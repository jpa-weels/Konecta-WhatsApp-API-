import { Router, type Request, type Response, type NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import {
  createSession,
  disconnectSession,
  restartSession,
  getSession,
  getAllSessions,
} from "../whatsapp/connection";
import { sendTextMessage, sendOutboundMessage, assertSafeUrl } from "../whatsapp/handlers";
import {
  getQR,
  getSessionPhone,
  setSessionName,
} from "../cache/redis";
import { publishOutbound, type OutboundMessage } from "../queue/rabbitmq";
import { getSessionData, saveSession, createWebhook, updateWebhookRecord, deleteWebhook, listWebhooks, getMessageAnalytics, purgeDatabase, removeSession, listAllSessions } from "../convex/client";
import { invalidateWebhooksCache } from "../cache/redis";
import { collectSystemMetrics } from "../metrics/system";
import { logger } from "../logger";

const router = Router();

const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-api-key"] as string) ?? req.ip ?? "unknown",
  message: { error: "Limite de envio de mensagens atingido. Tente novamente em breve." },
});

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return false;
  }
  return true;
}

// Formato seguro para sessionId: alfanumérico + hífen + underscore, máx 64 chars
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const validSessionIdParam = param("id")
  .matches(SESSION_ID_REGEX)
  .withMessage("sessionId inválido — use apenas letras, números, - e _");

// ─── Sessões ──────────────────────────────────────────────────────────────────

/** POST /sessions — cria nova sessão */
router.post(
  "/sessions",
  body("sessionId").optional().matches(SESSION_ID_REGEX).withMessage("sessionId inválido — use apenas letras, números, - e _"),
  async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  const sessionId: string = req.body.sessionId ?? uuidv4();
  const webhookUrl: string | undefined = req.body.webhookUrl;
  const name: string | undefined = req.body.name;
  try {
    await saveSession({ sessionId, name, status: "initializing", webhookUrl });
    if (name) await setSessionName(sessionId, name);
    await createSession(sessionId);
    res.status(201).json({ sessionId, message: "Sessão criada, aguarde o QR code" });
  } catch (err: any) {
    logger.error({ err, sessionId }, "Erro ao criar sessão");
    res.status(500).json({ error: err.message });
  }
});

/** GET /sessions — lista sessões ativas */
router.get("/sessions", async (_req: Request, res: Response) => {
  const sessions = await listAllSessions();
  const details = await Promise.all(
    sessions.map(async (s: any) => ({
      id: s.sessionId,
      status: s.status,
      name: s.name,
      phone: s.phone,
    }))
  );
  res.json({ sessions: details });
});

/** GET /sessions/:id/status */
router.get("/sessions/:id/status", validSessionIdParam, async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  const id = req.params.id as string;
  // Status vem do Convex (fonte de verdade única)
  const session = await getSessionData(id);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }
  // Redis ainda útil para leitura rápida do phone (cache efêmero)
  const phone = await getSessionPhone(id);
  res.json({ sessionId: id, status: session.status, phone: phone ?? session.phone ?? undefined });
});

/** GET /sessions/:id/qr — retorna o QR code em base64 */
router.get("/sessions/:id/qr", validSessionIdParam, async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  const id = req.params.id as string;
  const qr = await getQR(id);
  if (!qr) {
    res.status(404).json({ error: "QR code não disponível. Sessão pode já estar conectada ou expirou." });
    return;
  }
  res.json({ sessionId: id, qr });
});

