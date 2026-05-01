import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics, type AnalyticsData } from "../api/whatsapp";
import type { InstanceConfig } from "../types";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getDefaultApi(): { apiUrl: string; apiKey: string } | null {
  try {
    const instances: InstanceConfig[] = JSON.parse(localStorage.getItem("whatsapp-instances") || "[]");
    if (!instances.length) return null;
    return { apiUrl: instances[0].apiUrl, apiKey: instances[0].apiKey };
  } catch {
    return null;
  }
}

let cache: { data: AnalyticsData; ts: number } | null = null;

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cache ? new Date(cache.ts) : null);

  const api = getDefaultApi();

  const refresh = useCallback(async (force = false) => {
    if (!api) { setLoading(false); return; }
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data);
      setLastUpdated(new Date(cache.ts));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchAnalytics(api.apiUrl, api.apiKey);
      cache = { data: result, ts: Date.now() };
      setData(result);
      setLastUpdated(new Date(cache.ts));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api?.apiUrl, api?.apiKey]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, hasApi: !!api, lastUpdated, refresh: () => refresh(true) };
}
