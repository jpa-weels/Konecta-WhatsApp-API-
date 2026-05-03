import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { InstanceState, CreateInstanceForm, SessionStatus } from "../types";
import { createSession, getStatus, getQR, deleteSession, restartSession as restartSessionApi } from "../api/whatsapp";

const QR_CACHE_KEY = "qr-cache";
const QR_CACHE_TTL = 60 * 1000; // 60s — matches Redis TTL
const QR_PRUNE_AGE = 2 * 24 * 60 * 60 * 1000; // prune entries older than 2 days
const POLL_INTERVAL = 5000;

type QrEntry = { qr: string; ts: number };

function loadQrCache(): Record<string, QrEntry> {
  try { return JSON.parse(localStorage.getItem(QR_CACHE_KEY) ?? "{}"); } catch { return {}; }
}

function pruneQrCache() {
  const now = Date.now();
  const pruned = Object.fromEntries(
    Object.entries(loadQrCache()).filter(([, v]) => now - v.ts < QR_PRUNE_AGE)
  );
  localStorage.setItem(QR_CACHE_KEY, JSON.stringify(pruned));
}

function getCachedQr(sessionId: string): string | null {
  const entry = loadQrCache()[sessionId];
  if (!entry || Date.now() - entry.ts > QR_CACHE_TTL) return null;
  return entry.qr;
}

function cacheQr(sessionId: string, qr: string) {
  const cache = loadQrCache();
  cache[sessionId] = { qr, ts: Date.now() };
  localStorage.setItem(QR_CACHE_KEY, JSON.stringify(cache));
}

type LiveState = { status: SessionStatus; phone: string | null; qrCode: string | null; loading: boolean; error: string | null };
const DEFAULT_LIVE: LiveState = { status: "unknown", phone: null, qrCode: null, loading: false, error: null };

type ConvexSession = { _id: string; sessionId: string; name?: string; status: string; phone?: string; updatedAt: number };

export function useInstances(serverCreds?: { apiUrl: string; apiKey: string }) {
  const apiUrl = serverCreds?.apiUrl ?? "";
  const apiKey = serverCreds?.apiKey ?? "";

  // Real-time session list from Convex
  const convexSessions = ((useQuery(anyApi.sessions.list, {}) ?? []) as ConvexSession[]);

  const [liveStates, setLiveStates] = useState<Map<string, LiveState>>(new Map());
  const sessionsRef = useRef(convexSessions);
  sessionsRef.current = convexSessions;

  useEffect(() => { pruneQrCache(); }, []);

  const updateLive = useCallback((sessionId: string, patch: Partial<LiveState>) => {
    setLiveStates((prev) => {
      const next = new Map(prev);
      next.set(sessionId, { ...(next.get(sessionId) ?? DEFAULT_LIVE), ...patch });
      return next;
    });
  }, []);

  const pollSession = useCallback(
    async (sessionId: string) => {
      if (!apiUrl || !apiKey) return;
      try {
        const { status, phone } = await getStatus(apiUrl, apiKey, sessionId);
        const s = status as SessionStatus;
        if (s === "qr_ready") {
          const cached = getCachedQr(sessionId);
          if (cached) {
            updateLive(sessionId, { status: s, phone: phone ?? null, qrCode: cached, error: null });
            return;
          }
          try {
            const { qr } = await getQR(apiUrl, apiKey, sessionId);
            cacheQr(sessionId, qr);
            updateLive(sessionId, { status: s, phone: phone ?? null, qrCode: qr, error: null });
          } catch {
            updateLive(sessionId, { status: s, phone: phone ?? null, qrCode: null, error: null });
          }
        } else {
          updateLive(sessionId, { status: s, phone: phone ?? null, qrCode: null, error: null });
        }
      } catch {
        updateLive(sessionId, { status: "unknown", phone: null, error: "Sem conexão com a API" });
      }
    },
    [apiUrl, apiKey, updateLive]
  );

  useEffect(() => {
    if (!apiUrl || !apiKey || convexSessions.length === 0) return;
    convexSessions.forEach((s) => pollSession(s.sessionId));
    const timer = setInterval(
      () => sessionsRef.current.forEach((s) => pollSession(s.sessionId)),
      POLL_INTERVAL
    );
    return () => clearInterval(timer);
  }, [convexSessions, apiUrl, apiKey, pollSession]);

  const instances: InstanceState[] = convexSessions.map((s) => {
    const live = liveStates.get(s.sessionId) ?? DEFAULT_LIVE;
    return {
      id: s._id as string,
      name: s.name ?? s.sessionId,
      sessionId: s.sessionId,
      apiKey,
      apiUrl,
      createdAt: s.updatedAt,
      status: live.status,
      phone: live.phone,
      qrCode: live.qrCode,
      loading: live.loading,
      error: live.error,
    };
  });

  const instancesRef = useRef(instances);
  instancesRef.current = instances;

  const addInstance = useCallback(
    async (form: CreateInstanceForm): Promise<void> => {
      const url = (form.apiUrl || apiUrl).replace(/\/$/, "");
      const key = form.apiKey || apiKey;
      if (!url || !key) throw new Error("Credenciais do servidor não configuradas");
      const sessionId = form.sessionId.trim() || crypto.randomUUID();
      updateLive(sessionId, { ...DEFAULT_LIVE, loading: true });
      try {
        await createSession(url, key, sessionId, form.name);
        updateLive(sessionId, { loading: false });
      } catch (err) {
        updateLive(sessionId, { loading: false, error: err instanceof Error ? err.message : "Erro" });
        throw err;
      }
    },
    [apiUrl, apiKey, updateLive]
  );

  const removeInstance = useCallback(async (id: string): Promise<void> => {
    const session = instancesRef.current.find((s) => s.id === id);
    if (!session) return;
    try {
      await deleteSession(session.apiUrl, session.apiKey, session.sessionId);
    } catch { /* remove locally even if API fails */ }
    setLiveStates((prev) => {
      const next = new Map(prev);
      next.delete(session.sessionId);
      return next;
    });
  }, []);

  const refreshInstance = useCallback(
    async (id: string): Promise<void> => {
      const session = instancesRef.current.find((s) => s.id === id);
      if (session) await pollSession(session.sessionId);
    },
    [pollSession]
  );

  const restartInstance = useCallback(
    async (id: string): Promise<void> => {
      const session = instancesRef.current.find((s) => s.id === id);
      if (!session) return;
      updateLive(session.sessionId, { loading: true });
      try {
        await restartSessionApi(session.apiUrl, session.apiKey, session.sessionId);
        setTimeout(() => pollSession(session.sessionId), 2000);
      } catch (err) {
        updateLive(session.sessionId, {
          loading: false,
          error: err instanceof Error ? err.message : "Erro ao reiniciar",
        });
      }
    },
    [updateLive, pollSession]
  );

  const updateInstance = useCallback(
    (_id: string, _patch: Partial<Pick<{ name: string; apiKey: string; apiUrl: string }, "name" | "apiKey" | "apiUrl">>) => {
      // Session metadata is owned by the backend/Convex — no local override needed
    },
    []
  );

  return { instances, addInstance, removeInstance, refreshInstance, restartInstance, updateInstance };
}
