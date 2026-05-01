import path from "path";
import fs from "fs";
import makeWASocket, {
  type WASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { logger } from "../logger";
import { config } from "../config";
import { saveQR, setSessionStatus, setSessionPhone, deleteSessionCreds } from "../cache/redis";
import { saveSession, getSessionData } from "../convex/client";
import { publishInbound } from "../queue/rabbitmq";
import { handleIncomingMessage, sendWebhookEvent } from "./handlers";

const sessions = new Map<string, WASocket>();

export function getSession(sessionId: string): WASocket | undefined {
  return sessions.get(sessionId);
}

export function getAllSessions(): string[] {
  return [...sessions.keys()];
}

export async function createSession(sessionId: string): Promise<void> {
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, "Sessão já existe");
    return;
  }

  try {
    const existing = await getSessionData(sessionId);
    if (!existing) {
      await saveSession({
        sessionId,
        status: "initializing",
      });
    }
  } catch (err) {
    logger.warn({ err, sessionId }, "Falha ao definir sessão inicial");
  }

  const sessionPath = path.join(config.sessions.path, sessionId);
  fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  let version: [number, number, number];
  if (config.waVersion) {
    version = config.waVersion.split(",").map(Number) as [number, number, number];
    logger.info({ version }, "Usando versão WA fixa");
  } else {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    logger.info({ version }, "Usando versão WA mais recente");
  }

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    printQRInTerminal: false,
    logger: logger.child({ sessionId }) as any,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sessions.set(sessionId, sock);
  await setSessionStatus(sessionId, "connecting");

  // ─── Eventos ──────────────────────────────────────────────────────────────

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const qrBase64 = await QRCode.toDataURL(qr);
      await saveQR(sessionId, qrBase64);
      await setSessionStatus(sessionId, "qr_ready");
      logger.info({ sessionId }, "QR code gerado");
      await sendWebhookEvent(sessionId, "QRCODE_UPDATED", { qr: qrBase64 });
    }

    if (connection === "open") {
      const phone = sock.user?.id?.split(":")[0] ?? "";
      await setSessionStatus(sessionId, "connected");
      if (phone) await setSessionPhone(sessionId, phone);
      await saveSession({ sessionId, status: "connected", phone });
      logger.info({ sessionId, phone }, "Sessão conectada");
      await sendWebhookEvent(sessionId, "CONNECTION_UPDATE", { connection: "open", phone });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn({ sessionId, statusCode, shouldReconnect }, "Sessão desconectada");

      sessions.delete(sessionId);
      await setSessionStatus(sessionId, "disconnected");
      await saveSession({ sessionId, status: "disconnected" });
      await sendWebhookEvent(sessionId, "CONNECTION_UPDATE", { connection: "close", statusCode, shouldReconnect });

      if (shouldReconnect) {
        setTimeout(() => createSession(sessionId), 5000);
      } else {
        await deleteSessionCreds(sessionId);
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info({ sessionId }, "Sessão removida (logout)");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;

    for (const msg of msgs) {
      if (!msg.message || isJidBroadcast(msg.key.remoteJid ?? "")) continue;
      await handleIncomingMessage(sessionId, msg, publishInbound);
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      if (update.update.status) {
        logger.debug({ sessionId, key: update.key, status: update.update.status }, "Status atualizado");
      }
    }
    await sendWebhookEvent(sessionId, "MESSAGES_UPDATE", updates);
  });

  sock.ev.on("messages.delete", async (item) => {
    await sendWebhookEvent(sessionId, "MESSAGES_DELETE", item);
  });

  sock.ev.on("messaging-history.set", async ({ messages, chats, contacts, isLatest }) => {
    await sendWebhookEvent(sessionId, "MESSAGES_SET", { messagesCount: messages.length, chatsCount: chats.length, contactsCount: contacts.length, isLatest });
  });

  sock.ev.on("contacts.upsert", async (contacts) => {
    await sendWebhookEvent(sessionId, "CONTACTS_UPSERT", contacts);
  });

  sock.ev.on("contacts.update", async (updates) => {
    await sendWebhookEvent(sessionId, "CONTACTS_UPDATE", updates);
  });

  sock.ev.on("groups.upsert", async (groups) => {
    await sendWebhookEvent(sessionId, "GROUPS_UPSERT", groups);
  });

  sock.ev.on("groups.update", async (updates) => {
    await sendWebhookEvent(sessionId, "GROUPS_UPDATE", updates);
  });

  sock.ev.on("group-participants.update", async (update) => {
    await sendWebhookEvent(sessionId, "GROUP_PARTICIPANTS_UPDATE", update);
  });
}

export async function disconnectSession(sessionId: string): Promise<void> {
  const sock = sessions.get(sessionId);
  if (!sock) throw new Error(`Sessão ${sessionId} não encontrada`);
  await sock.logout();
  sessions.delete(sessionId);
}

export async function restartSession(sessionId: string): Promise<void> {
  const sock = sessions.get(sessionId);
  if (!sock) {
    await createSession(sessionId);
    return;
  }
  // Close WS without logout — the connection.update "close" handler will auto-reconnect
  sock.ws.close();
}

export async function restorePersistedSessions(): Promise<void> {
  const sessionsRoot = config.sessions.path;
  if (!fs.existsSync(sessionsRoot)) return;

  const dirs = fs.readdirSync(sessionsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  logger.info({ count: dirs.length }, "Restaurando sessões persistidas");

  for (const sessionId of dirs) {
    await createSession(sessionId);
  }
}
