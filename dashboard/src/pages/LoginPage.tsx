import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Globe, Loader2, ShieldAlert, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { DEFAULT_API_URL } from "@/config";
import type { InstanceConfig } from "@/types";

function getSavedApiUrl(): string {
  try {
    const instances: InstanceConfig[] = JSON.parse(
      localStorage.getItem("whatsapp-instances") || "[]"
    );
    // Prioridade: 1º instância salva → 2º variável de ambiente → 3º localhost (fallback final)
    return instances[0]?.apiUrl ?? DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export default function LoginPage() {
  const { login, isAuthenticated, attemptsLeft, lockedUntil } = useAuth();
  const navigate = useNavigate();

  const [apiUrl, setApiUrl] = useState(getSavedApiUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirecionar se já autenticado
  useEffect(() => {
    if (isAuthenticated) navigate("/instances", { replace: true });
  }, [isAuthenticated, navigate]);

  // Countdown do lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setCountdown(0);
        setError("");
      } else {
        setCountdown(left);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = countdown > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || loading) return;
    if (!apiUrl.trim() || !password.trim()) {
      setError("Preencha todos os campos.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login(apiUrl.trim(), password.trim());
      navigate("/instances", { replace: true });
    } catch (err: any) {
      const msg: string = err?.message ?? "Erro desconhecido";
      if (msg.startsWith("LOCKED:")) {
        const until = parseInt(msg.split(":")[1]);
        setCountdown(Math.ceil((until - Date.now()) / 1000));
        setError(`Muitas tentativas. Aguarde ${Math.ceil((until - Date.now()) / 1000)}s.`);
      } else {
        setError(msg);
        setPassword("");
        setTimeout(() => passwordRef.current?.focus(), 50);
      }
    } finally {
      setLoading(false);
    }
  };

  const isHttp = apiUrl.startsWith("http://") && !apiUrl.includes("localhost") && !apiUrl.includes("127.0.0.1");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock size={26} className="text-primary" />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-2xl font-black tracking-tight">Konecta</span>
              <span className="text-2xl font-bold tracking-tight text-primary">API</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1 tracking-wide">
              Acesso seguro ao painel de controle
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* API URL */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Globe size={11} className="text-primary" />
                URL da API
              </label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:4000"
                disabled={loading || isLocked}
                className="h-11 bg-muted/20 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
                autoComplete="url"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Lock size={11} className="text-primary" />
                Senha (API Secret)
              </label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Cole sua API_SECRET aqui"
                  disabled={loading || isLocked}
                  className="h-11 bg-muted/20 border-border/50 focus-visible:ring-primary/50 font-mono text-sm pr-11"
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* HTTP warning */}
            {isHttp && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>Conexão HTTP sem criptografia. Use HTTPS em produção para proteger sua chave de API.</span>
              </div>
            )}

            {/* Error */}
            {error && !isLocked && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Lockout */}
            {isLocked && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
                <Clock size={14} className="shrink-0 animate-pulse" />
                Muitas tentativas. Aguarde {countdown}s para tentar novamente.
              </div>
            )}

            {/* Attempts warning */}
            {!isLocked && attemptsLeft < 5 && attemptsLeft > 0 && (
              <p className="text-[11px] text-yellow-400/70 font-medium text-center">
                {attemptsLeft} tentativa{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""} antes do bloqueio.
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || isLocked || !apiUrl || !password}
              className={cn(
                "w-full h-12 font-black uppercase text-xs tracking-wider shadow-xl shadow-primary/20 rounded-xl",
                "transition-all duration-200"
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin mr-2" />
                  Verificando...
                </>
              ) : isLocked ? (
                <>
                  <Clock size={15} className="mr-2" />
                  Bloqueado ({countdown}s)
                </>
              ) : (
                <>
                  <Lock size={15} className="mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/40 mt-6 font-medium">
          A sessão expira automaticamente em 8 horas.
        </p>
      </div>
    </div>
  );
}
