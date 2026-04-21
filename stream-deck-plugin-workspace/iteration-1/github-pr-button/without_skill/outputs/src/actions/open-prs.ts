import {
  action,
  KeyDownEvent,
  SendToPluginEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { github, GitHubAPI } from "../github/api.js";
import { startAuthFlow, revokeAuth } from "../github/auth.js";
import type { GlobalSettings } from "../github/types.js";

type PRMode = "review-requested" | "authored" | "assigned";

interface OpenPRsSettings {
  clientId?: string;
  clientSecret?: string;
  /** Which PR query to show: review-requested (default), authored, or assigned */
  mode?: PRMode;
}

@action({ UUID: "com.dbroesch.github-prs.open-prs" })
export class OpenPRsAction extends SingletonAction<OpenPRsSettings> {
  // Track last known count to avoid unnecessary redraws
  private lastCount: number | null = null;
  private lastMode: PRMode | null = null;

  override async onWillAppear(ev: WillAppearEvent<OpenPRsSettings>): Promise<void> {
    await github.loadFromSettings();

    if (!github.isAuthorized) {
      await ev.action.setTitle("Auth\nGitHub");
      return;
    }

    await this.refreshCount(ev.payload.settings.mode ?? "review-requested");
  }

  override async onKeyDown(ev: KeyDownEvent<OpenPRsSettings>): Promise<void> {
    const { clientId, clientSecret, mode = "review-requested" } = ev.payload.settings;

    // Not authorized — start auth flow
    if (!github.isAuthorized) {
      if (!clientId || !clientSecret) {
        await ev.action.setTitle("Set\nCreds");
        await ev.action.showAlert();
        return;
      }

      try {
        await ev.action.setTitle("Authing\n...");
        await startAuthFlow(clientId, clientSecret);
        await github.loadFromSettings();
        await ev.action.showOk();
        await this.refreshCount(mode);
      } catch (err) {
        streamDeck.logger.error(`Auth failed: ${err}`);
        await ev.action.setTitle("Auth\nFailed");
        await ev.action.showAlert();
      }
      return;
    }

    // Open the GitHub PR list URL in the default browser
    const url = GitHubAPI.getPRListUrl(mode);
    streamDeck.system.openUrl(url);
  }

  /**
   * Called by the Property Inspector "Connect to GitHub" button.
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<
      { event: string; clientId?: string; clientSecret?: string },
      OpenPRsSettings
    >
  ): Promise<void> {
    if (ev.payload.event !== "startAuth") return;

    const clientId = ev.payload.clientId;
    const clientSecret = ev.payload.clientSecret;

    if (!clientId || !clientSecret) {
      streamDeck.logger.warn("startAuth received without clientId or clientSecret");
      return;
    }

    // Save credentials to action settings before auth
    for (const a of this.actions) {
      await a.setSettings({ clientId, clientSecret });
    }

    try {
      for (const a of this.actions) {
        await a.setTitle("Authing\n...");
      }

      await startAuthFlow(clientId, clientSecret);
      await github.loadFromSettings();

      for (const a of this.actions) {
        await a.showOk();
      }

      // Notify the PI so it can update its status display
      // (PI will get the updated global settings via didReceiveGlobalSettings)
      const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      await streamDeck.settings.setGlobalSettings(settings); // triggers PI update

      // Get the mode from the first action's settings
      const firstActionSettings = ev.payload as unknown as OpenPRsSettings;
      await this.refreshCount(firstActionSettings.mode ?? "review-requested");
    } catch (err) {
      streamDeck.logger.error(`Auth from PI failed: ${err}`);
      for (const a of this.actions) {
        await a.setTitle("Auth\nFailed");
        await a.showAlert();
      }
    }
  }

  /**
   * Called by the polling loop in plugin.ts to keep the count fresh.
   */
  async update(mode?: PRMode): Promise<void> {
    if (!github.isAuthorized) return;
    const resolvedMode = mode ?? "review-requested";
    await this.refreshCount(resolvedMode);
  }

  private async refreshCount(mode: PRMode): Promise<void> {
    try {
      const count = await github.getPRCount(mode);

      // Only redraw if the count or mode changed
      if (count === this.lastCount && mode === this.lastMode) return;
      this.lastCount = count;
      this.lastMode = mode;

      for (const a of this.actions) {
        const modeLabel = this.modeLabel(mode);
        if (count === 0) {
          await a.setTitle(`0\n${modeLabel}`);
        } else {
          // Large number for visibility
          await a.setTitle(`${count}\n${modeLabel}`);
        }
      }
    } catch (err) {
      streamDeck.logger.error(`Failed to fetch PR count: ${err}`);
      for (const a of this.actions) {
        await a.setTitle("ERR");
        await a.showAlert();
      }
    }
  }

  private modeLabel(mode: PRMode): string {
    switch (mode) {
      case "review-requested":
        return "PRs";
      case "authored":
        return "My PRs";
      case "assigned":
        return "Assigned";
    }
  }
}
