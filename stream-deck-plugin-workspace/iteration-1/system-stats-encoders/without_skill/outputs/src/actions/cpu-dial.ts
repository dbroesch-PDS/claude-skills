import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { SystemStatsService } from "../services/system-stats.js";

/**
 * CPU Usage dial — shows live CPU % on the touch strip.
 * Rotating does nothing (read-only). Pressing refreshes all stats immediately.
 */
@action({ UUID: "com.dbroesch.systemstats.cpu" })
export class CpuDial extends SingletonAction {
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
    const cpu = this.stats.lastCpu;
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "CPU",
        value: `${cpu.toFixed(0)}%`,
        indicator: { value: Math.round(cpu), enabled: true },
      });
    }
  }
}
