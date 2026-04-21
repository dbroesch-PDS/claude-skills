import { execSync } from "child_process";
import * as os from "os";
import streamDeck from "@elgato/streamdeck";

export interface CpuSnapshot {
  /** CPU usage percentage 0–100 */
  pct: number;
}

export interface RamSnapshot {
  usedGb: number;
  totalGb: number;
  /** Percentage used 0–100 */
  pct: number;
}

export interface NetworkSnapshot {
  /** Combined TX+RX in MB/s */
  totalMbps: number;
  /** 0–100 scaled against NET_CEILING_MBPS for the indicator bar */
  indicatorPct: number;
}

/** The indicator bar saturates at this throughput (100 MB/s ≈ 800 Mbit/s). */
const NET_CEILING_MBPS = 100;

/**
 * SystemStatsService — collects CPU, RAM, and network metrics.
 *
 * CPU is measured by sampling /proc-style CPU times (macOS uses `top` or `ps`
 * for an instantaneous reading). We use two consecutive reads of `os.cpus()`
 * with a short gap to compute a delta-based usage percentage — the same
 * technique used by most Node monitoring tools.
 *
 * Network is measured by reading `netstat -ib` twice and computing bytes/s.
 *
 * Call `start()` once after construction to begin polling.
 * Observers register via `onUpdate`.
 */
export class SystemStatsService {
  private _lastCpu: number = 0;
  private _lastRam: RamSnapshot = { usedGb: 0, totalGb: 0, pct: 0 };
  private _lastNetwork: NetworkSnapshot = { totalMbps: 0, indicatorPct: 0 };

  private _observers: Array<() => Promise<void>> = [];
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  // For CPU delta calculation
  private _prevCpuTimes: os.CpuInfo[] | null = null;

  // For network delta calculation
  private _prevNetBytes: number | null = null;
  private _prevNetTime: number | null = null;

  get lastCpu(): number {
    return this._lastCpu;
  }

  get lastRam(): RamSnapshot {
    return this._lastRam;
  }

  get lastNetwork(): NetworkSnapshot {
    return this._lastNetwork;
  }

  /** Register a callback invoked after every refresh cycle. */
  onUpdate(cb: () => Promise<void>): void {
    this._observers.push(cb);
  }

  /** Start polling every `intervalMs` milliseconds (default 3000). */
  start(intervalMs = 3000): void {
    // Do an immediate read
    void this._poll();
    this._pollTimer = setInterval(() => void this._poll(), intervalMs);
  }

  /** Stop the polling interval. */
  stop(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Force an immediate refresh outside the normal poll cycle.
   * Called when the user presses any dial.
   */
  async forceRefresh(): Promise<void> {
    await this._poll();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _poll(): Promise<void> {
    try {
      this._lastCpu = this._readCpu();
      this._lastRam = this._readRam();
      this._lastNetwork = this._readNetwork();

      for (const cb of this._observers) {
        await cb();
      }
    } catch (err) {
      streamDeck.logger.error(`SystemStatsService poll error: ${err}`);
    }
  }

  /** Compute CPU usage % using a delta between two os.cpus() snapshots. */
  private _readCpu(): number {
    const current = os.cpus();

    if (!this._prevCpuTimes) {
      // First call — store snapshot and return 0; next call will have a delta.
      this._prevCpuTimes = current;
      return this._lastCpu; // keep previous value
    }

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < current.length; i++) {
      const prev = this._prevCpuTimes[i];
      const curr = current[i];

      const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
      const currTotal = Object.values(curr.times).reduce((a, b) => a + b, 0);

      totalTick += currTotal - prevTotal;
      totalIdle += curr.times.idle - prev.times.idle;
    }

    this._prevCpuTimes = current;

    if (totalTick === 0) return this._lastCpu;
    return Math.max(0, Math.min(100, ((totalTick - totalIdle) / totalTick) * 100));
  }

  /** Read RAM from os.totalmem / os.freemem. */
  private _readRam(): RamSnapshot {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;

    const GB = 1024 ** 3;
    const totalGb = totalBytes / GB;
    const usedGb = usedBytes / GB;
    const pct = (usedBytes / totalBytes) * 100;

    return { usedGb, totalGb, pct };
  }

  /**
   * Read combined network bytes by parsing `netstat -ib` (macOS).
   * Computes MB/s since last call.
   */
  private _readNetwork(): NetworkSnapshot {
    let totalBytes = 0;

    try {
      // netstat -ib prints one row per interface with columns:
      // Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
      const output = execSync("netstat -ib", { encoding: "utf8", timeout: 2000 });
      const lines = output.split("\n");

      const seen = new Set<string>();

      for (const line of lines.slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;

        const iface = parts[0];
        // Skip loopback and skip duplicates (netstat can list same iface twice)
        if (iface.startsWith("lo") || seen.has(iface)) continue;
        seen.add(iface);

        const ibytes = parseInt(parts[6], 10);
        const obytes = parseInt(parts[9], 10);

        if (!isNaN(ibytes) && !isNaN(obytes)) {
          totalBytes += ibytes + obytes;
        }
      }
    } catch (err) {
      streamDeck.logger.warn(`Network read failed: ${err}`);
      return this._lastNetwork;
    }

    const now = Date.now();

    if (this._prevNetBytes === null || this._prevNetTime === null) {
      this._prevNetBytes = totalBytes;
      this._prevNetTime = now;
      return this._lastNetwork;
    }

    const elapsedSec = (now - this._prevNetTime) / 1000;
    const deltaMb = (totalBytes - this._prevNetBytes) / (1024 * 1024);
    const totalMbps = elapsedSec > 0 ? Math.max(0, deltaMb / elapsedSec) : 0;

    this._prevNetBytes = totalBytes;
    this._prevNetTime = now;

    const indicatorPct = Math.min(100, (totalMbps / NET_CEILING_MBPS) * 100);

    return { totalMbps, indicatorPct };
  }
}
