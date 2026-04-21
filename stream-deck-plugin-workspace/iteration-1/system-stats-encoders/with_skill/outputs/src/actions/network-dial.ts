import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { SystemStats } from "../services/system-stats.js";

/**
 * Formats a KB/s value into a human-readable string.
 * Below 1000 KB/s shown as KB/s, above as MB/s.
 */
function formatRate(kbps: number): string {
  if (kbps >= 1024) {
    return `${(kbps / 1024).toFixed(1)} MB/s`;
  }
  return `${Math.round(kbps)} KB/s`;
}

/**
 * Clamps a network rate to a 0–100 indicator value.
 * We treat 100 MB/s (102400 KB/s) as the "full" reference so the
 * bar is still meaningful for typical consumer connections.
 */
function rateToIndicator(kbps: number): number {
  const MAX_KBPS = 100 * 1024; // 100 MB/s reference ceiling
  return Math.min(100, Math.round((kbps / MAX_KBPS) * 100));
}

@action({ UUID: "com.dbroesch.systemstats.network" })
export class NetworkDial extends SingletonAction {
  /** Called by plugin.ts when a fresh stats snapshot is available. */
  async update(stats: SystemStats): Promise<void> {
    const total = stats.networkRxKbps + stats.networkTxKbps;
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "Net",
        value: formatRate(total),
        indicator: { value: rateToIndicator(total), enabled: true },
      });
    }
  }

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "Net",
        value: "—",
        indicator: { value: 0, enabled: true },
      });
    }
  }

  /** Rotation does nothing — this is a read-only display. */
  override async onDialRotate(_ev: DialRotateEvent): Promise<void> {
    // intentionally empty
  }

  /** Pressing the dial triggers an immediate refresh (handled in plugin.ts). */
  override async onDialDown(_ev: DialDownEvent): Promise<void> {
    // handled centrally in plugin.ts
  }
}
