import { downloadMediaMessage, type proto, type WASocket } from "@whiskeysockets/baileys";
import axios from "axios";
import { resolve4, resolve6 } from "dns/promises";
import { logger } from "../logger";
import { config } from "../config";
import { saveMessage, upsertContact, listWebhooksBySession } from "../convex/client";
import { getWebhooksCache, setWebhooksCache, type WebhookCacheEntry, getSessionName } from "../cache/redis";
import type { InboundMessage, OutboundMessage } from "../queue/rabbitmq";

type PublishFn = (msg: InboundMessage) => void;

export async function handleIncomingMessage(
  sessionId: string,
  msg: proto.IWebMessageInfo,
  publish: PublishFn,
): Promise<void> {
  let jid = msg.key.remoteJid ?? "";
  if (jid.endsWith("@lid") && (msg.key as any).senderPn) {
    jid = (msg.key as any).senderPn;
  }

  const messageId = msg.key.id ?? "";
  const timestamp = Number(msg.messageTimestamp ?? Date.now() / 1000);
  const pushName = msg.pushName ?? undefined;
  const phone = jid.split("@")[0];
  
  let participant = msg.key.participant ?? undefined;
  if (participant?.endsWith("@lid") && (msg.key as any).senderPn) {
    participant = (msg.key as any).senderPn;
  }
  const isGroup = jid.endsWith("@g.us");
  const fromMe = msg.key.fromMe ?? false;

  let type = Object.keys(msg.message ?? {})[0] ?? "unknown";
  if (type === "conversation" || type === "extendedTextMessage") {
    type = "text";
  }
  const text =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.imageMessage?.caption ??
    msg.message?.videoMessage?.caption ??
    msg.message?.documentMessage?.caption ??
    undefined;

  let media: { mimetype: string; base64: string; fileName?: string } | undefined;
  const msgMsg = msg.message;
  
  if (msgMsg && (msgMsg.imageMessage || msgMsg.videoMessage || msgMsg.documentMessage || msgMsg.audioMessage || msgMsg.stickerMessage)) {
    try {
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: logger as any, reuploadRequest: async (msg: any) => msg } as any
      ) as Buffer;

      let mimetype = "";
      let fileName = "";
      
      if (msgMsg.imageMessage) mimetype = msgMsg.imageMessage.mimetype || "image/jpeg";
      if (msgMsg.videoMessage) mimetype = msgMsg.videoMessage.mimetype || "video/mp4";
      if (msgMsg.audioMessage) mimetype = msgMsg.audioMessage.mimetype || "audio/ogg";
      if (msgMsg.stickerMessage) mimetype = msgMsg.stickerMessage.mimetype || "image/webp";
      if (msgMsg.documentMessage) {
        mimetype = msgMsg.documentMessage.mimetype || "application/octet-stream";
        fileName = msgMsg.documentMessage.fileName || msgMsg.documentMessage.title || "";
      }

      media = {
        mimetype,
        base64: buffer.toString('base64'),
        fileName: fileName || undefined
      };
    } catch (error) {
      logger.error({ error, messageId }, "Falha ao baixar mídia da mensagem");
    }
  }

  const inbound: InboundMessage = {
    api: {
      url: config.apiUrl,
      instanceName: config.instanceName,
    },
    sessionId,
    from: jid,
    fromMe,
    participant,
    isGroup,
    messageId,
    type,
    text,
    timestamp,
    pushName,
    media,
    raw: msg,
  };

  publish(inbound);

  await Promise.allSettled([
    saveMessage({
      sessionId,
      messageId,
      from: jid,
      to: sessionId,
      type,
      text,
      timestamp,
      direction: "inbound",
      status: "received",
    }),
    upsertContact({ sessionId, jid, name: pushName, phone }),
    notifyWebhook(inbound),
  ]);
}

export async function sendTextMessage(
  sock: WASocket,
  to: string,
  text: string,
): Promise<proto.IWebMessageInfo | undefined> {
  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  const sent = await sock.sendMessage(jid, { text });
  return sent;
}

export async function sendOutboundMessage(
  sock: WASocket,
  msg: OutboundMessage,
): Promise<void> {
  const jid = msg.to.includes("@") ? msg.to : `${msg.to}@s.whatsapp.net`;

  if (msg.mediaUrl) {
    await sock.sendMessage(jid, {
      [msg.mediaType ?? "image"]: { url: msg.mediaUrl },
      caption: msg.caption,
    } as any);
    return;
  }

  if (msg.text) {
    await sock.sendMessage(jid, { text: msg.text });
  }
}

async function resolveWebhooksForSession(sessionId: string): Promise<WebhookCacheEntry[]> {
  const cached = await getWebhooksCache(sessionId);
  if (cached) return cached;

  const webhooks = await listWebhooksBySession(sessionId);
  const entries: WebhookCacheEntry[] = webhooks.map((w: any) => ({
    id: w._id,
    url: w.url,
    events: w.events,
  }));
  await setWebhooksCache(sessionId, entries);
  return entries;
}

export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

export async function assertSafeUrl(urlStr: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(urlStr); } catch { throw new Error("URL de webhook inválida"); }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Protocolo de webhook não permitido");
  }
  const hostname = parsed.hostname;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Destino de webhook não permitido (IP privado)");
    return;
  }
  const [r4, r6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const resolved = [
    ...(r4.status === "fulfilled" ? r4.value : []),
    ...(r6.status === "fulfilled" ? r6.value : []),
  ];
  for (const ip of resolved) {
    if (isPrivateIp(ip)) throw new Error("Destino de webhook não permitido (IP privado)");
  }
}

async function postToWebhook(url: string, payload: object): Promise<void> {
  try {
    await assertSafeUrl(url);
    await axios.post(url, payload, { timeout: 15000, maxBodyLength: Infinity });
  } catch (err) {
    logger.warn({ err, url }, "Falha ao notificar webhook");
  }
}

async function notifyWebhook(msg: InboundMessage): Promise<void> {
  const webhooks = await resolveWebhooksForSession(msg.sessionId);
  if (!webhooks.length) return;

  const instanceName = await getSessionName(msg.sessionId);
  const { raw: _raw, ...safeMsg } = msg;
  const payload = { event: "MESSAGES_UPSERT", sessionId: msg.sessionId, instanceName, data: safeMsg };
  await Promise.allSettled(
    webhooks
      .filter((w) => w.events.length === 0 || w.events.includes("MESSAGES_UPSERT"))
      .map((w) => postToWebhook(w.url, payload))
  );
}

export async function sendWebhookEvent(sessionId: string, event: string, data: unknown): Promise<void> {
  const webhooks = await resolveWebhooksForSession(sessionId);
  if (!webhooks.length) return;

  const instanceName = await getSessionName(sessionId);
  const payload = { event, sessionId, instanceName, data };
  await Promise.allSettled(
    webhooks
      .filter((w) => w.events.length === 0 || w.events.includes(event))
      .map((w) => postToWebhook(w.url, payload))
  );
}
