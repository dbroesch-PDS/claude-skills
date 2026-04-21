import streamDeck from "@elgato/streamdeck";
import { OpenPRsAction } from "./actions/open-prs.js";
import { github } from "./github/api.js";

// Register all actions
const openPRs = new OpenPRsAction();
streamDeck.actions.registerAction(openPRs);

// Load token from global settings on startup
await github.loadFromSettings();

// Poll GitHub every 60 seconds to keep PR count in sync
// 60s is conservative to avoid hitting GitHub API rate limits (60 req/hour unauthenticated,
// 5000 req/hour authenticated). Search API has a lower limit of 30 req/min.
const POLL_INTERVAL_MS = 60_000;

async function poll(): Promise<void> {
  if (!github.isAuthorized) return;

  try {
    await openPRs.update();
  } catch (err) {
    streamDeck.logger.warn(`Poll failed: ${err}`);
  }
}

setInterval(poll, POLL_INTERVAL_MS);

// Re-load token after global settings change (e.g. after auth flow completes)
streamDeck.settings.onDidReceiveGlobalSettings(() => {
  github.loadFromSettings().catch((err) =>
    streamDeck.logger.error(`Failed to reload settings: ${err}`)
  );
});

// Connect to Stream Deck
await streamDeck.connect();
