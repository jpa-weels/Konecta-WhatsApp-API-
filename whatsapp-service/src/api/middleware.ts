import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { logger } from "../logger";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-api-key"];
  if (!key || key !== config.apiSecret) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  next();
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, method: req.method, url: req.url }, "Erro interno não tratado");
  res.status(500).json({ error: "Erro interno do servidor", message: err.message });
}
