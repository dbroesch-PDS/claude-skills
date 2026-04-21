import { action, KeyDownEvent, SingletonAction, WillAppearEvent, SendToPluginEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obsService, OBSState } from "../services/obs-websocket.js";

interface SceneSettings {
  sceneName?: string;
}

interface ScenePIMessage {
  action: string;
}

@action({ UUID: "com.dbroesch.obs.scene" })
export class SceneAction extends SingletonAction<SceneSettings> {
  private currentScene = "";

  constructor() {
    super();
    obsService.onStateChange((state: OBSState) => {
      this.currentScene = state.currentScene;
      this.updateAll(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<SceneSettings>): Promise<void> {
    const state = obsService.currentState;
    this.currentScene = state.currentScene;
    await this.updateButton(ev.action, state);
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
    if (!obsService.isConnected) {
      await ev.action.showAlert();
      streamDeck.logger.warn("SceneAction: OBS not connected");
      return;
    }
    const settings = await ev.action.getSettings();
    const sceneName = settings.sceneName;
    if (!sceneName) {
      await ev.action.showAlert();
      streamDeck.logger.warn("SceneAction: no scene name configured");
      return;
    }
    try {
      await obsService.switchScene(sceneName);
      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`SceneAction: switch failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<ScenePIMessage, SceneSettings>): Promise<void> {
    if (ev.payload.action === "getScenes") {
      try {
        const scenes = await obsService.getSceneList();
        // Send scene list back to the property inspector
        await streamDeck.ui.current?.sendToPropertyInspector({ scenes });
      } catch (err) {
        streamDeck.logger.error(`SceneAction: getScenes failed: ${err}`);
      }
    }
  }

  private async updateAll(state: OBSState): Promise<void> {
    for (const action of this.actions) {
      await this.updateButton(action, state);
    }
  }

  private async updateButton(
    action: {
      setState: (state: number) => Promise<void>;
      setTitle: (title: string) => Promise<void>;
      getSettings: () => Promise<SceneSettings>;
    },
    state: OBSState
  ): Promise<void> {
    if (!state.connected) {
      await action.setState(0);
      await action.setTitle("No OBS");
      return;
    }

    const settings = await action.getSettings();
    const thisScene = settings.sceneName ?? "";
    const isActive = thisScene !== "" && thisScene === state.currentScene;

    // Show the scene name on the button (truncated to fit)
    const displayName = thisScene || "Set Scene";
    const label = isActive ? `> ${displayName}` : displayName;

    await action.setState(isActive ? 1 : 0);
    await action.setTitle(truncate(label, 12));
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
