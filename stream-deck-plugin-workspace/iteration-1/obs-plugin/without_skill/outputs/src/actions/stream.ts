import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs/client.js";

/**
 * Stream action — toggles OBS streaming on/off.
 * State 0 = idle (not live), State 1 = live.
 */
@action({ UUID: "com.dbroesch.obs.stream" })
export class StreamAction extends SingletonAction {
  private streaming = false;

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    await this.refresh();

    obs.on("StreamStateChanged", async (data: unknown) => {
      const { outputActive } = data as { outputActive: boolean };
      this.streaming = outputActive;
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
      await obs.toggleStream();
    } catch (err) {
      streamDeck.logger.error(`[Stream] Toggle failed: ${err}`);
      for (const action of this.actions) await action.showAlert();
    }
  }

  async update(streaming: boolean): Promise<void> {
    this.streaming = streaming;
    await this.updateAllActions();
  }

  private async refresh(): Promise<void> {
    if (!obs.isConnected) {
      await this.setDisconnectedState();
      return;
    }
    try {
      const status = await obs.getStreamStatus();
      this.streaming = status.outputActive;
      await this.updateAllActions();
    } catch (err) {
      streamDeck.logger.warn(`[Stream] Refresh failed: ${err}`);
    }
  }

  private async updateAllActions(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(this.streaming ? 1 : 0);
      await action.setTitle(this.streaming ? "LIVE" : "Stream");
    }
  }

  private async setDisconnectedState(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(0);
      await action.setTitle("OBS\nOffline");
    }
  }
}
