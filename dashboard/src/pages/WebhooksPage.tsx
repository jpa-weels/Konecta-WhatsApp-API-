import { useState } from "react";
import {
  Webhook, Plus, Pencil, Trash2, Pause, Play,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Check, AlertCircle, Loader2, Globe, MessageSquare,
  Users, UsersRound, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Modal from "@/components/Modal";
import { cn } from "@/lib/utils";
import { useWebhooks } from "@/hooks/useWebhooks";
import type { WebhookRecord } from "@/api/whatsapp";
import type { InstanceConfig } from "@/types";

// ─── Eventos disponíveis ──────────────────────────────────────────────────────

const EVENT_GROUPS = [
  {
    id: "messages", label: "Mensagens", icon: MessageSquare, color: "text-primary",
    events: [
      { key: "MESSAGES_UPSERT", label: "Nova mensagem recebida" },
      { key: "MESSAGES_UPDATE", label: "Status de mensagem atualizado" },
      { key: "MESSAGES_DELETE", label: "Mensagem deletada" },
      { key: "MESSAGES_SET",    label: "Histórico de mensagens (sync)" },
    ],
  },
  {
    id: "contacts", label: "Contatos", icon: Users, color: "text-emerald-400",
    events: [
      { key: "CONTACTS_UPSERT", label: "Contato inserido/atualizado" },
      { key: "CONTACTS_UPDATE", label: "Contato atualizado" },
    ],
  },
  {
    id: "groups", label: "Grupos", icon: UsersRound, color: "text-orange-400",
    events: [
      { key: "GROUPS_UPSERT",             label: "Grupo criado/atualizado" },
      { key: "GROUPS_UPDATE",             label: "Grupo atualizado" },
      { key: "GROUP_PARTICIPANTS_UPDATE", label: "Participantes do grupo" },
    ],
  },
  {
    id: "connection", label: "Conexão", icon: Zap, color: "text-yellow-400",
    events: [
      { key: "CONNECTION_UPDATE", label: "Status de conexão" },
      { key: "QRCODE_UPDATED",   label: "QR Code gerado" },
    ],
  },
];

const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.key));

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex w-11 h-6 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-secondary border border-border/50"
      )}
    >
      <span className={cn(
        "block w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

// ─── Event Group Selector ─────────────────────────────────────────────────────

function EventGroupSelector({
  selected, onChange,
}: { selected: string[]; onChange: (events: string[]) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    const next = selected.includes(key)
      ? selected.filter((e) => e !== key)
      : [...selected, key];
    onChange(next);
  };

  const toggleGroup = (group: typeof EVENT_GROUPS[0]) => {
    const keys = group.events.map((e) => e.key);
    const allOn = keys.every((k) => selected.includes(k));
    const next = allOn
      ? selected.filter((e) => !keys.includes(e))
      : [...new Set([...selected, ...keys])];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {EVENT_GROUPS.map((group) => {
        const Icon = group.icon;
        const keys = group.events.map((e) => e.key);
        const enabledCount = keys.filter((k) => selected.includes(k)).length;
        const allOn = enabledCount === keys.length;
        const isCollapsed = collapsed[group.id];

        return (
          <div key={group.id} className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Icon size={14} className={group.color} />
                <span className="text-xs font-bold text-foreground">{group.label}</span>
                <span className="text-[10px] text-muted-foreground">{enabledCount}/{keys.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-colors",
                    allOn ? "bg-primary/10 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {allOn ? <ToggleRight size={10} className="inline mr-0.5" /> : <ToggleLeft size={10} className="inline mr-0.5" />}
                  {allOn ? "Todos" : "Nenhum"}
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [group.id]: !p[group.id] }))}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="border-t border-border/20 px-3 pb-2 pt-1 space-y-1">
                {group.events.map((event) => (
                  <div key={event.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{event.label}</span>
                    <Toggle checked={selected.includes(event.key)} onChange={() => toggle(event.key)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Instance Selector ────────────────────────────────────────────────────────

function InstanceSelector({
  selected, onChange,
}: { selected: string[]; onChange: (ids: string[]) => void }) {
  const instances: InstanceConfig[] = (() => {
    try { return JSON.parse(localStorage.getItem("whatsapp-instances") || "[]"); }
    catch { return []; }
  })();

  if (!instances.length) return (
    <p className="text-xs text-muted-foreground">Nenhuma instância configurada.</p>
  );

  const toggle = (sessionId: string) => {
    onChange(selected.includes(sessionId)
      ? selected.filter((id) => id !== sessionId)
      : [...selected, sessionId]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {instances.map((inst) => {
        const active = selected.includes(inst.sessionId);
        return (
          <button
            key={inst.id}
            type="button"
            onClick={() => toggle(inst.sessionId)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              active
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-border"
            )}
          >
            {active && <Check size={11} />}
            {inst.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Webhook Form Modal ───────────────────────────────────────────────────────

interface WebhookFormProps {
  initial?: Partial<WebhookRecord>;
  onSubmit: (data: { name: string; url: string; events: string[]; sessionIds: string[] }) => Promise<void>;
  onClose: () => void;
}

function WebhookFormModal({ initial, onSubmit, onClose }: WebhookFormProps) {
  const [name, setName]           = useState(initial?.name ?? "");
  const [url, setUrl]             = useState(initial?.url ?? "");
  const [events, setEvents]       = useState<string[]>(initial?.events ?? ["MESSAGES_UPSERT"]);
  const [sessionIds, setSessionIds] = useState<string[]>(initial?.sessionIds ?? []);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const handleSubmit = async () => {
    if (!url) { setErr("URL é obrigatória"); return; }
    if (!sessionIds.length) { setErr("Selecione ao menos uma instância"); return; }
    setSaving(true);
    try {
      await onSubmit({ name, url, events, sessionIds });
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Nome */}
      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome (opcional)</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Meu sistema CRM"
          className="h-10 bg-muted/30 border-border/50 text-sm"
        />
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">URL do Webhook *</label>
        <Input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setErr(""); }}
          placeholder="https://seu-servidor.com/webhook"
          className="h-10 bg-muted/30 border-border/50 font-mono text-sm"
        />
      </div>

      {/* Instâncias */}
      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Instâncias *</label>
        <InstanceSelector selected={sessionIds} onChange={setSessionIds} />
      </div>

      {/* Eventos */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Eventos</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEvents(ALL_EVENTS)}
              className="text-[10px] font-bold text-primary hover:underline">Todos</button>
            <button type="button" onClick={() => setEvents([])}
              className="text-[10px] font-bold text-muted-foreground hover:underline">Nenhum</button>
          </div>
        </div>
        <EventGroupSelector selected={events} onChange={setEvents} />
      </div>

      {err && (
        <div className="flex items-center gap-2 text-destructive text-xs font-semibold">
          <AlertCircle size={13} /> {err}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ webhook, onConfirm, onClose }: {
  webhook: WebhookRecord; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja excluir o webhook{webhook.name ? ` <strong>${webhook.name}</strong>` : ""}?
        Esta ação não pode ser desfeita.
      </p>
      <p className="text-xs font-mono text-muted-foreground/60 truncate">{webhook.url}</p>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button
          className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
          {deleting ? "Excluindo..." : "Excluir"}
        </Button>
      </div>
    </div>
  );
}

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard({ webhook, onEdit, onToggle, onDelete }: {
  webhook: WebhookRecord;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const instances: InstanceConfig[] = (() => {
    try { return JSON.parse(localStorage.getItem("whatsapp-instances") || "[]"); }
    catch { return []; }
  })();

  const instanceNames = webhook.sessionIds
    .map((sid) => instances.find((i) => i.sessionId === sid)?.name ?? sid.slice(0, 8))
    .join(", ");

  return (
    <Card className={cn(
      "rounded-2xl border-border/40 bg-card/40 transition-opacity",
      !webhook.enabled && "opacity-50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CardTitle className="text-sm font-black truncate">
                {webhook.name || "Webhook"}
              </CardTitle>
              <Badge variant={webhook.enabled ? "success" : "secondary"} className="text-[9px] shrink-0">
                {webhook.enabled ? "Ativo" : "Pausado"}
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground truncate">{webhook.url}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggle}
              title={webhook.enabled ? "Pausar" : "Ativar"}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {webhook.enabled ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Globe size={11} className="text-muted-foreground/50 shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{instanceNames || "Nenhuma instância"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-muted-foreground/50 shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            {webhook.events.length === 0 ? "Todos os eventos" : `${webhook.events.length} evento${webhook.events.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { webhooks, loading, error, hasApi, create, update, remove, toggle } = useWebhooks();

  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<WebhookRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRecord | null>(null);

  return (
    <div className="h-full overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Webhook className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight">Webhooks</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Gerencie os endpoints que recebem eventos das suas instâncias.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!hasApi}
          className="h-9 font-black text-xs uppercase shadow-lg shadow-primary/20 px-5 gap-2"
        >
          <Plus size={14} /> Novo Webhook
        </Button>
      </div>

      {/* Sem instâncias */}
      {!hasApi && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold">
          <AlertCircle size={18} className="shrink-0" />
          Configure ao menos uma instância na aba "Instâncias" para gerenciar webhooks.
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
          <AlertCircle size={18} className="shrink-0" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      )}

      {/* Lista */}
      {!loading && !error && (
        <>
          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <Webhook size={48} className="text-muted-foreground/20" />
              <div>
                <p className="text-lg font-black text-foreground">Nenhum webhook criado</p>
                <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Webhook" para começar.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {webhooks.map((wh) => (
                <WebhookCard
                  key={wh._id}
                  webhook={wh}
                  onEdit={() => setEditTarget(wh)}
                  onToggle={() => toggle(wh)}
                  onDelete={() => setDeleteTarget(wh)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal — Criar */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Novo Webhook" maxWidth="560px">
        <WebhookFormModal
          onSubmit={create}
          onClose={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Modal — Editar */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Webhook" maxWidth="560px">
        {editTarget && (
          <WebhookFormModal
            initial={editTarget}
            onSubmit={(data) => update(editTarget._id, data)}
            onClose={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Modal — Confirmar exclusão */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Webhook" maxWidth="420px">
        {deleteTarget && (
          <DeleteModal
            webhook={deleteTarget}
            onConfirm={() => remove(deleteTarget._id)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}
