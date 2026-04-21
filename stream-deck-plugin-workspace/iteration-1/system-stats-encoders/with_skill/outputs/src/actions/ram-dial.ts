import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { SystemStats } from "../services/system-stats.js";

@action({ UUID: "com.dbroesch.systemstats.ram" })
export class RamDial extends SingletonAction {
  /** Called by plugin.ts when a fresh stats snapshot is available. */
  async update(stats: SystemStats): Promise<void> {
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "RAM",
        value: `${stats.ramUsedGB.toFixed(1)}/${stats.ramTotalGB.toFixed(0)}GB`,
        indicator: { value: stats.ramPercent, enabled: true },
      });
    }
  }

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    for (const action of this.actions) {
      if (!action.isDial()) continue;
      await action.setFeedback({
        title: "RAM",
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
