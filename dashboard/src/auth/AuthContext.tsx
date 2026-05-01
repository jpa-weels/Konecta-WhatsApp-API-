import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const AUTH_KEY = "konecta:auth";
const ATTEMPTS_KEY = "konecta:attempts";
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 segundos

interface AuthState {
  apiUrl: string;
  apiKey: string;
  expiresAt: number;
}

interface AttemptsState {
  count: number;
  lockedUntil: number;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  apiUrl: string;
  apiKey: string;
  login: (apiUrl: string, apiKey: string) => Promise<void>;
  logout: () => void;
  attemptsLeft: number;
  lockedUntil: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): AuthState | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const state: AuthState = JSON.parse(raw);
    if (Date.now() > state.expiresAt) {
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function loadAttempts(): AttemptsState {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) || "{}");
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function saveAttempts(state: AttemptsState) {
  sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthState | null>(loadSession);
  const [attempts, setAttempts] = useState<AttemptsState>(loadAttempts);

  // Auto-logout quando a sessão expirar
  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    const timer = setTimeout(() => {
      sessionStorage.removeItem(AUTH_KEY);
      setSession(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [session]);

  const login = useCallback(async (apiUrl: string, apiKey: string) => {
    const now = Date.now();

    // Verificar lockout
    const current = loadAttempts();
    if (current.lockedUntil && now < current.lockedUntil) {
      throw new Error(`LOCKED:${current.lockedUntil}`);
    }

    const url = apiUrl.replace(/\/$/, "");

    // Validar credenciais contra a API real
    let ok = false;
    try {
      const res = await fetch(`${url}/api/v1/sessions`, {
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      ok = res.ok;
    } catch {
      throw new Error("Não foi possível conectar à API. Verifique a URL.");
    }

    if (!ok) {
      const newCount = (current.count ?? 0) + 1;
      const locked = newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
      const next = { count: newCount, lockedUntil: locked };
      saveAttempts(next);
      setAttempts(next);
      throw new Error(newCount >= MAX_ATTEMPTS ? `LOCKED:${locked}` : "Senha incorreta.");
    }

    // Sucesso — limpar tentativas e salvar sessão
    sessionStorage.removeItem(ATTEMPTS_KEY);
    setAttempts({ count: 0, lockedUntil: 0 });

    const state: AuthState = {
      apiUrl: url,
      apiKey,
      expiresAt: now + SESSION_MS,
    };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
    setSession(state);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setSession(null);
  }, []);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - (attempts.count ?? 0));

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        apiUrl: session?.apiUrl ?? "",
        apiKey: session?.apiKey ?? "",
        login,
        logout,
        attemptsLeft,
        lockedUntil: attempts.lockedUntil ?? 0,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
