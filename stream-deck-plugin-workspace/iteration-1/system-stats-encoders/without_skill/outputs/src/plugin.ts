import streamDeck from "@elgato/streamdeck";
import { CpuDial } from "./actions/cpu-dial.js";
import { RamDial } from "./actions/ram-dial.js";
import { NetworkDial } from "./actions/network-dial.js";
import { SystemStatsService } from "./services/system-stats.js";

// ── Shared service ──────────────────────────────────────────────────────────
const stats = new SystemStatsService();

// ── Action instances (hold references so we can call .refresh()) ─────────────
const cpuDial = new CpuDial(stats);
const ramDial = new RamDial(stats);
const networkDial = new NetworkDial(stats);

// ── Register all actions ─────────────────────────────────────────────────────
streamDeck.actions.registerAction(cpuDial);
streamDeck.actions.registerAction(ramDial);
streamDeck.actions.registerAction(networkDial);

// ── Subscribe to stats updates → push to all dials ──────────────────────────
stats.onUpdate(async () => {
  await Promise.allSettled([
    cpuDial.refresh(),
    ramDial.refresh(),
    networkDial.refresh(),
  ]);
});

// ── Start polling every 3 seconds ────────────────────────────────────────────
stats.start(3000);

streamDeck.logger.info("System Stats plugin started");

// ── Connect to Stream Deck (must be last) ────────────────────────────────────
await streamDeck.connect();
