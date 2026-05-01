import { useState } from "react";
import {
  Settings,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Database,
  CheckCircle2,
  Loader2,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/Modal";
import SystemMonitor from "@/components/SystemMonitor";
import { useInstances } from "@/hooks/useInstances";
import { purgeDatabase, type PurgeResult } from "@/api/whatsapp";
import { cn } from "@/lib/utils";

// ─── Purge Modal ─────────────────────────────────────────────────────────────

interface PurgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  apiKey: string;
}

const PURGE_ITEMS = [
  { label: "Mensagens", key: "messages" as const, color: "text-sky-400" },
  { label: "Contatos", key: "contacts" as const, color: "text-emerald-400" },
  { label: "Sessões (DB)", key: "sessions" as const, color: "text-amber-400" },
  { label: "Webhooks", key: "webhooks" as const, color: "text-purple-400" },
];

function PurgeModal({ isOpen, onClose, apiUrl, apiKey }: PurgeModalProps) {
  const [step, setStep] = useState<"confirm" | "loading" | "done" | "error">("confirm");
  const [result, setResult] = useState<PurgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("confirm");
      setResult(null);
      setError(null);
    }, 300);
  };

  const handlePurge = async () => {
    setStep("loading");
    setError(null);
    try {
      const data = await purgeDatabase(apiUrl, apiKey);
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Limpar Base de Dados" maxWidth="480px">
      {step === "confirm" && (
        <div className="space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
            <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-destructive">Ação irreversível</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Todos os dados abaixo serão <strong>permanentemente excluídos</strong> do banco de dados.
                As sessões WhatsApp ativas no servidor <strong>não</strong> serão desconectadas.
              </p>
            </div>
          </div>

          {/* O que será deletado */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Dados que serão excluídos
            </p>
            <div className="rounded-2xl border border-border/40 overflow-hidden">
              {PURGE_ITEMS.map(({ label, color }, i) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    i < PURGE_ITEMS.length - 1 && "border-b border-border/20"
                  )}
                >
                  <Database size={14} className={color} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2 font-black uppercase text-xs"
              onClick={handlePurge}
            >
              <Trash2 size={14} />
              Confirmar limpeza
            </Button>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 size={40} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Apagando registros…</p>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-400">Base de dados limpa!</p>
              <p className="text-xs text-muted-foreground">Os registros foram excluídos com sucesso.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Registros excluídos
            </p>
            <div className="rounded-2xl border border-border/40 overflow-hidden">
              {PURGE_ITEMS.map(({ label, key, color }, i) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    i < PURGE_ITEMS.length - 1 && "border-b border-border/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Database size={14} className={color} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className="text-sm font-black tabular-nums">
                    {result.counts[key] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
            <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-destructive">Erro ao limpar</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={handleClose}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2 font-black uppercase text-xs"
              onClick={() => setStep("confirm")}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { instances } = useInstances();
  const [purgeOpen, setPurgeOpen] = useState(false);

  // Usa a primeira instância disponível para a chamada de purge
  const firstInstance = instances[0];

  const handleClearLocal = () => {
    if (
      confirm("Tem certeza? Isso remove todas as instâncias do dashboard (não desconecta do servidor).")
    ) {
      localStorage.removeItem("whatsapp-instances");
      window.location.reload();
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500 custom-scrollbar">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">Monitor de Recursos</h1>
        </div>
        <p className="text-muted-foreground font-medium">
          Informações sobre o dashboard e gerenciamento de dados.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Monitor de Recursos */}
        {firstInstance ? (
          <Card className="rounded-3xl border-border/40 bg-card/50 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/20">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                Recursos do Sistema
              </CardTitle>
              <CardDescription>
                CPU, memória, disco e saúde dos containers — atualiza a cada 15s
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <SystemMonitor apiUrl={firstInstance.apiUrl} apiKey={firstInstance.apiKey} />
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-border/30 bg-card/30">
            <CardContent className="flex items-center gap-3 py-6 text-muted-foreground">
              <Activity size={20} className="text-primary/40" />
              <p className="text-sm">Adicione uma instância para ver as métricas do sistema.</p>
            </CardContent>
          </Card>
        )}

        {/* Zona de Perigo */}
        <Card className="rounded-3xl border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-black flex items-center gap-2 text-destructive">
              <AlertCircle size={16} />
              Zona de Perigo
            </CardTitle>
            <CardDescription>Ações irreversíveis — use com cuidado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Limpar dados locais */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-background/40 border border-border/30">
              <div className="space-y-1">
                <p className="text-sm font-bold">Limpar dados locais</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Remove todas as instâncias salvas no navegador. As sessões no servidor{" "}
                  <strong>não</strong> são encerradas — apenas o registro local é apagado.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearLocal}
                className="gap-2 font-black uppercase text-xs shrink-0"
                disabled={instances.length === 0}
              >
                <Trash2 size={14} />
                Limpar local
              </Button>
            </div>

            {/* Limpar base de dados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-background/40 border border-border/30">
              <div className="space-y-1">
                <p className="text-sm font-bold">Limpar base de dados</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Apaga <strong>permanentemente</strong> todos os contatos, mensagens, sessões (DB) e
                  webhooks do servidor. As sessões WhatsApp ativas{" "}
                  <strong>não</strong> são desconectadas.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPurgeOpen(true)}
                className="gap-2 font-black uppercase text-xs shrink-0"
                disabled={!firstInstance}
              >
                <Database size={14} />
                Limpar banco
              </Button>
            </div>

            {!firstInstance && (
              <p className="text-[11px] text-muted-foreground text-center">
                Adicione ao menos uma instância para habilitar a limpeza do banco.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Purge modal */}
      {firstInstance && (
        <PurgeModal
          isOpen={purgeOpen}
          onClose={() => setPurgeOpen(false)}
          apiUrl={firstInstance.apiUrl}
          apiKey={firstInstance.apiKey}
        />
      )}
    </div>
  );
}
