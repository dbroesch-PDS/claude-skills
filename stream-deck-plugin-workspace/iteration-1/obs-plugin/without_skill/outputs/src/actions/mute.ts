import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs/client.js";
import type { MuteSettings } from "../obs/types.js";

interface InputMuteStateChangedEvent {
  inputName: string;
  inputMuted: boolean;
}

/**
 * Mic Mute action — toggles the configured OBS audio input.
 * State 0 = unmuted (mic on), State 1 = muted.
 *
 * The user configures which OBS input to control (e.g. "Mic/Aux") via
 * the Property Inspector. Defaults to "Mic/Aux" if not set.
 */
@action({ UUID: "com.dbroesch.obs.mute" })
export class MuteAction extends SingletonAction<MuteSettings> {
  private muted = false;
  private boundHandler: ((data: unknown) => Promise<void>) | null = null;

  override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
    const inputName = ev.payload.settings.inputName ?? "Mic/Aux";
    await this.refresh(inputName);

    // Listen for mute events from OBS — filter to the configured input
    this.boundHandler = async (data: unknown) => {
      const { inputName: changedInput, inputMuted } = data as InputMuteStateChangedEvent;
      if (changedInput === inputName) {
        this.muted = inputMuted;
        await this.updateAllActions();
      }
    };
    obs.on("InputMuteStateChanged", this.boundHandler);

    obs.on("Connected", async () => {
      await this.refresh(inputName);
    });
  }

  override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
    if (!obs.isConnected) {
      for (const action of this.actions) await action.showAlert();
      return;
    }
    const inputName = ev.payload.settings.inputName ?? "Mic/Aux";
    try {
      await obs.toggleInputMute(inputName);
    } catch (err) {
      streamDeck.logger.error(`[Mute] Toggle failed: ${err}`);
      for (const action of this.actions) await action.showAlert();
    }
  }

  async update(muted: boolean): Promise<void> {
    this.muted = muted;
    await this.updateAllActions();
  }

  private async refresh(inputName: string): Promise<void> {
    if (!obs.isConnected) {
      await this.setDisconnectedState();
      return;
    }
    try {
      this.muted = await obs.getInputMute(inputName);
      await this.updateAllActions();
    } catch (err) {
      streamDeck.logger.warn(`[Mute] Refresh failed for "${inputName}": ${err}`);
      // Input may not exist; show a neutral state
      for (const action of this.actions) {
        await action.setState(0);
        await action.setTitle("No\nInput");
      }
    }
  }

  private async updateAllActions(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(this.muted ? 1 : 0);
      await action.setTitle(this.muted ? "MUTED" : "Mic On");
    }
  }

  private async setDisconnectedState(): Promise<void> {
    for (const action of this.actions) {
      await action.setState(0);
      await action.setTitle("OBS\nOffline");
    }
  }
}
