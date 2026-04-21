import os from "node:os";

export interface SystemStats {
  cpuPercent: number;      // 0–100
  ramPercent: number;      // 0–100
  ramUsedGB: number;
  ramTotalGB: number;
  networkRxKbps: number;   // receive KB/s
  networkTxKbps: number;   // transmit KB/s
  networkTotalKbps: number;
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

interface NetSnapshot {
  rx: number;
  tx: number;
  ts: number;
}

/**
 * Reads raw CPU times from os.cpus() and returns per-core snapshots.
 */
function getCpuSnapshot(): CpuSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const val of Object.values(cpu.times)) {
      total += val;
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/**
 * Reads /proc/net/dev (Linux) or falls back to 0 on macOS.
 * On macOS we use `netstat -ib` via child_process for accurate stats.
 */
async function getNetSnapshot(): Promise<NetSnapshot> {
  const ts = Date.now();
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    // netstat -ib outputs interface stats including bytes in/out
    const { stdout } = await execFileAsync("netstat", ["-ib"]);
    const lines = stdout.split("\n");

    let totalRx = 0;
    let totalTx = 0;

    // Header line: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
    // We want Ibytes (index 6) and Obytes (index 9) for real interfaces
    for (const line of lines.slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const name = parts[0];
      // Skip loopback and virtual interfaces
      if (name.startsWith("lo") || name.startsWith("utun") || name.startsWith("ipsec")) continue;
      // Only count physical/wifi interfaces (en*, bridge*, etc.)
      const ibytes = parseInt(parts[6], 10);
      const obytes = parseInt(parts[9], 10);
      if (!isNaN(ibytes)) totalRx += ibytes;
      if (!isNaN(obytes)) totalTx += obytes;
    }

    return { rx: totalRx, tx: totalTx, ts };
  } catch {
    return { rx: 0, tx: 0, ts };
  }
}

export class SystemStatsService {
  private lastCpu: CpuSnapshot | null = null;
  private lastNet: NetSnapshot | null = null;

  /**
   * Collects current system stats. The first call returns 0 for CPU and network
   * since we need two samples to compute deltas.
   */
  async collect(): Promise<SystemStats> {
    const cpuNow = getCpuSnapshot();
    const netNow = await getNetSnapshot();

    // --- CPU ---
    let cpuPercent = 0;
    if (this.lastCpu) {
      const idleDelta = cpuNow.idle - this.lastCpu.idle;
      const totalDelta = cpuNow.total - this.lastCpu.total;
      cpuPercent = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
      cpuPercent = Math.max(0, Math.min(100, cpuPercent));
    }
    this.lastCpu = cpuNow;

    // --- RAM ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);
    const ramUsedGB = usedMem / (1024 ** 3);
    const ramTotalGB = totalMem / (1024 ** 3);

    // --- Network ---
    let networkRxKbps = 0;
    let networkTxKbps = 0;
    if (this.lastNet && this.lastNet.rx > 0) {
      const elapsedSec = (netNow.ts - this.lastNet.ts) / 1000;
      if (elapsedSec > 0) {
        networkRxKbps = Math.max(0, (netNow.rx - this.lastNet.rx) / 1024 / elapsedSec);
        networkTxKbps = Math.max(0, (netNow.tx - this.lastNet.tx) / 1024 / elapsedSec);
      }
    }
    this.lastNet = netNow;

    const networkTotalKbps = networkRxKbps + networkTxKbps;

    return {
      cpuPercent,
      ramPercent,
      ramUsedGB,
      ramTotalGB,
      networkRxKbps,
      networkTxKbps,
      networkTotalKbps,
    };
  }
}
