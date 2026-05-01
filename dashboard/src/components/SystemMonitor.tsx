import { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Container,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Activity,
} from "lucide-react";
import { fetchSystemMetrics, type SystemMetrics, type ContainerStat } from "@/api/whatsapp";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────

interface CircularGaugeProps {
  value: number;       // 0-100
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
}

function CircularGauge({ value, size = 140, strokeWidth = 10, color, label, sublabel, children }: CircularGaugeProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clamp(value);
  const offset = circumference - (pct / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Track */}
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children ?? (
            <span className="text-2xl font-black tabular-nums" style={{ color }}>
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold">{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

interface BarProps {
  value: number;
  color: string;
  label: string;
  detail?: string;
}

function HorizontalBar({ value, color, label, detail }: BarProps) {
  const pct = clamp(value);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">{label}</span>
        <span className="text-xs font-black tabular-nums">{detail ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Mini spark bar ───────────────────────────────────────────────────────────

function SparkBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = max > 0 ? clamp((value / max) * 100) : 0;
  return (
    <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Container Health Badge ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContainerStat["status"], { label: string; color: string; dot: string }> = {
  running: { label: "Rodando", color: "text-emerald-400", dot: "bg-emerald-400" },
  paused:  { label: "Pausado", color: "text-amber-400",   dot: "bg-amber-400"   },
  stopped: { label: "Parado",  color: "text-slate-400",   dot: "bg-slate-400"   },
  error:   { label: "Erro",    color: "text-red-400",     dot: "bg-red-400"     },
  unknown: { label: "Desconhecido", color: "text-slate-400", dot: "bg-slate-400" },
};

const HEALTH_CONFIG: Record<ContainerStat["health"], { icon: React.ReactNode; color: string }> = {
  healthy:   { icon: <CheckCircle2 size={13} />, color: "text-emerald-400" },
  unhealthy: { icon: <AlertTriangle size={13} />, color: "text-red-400"     },
  starting:  { icon: <Loader2 size={13} className="animate-spin" />, color: "text-amber-400" },
  none:      { icon: <Clock size={13} />, color: "text-slate-400"           },
};

function ContainerCard({ container }: { container: ContainerStat }) {
  const st = STATUS_CONFIG[container.status];
  const hl = HEALTH_CONFIG[container.health];
  const isRunning = container.status === "running";

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all",
      isRunning
        ? "bg-card/60 border-border/40"
        : "bg-card/20 border-border/20 opacity-70"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background", st.dot,
            container.status === "running" && "animate-pulse")} />
          <span className="text-sm font-bold truncate">{container.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[10px] font-black uppercase", st.color)}>{st.label}</span>
          <span className={cn(hl.color)}>{hl.icon}</span>
        </div>
      </div>

      {/* Image */}
      <p className="text-[10px] font-mono text-muted-foreground truncate mb-3">{container.image}</p>

      {isRunning ? (
        <div className="space-y-2">
          {/* CPU bar */}
          <div className="flex items-center gap-2">
            <Cpu size={11} className="text-sky-400 shrink-0" />
            <SparkBar value={container.cpuPercent} color="#38bdf8" />
            <span className="text-[10px] tabular-nums font-bold text-sky-400 w-10 text-right">
              {container.cpuPercent.toFixed(1)}%
            </span>
          </div>
          {/* MEM bar */}
          <div className="flex items-center gap-2">
            <MemoryStick size={11} className="text-violet-400 shrink-0" />
            <SparkBar value={container.memUsed} max={container.memLimit || 1} color="#a78bfa" />
            <span className="text-[10px] tabular-nums font-bold text-violet-400 w-10 text-right">
              {formatBytes(container.memUsed, 0)}
            </span>
          </div>
          {/* Uptime */}
          <div className="flex items-center gap-1.5 pt-1">
            <Clock size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Uptime: {container.uptime}</span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Container inativo</p>
      )}
    </div>
  );
}

// ─── Main Monitor Component ───────────────────────────────────────────────────

interface SystemMonitorProps {
  apiUrl: string;
  apiKey: string;
}

const REFRESH_INTERVAL = 15_000;

export default function SystemMonitor({ apiUrl, apiKey }: SystemMonitorProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [spinning, setSpinning] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    setError(null);
    try {
      const data = await fetchSystemMetrics(apiUrl, apiKey);
      setMetrics(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar métricas");
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setSpinning(false), 600);
    }
  }, [apiUrl, apiKey]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm">Coletando métricas do sistema…</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !metrics) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <WifiOff size={32} className="text-red-400" />
        <p className="text-sm font-medium text-red-400">Sem acesso às métricas</p>
        <p className="text-xs text-center max-w-xs">{error ?? "Resposta inválida da API"}</p>
        <button
          onClick={() => load(true)}
          className="mt-2 text-xs font-black uppercase px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { cpu, memory, disks, containers } = metrics;

  // Color thresholds
  const cpuColor  = cpu.usage > 85  ? "#f87171" : cpu.usage > 60  ? "#fb923c" : "#38bdf8";
  const memColor  = memory.usePercent > 85 ? "#f87171" : memory.usePercent > 60 ? "#fb923c" : "#a78bfa";
  const diskColor = (p: number) => p > 85 ? "#f87171" : p > 60 ? "#fb923c" : "#34d399";

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <span className="text-sm font-bold">Monitor em tempo real</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[11px] text-muted-foreground">
              Atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            className="p-1.5 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
            title="Atualizar"
          >
            <RefreshCw size={14} className={spinning ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── CPU + Memory + Disk gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        {/* CPU */}
        <CircularGauge
          value={cpu.usage}
          color={cpuColor}
          label="CPU"
          sublabel={`${cpu.cores} núcleos · ${cpu.speed} GHz`}
        />

        {/* Memory */}
        <CircularGauge
          value={memory.usePercent}
          color={memColor}
          label="Memória RAM"
          sublabel={`${formatBytes(memory.used)} / ${formatBytes(memory.total)}`}
        />

        {/* Disk (first partition) */}
        {disks[0] && (
          <CircularGauge
            value={disks[0].usePercent}
            color={diskColor(disks[0].usePercent)}
            label="Disco"
            sublabel={`${formatBytes(disks[0].used)} / ${formatBytes(disks[0].total)}`}
          />
        )}
      </div>

      {/* ── CPU model info ── */}
      {cpu.model && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card/40 border border-border/30">
          <Cpu size={14} className="text-sky-400 shrink-0" />
          <span className="text-xs text-muted-foreground font-mono truncate">{cpu.model}</span>
        </div>
      )}

      {/* ── All disks ── */}
      {disks.length > 0 && (
        <div className="space-y-4 p-5 rounded-3xl bg-card/40 border border-border/30">
          <div className="flex items-center gap-2">
            <HardDrive size={15} className="text-emerald-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Partições de disco
            </p>
          </div>
          <div className="space-y-3">
            {disks.map((d) => (
              <HorizontalBar
                key={d.mount}
                value={d.usePercent}
                color={diskColor(d.usePercent)}
                label={`${d.mount}  (${d.fs})`}
                detail={`${formatBytes(d.available)} livre`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Containers ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Container size={15} className="text-primary" />
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Containers Docker
          </p>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {containers.filter((c) => c.status === "running").length}/{containers.length} rodando
          </span>
        </div>

        {containers.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card/20 border border-border/20 text-muted-foreground">
            <WifiOff size={16} />
            <p className="text-xs">Docker socket inacessível ou nenhum container encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {containers.map((c) => (
              <ContainerCard key={c.id} container={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
