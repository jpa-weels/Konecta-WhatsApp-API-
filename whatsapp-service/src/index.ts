import { config } from "./config";
import { logger } from "./logger";
import { connectRabbitMQ, consumeOutbound } from "./queue/rabbitmq";
import { getRedis } from "./cache/redis";
import { startServer } from "./api/server";
import { restorePersistedSessions, getSession } from "./whatsapp/connection";
import { sendOutboundMessage } from "./whatsapp/handlers";

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

  // Restaura sessões que estavam ativas antes de reiniciar
  await restorePersistedSessions();

  // HTTP API
  startServer();
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Falha crítica ao iniciar a aplicação");
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM recebido — encerrando");
  process.exit(0);
});
