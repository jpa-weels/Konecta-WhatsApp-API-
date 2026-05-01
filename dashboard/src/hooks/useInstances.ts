import { useState, useEffect, useCallback, useRef } from "react";
import type { InstanceConfig, InstanceState, CreateInstanceForm, SessionStatus } from "../types";
import { createSession, getStatus, getQR, deleteSession, restartSession as restartSessionApi } from "../api/whatsapp";
import { generateId } from "../lib/utils";

const STORAGE_KEY = "whatsapp-instances";
const POLL_INTERVAL = 5000;

type StateSlice = {
  status: SessionStatus;
  phone: string | null;
  qrCode: string | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATE: StateSlice = {
  status: "unknown",
  phone: null,
  qrCode: null,
  loading: false,
  error: null,
};

function loadFromStorage(): InstanceConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InstanceConfig[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(instances: InstanceConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
}

export function useInstances() {
  const [configs, setConfigs] = useState<InstanceConfig[]>(() => loadFromStorage());
  const [states, setStates] = useState<Map<string, StateSlice>>(new Map());
  const configsRef = useRef(configs);
  configsRef.current = configs;

  const updateState = useCallback((id: string, patch: Partial<StateSlice>) => {
    setStates((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) ?? DEFAULT_STATE), ...patch });
      return next;
    });
  }, []);

  const pollInstance = useCallback(
    async (config: InstanceConfig) => {
      try {
        const { status, phone } = await getStatus(config.apiUrl, config.apiKey, config.sessionId);
        const s = status as SessionStatus;
        if (s === "qr_ready") {
          try {
            const { qr } = await getQR(config.apiUrl, config.apiKey, config.sessionId);
            updateState(config.id, { status: s, phone: phone ?? null, qrCode: qr, error: null });
          } catch {
            updateState(config.id, { status: s, phone: phone ?? null, qrCode: null, error: null });
          }
        } else {
          updateState(config.id, { status: s, phone: phone ?? null, qrCode: null, error: null });
        }
      } catch {
        updateState(config.id, { status: "unknown", phone: null, error: "Sem conexão com a API" });
      }
    },
    [updateState]
  );

  useEffect(() => {
    if (configs.length === 0) return;
    configs.forEach(pollInstance);
    const timer = setInterval(() => configsRef.current.forEach(pollInstance), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [configs, pollInstance]);

  const instances: InstanceState[] = configs.map((c) => ({
    ...c,
    ...(states.get(c.id) ?? DEFAULT_STATE),
  }));

  const addInstance = useCallback(
    async (form: CreateInstanceForm): Promise<void> => {
      const id = generateId();
      const sessionId = form.sessionId.trim() || generateId();
      const apiUrl = form.apiUrl.replace(/\/$/, "");

      const newConfig: InstanceConfig = {
        id,
        name: form.name,
        sessionId,
        apiKey: form.apiKey,
        apiUrl,
        createdAt: Date.now(),
      };

      updateState(id, { ...DEFAULT_STATE, loading: true });

      try {
        await createSession(apiUrl, form.apiKey, sessionId, form.name);
        const updated = [...configsRef.current, newConfig];
        setConfigs(updated);
        saveToStorage(updated);
        updateState(id, { loading: false });
        await pollInstance(newConfig);
      } catch (err) {
        updateState(id, { loading: false, error: err instanceof Error ? err.message : "Erro" });
        throw err;
      }
    },
    [updateState, pollInstance]
  );

  const removeInstance = useCallback(async (id: string): Promise<void> => {
    const config = configsRef.current.find((c) => c.id === id);
    if (!config) return;

    try {
      await deleteSession(config.apiUrl, config.apiKey, config.sessionId);
    } catch {
      // remove locally even if API fails
    }

    const updated = configsRef.current.filter((c) => c.id !== id);
    setConfigs(updated);
    saveToStorage(updated);
    setStates((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const refreshInstance = useCallback(
    async (id: string): Promise<void> => {
      const config = configsRef.current.find((c) => c.id === id);
      if (config) await pollInstance(config);
    },
    [pollInstance]
  );

  const restartInstance = useCallback(
    async (id: string): Promise<void> => {
      const config = configsRef.current.find((c) => c.id === id);
      if (!config) return;
      updateState(id, { loading: true });
      try {
        await restartSessionApi(config.apiUrl, config.apiKey, config.sessionId);
        setTimeout(() => pollInstance(config), 2000);
      } catch (err) {
        updateState(id, { loading: false, error: err instanceof Error ? err.message : "Erro ao reiniciar" });
      }
    },
    [updateState, pollInstance]
  );

  const updateInstance = useCallback(
    (id: string, patch: Partial<Pick<InstanceConfig, "name" | "apiKey" | "apiUrl">>) => {
      const updated = configsRef.current.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      );
      setConfigs(updated);
      saveToStorage(updated);
    },
    []
  );

  return { instances, addInstance, removeInstance, refreshInstance, restartInstance, updateInstance };
}
