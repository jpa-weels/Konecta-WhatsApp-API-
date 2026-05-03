import { useState, useEffect, useCallback } from "react";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  type WebhookRecord,
} from "../api/whatsapp";
import type { InstanceConfig } from "../types";

export function useWebhooks(serverCreds?: { apiUrl: string; apiKey: string }) {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = serverCreds?.apiUrl;
  const apiKey = serverCreds?.apiKey;

  const refresh = useCallback(async () => {
    if (!apiUrl || !apiKey) { setLoading(false); return; }
    try {
      setLoading(true);
      setWebhooks(await listWebhooks(apiUrl, apiKey));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload: { name?: string; url: string; events: string[]; sessionIds: string[] }) => {
    if (!apiUrl || !apiKey) throw new Error("Nenhuma instância configurada");
    await createWebhook(apiUrl, apiKey, payload);
    await refresh();
  }, [apiUrl, apiKey, refresh]);

  const update = useCallback(async (id: string, payload: { name?: string; url?: string; events?: string[]; sessionIds?: string[]; enabled?: boolean }) => {
    if (!apiUrl || !apiKey) throw new Error("Nenhuma instância configurada");
    await updateWebhook(apiUrl, apiKey, id, payload);
    await refresh();
  }, [apiUrl, apiKey, refresh]);

  const remove = useCallback(async (id: string) => {
    if (!apiUrl || !apiKey) throw new Error("Nenhuma instância configurada");
    await deleteWebhook(apiUrl, apiKey, id);
    await refresh();
  }, [apiUrl, apiKey, refresh]);

  const toggle = useCallback(async (webhook: WebhookRecord) => {
    await update(webhook._id, { enabled: !webhook.enabled });
  }, [update]);

  return { webhooks, loading, error, hasApi: !!(apiUrl && apiKey), refresh, create, update, remove, toggle };
}
