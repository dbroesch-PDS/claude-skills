import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obsService, OBSState } from "../services/obs-websocket.js";

@action({ UUID: "com.dbroesch.obs.record" })
export class RecordAction extends SingletonAction {
  private isRecording = false;

  constructor() {
    super();
    obsService.onStateChange((state: OBSState) => {
      if (state.recording !== this.isRecording || state.connected !== undefined) {
        this.isRecording = state.recording;
        this.updateAll(state);
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const state = obsService.currentState;
    this.isRecording = state.recording;
    await this.updateButton(ev.action, state);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!obsService.isConnected) {
      await ev.action.showAlert();
      streamDeck.logger.warn("RecordAction: OBS not connected");
      return;
    }
    try {
      await obsService.toggleRecording();
      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`RecordAction: toggle failed: ${err}`);
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
    await action.setState(state.recording ? 1 : 0);
    await action.setTitle(state.recording ? "Stop REC" : "Record");
  }
}
