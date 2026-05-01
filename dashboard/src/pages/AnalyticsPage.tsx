import { useState, useEffect, useCallback } from "react";
import {
  BarChart2,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Wifi,
  Webhook,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { InstanceConfig } from "@/types";

// ─── Animated number ──────────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 900) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let id: number;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(target * ease));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return current;
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="w-20 h-8" />;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 80; const H = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - 4 - ((v - min) / range) * (H - 8);
    return `${x},${y}`;
  });
  const areaPoints = `0,${H} ${pts.join(" ")} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Area Line Chart ──────────────────────────────────────────────────────────

function AreaLineChart({ data }: {
  data: Array<{ label: string; inbound: number; outbound: number }>;
}) {
  const W = 560; const H = 180;
  const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...data.flatMap(d => [d.inbound, d.outbound]));

  const xPos = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yPos = (v: number) => PAD.top + cH - (v / maxVal) * cH;

  const line = (key: "inbound" | "outbound") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(d[key]).toFixed(1)}`).join(" ");

  const area = (key: "inbound" | "outbound") => {
    const bottom = (PAD.top + cH).toFixed(1);
    const pts = data.map((d, i) => `${xPos(i).toFixed(1)} ${yPos(d[key]).toFixed(1)}`).join(" L ");
    return `M ${xPos(0).toFixed(1)} ${bottom} L ${pts} L ${xPos(data.length - 1).toFixed(1)} ${bottom} Z`;
  };

  const gridVals = [0, 0.25, 0.5, 0.75, 1];

  if (!data.length) return <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="alc-in" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="alc-out" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>

      {gridVals.map((f) => {
        const y = PAD.top + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="currentColor" strokeOpacity={0.07} strokeDasharray="4 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize={9} fill="currentColor" fillOpacity={0.35}>
              {Math.round(maxVal * f)}
            </text>
          </g>
        );
      })}

      <path d={area("inbound")} fill="url(#alc-in)" />
      <path d={area("outbound")} fill="url(#alc-out)" />
      <path d={line("inbound")} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={line("outbound")} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xPos(i)} cy={yPos(d.inbound)} r={3} fill="hsl(var(--primary))" />
          <circle cx={xPos(i)} cy={yPos(d.outbound)} r={3} fill="#22c55e" />
          <text x={xPos(i)} y={H - 4} textAnchor="middle"
            fontSize={9} fill="currentColor" fillOpacity={0.4}>
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ segments, total }: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  let cumulative = 0;
  const arcs = segments.map((s) => {
    const dash = total > 0 ? (s.value / total) * circ : 0;
    const offset = cumulative;
    cumulative += dash;
    return { ...s, dash, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <svg width={140} height={140} viewBox="0 0 100 100">
          {total === 0 ? (
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={18} />
          ) : (
            arcs.map((arc, i) => (
              <circle key={i} cx="50" cy="50" r={radius} fill="none"
                stroke={arc.color} strokeWidth={18}
                strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
                strokeDashoffset={-arc.offset}
                transform="rotate(-90 50 50)"
              />
            ))
          )}
          <circle cx="50" cy="50" r="29" fill="hsl(var(--card))" />
          <text x="50" y="47" textAnchor="middle" fontSize="12" fontWeight="900" fill="currentColor">
            {total.toLocaleString("pt-BR")}
          </text>
          <text x="50" y="60" textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.45}>
            mensagens
          </text>
        </svg>
      </div>
      <div className="w-full space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-muted-foreground capitalize flex-1 truncate">{s.label}</span>
            <span className="text-[11px] font-bold">{s.value}</span>
            <span className="text-[10px] text-muted-foreground/50 w-8 text-right">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Session Bars ──────────────────────────────────────────────────

function SessionBars({ items }: {
  items: Array<{ name: string; inbound: number; outbound: number }>;
}) {
  const maxTotal = Math.max(1, ...items.map(s => s.inbound + s.outbound));

  if (!items.length) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      Nenhuma sessão com dados
    </div>
  );

  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item, i) => {
        const total = item.inbound + item.outbound;
        const pct = (total / maxTotal) * 100;
        const inPct = total > 0 ? (item.inbound / total) * 100 : 50;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[140px]">{item.name}</span>
              <span className="text-[10px] text-muted-foreground">{total.toLocaleString("pt-BR")} msgs</span>
            </div>
            <div className="h-5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full flex overflow-hidden transition-all duration-700"
                style={{ width: `${pct}%` }}>
                <div className="h-full bg-primary/80" style={{ width: `${inPct}%` }} />
                <div className="h-full bg-green-500/70" style={{ width: `${100 - inPct}%` }} />
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-[10px] text-primary/70">↓ {item.inbound}</span>
              <span className="text-[10px] text-green-500/70">↑ {item.outbound}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, trend, sparkValues,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "flat";
  sparkValues?: number[];
}) {
  const animated = useAnimatedNumber(value);
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-5 flex flex-col gap-3 hover:border-border/60 transition-all group">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 70%)` }} />
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <MiniSparkline values={sparkValues} color={color} />
        )}
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight tabular-nums">
          {animated.toLocaleString("pt-BR")}
        </p>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
        {sub && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>
        )}
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1", trendColor)}>
          <TrendIcon size={11} />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {trend === "up" ? "Aumentando" : trend === "down" ? "Diminuindo" : "Estável"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white/5 animate-pulse", className)} />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  text: "hsl(var(--primary))",
  image: "#22c55e",
  video: "#f59e0b",
  audio: "#8b5cf6",
  document: "#06b6d4",
  sticker: "#ec4899",
  unknown: "#6b7280",
};

