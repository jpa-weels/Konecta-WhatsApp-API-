import { useState, useEffect, useCallback } from "react";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  type WebhookRecord,
} from "../api/whatsapp";
import type { InstanceConfig } from "../types";

function getDefaultApi(): { apiUrl: string; apiKey: string } | null {
  try {
    const instances: InstanceConfig[] = JSON.parse(localStorage.getItem("whatsapp-instances") || "[]");
    if (!instances.length) return null;
    return { apiUrl: instances[0].apiUrl, apiKey: instances[0].apiKey };
  } catch {
    return null;
  }
}

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = getDefaultApi();

  const refresh = useCallback(async () => {
    if (!api) { setLoading(false); return; }
    try {
      setLoading(true);
      setWebhooks(await listWebhooks(api.apiUrl, api.apiKey));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api?.apiUrl, api?.apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload: { name?: string; url: string; events: string[]; sessionIds: string[] }) => {
    if (!api) throw new Error("Nenhuma instância configurada");
    await createWebhook(api.apiUrl, api.apiKey, payload);
    await refresh();
  }, [api, refresh]);

  const update = useCallback(async (id: string, payload: { name?: string; url?: string; events?: string[]; sessionIds?: string[]; enabled?: boolean }) => {
    if (!api) throw new Error("Nenhuma instância configurada");
    await updateWebhook(api.apiUrl, api.apiKey, id, payload);
    await refresh();
  }, [api, refresh]);

  const remove = useCallback(async (id: string) => {
    if (!api) throw new Error("Nenhuma instância configurada");
    await deleteWebhook(api.apiUrl, api.apiKey, id);
    await refresh();
  }, [api, refresh]);

  const toggle = useCallback(async (webhook: WebhookRecord) => {
    await update(webhook._id, { enabled: !webhook.enabled });
  }, [update]);

  return { webhooks, loading, error, hasApi: !!api, refresh, create, update, remove, toggle };
}