/** POST /sessions/:id/restart — reinicia sessão sem logout */
router.post("/sessions/:id/restart", validSessionIdParam, async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  const id = req.params.id as string;
  try {
    await restartSession(id);
    res.json({ message: "Sessão reiniciada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /sessions/:id — desconecta sessão */
router.delete("/sessions/:id", validSessionIdParam, async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  const id = req.params.id as string;
  try {
    await disconnectSession(id);
    await removeSession(id);
    res.json({ message: "Sessão desconectada" });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});
/** PUT /sessions/:id/webhook — atualiza o webhookUrl e eventos da sessão */
router.put(
  "/sessions/:id/webhook",
  validSessionIdParam,
  body("webhookUrl").isURL().withMessage("Deve ser uma URL válida"),
  body("webhookEvents").optional().isArray().withMessage("Deve ser um array de strings"),
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;
    const id = req.params.id as string;
    const { webhookUrl, webhookEvents } = req.body;

    try {
      await assertSafeUrl(webhookUrl);
      const existing = await getSessionData(id);
      const status = existing?.status || "disconnected";
      await saveSession({ sessionId: id, status, webhookUrl, webhookEvents });
      await invalidateWebhooksCache(id);
      res.json({ message: "Webhook atualizado com sucesso!", webhookUrl, webhookEvents });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/** GET /webhooks */
router.get("/webhooks", async (_req: Request, res: Response) => {
  const webhooks = await listWebhooks();
  res.json({ webhooks });
});

/** POST /webhooks */
router.post(
  "/webhooks",
  body("url").isURL().withMessage("Deve ser uma URL válida"),
  body("events").isArray().withMessage("Deve ser um array de strings"),
  body("sessionIds").isArray().withMessage("Deve ser um array de sessionIds"),
  body("name").optional().isString(),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    const { url, events, sessionIds, name } = req.body;
    try {
      await assertSafeUrl(url);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }
    try {
      const id = await createWebhook({ url, events, sessionIds, name });
      await Promise.all(sessionIds.map((sid: string) => invalidateWebhooksCache(sid)));
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /webhooks/:id */
router.put(
  "/webhooks/:id",
  body("url").optional().isURL(),
  body("events").optional().isArray(),
  body("sessionIds").optional().isArray(),
  body("name").optional().isString(),
  body("enabled").optional().isBoolean(),
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;
    const id = req.params.id as string;
    const { url, events, sessionIds, name, enabled } = req.body;

    if (url) {
      try {
        await assertSafeUrl(url);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
    }

    const before = (await listWebhooks()).find((w: any) => w._id === id);
    await updateWebhookRecord({ id, url, events, sessionIds, name, enabled });

    const affectedSessions = new Set<string>([
      ...(before?.sessionIds ?? []),
      ...(sessionIds ?? []),
    ]);
    await Promise.all([...affectedSessions].map((sid) => invalidateWebhooksCache(sid)));
    res.json({ message: "Webhook atualizado" });
  }
);

/** DELETE /webhooks/:id */
router.delete("/webhooks/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const before = (await listWebhooks()).find((w: any) => w._id === id);
  await deleteWebhook(id);
  await Promise.all((before?.sessionIds ?? []).map((sid: string) => invalidateWebhooksCache(sid)));
  res.json({ message: "Webhook removido" });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/** GET /analytics */
router.get("/analytics", async (_req: Request, res: Response) => {
  const [msgStats, sessions, webhooks] = await Promise.all([
    getMessageAnalytics(30),
    listAllSessions(),
    listWebhooks(),
  ]);

  const byStatus = sessions.reduce((acc: Record<string, number>, s: any) => {
    const k = s.status ?? "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    messages: msgStats,
    sessions: {
      total: sessions.length,
      connected: byStatus["connected"] || 0,
      byStatus,
    },
    webhooks: {
      total: webhooks.length,
      active: (webhooks as any[]).filter((w) => w.enabled).length,
      paused: (webhooks as any[]).filter((w) => !w.enabled).length,
      totalEventConfigs: (webhooks as any[]).reduce((s, w) => s + (w.events?.length || 0), 0),
    },
  });
});

// ─── Mensagens ────────────────────────────────────────────────────────────────

/** POST /messages/send — envia mensagem imediata (sessão já conectada) */
router.post(
  "/messages/send",
  sendLimiter,
  body("sessionId").isString().notEmpty(),
  body("to").isString().notEmpty(),
  body("text").optional().isString(),
  body("mediaUrl").optional().isURL(),
  body("mediaType").optional().isIn(["image", "video", "audio", "document"]),
  body("caption").optional().isString(),
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { sessionId, to, text, mediaUrl, mediaType, caption } = req.body;

    const sock = getSession(sessionId);
    if (!sock) {
      res.status(404).json({ error: `Sessão '${sessionId}' não está conectada` });
      return;
    }

    try {
      const msg: OutboundMessage = { sessionId, to, text, mediaUrl, mediaType, caption };
      await sendOutboundMessage(sock, msg);
      res.json({ message: "Mensagem enviada" });
    } catch (err: any) {
      logger.error({ err, sessionId, to }, "Erro ao enviar mensagem");
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /messages/queue — enfileira mensagem no RabbitMQ */
router.post(
  "/messages/queue",
  sendLimiter,
  body("sessionId").isString().notEmpty(),
  body("to").isString().notEmpty(),
  body("text").optional().isString(),
  body("mediaUrl").optional().isURL(),
  body("mediaType").optional().isIn(["image", "video", "audio", "document"]),
  body("caption").optional().isString(),
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { sessionId, to, text, mediaUrl, mediaType, caption } = req.body;
    const correlationId = uuidv4();

    try {
      publishOutbound({ sessionId, to, text, mediaUrl, mediaType, caption, correlationId });
      res.status(202).json({ message: "Mensagem enfileirada", correlationId });
    } catch (err: any) {
      logger.error({ err }, "Erro ao enfileirar mensagem");
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── Admin ────────────────────────────────────────────────────────────────────────────

/** DELETE /admin/purge — apaga todos os dados do Convex (mensagens, contatos, sessões, webhooks) */
router.delete(
  "/admin/purge",
  body("confirm").equals("PURGE_ALL").withMessage("Envie { \"confirm\": \"PURGE_ALL\" } para confirmar"),
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;
    try {
      const totals: Record<string, number> = {};
      // Loop até zerar — cada chamada deleta até 500 docs/tabela (limite Convex)
      let hasMore = true;
      while (hasMore) {
        const counts = await purgeDatabase();
        for (const [table, n] of Object.entries(counts)) {
          totals[table] = (totals[table] ?? 0) + n;
        }
        hasMore = Object.values(counts).some((n) => n > 0);
      }
      logger.warn({ totals }, "Base de dados purgada via admin endpoint");
      res.json({ message: "Base de dados limpa com sucesso", counts: totals });
    } catch (err: any) {
      logger.error({ err }, "Erro ao purgar base de dados");
      res.status(500).json({ error: err.message });
    }
  },
);

/** GET /admin/metrics — métricas do sistema: CPU, memória, disco, containers Docker */
router.get("/admin/metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = await collectSystemMetrics();
    res.json(metrics);
  } catch (err: any) {
    logger.error({ err }, "Erro ao coletar métricas do sistema");
    res.status(500).json({ error: err.message });
  }
});

export { router };
