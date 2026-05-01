import dotenv from "dotenv";
import path from "path";
// Carrega .env e depois .env.local (sobrescreve), ambos relativos à raiz do projeto
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  apiSecret: required("API_SECRET"),
  apiUrl: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  instanceName: process.env.INSTANCE_NAME ?? "api-local",

  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    sessionTTL: 60 * 60 * 24 * 7, // 7 dias
    qrTTL: 60, // 60 segundos
  },

  rabbitmq: {
    url: required("RABBITMQ_URL"),
    queues: {
      outbound: "whatsapp.outbound",
      inbound: "whatsapp.inbound",
      failed: "whatsapp.failed",
    },
    exchanges: {
      main: "whatsapp.events",
    },
  },

  convex: {
    url: process.env.CONVEX_URL ?? "http://localhost:3210",
    adminKey: process.env.CONVEX_ADMIN_KEY ?? "",
  },

  sessions: {
    path: process.env.SESSIONS_PATH ?? "./sessions",
  },

  waVersion: process.env.WA_VERSION ?? "",

  webhook: {
    url: process.env.WEBHOOK_URL ?? "",
  },
};