function buildDayData(
  byDay: Record<string, { inbound: number; outbound: number }>,
  days = 7,
) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = Math.floor(d.getTime() / 1000);
    const counts = byDay[key] ?? { inbound: 0, outbound: 0 };
    return {
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      inbound: counts.inbound,
      outbound: counts.outbound,
    };
  });
}

function detectTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const half = Math.floor(values.length / 2);
  const first = values.slice(0, half).reduce((a, b) => a + b, 0);
  const second = values.slice(half).reduce((a, b) => a + b, 0);
  if (second > first * 1.05) return "up";
  if (second < first * 0.95) return "down";
  return "flat";
}

function getSessionNames(): Record<string, string> {
  try {
    const instances: InstanceConfig[] = JSON.parse(localStorage.getItem("whatsapp-instances") || "[]");
    return Object.fromEntries(instances.map(i => [i.sessionId, i.name]));
  } catch { return {}; }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data, loading, error, hasApi, lastUpdated, refresh } = useAnalytics();
  const [range, setRange] = useState<7 | 30>(7);

  const sessionNames = getSessionNames();

  const dayData = data ? buildDayData(data.messages.byDay, range) : [];
  const sparkValues = data ? buildDayData(data.messages.byDay, 14).map(d => d.inbound + d.outbound) : [];
  const inSpark = data ? buildDayData(data.messages.byDay, 14).map(d => d.inbound) : [];
  const outSpark = data ? buildDayData(data.messages.byDay, 14).map(d => d.outbound) : [];

  const typeSegments = data
    ? Object.entries(data.messages.byType)
        .sort(([, a], [, b]) => b - a)
        .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] ?? "#6b7280" }))
    : [];

  const sessionItems = data
    ? Object.entries(data.messages.bySession)
        .map(([sid, counts]) => ({
          name: sessionNames[sid] ?? sid.slice(0, 12),
          inbound: counts.inbound,
          outbound: counts.outbound,
        }))
        .sort((a, b) => (b.inbound + b.outbound) - (a.inbound + a.outbound))
    : [];

  const statusSegments = data
    ? Object.entries(data.sessions.byStatus).map(([status, count]) => ({
        label: status,
        value: count as number,
        color: status === "connected" ? "#22c55e"
          : status === "connecting" || status === "qr_ready" ? "#f59e0b"
          : "#6b7280",
      }))
    : [];

  const trend = detectTrend(sparkValues);

  return (
    <div className="h-full overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500 custom-scrollbar">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight">Analytics</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Visão geral do volume de mensagens, sessões e webhooks — últimos {range} dias.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <Clock size={11} />
              <span>Atualizado {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
          <div className="flex rounded-xl border border-border/50 overflow-hidden">
            {([7, 30] as const).map((d) => (
              <button key={d} onClick={() => setRange(d)}
                className={cn(
                  "px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all",
                  range === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"
                )}>
                {d}d
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}
            className="h-9 gap-2 font-bold text-[11px] uppercase border border-border/40">
            <RefreshCcw size={13} className={cn(loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* No API */}
      {!hasApi && (
        <div className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold">
          Nenhuma instância configurada. Adicione uma instância na aba Instâncias para ver os dados.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
          {error}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-36" />)
        ) : data ? (
          <>
            <KpiCard
              label="Total de Mensagens"
              value={data.messages.total}
              sub={`Últimos ${range} dias`}
              icon={MessageSquare}
              color="hsl(var(--primary))"
              trend={trend}
              sparkValues={sparkValues}
            />
            <KpiCard
              label="Recebidas"
              value={data.messages.inbound}
              sub="Inbound"
              icon={ArrowDownLeft}
              color="hsl(var(--primary))"
              sparkValues={inSpark}
            />
            <KpiCard
              label="Enviadas"
              value={data.messages.outbound}
              sub="Outbound"
              icon={ArrowUpRight}
              color="#22c55e"
              sparkValues={outSpark}
            />
            <KpiCard
              label="Sessões Ativas"
              value={data.sessions.connected}
              sub={`de ${data.sessions.total} total`}
              icon={Wifi}
              color="#22c55e"
            />
          </>
        ) : null}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area Line Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">Volume de Mensagens</p>
              <p className="text-[11px] text-muted-foreground">Recebidas vs enviadas por dia</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-[11px] text-muted-foreground">Recebidas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-[11px] text-muted-foreground">Enviadas</span>
              </div>
            </div>
          </div>
          {loading ? (
            <Shimmer className="h-44" />
          ) : (
            <AreaLineChart data={dayData} />
          )}
        </div>

        {/* Donut Chart */}
        <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-4">
          <div>
            <p className="text-sm font-black">Tipos de Mensagem</p>
            <p className="text-[11px] text-muted-foreground">Distribuição por formato</p>
          </div>
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Shimmer className="w-36 h-36 rounded-full" />
              <div className="w-full space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-4" />)}
              </div>
            </div>
          ) : (
            <DonutChart segments={typeSegments} total={data?.messages.total ?? 0} />
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Per Session */}
        <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">Por Instância</p>
              <p className="text-[11px] text-muted-foreground">Volume de mensagens por sessão</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/70 inline-block" />Recebidas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/60 inline-block" />Enviadas</span>
            </div>
          </div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-12" />)}
            </div>
          ) : (
            <SessionBars items={sessionItems} />
          )}
        </div>

        {/* Webhook + Session Stats */}
        <div className="space-y-6">

          {/* Webhook Stats */}
          <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Webhook size={16} className="text-primary" />
              <p className="text-sm font-black">Webhooks</p>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-16" />)}
              </div>
            ) : data ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total", value: data.webhooks.total, color: "text-foreground" },
                  { label: "Ativos", value: data.webhooks.active, color: "text-green-400" },
                  { label: "Pausados", value: data.webhooks.paused, color: "text-muted-foreground" },
                  { label: "Eventos Config.", value: data.webhooks.totalEventConfigs, color: "text-primary" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-white/5 p-3 space-y-1">
                    <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Session Status */}
          <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              <p className="text-sm font-black">Status das Sessões</p>
            </div>
            {loading ? (
              <Shimmer className="h-24" />
            ) : data ? (
              <div className="space-y-2.5">
                {statusSegments.map((seg) => {
                  const pct = data.sessions.total > 0 ? (seg.value / data.sessions.total) * 100 : 0;
                  const label =
                    seg.label === "connected" ? "Conectadas"
                    : seg.label === "qr_ready" ? "Aguardando QR"
                    : seg.label === "connecting" ? "Conectando"
                    : seg.label === "disconnected" ? "Desconectadas"
                    : seg.label;
                  return (
                    <div key={seg.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-muted-foreground">{label}</span>
                        <span className="font-black" style={{ color: seg.color }}>{seg.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: seg.color }} />
                      </div>
                    </div>
                  );
                })}
                {statusSegments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Nenhuma sessão encontrada</p>
                )}
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* API Health Row */}
      {data && (
        <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-primary" />
            <p className="text-sm font-black">Resumo Geral</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Taxa de Resposta",
                value: data.messages.total > 0
                  ? `${Math.round((data.messages.outbound / Math.max(data.messages.inbound, 1)) * 100)}%`
                  : "—",
                sub: "Enviadas / Recebidas",
                color: "text-primary",
              },
              {
                label: "Tipos Distintos",
                value: Object.keys(data.messages.byType).length.toString(),
                sub: "Formatos de mídia",
                color: "text-purple-400",
              },
              {
                label: "Sessões Configuradas",
                value: data.sessions.total.toString(),
                sub: `${data.sessions.connected} online agora`,
                color: "text-green-400",
              },
              {
                label: "Cobertura Webhooks",
                value: data.sessions.total > 0
                  ? `${Math.round((data.webhooks.active / Math.max(data.sessions.total, 1)) * 100)}%`
                  : "—",
                sub: "Sessões monitoradas",
                color: "text-yellow-400",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-xl bg-white/5 p-4 space-y-1.5">
                <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
                <p className="text-[11px] font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
