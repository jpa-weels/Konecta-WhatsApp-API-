import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import Docker from "dockerode";
import { logger } from "../logger";

const execAsync = promisify(exec);

// Docker socket: Linux container usa /var/run/docker.sock; Windows host usa named pipe
const DOCKER_SOCKET =
  process.env.DOCKER_SOCKET ??
  (process.platform === "win32"
    ? "//./pipe/docker_engine"
    : "/var/run/docker.sock");

let docker: Docker | null = null;

function getDocker(): Docker {
  if (!docker) {
    docker = new Docker({ socketPath: DOCKER_SOCKET });
  }
  return docker;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiskInfo {
  fs: string;
  total: number;
  used: number;
  available: number;
  usePercent: number;
  mount: string;
}

export interface ContainerStat {
  id: string;
  name: string;
  image: string;
  status: "running" | "paused" | "stopped" | "error" | "unknown";
  state: string;
  health: "healthy" | "unhealthy" | "starting" | "none";
  cpuPercent: number;
  memUsed: number;
  memLimit: number;
  memPercent: number;
  uptime: string;
}

export interface SystemMetrics {
  cpu: { usage: number; cores: number; model: string; speed: number };
  memory: { total: number; used: number; free: number; usePercent: number };
  disks: DiskInfo[];
  containers: ContainerStat[];
  collectedAt: number;
}

// ─── CPU (os module, 200ms sample) ───────────────────────────────────────────

function cpuSample(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) {
      total += t;
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

async function getCpuUsage(): Promise<number> {
  const before = cpuSample();
  await new Promise((r) => setTimeout(r, 200));
  const after = cpuSample();
  const idle = after.idle - before.idle;
  const total = after.total - before.total;
  if (total === 0) return 0;
  return Math.max(0, 100 - (idle / total) * 100);
}

function getCpuInfo() {
  const cpus = os.cpus();
  const first = cpus[0];
  return {
    cores: cpus.length,
    model: first?.model?.trim() ?? "Desconhecido",
    speed: first ? first.speed / 1000 : 0, // GHz
  };
}

// ─── Memory (os module) ───────────────────────────────────────────────────────

function getMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return { total, used, free, usePercent: (used / total) * 100 };
}

// ─── Disk (df -k on Linux, wmic on Windows) ───────────────────────────────────

async function getDisks(): Promise<DiskInfo[]> {
  try {
    if (process.platform === "win32") {
      // Windows: use wmic
      const { stdout } = await execAsync(
        'wmic logicaldisk get Caption,FreeSpace,Size /format:csv'
      );
      return stdout
        .split("\n")
        .slice(2)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((line) => {
          const [, caption, freeSpace, size] = line.split(",");
          const total = parseInt(size ?? "0", 10) || 0;
          const free = parseInt(freeSpace ?? "0", 10) || 0;
          const used = total - free;
          return {
            fs: caption ?? "?",
            total,
            used,
            available: free,
            usePercent: total > 0 ? (used / total) * 100 : 0,
            mount: caption ?? "?",
          };
        })
        .filter((d) => d.total > 0);
    } else {
      // Linux/macOS: df -k
      const { stdout } = await execAsync("df -k --output=source,size,used,avail,pcent,target 2>/dev/null || df -k");
      const lines = stdout.trim().split("\n").slice(1); // skip header
      return lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const total = parseInt(parts[1] ?? "0", 10) * 1024;
          const used  = parseInt(parts[2] ?? "0", 10) * 1024;
          const avail = parseInt(parts[3] ?? "0", 10) * 1024;
          const pct   = parseInt((parts[4] ?? "0").replace("%", ""), 10);
          const mount = parts[5] ?? "/";
          return { fs: parts[0] ?? "?", total, used, available: avail, usePercent: pct, mount };
        })
        .filter((d) =>
          d.total > 0 &&
          !d.fs.startsWith("tmpfs") &&
          !d.fs.startsWith("shm") &&
          d.fs !== "none" &&
          d.mount !== "/dev" &&
          !d.mount.includes("docker.sock")
        )
        // Deduplica partições com mesmo tamanho total (overlay duplica /dev/sdX)
        .filter((d, idx, arr) => arr.findIndex((x) => x.total === d.total) === idx)
        .slice(0, 4);
    }
  } catch (err) {
    logger.warn({ err }, "Erro ao coletar info de disco");
    return [];
  }
}

// ─── Docker containers ────────────────────────────────────────────────────────

function formatUptime(createdUnix: number): string {
  if (!createdUnix) return "–";
  const diff = Date.now() - createdUnix * 1000;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function calcCpuPercent(stats: any): number {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
    const numCpus  = stats.cpu_stats.online_cpus ?? stats.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
    if (sysDelta <= 0 || cpuDelta < 0) return 0;
    return (cpuDelta / sysDelta) * numCpus * 100;
  } catch {
    return 0;
  }
}

function mapStatus(state: string): ContainerStat["status"] {
  const map: Record<string, ContainerStat["status"]> = {
    running: "running", paused: "paused",
    exited: "stopped", dead: "error",
    created: "stopped", restarting: "stopped",
  };
  return map[state] ?? "unknown";
}

function parseHealth(statusStr: string): ContainerStat["health"] {
  if (statusStr.includes("(healthy)"))          return "healthy";
  if (statusStr.includes("(unhealthy)"))        return "unhealthy";
  if (statusStr.includes("(health: starting)")) return "starting";
  return "none";
}

async function getContainers(): Promise<ContainerStat[]> {
  try {
    const d = getDocker();
    // quick ping to verify socket
    await d.ping();
    const list = await d.listContainers({ all: true });

    return await Promise.all(
      list.map(async (info): Promise<ContainerStat> => {
        const name   = (info.Names[0] ?? "").replace(/^\//, "");
        const state  = info.State;
        const status = mapStatus(state);
        const health = parseHealth(info.Status ?? "");

        let cpuPercent = 0, memUsed = 0, memLimit = 0, memPercent = 0;

        if (state === "running") {
          try {
            const rawStats = await d.getContainer(info.Id).stats({ stream: false }) as any;
            cpuPercent = calcCpuPercent(rawStats);
            memUsed    = rawStats.memory_stats?.usage ?? 0;
            memLimit   = rawStats.memory_stats?.limit ?? 0;
            memPercent = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;
          } catch {
            // stats unavailable — leave zeros
          }
        }

        return {
          id: info.Id.slice(0, 12),
          name,
          image: info.Image,
          status,
          state,
          health,
          cpuPercent,
          memUsed,
          memLimit,
          memPercent,
          uptime: formatUptime(info.Created),
        };
      })
    );
  } catch (err) {
    logger.warn({ err, socket: DOCKER_SOCKET }, "Docker inacessível — containers não monitorados");
    return [];
  }
}

// ─── Main collector ───────────────────────────────────────────────────────────

export async function collectSystemMetrics(): Promise<SystemMetrics> {
  const [cpuUsage, disks, containers] = await Promise.all([
    getCpuUsage(),
    getDisks(),
    getContainers(),
  ]);

  const { cores, model, speed } = getCpuInfo();
  const memory = getMemory();

  return {
    cpu:    { usage: cpuUsage, cores, model, speed },
    memory,
    disks,
    containers,
    collectedAt: Date.now(),
  };
}
