import { logger } from "./logger";
import { connectRabbitMQ, consumeOutbound, consumeInbound, closeRabbitMQ } from "./queue/rabbitmq";
import { getRedis, closeRedis } from "./cache/redis";
import { startServer } from "./api/server";
import { restorePersistedSessions, getSession } from "./whatsapp/connection";
import { sendOutboundMessage, notifyWebhook } from "./whatsapp/handlers";
import { saveMessage, upsertContact } from "./convex/client";

async function bootstrap(): Promise<void> {
  logger.info("Iniciando WhatsApp API...");

  // Redis — testa conexão
  const redis = getRedis();
  await redis.ping();
  logger.info("Redis OK");

  // RabbitMQ
  await connectRabbitMQ();

  // Consumidor de mensagens enfileiradas para envio
  await consumeOutbound(async (msg) => {
    const sock = getSession(msg.sessionId);
    if (!sock) throw new Error(`Sessão '${msg.sessionId}' não conectada`);
    await sendOutboundMessage(sock, msg);
    logger.info({ sessionId: msg.sessionId, to: msg.to }, "Mensagem da fila enviada");
  });

  // Consumidor de mensagens recebidas — persiste no Convex e notifica webhooks
  await consumeInbound(async (msg) => {
    // Webhook é fire-and-forget: latência do cliente não atrasa o ack nem bloqueia persistência
    notifyWebhook(msg).catch((err) =>
      logger.warn({ err, sessionId: msg.sessionId }, "Falha ao notificar webhook (ignorada)"),
    );

    const results = await Promise.allSettled([
      saveMessage({
        sessionId: msg.sessionId,
        messageId: msg.messageId,
        from: msg.from,
        to: msg.sessionId,
        type: msg.type,
        text: msg.text,
        timestamp: msg.timestamp,
        direction: "inbound",
        status: "received",
        storageId: msg.media?.storageId,
        mediaUrl: msg.media?.url,
      }),
      msg.from && !msg.fromMe
        ? upsertContact({
            sessionId: msg.sessionId,
            jid: msg.from,
            name: msg.pushName,
            phone: msg.from.split("@")[0],
          })
        : Promise.resolve(),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        logger.error(
          { err: result.reason, sessionId: msg.sessionId, messageId: msg.messageId },
          "Falha na persistência da mensagem inbound",
        );
      }
    }
  });

  // HTTP API — sobe antes de restaurar sessões para não bloquear requests durante bootstrap
  const httpServer = startServer();

  // Restaura sessões que estavam ativas antes de reiniciar
  await restorePersistedSessions();

  // Graceful shutdown — drena HTTP, fecha filas e cache antes de sair
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "Sinal recebido — iniciando graceful shutdown");

    // Para de aceitar novas conexões HTTP; aguarda requests em andamento
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    logger.info("HTTP server fechado");

    // Fecha canal RabbitMQ — mensagens em flight recebem nack e voltam à fila
    await closeRabbitMQ();
    logger.info("RabbitMQ fechado");

    await closeRedis();
    logger.info("Redis fechado");

    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Falha crítica ao iniciar a aplicação");
  process.exit(1);
});
