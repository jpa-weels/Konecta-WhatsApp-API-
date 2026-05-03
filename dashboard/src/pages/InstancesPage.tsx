import { useState } from "react";
import {
  Plus,
  Search,
  Smartphone,
  Trash2,
  RefreshCcw,
  QrCode,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Settings2,
  Wifi,
  WifiOff,
  Loader2,
  Link,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Modal from "@/components/Modal";
import { useInstances } from "@/hooks/useInstances";
import { useAuth } from "@/auth/AuthContext";
import { cn, maskSecret, copyToClipboard, generateId } from "@/lib/utils";
import { DEFAULT_API_URL } from "@/config";
import type { InstanceState, CreateInstanceForm, SessionStatus } from "@/types";

function statusConfig(status: SessionStatus) {
  switch (status) {
    case "connected":
      return { label: "ONLINE", variant: "success" as const, pulse: true };
    case "connecting":
      return { label: "CONECTANDO", variant: "warning" as const, pulse: true };
    case "qr_ready":
      return { label: "AGUARDANDO QR", variant: "warning" as const, pulse: true };
    case "disconnected":
      return { label: "OFFLINE", variant: "destructive" as const, pulse: false };
    default:
      return { label: "DESCONHECIDO", variant: "secondary" as const, pulse: false };
  }
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copiar ${label ?? ""}`}
      className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  );
}

function InstanceCard({
  instance,
  onDelete,
  onRefresh,
  onRestart,
  onEdit,
}: {
  instance: InstanceState;
  onDelete: (inst: InstanceState) => void;
  onRefresh: (id: string) => void;
  onRestart: (id: string) => void;
  onEdit: (inst: InstanceState) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const s = statusConfig(instance.status);
  const isConnected = instance.status === "connected";
  const isQR = instance.status === "qr_ready";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 rounded-3xl flex flex-col",
        isConnected && "border-primary/40 ring-1 ring-primary/20"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0 flex-1">
            <CardTitle className="text-base font-black truncate group-hover:text-primary transition-colors">
              {instance.name}
            </CardTitle>
            <CardDescription className="text-[10px] font-bold tracking-tighter text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="truncate">{instance.apiUrl}</span>
            </CardDescription>
          </div>
          <Badge
            variant={s.variant}
            className={cn(
              "gap-1 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shrink-0",
              s.variant === "success" && "bg-success/20 text-success border-success/30",
              s.variant === "warning" && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
              s.variant === "destructive" && "bg-destructive/20 text-destructive border-destructive/30",
              s.variant === "secondary" && "bg-secondary text-muted-foreground"
            )}
          >
            {instance.loading ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <div className={cn("w-1.5 h-1.5 rounded-full bg-current", s.pulse && "animate-pulse")} />
            )}
            {s.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2 flex-1">
        {/* Session ID */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <Link size={10} className="text-primary" /> Session ID
          </label>
          <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-xs text-muted-foreground font-mono truncate flex-1">
              {instance.sessionId}
            </span>
            <CopyButton value={instance.sessionId} label="Session ID" />
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <Key size={10} className="text-primary" /> Chave de API
          </label>
          <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-xs text-muted-foreground font-mono truncate flex-1">
              {showKey ? instance.apiKey : maskSecret(instance.apiKey)}
            </span>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <CopyButton value={instance.apiKey} label="API Key" />
          </div>
        </div>

        {/* QR Code */}
        {isQR && instance.qrCode && (
          <div className="p-4 bg-muted/20 border border-dashed border-border/50 rounded-2xl flex flex-col items-center gap-3 animate-in zoom-in duration-500">
            <div className="relative p-3 bg-white rounded-xl shadow-xl">
              <img src={instance.qrCode} alt="QR Code" className="w-40 h-40" />
              <div className="absolute inset-0 border-4 border-primary/20 rounded-xl pointer-events-none" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2">
                <QrCode size={12} /> Escaneie agora
              </p>
              <p className="text-[9px] text-muted-foreground font-medium">
                Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </p>
            </div>
          </div>
        )}

        {isQR && !instance.qrCode && (
          <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex items-center gap-3">
            <Loader2 size={20} className="text-yellow-400 animate-spin shrink-0" />
            <p className="text-xs font-medium text-muted-foreground">Carregando QR code...</p>
          </div>
        )}

        {/* Disconnected warning */}
        {(instance.status === "disconnected" || instance.status === "unknown") && (
          <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl flex items-center gap-3">
            <HelpCircle size={20} className="text-destructive opacity-40 shrink-0" />
            <p className="text-xs font-medium text-muted-foreground">
              {instance.error ?? "Instância desconectada da API."}
            </p>
          </div>
        )}

        {/* Connected state */}
        {isConnected && (
          <div className="p-4 bg-success/5 border border-success/10 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center text-success shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              {instance.phone && (
                <p className="text-xs font-black text-success tracking-wide">
                  +{instance.phone}
                </p>
              )}
              <p className="text-[10px] font-bold text-muted-foreground leading-tight">
                Sessão ativa. WhatsApp conectado e pronto para enviar mensagens.
              </p>
            </div>
          </div>
        )}

        {/* Connecting state */}
        {instance.status === "connecting" && (
          <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex items-center gap-3">
            <Loader2 size={20} className="text-yellow-400 animate-spin shrink-0" />
            <p className="text-xs font-medium text-muted-foreground">Iniciando sessão...</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/10 grid grid-cols-3 gap-2 bg-muted/10">
        {isConnected ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestart(instance.id)}
            className="h-9 gap-1.5 font-bold text-[10px] uppercase border-border/30 text-muted-foreground hover:text-primary hover:bg-primary/10"
          >
            <RefreshCcw size={12} />
            Reiniciar
          </Button>
        ) : instance.status === "disconnected" || instance.status === "unknown" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestart(instance.id)}
            className="h-9 gap-1.5 font-bold text-[10px] uppercase border-border/30 text-muted-foreground hover:text-success hover:bg-success/10"
          >
            <Wifi size={12} />
            Conectar
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRefresh(instance.id)}
            className="h-9 gap-1.5 font-bold text-[10px] uppercase border-border/30 text-muted-foreground hover:text-primary hover:bg-primary/10"
          >
            <RefreshCcw size={12} />
            Atualizar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(instance)}
          className="h-9 gap-1.5 font-bold text-[10px] uppercase text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <Settings2 size={12} />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(instance)}
          className="h-9 gap-1.5 font-bold text-[10px] uppercase text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={12} />
          Excluir
        </Button>
      </CardFooter>
    </Card>
  );
}

const EMPTY_FORM: CreateInstanceForm = {
  name: "",
  apiKey: "",
  apiUrl: DEFAULT_API_URL,
  sessionId: "",
};

export default function InstancesPage() {
  const { apiUrl, apiKey } = useAuth();
  const { instances, addInstance, removeInstance, refreshInstance, restartInstance, updateInstance } = useInstances(
    apiUrl && apiKey ? { apiUrl, apiKey } : undefined
  );

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<InstanceState | null>(null);
  const [showEdit, setShowEdit] = useState<InstanceState | null>(null);
  const [form, setForm] = useState<CreateInstanceForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<Pick<CreateInstanceForm, "name" | "apiKey" | "apiUrl">>({
    name: "",
    apiKey: "",
    apiUrl: "",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const filtered = instances.filter((inst) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inst.name.toLowerCase().includes(q) || inst.sessionId.toLowerCase().includes(q);
  });

  const stats = {
    total: instances.length,
    connected: instances.filter((i) => i.status === "connected").length,
    waiting: instances.filter((i) => i.status === "qr_ready").length,
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sessionId: generateId() });
    setFormError("");
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.apiKey || !form.apiUrl) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      await addInstance(form);
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    setDeleting(true);
    try {
      await removeInstance(showDelete.id);
    } finally {
      setDeleting(false);
      setShowDelete(null);
    }
  };

  const openEdit = (inst: InstanceState) => {
    setEditForm({ name: inst.name, apiKey: inst.apiKey, apiUrl: inst.apiUrl });
    setShowEdit(inst);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    updateInstance(showEdit.id, editForm);
    setShowEdit(null);
  };

  return (
    <div className="h-full overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight">Instâncias</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Gerencie suas conexões WhatsApp — cada uma com sua própria chave de API.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar instâncias..."
              className="pl-11 w-full bg-translucent border-border shadow-inner rounded-xl h-11 focus-visible:ring-primary/50"
            />
          </div>
          <Button
            size="lg"
            onClick={openCreate}
            className="rounded-full px-6 font-black text-xs uppercase shadow-xl shadow-primary/20 h-11 shrink-0"
          >
            <Plus size={18} className="mr-2" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Stats */}
      {instances.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Smartphone, color: "text-primary" },
            { label: "Conectadas", value: stats.connected, icon: Wifi, color: "text-success" },
            { label: "Aguardando QR", value: stats.waiting, icon: QrCode, color: "text-yellow-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="flex items-center gap-4 p-4 rounded-2xl bg-card/50 border border-border/50"
            >
              <div className={cn("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0", color)}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-6 bg-card/20 rounded-3xl border-2 border-dashed border-border/50">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground opacity-30">
              <Smartphone size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">
                {search ? "Nenhuma instância encontrada" : "Sem instâncias ativas"}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto font-medium">
                {search
                  ? "Tente outro termo de busca."
                  : "Crie uma nova instância para começar a gerenciar conexões WhatsApp."}
              </p>
            </div>
            {!search && (
              <Button
                variant="outline"
                onClick={openCreate}
                className="rounded-full px-6 border-primary/20 text-primary hover:bg-primary/10"
              >
                <Plus size={16} className="mr-2" />
                Criar primeira instância
              </Button>
            )}
          </div>
        ) : (
          filtered.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onDelete={setShowDelete}
              onRefresh={refreshInstance}
              onRestart={restartInstance}
              onEdit={openEdit}
            />
          ))
        )}
      </div>

      {/* ── Modal: Criar ── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nova Instância">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
            <Plus size={32} />
          </div>
          <p className="text-sm text-muted-foreground font-medium text-center">
            Configure uma nova conexão WhatsApp com sua própria chave de API.
          </p>

          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                Nome Identificador <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Suporte, Vendas, Matriz"
                required
                className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                API URL <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.apiUrl}
                onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
                placeholder={DEFAULT_API_URL}
                required
                className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                Chave de API <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="Sua API_SECRET configurada no backend"
                required
                type="password"
                className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Session ID
                </label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sessionId: generateId() }))}
                  className="text-[10px] text-primary font-bold hover:underline"
                >
                  Gerar novo
                </button>
              </div>
              <Input
                value={form.sessionId}
                onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}
                placeholder="UUID automático se deixado em branco"
                className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground ml-1">
                Identificador único da sessão WhatsApp. Deixe em branco para gerar automaticamente.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 h-12 font-bold uppercase text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="flex-1 h-12 font-black uppercase text-xs shadow-xl shadow-primary/20"
            >
              {creating ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {creating ? "Criando..." : "Criar Instância"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Editar ── */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Editar Instância">
        {showEdit && (
          <form onSubmit={handleEdit} className="space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
              <Settings2 size={32} />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Nome
                </label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  API URL
                </label>
                <Input
                  value={editForm.apiUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  required
                  className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Chave de API
                </label>
                <Input
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                  required
                  type="password"
                  className="h-11 bg-muted/30 border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
                />
              </div>

              <div className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Session ID (imutável)
                </p>
                <p className="text-xs font-mono text-muted-foreground/70 truncate">{showEdit.sessionId}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowEdit(null)}
                className="flex-1 h-12 font-bold uppercase text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-12 font-black uppercase text-xs shadow-xl shadow-primary/20">
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Modal: Confirmar exclusão ── */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirmar Exclusão">
        {showDelete && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto animate-in zoom-in duration-500">
              <Trash2 size={40} className="text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight uppercase">Excluir instância?</h3>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                Você tem certeza que deseja remover{" "}
                <span className="text-primary font-black px-2 py-0.5 bg-primary/5 rounded border border-primary/10">
                  {showDelete.name}
                </span>
                ? A sessão WhatsApp será encerrada e os dados removidos.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowDelete(null)}
                className="flex-1 h-12 font-bold uppercase text-xs"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-12 font-black uppercase text-xs"
              >
                {deleting ? <Loader2 size={16} className="animate-spin mr-2" /> : <WifiOff size={14} className="mr-2" />}
                {deleting ? "Removendo..." : "Excluir"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
