import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obsService, OBSState } from "../services/obs-websocket.js";

@action({ UUID: "com.dbroesch.obs.stream" })
export class StreamAction extends SingletonAction {
  private isStreaming = false;

  constructor() {
    super();
    obsService.onStateChange((state: OBSState) => {
      this.isStreaming = state.streaming;
      this.updateAll(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const state = obsService.currentState;
    this.isStreaming = state.streaming;
    await this.updateButton(ev.action, state);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!obsService.isConnected) {
      await ev.action.showAlert();
      streamDeck.logger.warn("StreamAction: OBS not connected");
      return;
    }
    try {
      await obsService.toggleStreaming();
      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`StreamAction: toggle failed: ${err}`);
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
    await action.setState(state.streaming ? 1 : 0);
    await action.setTitle(state.streaming ? "LIVE" : "Stream");
  }
}
