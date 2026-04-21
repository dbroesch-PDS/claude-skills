// src/actions/open-pr-list.ts
import {
  action,
  KeyDownEvent,
  SendToPluginEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { github, PullRequest } from "../services/github.js";
import { startAuthFlow } from "../services/auth.js";

interface ActionSettings {
  // No per-action settings needed — tokens live in global settings
}

interface PIPayload {
  action: "startAuth" | "disconnectAuth" | "saveClientId";
  clientId?: string;
}

// GitHub PR page URL — opens the "Review requests" view
const GITHUB_PR_URL = "https://github.com/pulls?q=is%3Aopen+is%3Apr+assignee%3A%40me";

@action({ UUID: "com.dbroesch.githubprs.openprlist" })
export class OpenPRListAction extends SingletonAction<ActionSettings> {
  private lastPRCount = -1;
  private lastPRs: PullRequest[] = [];
  private isAuthInProgress = false;

  // Called by the poll loop in plugin.ts
  async updateFromPoll(): Promise<void> {
    if (!github.isAuthorized) {
      await this.setAllButtonsState("not-authed");
      return;
    }

    try {
      const prs = await github.getOpenAssignedPRs();
      this.lastPRs = prs;

      if (prs.length !== this.lastPRCount) {
        this.lastPRCount = prs.length;
        await this.setAllButtonsState("ok", prs.length);
        streamDeck.logger.info(`PR count updated: ${prs.length} open PRs`);
      }
    } catch (err) {
      streamDeck.logger.warn(`Failed to fetch PRs: ${err}`);
      await this.setAllButtonsState("error");
    }
  }

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    if (!github.isAuthorized) {
      await ev.action.setImage(this.buildImage("not-authed", 0));
      await ev.action.setTitle("");
      return;
    }

    if (this.lastPRCount >= 0) {
      await ev.action.setImage(this.buildImage("ok", this.lastPRCount));
      await ev.action.setTitle("");
    } else {
      await ev.action.setImage(this.buildImage("loading", 0));
      await ev.action.setTitle("");
    }
  }

  override async onKeyDown(_ev: KeyDownEvent<ActionSettings>): Promise<void> {
    if (!github.isAuthorized) {
      // If not authed, pressing the button shows an alert
      await _ev.action.showAlert();
      return;
    }
    // Open GitHub PR page in browser
    streamDeck.system.openUrl(GITHUB_PR_URL);
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<PIPayload, ActionSettings>
  ): Promise<void> {
    const { action: piAction, clientId } = ev.payload;

    if (piAction === "saveClientId" && clientId) {
      await github.storeClientId(clientId);
      await this.sendStatusToPI(ev.action.id);
      return;
    }

    if (piAction === "startAuth") {
      if (this.isAuthInProgress) {
        streamDeck.logger.warn("Auth already in progress");
        return;
      }
      if (!github.clientId) {
        streamDeck.logger.warn("No client ID set — user must enter it in PI first");
        return;
      }

      this.isAuthInProgress = true;
      streamDeck.logger.info("Starting GitHub OAuth flow...");

      try {
        const tokens = await startAuthFlow(github.clientId);
        await github.storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
        streamDeck.logger.info("GitHub OAuth complete");

        // Immediately fetch PRs
        await this.updateFromPoll();
        await this.sendStatusToPI(ev.action.id);
      } catch (err) {
        streamDeck.logger.error(`GitHub OAuth failed: ${err}`);
        for (const a of this.actions) {
          await a.showAlert();
        }
      } finally {
        this.isAuthInProgress = false;
      }
      return;
    }

    if (piAction === "disconnectAuth") {
      await github.clearAuth();
      this.lastPRCount = -1;
      this.lastPRs = [];
      await this.setAllButtonsState("not-authed");
      await this.sendStatusToPI(ev.action.id);
      return;
    }
  }

  private async sendStatusToPI(actionId: string): Promise<void> {
    await streamDeck.ui.current?.sendToPropertyInspector({
      isAuthorized: github.isAuthorized,
      username: github.username,
      clientId: github.clientId,
      prCount: this.lastPRCount >= 0 ? this.lastPRCount : null,
    });
  }

  private async setAllButtonsState(
    state: "ok" | "error" | "not-authed" | "loading",
    prCount = 0
  ): Promise<void> {
    for (const a of this.actions) {
      await a.setImage(this.buildImage(state, prCount));
      await a.setTitle("");
    }
  }

  /**
   * Build an SVG button image showing the PR count (or status).
   * viewBox 0 0 144 144 — Stream Deck renders at 2x for retina.
   */
  private buildImage(
    state: "ok" | "error" | "not-authed" | "loading",
    prCount: number
  ): string {
    let bgColor: string;
    let labelText: string;
    let countText: string;
    let countColor: string;

    switch (state) {
      case "ok":
        bgColor = prCount > 0 ? "#1a1a2e" : "#0d1117";
        labelText = "PRs";
        countText = String(prCount);
        countColor = prCount > 0 ? "#f78166" : "#3fb950";
        break;
      case "error":
        bgColor = "#2d1b1b";
        labelText = "PRs";
        countText = "!";
        countColor = "#f85149";
        break;
      case "not-authed":
        bgColor = "#161b22";
        labelText = "GitHub";
        countText = "—";
        countColor = "#8b949e";
        break;
      case "loading":
        bgColor = "#0d1117";
        labelText = "PRs";
        countText = "...";
        countColor = "#8b949e";
        break;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <!-- Background -->
  <rect width="144" height="144" rx="8" fill="${bgColor}"/>

  <!-- GitHub icon (simplified Octocat outline) -->
  <g transform="translate(52, 16)">
    <circle cx="20" cy="20" r="18" fill="none" stroke="#8b949e" stroke-width="3"/>
    <path d="M20 8 C13 8 8 13 8 20 C8 25.5 11.5 30.2 16.5 31.8 C17.1 31.9 17.3 31.5 17.3 31.2 C17.3 30.9 17.3 30.1 17.3 28.9 C14.2 29.6 13.5 27.5 13.5 27.5 C12.9 25.9 12.1 25.5 12.1 25.5 C11 24.8 12.2 24.8 12.2 24.8 C13.4 24.9 14 26 14 26 C15.1 27.9 16.9 27.4 17.4 27.1 C17.5 26.3 17.8 25.8 18.1 25.5 C15.4 25.2 12.5 24.2 12.5 19.5 C12.5 18.1 13 17 13.8 16.2 C13.7 15.9 13.2 14.6 13.9 12.9 C13.9 12.9 14.9 12.6 17.3 14.2 C18.3 13.9 19.3 13.8 20.3 13.8 C21.3 13.8 22.3 13.9 23.3 14.2 C25.7 12.6 26.7 12.9 26.7 12.9 C27.4 14.6 26.9 15.9 26.8 16.2 C27.6 17 28.1 18.1 28.1 19.5 C28.1 24.2 25.2 25.2 22.5 25.5 C22.9 25.9 23.3 26.7 23.3 27.9 C23.3 29.7 23.3 31.1 23.3 31.2 C23.3 31.5 23.5 31.9 24.1 31.8 C29.1 30.2 32 25.5 32 20 C32 13 27 8 20 8 Z" fill="#8b949e"/>
  </g>

  <!-- PR count (large, center) -->
  <text x="72" y="95"
    font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    font-size="40"
    font-weight="700"
    fill="${countColor}"
    text-anchor="middle"
    dominant-baseline="middle">${countText}</text>

  <!-- Label at bottom -->
  <text x="72" y="126"
    font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    font-size="16"
    font-weight="500"
    fill="#8b949e"
    text-anchor="middle"
    dominant-baseline="middle">${labelText}</text>
</svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}
