import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { SystemStatsService } from "../services/system-stats.js";

/**
 * Network Activity dial — shows combined TX+RX throughput.
 * The indicator bar is scaled against a configurable ceiling (default 100 MB/s).
 * Rotating does nothing (read-only). Pressing refreshes all stats immediately.
 */
@action({ UUID: "com.dbroesch.systemstats.network" })
export class NetworkDial extends SingletonAction {
  constructor(private readonly stats: SystemStatsService) {
    super();
  }

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    await this.refresh();
  }

  /** Rotation is intentionally a no-op — this is a read-only display. */
  override async onDialRotate(_ev: DialRotateEvent): Promise<void> {
    // no-op
  }

  /** Press any dial → refresh all stats immediately via the shared service. */
  override async onDialDown(_ev: DialDownEvent): Promise<void> {
    await this.stats.forceRefresh();
  }

  async refresh(): Promise<void> {
    const { totalMbps, indicatorPct } = this.stats.lastNetwork;
    const label = formatRate(totalMbps);
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "Net",
        value: label,
        indicator: { value: Math.round(indicatorPct), enabled: true },
      });
    }
  }
}

/** Format MB/s into a human-readable label, switching to KB/s for small values. */
function formatRate(mbps: number): string {
  if (mbps < 1) {
    return `${(mbps * 1024).toFixed(0)}K/s`;
  }
  return `${mbps.toFixed(1)}M/s`;
}
