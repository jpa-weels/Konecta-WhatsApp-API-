import { readdir, rm, stat } from "fs/promises";
import { join, resolve as resolvePath } from "path";
import { config } from "../config";
import { logger } from "../logger";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export async function cleanupOldMedia(): Promise<void> {
  const baseDir = resolvePath(config.media.path);
  const now = Date.now();

  let sessionDirs: string[];
  try {
    sessionDirs = await readdir(baseDir);
  } catch {
    return; // pasta ainda não existe
  }

  for (const sessionId of sessionDirs) {
    const sessionDir = join(baseDir, sessionId);
    let files: string[];
    try {
      files = await readdir(sessionDir);
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(sessionDir, file);
      try {
        const { mtimeMs } = await stat(filePath);
        if (now - mtimeMs > MAX_AGE_MS) {
          await rm(filePath);
          logger.debug({ filePath }, "Mídia expirada removida");
        }
      } catch (err) {
        logger.warn({ err, filePath }, "Erro ao verificar/remover mídia");
      }
    }
  }
}

export function scheduleMediaCleanup(): void {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // roda a cada 6 horas
  cleanupOldMedia().catch((err) => logger.error({ err }, "Erro na limpeza de mídia"));
  setInterval(() => {
    cleanupOldMedia().catch((err) => logger.error({ err }, "Erro na limpeza de mídia"));
  }, INTERVAL_MS);
}
