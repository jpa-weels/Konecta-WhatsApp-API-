import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../logger";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on("connect", () => logger.info("Redis conectado"));
    client.on("error", (err) => logger.error({ err }, "Erro no Redis"));
    client.on("reconnecting", () => logger.warn("Redis reconectando..."));
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

// ─── Helpers de sessão ────────────────────────────────────────────────────────

const SESSION_PREFIX = "wa:session:";
const QR_PREFIX = "wa:qr:";
const STATUS_PREFIX = "wa:status:";

export async function saveSessionCreds(sessionId: string, creds: object): Promise<void> {
  const redis = getRedis();
  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    config.redis.sessionTTL,
    JSON.stringify(creds),
  );
}

export async function getSessionCreds(sessionId: string): Promise<object | null> {
  const redis = getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteSessionCreds(sessionId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}

export async function saveQR(sessionId: string, qrBase64: string): Promise<void> {
  const redis = getRedis();
  await redis.setex(`${QR_PREFIX}${sessionId}`, config.redis.qrTTL, qrBase64);
}

export async function getQR(sessionId: string): Promise<string | null> {
  return getRedis().get(`${QR_PREFIX}${sessionId}`);
}

export async function setSessionStatus(
  sessionId: string,
  status: "connecting" | "qr_ready" | "connected" | "disconnected",
): Promise<void> {
  await getRedis().set(`${STATUS_PREFIX}${sessionId}`, status);
}

export async function getSessionStatus(sessionId: string): Promise<string | null> {
  return getRedis().get(`${STATUS_PREFIX}${sessionId}`);
}

export async function listActiveSessions(): Promise<string[]> {
  const redis = getRedis();
  const keys = await redis.keys(`${STATUS_PREFIX}*`);
  return keys.map((k) => k.replace(STATUS_PREFIX, ""));
}

// ─── Cache de telefone da sessão ─────────────────────────────────────────────

const PHONE_PREFIX = "wa:phone:";

export async function setSessionPhone(sessionId: string, phone: string): Promise<void> {
  await getRedis().set(`${PHONE_PREFIX}${sessionId}`, phone);
}

export async function getSessionPhone(sessionId: string): Promise<string | null> {
  return getRedis().get(`${PHONE_PREFIX}${sessionId}`);
}

// ─── Cache de nome da sessão ─────────────────────────────────────────────────

const NAME_PREFIX = "wa:name:";

export async function setSessionName(sessionId: string, name: string): Promise<void> {
  await getRedis().set(`${NAME_PREFIX}${sessionId}`, name);
}

export async function getSessionName(sessionId: string): Promise<string | null> {
  return getRedis().get(`${NAME_PREFIX}${sessionId}`);
}

// ─── Cache de webhooks por sessão (array de webhooks ativos) ─────────────────

const WEBHOOK_PREFIX = "wa:webhooks:";
const WEBHOOK_TTL = 3600;

export interface WebhookCacheEntry {
  id: string;
  url: string;
  events: string[];
}

export async function setWebhooksCache(sessionId: string, data: WebhookCacheEntry[]): Promise<void> {
  await getRedis().setex(`${WEBHOOK_PREFIX}${sessionId}`, WEBHOOK_TTL, JSON.stringify(data));
}

export async function getWebhooksCache(sessionId: string): Promise<WebhookCacheEntry[] | null> {
  const raw = await getRedis().get(`${WEBHOOK_PREFIX}${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function invalidateWebhooksCache(sessionId: string): Promise<void> {
  await getRedis().del(`${WEBHOOK_PREFIX}${sessionId}`);
}
