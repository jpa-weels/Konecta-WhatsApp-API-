import { ConvexHttpClient } from "convex/browser";
import { config } from "../config";
import { logger } from "../logger";

let convexClient: ConvexHttpClient | null = null;

export function getConvex(): ConvexHttpClient {
  if (!convexClient) {
    convexClient = new ConvexHttpClient(config.convex.url);
    if (config.convex.adminKey) {
      // setAdminAuth is not in public types but exists at runtime for self-hosted backends
      (convexClient as any).setAdminAuth(config.convex.adminKey); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    logger.info({ url: config.convex.url }, "Convex client inicializado");
  }
  return convexClient;
}

// ─── Funções utilitárias que chamam as mutations/queries do Convex ────────────

import { api } from "./api";

export async function saveMessage(payload: {
  sessionId: string;
  messageId: string;
  from: string;
  to: string;
  type: string;
  text?: string;
  timestamp: number;
  direction: "inbound" | "outbound";
  status?: string;
}): Promise<string | null> {
  try {
    const client = getConvex();
    return await client.mutation(api.messages.save, payload);
  } catch (err) {
    logger.error({ err, payload }, "Erro ao salvar mensagem no Convex");
    return null;
  }
}

export async function updateMessageStatus(
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed",
): Promise<void> {
  try {
    await getConvex().mutation(api.messages.updateStatus, { messageId, status });
  } catch (err) {
    logger.error({ err, messageId, status }, "Erro ao atualizar status da mensagem");
  }
}

export async function upsertContact(payload: {
  sessionId: string;
  jid: string;
  name?: string;
  phone: string;
}): Promise<void> {
  try {
    await getConvex().mutation(api.contacts.upsert, payload);
  } catch (err) {
    logger.error({ err, payload }, "Erro ao salvar contato no Convex");
  }
}

export async function saveSession(payload: {
  sessionId: string;
  name?: string;
  status: string;
  phone?: string;
  webhookUrl?: string;
  webhookEvents?: string[];
}): Promise<void> {
  try {
    await getConvex().mutation(api.sessions.upsert, payload);
  } catch (err) {
    logger.error({ err, payload }, "Erro ao salvar sessão no Convex");
  }
}

export async function getSessionData(sessionId: string): Promise<any> {
  try {
    return await getConvex().query(api.sessions.get, { sessionId });
  } catch (err) {
    logger.error({ err, sessionId }, "Erro ao buscar sessão no Convex");
    return null;
  }
}

export async function createWebhook(payload: {
  name?: string;
  url: string;
  events: string[];
  sessionIds: string[];
}): Promise<string | null> {
  try {
    return await getConvex().mutation(api.webhooks.create, payload);
  } catch (err) {
    logger.error({ err, payload }, "Erro ao criar webhook no Convex");
    return null;
  }
}

export async function updateWebhookRecord(payload: {
  id: string;
  name?: string;
  url?: string;
  events?: string[];
  sessionIds?: string[];
  enabled?: boolean;
}): Promise<void> {
  try {
    await getConvex().mutation(api.webhooks.update, payload);
  } catch (err) {
    logger.error({ err, payload }, "Erro ao atualizar webhook no Convex");
  }
}

export async function deleteWebhook(id: string): Promise<void> {
  try {
    await getConvex().mutation(api.webhooks.remove, { id });
  } catch (err) {
    logger.error({ err, id }, "Erro ao deletar webhook no Convex");
  }
}

export async function listWebhooks(): Promise<any[]> {
  try {
    return await getConvex().query(api.webhooks.list, {});
  } catch (err) {
    logger.error({ err }, "Erro ao listar webhooks no Convex");
    return [];
  }
}

export async function getMessageAnalytics(days = 30): Promise<any> {
  try {
    return await getConvex().query(api.messages.analytics, { days });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar analytics de mensagens");
    return { total: 0, inbound: 0, outbound: 0, byDay: {}, byType: {}, bySession: {} };
  }
}

export async function listWebhooksBySession(sessionId: string): Promise<any[]> {
  try {
    return await getConvex().query(api.webhooks.listBySession, { sessionId });
  } catch (err) {
    logger.error({ err, sessionId }, "Erro ao buscar webhooks da sessão no Convex");
    return [];
  }
}

export async function purgeDatabase(): Promise<Record<string, number>> {
  try {
    return await getConvex().mutation(api.admin.purgeAll, {});
  } catch (err) {
    logger.error({ err }, "Erro ao purgar banco de dados");
    throw err;
  }
}
