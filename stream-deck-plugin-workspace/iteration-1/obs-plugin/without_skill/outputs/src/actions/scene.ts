import {
  action,
  KeyDownEvent,
  SendToPluginEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs/client.js";
import type { SceneSettings } from "../obs/types.js";

interface CurrentProgramSceneChangedEvent {
  currentProgramSceneName: string;
}

interface SendToPluginPayload {
  action: string;
  scenes?: string[];
}

/**
 * Scene Switcher action — each button instance is bound to one scene name.
 * Shows the scene name on the button. Highlights (state 1) when that scene
 * is the current program scene.
 *
 * The Property Inspector lets the user pick from the live scene list.
 */
@action({ UUID: "com.dbroesch.obs.scene" })
export class SceneAction extends SingletonAction<SceneSettings> {
  private currentScene = "";

  override async onWillAppear(ev: WillAppearEvent<SceneSettings>): Promise<void> {
    await this.refresh(ev.payload.settings.sceneName);

    obs.on("CurrentProgramSceneChanged", async (data: unknown) => {
      const { currentProgramSceneName } = data as CurrentProgramSceneChangedEvent;
      this.currentScene = currentProgramSceneName;
      await this.updateAction(ev.action, ev.payload.settings.sceneName);
    });

    obs.on("Connected", async () => {
      await this.refresh(ev.payload.settings.sceneName);
      // Send fresh scene list to PI when connection is established
      await this.sendSceneListToPI(ev.action);
    });
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
    if (!obs.isConnected) {
      await ev.action.showAlert();
      return;
    }
    const sceneName = ev.payload.settings.sceneName;
    if (!sceneName) {
      await ev.action.showAlert();
      return;
    }
    try {
      await obs.setCurrentScene(sceneName);
    } catch (err) {
      streamDeck.logger.error(`[Scene] Switch failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from the Property Inspector (e.g. "getScenes" request).
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<SendToPluginPayload, SceneSettings>
  ): Promise<void> {
    if (ev.payload.action === "getScenes") {
      await this.sendSceneListToPI(ev.action);
    }
  }

  private async refresh(sceneName?: string): Promise<void> {
    if (!obs.isConnected) {
      for (const action of this.actions) {
        await action.setState(0);
        await action.setTitle("OBS\nOffline");
      }
      return;
    }

    try {
      this.currentScene = await obs.getCurrentScene();
    } catch (err) {
      streamDeck.logger.warn(`[Scene] Could not get current scene: ${err}`);
    }

    for (const action of this.actions) {
      await this.updateAction(action, sceneName);
    }
  }

  private async updateAction(
    actionInst: { setState(s: number): Promise<void>; setTitle(t: string): Promise<void> },
    sceneName?: string
  ): Promise<void> {
    const label = sceneName
      ? this.abbreviate(sceneName)
      : "Select\nScene";
    const isActive = !!sceneName && sceneName === this.currentScene;
    await actionInst.setState(isActive ? 1 : 0);
    await actionInst.setTitle(label);
  }

  private async sendSceneListToPI(
    actionInst: { sendToPropertyInspector(payload: unknown): Promise<void> }
  ): Promise<void> {
    if (!obs.isConnected) return;
    try {
      const scenes = await obs.getSceneList();
      await actionInst.sendToPropertyInspector({ scenes });
    } catch (err) {
      streamDeck.logger.warn(`[Scene] Could not fetch scene list: ${err}`);
    }
  }

  /**
   * Shorten a scene name to fit on a Stream Deck key (~14 chars max).
   * Splits on word boundaries and wraps to two lines.
   */
  private abbreviate(name: string): string {
    if (name.length <= 10) return name;
    const words = name.split(/\s+/);
    if (words.length >= 2) {
      const half = Math.ceil(words.length / 2);
      return words.slice(0, half).join(" ") + "\n" + words.slice(half).join(" ");
    }
    return name.slice(0, 9) + "…";
  }
}
