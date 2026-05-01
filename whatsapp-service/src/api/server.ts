import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { logger } from "../logger";
import { router } from "./routes";
import { authMiddleware, errorHandler } from "./middleware";

const limiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em breve." },
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

export function buildServer() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins.length > 0
        ? (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) cb(null, true);
            else cb(new Error("Origem não permitida pelo CORS"));
          }
        : false,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-API-Key"],
    })
  );
  app.use(limiter);
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

  app.use("/api/v1", authMiddleware, router);

  app.use(errorHandler as any);

  return app;
}

export function startServer(): void {
  const app = buildServer();
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "WhatsApp API iniciada");
  });
}
