import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { resolve as resolvePath } from "path";
import { config } from "../config";
import { logger } from "../logger";
import { router } from "./routes";
import { authMiddleware, errorHandler } from "./middleware";
import { getQR } from "../cache/redis";
import { logoBase64 } from "./logoBase64";
import { acceptBase64 } from "./acceptBase64";

const limiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-api-key"] as string) ?? req.ip ?? "unknown",
  message: { error: "Muitas requisições. Tente novamente em breve." },
});


export function buildServer() {
  const app = express();

  app.use(helmet());
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : null;

  app.use(
    cors({
      origin: allowedOrigins ?? true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-API-Key"],
    })
  );
  app.use(limiter);
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

  // Rota pública — exibe o QR code em HTML para escanear no browser
  app.get("/sessions/:id/qr-view", async (req: Request<{ id: string }>, res: Response) => {
    const sessionId = req.params.id;
    
    // Verifica primeiro se já está conectada — Convex é a fonte de verdade do status
    const { getSessionData } = await import("../convex/client");
    const session = await getSessionData(sessionId);
    const status = session?.status ?? null;

    if (status === "connected") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Conectado — ${sessionId}</title>
  <style>
    body { margin:0; background:#0d0d0d; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; color:#ccc; gap:16px; text-align:center; }
    h1 { color:#4caf50; margin:0; font-size:24px; }
    p { font-size:16px; opacity:.8; }
    .logo { height: 64px; margin-bottom: 8px; object-fit: contain; }
  </style>
</head>
<body>
  <img class="logo" src="${logoBase64}" alt="Logo">
  <h1>✅ Conexão Bem-Sucedida!</h1>
  <p>Sua sessão <b>${sessionId}</b> está conectada e pronta para enviar mensagens.</p>
</body>
</html>`);
      return;
    }

    const qr = await getQR(sessionId);
    if (!qr) {
      res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR expirado</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0d0d;color:#888"><p>QR code não disponível ou já expirou. Recarregue para tentar novamente.</p></body></html>`);
      return;
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QR Code — ${sessionId}</title>
  <style>
    body { margin:0; background:#0d0d0d; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; color:#ccc; gap:16px; }
    img.qr  { width:280px; height:280px; border-radius:12px; background:#fff; padding:12px; }
    .logo { height: 64px; margin-bottom: 8px; object-fit: contain; }
    p    { font-size:14px; opacity:.6; }
    small{ font-size:11px; opacity:.35; }
  </style>
</head>
<body>
  <img class="logo" src="${logoBase64}" alt="Logo">
  <img id="main-image" class="qr" src="${qr}" alt="QR Code WhatsApp">
  <p id="message-text">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
  <small>Sessão: ${sessionId}</small>
  <script>
    const acceptImage = "${acceptBase64}";
    setInterval(async () => {
      try {
        const url = window.location.href.split('?')[0] + '?t=' + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        if (text.includes("Bem-Sucedida")) {
          const img = document.getElementById('main-image');
          if (img.src !== acceptImage) {
            img.src = acceptImage;
            img.style.background = 'transparent';
            img.style.width = '160px';
            img.style.height = '160px';
            document.getElementById('message-text').innerHTML = '<span style="color:#4caf50; font-size:24px; font-weight:bold;">✅ Conexão Bem-Sucedida!</span><br><br>Sua sessão está conectada e pronta para enviar mensagens.';
          }
        } else if (text.includes("expirado")) {
          window.location.reload();
        }
      } catch(e) {}
    }, 2000);
  </script>
</body>
</html>`);
  });

  app.use("/media", express.static(resolvePath(config.media.path), { maxAge: "7d" }));

  app.use("/api/v1", authMiddleware, router);

  app.use(errorHandler as any);

  return app;
}

export function startServer(): import("http").Server {
  const app = buildServer();
  return app.listen(config.port, () => {
    logger.info({ port: config.port }, "WhatsApp API iniciada");
  });
}

