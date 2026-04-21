import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obsService, OBSState } from "../services/obs-websocket.js";

interface MuteSettings {
  micSourceName?: string;
}

@action({ UUID: "com.dbroesch.obs.mute" })
export class MuteAction extends SingletonAction<MuteSettings> {
  private isMuted = false;

  constructor() {
    super();
    obsService.onStateChange((state: OBSState) => {
      this.isMuted = state.micMuted;
      this.updateAll(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<MuteSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    if (settings.micSourceName) {
      obsService.setMicSourceName(settings.micSourceName);
    }
    const state = obsService.currentState;
    this.isMuted = state.micMuted;
    await this.updateButton(ev.action, state);
  }

  override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
    if (!obsService.isConnected) {
      await ev.action.showAlert();
      streamDeck.logger.warn("MuteAction: OBS not connected");
      return;
    }
    try {
      const settings = await ev.action.getSettings();
      await obsService.toggleMute(settings.micSourceName);
      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`MuteAction: toggle failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  private async updateAll(state: OBSState): Promise<void> {
    for (const action of this.actions) {
      await this.updateButton(action, state);
    }
  }

  private async updateButton(
    action: { setState: (state: number) => Promise<void>; setTitle: (title: string) => Promise<void> },
    state: OBSState
  ): Promise<void> {
    if (!state.connected) {
      await action.setState(0);
      await action.setTitle("No OBS");
      return;
    }
    await action.setState(state.micMuted ? 1 : 0);
    await action.setTitle(state.micMuted ? "MUTED" : "Mic ON");
  }
}
