import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs/client.js";

/**
 * Record action — toggles OBS recording on/off.
 * State 0 = idle (not recording), State 1 = recording.
 */
@action({ UUID: "com.dbroesch.obs.record" })
export class RecordAction extends SingletonAction {
  private recording = false;

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    await this.refresh();

    // React to OBS events so the button stays in sync without polling
    obs.on("RecordStateChanged", async (data: unknown) => {
      const { outputActive } = data as { outputActive: boolean };
      this.recording = outputActive;
      await this.updateAllActions();
    });

    obs.on("Connected", async () => {
      await this.refresh();
    });
  }

  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    if (!obs.isConnected) {
      for (const action of this.actions) await action.showAlert();
      return;
    }
    try {
      await obs.toggleRecord();
      // State update will arrive via RecordStateChanged event
    } catch (err) {
      streamDeck.logger.error(`[Record] Toggle failed: ${err}`);
      for (const action of this.actions) await action.showAlert();
    }
  }

  /** Called from plugin.ts after polling */
  async update(recording: boolean): Promise<void> {
    this.recording = recording;
    await this.updateAllActions();
  }

  private async refresh(): Promise<void> {
    if (!obs.isConnected) {
      await this.setDisconnectedState();
      return;
    }
    try {
      const status = await obs.getRecordStatus();
      this.recording = status.outputActive;
      await this.updateAllActions();
    } catch (err) {
      streamDeck.logger.warn(`[Record] Refresh failed: ${err}`);
    }
  }

  private async updateAllActions(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(this.recording ? 1 : 0);
      await action.setTitle(this.recording ? "REC" : "Record");
    }
  }

  private async setDisconnectedState(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(0);
      await action.setTitle("OBS\nOffline");
    }
  }
}
