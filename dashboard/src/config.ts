/**
 * Configurações globais do dashboard.
 * Lidas de variáveis de ambiente Vite (prefixo VITE_).
 *
 * Em desenvolvimento: defina em dashboard/.env.local
 * Em produção (Docker): passe como ARG no Dockerfile ou
 * injete via nginx com window.__ENV__ antes do bundle.
 */

/** URL base da API WhatsApp. Exemplo: https://api.seudominio.com */
export const DEFAULT_API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000";
