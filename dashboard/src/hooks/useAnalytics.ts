import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics, type AnalyticsData } from "../api/whatsapp";
import type { InstanceConfig } from "../types";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cache: { data: AnalyticsData; ts: number } | null = null;

export function useAnalytics(serverCreds?: { apiUrl: string; apiKey: string }) {
  const [data, setData] = useState<AnalyticsData | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cache ? new Date(cache.ts) : null);

  const apiUrl = serverCreds?.apiUrl;
  const apiKey = serverCreds?.apiKey;

  const refresh = useCallback(async (force = false) => {
    if (!apiUrl || !apiKey) { setLoading(false); return; }
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data);
      setLastUpdated(new Date(cache.ts));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchAnalytics(apiUrl, apiKey);
      cache = { data: result, ts: Date.now() };
      setData(result);
      setLastUpdated(new Date(cache.ts));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, hasApi: !!(apiUrl && apiKey), lastUpdated, refresh: () => refresh(true) };
}
