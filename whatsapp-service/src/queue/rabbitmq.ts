import amqplib, { type Channel, type ChannelModel } from "amqplib";
import { config } from "../config";
import { logger } from "../logger";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  const conn = await amqplib.connect(config.rabbitmq.url);
  connection = conn;
  const ch = await conn.createChannel();
  channel = ch;

  await ch.assertExchange(config.rabbitmq.exchanges.main, "topic", { durable: true });

  for (const queue of Object.values(config.rabbitmq.queues)) {
    await ch.assertQueue(queue, { durable: true });
  }

  // Binding de roteamento
  await ch.bindQueue(
    config.rabbitmq.queues.inbound,
    config.rabbitmq.exchanges.main,
    "message.inbound.*",
  );
  await ch.bindQueue(
    config.rabbitmq.queues.outbound,
    config.rabbitmq.exchanges.main,
    "message.outbound.*",
  );

  conn.on("error", (err) => logger.error({ err }, "Erro na conexão RabbitMQ"));
  conn.on("close", () => {
    logger.warn("Conexão RabbitMQ fechada — tentando reconectar em 5s");
    setTimeout(connectRabbitMQ, 5000);
  });

  logger.info("RabbitMQ conectado");
}

export function getChannel(): Channel {
  if (!channel) throw new Error("RabbitMQ channel não inicializado");
  return channel;
}

export async function closeRabbitMQ(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}

// ─── Publicadores ─────────────────────────────────────────────────────────────

export interface OutboundMessage {
  sessionId: string;
  to: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  caption?: string;
  correlationId?: string;
}

export interface InboundMessage {
  api?: {
    url: string;
    instanceName: string;
  };
  sessionId: string;
  from: string;
  fromMe: boolean;
  participant?: string;
  isGroup: boolean;
  messageId: string;
  type: string;
  text?: string;
  timestamp: number;
  pushName?: string;
  media?: {
    mimetype: string;
    base64: string;
    fileName?: string;
  };
  raw?: any;
}

export function publishOutbound(msg: OutboundMessage): void {
  const ch = getChannel();
  ch.publish(
    config.rabbitmq.exchanges.main,
    `message.outbound.${msg.sessionId}`,
    Buffer.from(JSON.stringify(msg)),
    { persistent: true, contentType: "application/json" },
  );
}

export function publishInbound(msg: InboundMessage): void {
  const ch = getChannel();
  ch.publish(
    config.rabbitmq.exchanges.main,
    `message.inbound.${msg.sessionId}`,
    Buffer.from(JSON.stringify(msg)),
    { persistent: true, contentType: "application/json" },
  );
}

// ─── Consumidor de mensagens de saída ─────────────────────────────────────────

type OutboundHandler = (msg: OutboundMessage) => Promise<void>;

export async function consumeOutbound(handler: OutboundHandler): Promise<void> {
  const ch = getChannel();
  ch.prefetch(5);

  await ch.consume(config.rabbitmq.queues.outbound, async (raw) => {
    if (!raw) return;
    try {
      const msg: OutboundMessage = JSON.parse(raw.content.toString());
      await handler(msg);
      ch.ack(raw);
    } catch (err) {
      logger.error({ err }, "Erro ao processar mensagem da fila outbound");
      ch.nack(raw, false, false);

      ch.sendToQueue(
        config.rabbitmq.queues.failed,
        raw.content,
        { persistent: true, contentType: "application/json" },
      );
    }
  });
}
