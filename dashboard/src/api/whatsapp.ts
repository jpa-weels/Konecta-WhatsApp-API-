export type ApiStatus = "connecting" | "qr_ready" | "connected" | "disconnected";

function authHeaders(apiKey: string) {
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

export async function createSession(apiUrl: string, apiKey: string, sessionId: string, name?: string) {
  const res = await fetch(`${apiUrl}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ sessionId, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro ao criar sessão");
  }
  return res.json();
}

export async function getStatus(
  apiUrl: string,
  apiKey: string,
  sessionId: string
): Promise<{ sessionId: string; status: ApiStatus; phone?: string }> {
  const res = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}/status`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("Sessão não encontrada");
  return res.json();
}

export async function getQR(
  apiUrl: string,
  apiKey: string,
  sessionId: string
): Promise<{ sessionId: string; qr: string }> {
  const res = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}/qr`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("QR code não disponível");
  return res.json();
}

export async function restartSession(apiUrl: string, apiKey: string, sessionId: string) {
  const res = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}/restart`, {
    method: "POST",
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("Erro ao reiniciar sessão");
  return res.json();
}

export async function deleteSession(apiUrl: string, apiKey: string, sessionId: string) {
  const res = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("Erro ao remover sessão");
  return res.json();
}

export interface WebhookRecord {
  _id: string;
  name?: string;
  url: string;
  events: string[];
  sessionIds: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export async function listWebhooks(apiUrl: string, apiKey: string): Promise<WebhookRecord[]> {
  const res = await fetch(`${apiUrl}/api/v1/webhooks`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error("Erro ao listar webhooks");
  const data = await res.json();
  return data.webhooks;
}

export async function createWebhook(
  apiUrl: string,
  apiKey: string,
  payload: { name?: string; url: string; events: string[]; sessionIds: string[] },
): Promise<{ id: string }> {
  const res = await fetch(`${apiUrl}/api/v1/webhooks`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro ao criar webhook");
  }
  return res.json();
}

export async function updateWebhook(
  apiUrl: string,
  apiKey: string,
  id: string,
  payload: { name?: string; url?: string; events?: string[]; sessionIds?: string[]; enabled?: boolean },
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/v1/webhooks/${id}`, {
    method: "PUT",
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro ao atualizar webhook");
  }
}

export async function deleteWebhook(apiUrl: string, apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/v1/webhooks/${id}`, {
    method: "DELETE",
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("Erro ao deletar webhook");
}

export interface AnalyticsData {
  messages: {
    total: number;
    inbound: number;
    outbound: number;
    byDay: Record<string, { inbound: number; outbound: number }>;
    byType: Record<string, number>;
    bySession: Record<string, { inbound: number; outbound: number }>;
  };
  sessions: {
    total: number;
    connected: number;
    byStatus: Record<string, number>;
  };
  webhooks: {
    total: number;
    active: number;
    paused: number;
    totalEventConfigs: number;
  };
}

export async function fetchAnalytics(apiUrl: string, apiKey: string): Promise<AnalyticsData> {
  const res = await fetch(`${apiUrl}/api/v1/analytics`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error("Erro ao buscar analytics");
  return res.json();
}

export interface PurgeResult {
  message: string;
  counts: {
    messages: number;
    contacts: number;
    sessions: number;
    webhooks: number;
  };
}

export async function purgeDatabase(apiUrl: string, apiKey: string): Promise<PurgeResult> {
  const res = await fetch(`${apiUrl}/api/v1/admin/purge`, {
    method: "DELETE",
    headers: authHeaders(apiKey),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro ao limpar base de dados");
  }
  return res.json();
}

// ─── System Metrics ───────────────────────────────────────────────────────────

export interface ContainerStat {
  id: string;
  name: string;
  image: string;
  status: "running" | "paused" | "stopped" | "error" | "unknown";
  state: string;
  health: "healthy" | "unhealthy" | "starting" | "none";
  cpuPercent: number;
  memUsed: number;
  memLimit: number;
  memPercent: number;
  uptime: string;
}

export interface SystemMetrics {
  cpu: { usage: number; cores: number; model: string; speed: number };
  memory: { total: number; used: number; free: number; usePercent: number };
  disks: { fs: string; total: number; used: number; available: number; usePercent: number; mount: string }[];
  containers: ContainerStat[];
  collectedAt: number;
}

export async function fetchSystemMetrics(apiUrl: string, apiKey: string): Promise<SystemMetrics> {
  const res = await fetch(`${apiUrl}/api/v1/admin/metrics`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) throw new Error("Erro ao buscar métricas do sistema");
  return res.json();
}
