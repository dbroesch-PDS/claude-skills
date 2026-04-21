import streamDeck from "@elgato/streamdeck";
import { CpuDial } from "./actions/cpu-dial.js";
import { RamDial } from "./actions/ram-dial.js";
import { NetworkDial } from "./actions/network-dial.js";
import { SystemStatsService } from "./services/system-stats.js";

// ── Instantiate actions ──────────────────────────────────────────────────────
const cpuDial = new CpuDial();
const ramDial = new RamDial();
const networkDial = new NetworkDial();

streamDeck.actions.registerAction(cpuDial);
streamDeck.actions.registerAction(ramDial);
streamDeck.actions.registerAction(networkDial);

// ── Stats service ────────────────────────────────────────────────────────────
const statsService = new SystemStatsService();

/**
 * Fetches a fresh stats snapshot and pushes it to all three dials.
 * A seed call is made immediately so the service captures a baseline CPU/net
 * snapshot before the first display update 3 seconds later.
 */
async function refreshStats(): Promise<void> {
  try {
    const stats = await statsService.collect();
    await Promise.all([
      cpuDial.update(stats),
      ramDial.update(stats),
      networkDial.update(stats),
    ]);
  } catch (err) {
    streamDeck.logger.warn(`Stats refresh failed: ${err}`);
  }
}

// Seed call — captures baseline for delta calculations; no display update yet
// because actions may not be visible yet. The 3 s interval will fire first.
statsService.collect().catch(() => { /* ignore seed errors */ });

// Regular 3-second polling interval
setInterval(refreshStats, 3000);

// ── Press-to-refresh: patch each action's onDialDown ────────────────────────
// We override the method at plugin level so pressing any of the three dials
// triggers an immediate stats refresh across all three displays.

const _cpuDown = cpuDial.onDialDown.bind(cpuDial);
cpuDial.onDialDown = async (ev) => {
  await _cpuDown(ev);
  await refreshStats();
};

const _ramDown = ramDial.onDialDown.bind(ramDial);
ramDial.onDialDown = async (ev) => {
  await _ramDown(ev);
  await refreshStats();
};

const _netDown = networkDial.onDialDown.bind(networkDial);
networkDial.onDialDown = async (ev) => {
  await _netDown(ev);
  await refreshStats();
};

// ── Connect ──────────────────────────────────────────────────────────────────
await streamDeck.connect();
