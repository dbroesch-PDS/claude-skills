// src/plugin.ts — entry point
import streamDeck from "@elgato/streamdeck";
import { OpenPRListAction } from "./actions/open-pr-list.js";
import { github } from "./services/github.js";

// Register action
const openPRListAction = new OpenPRListAction();
streamDeck.actions.registerAction(openPRListAction);

// Load stored tokens from global settings on startup
await github.loadFromSettings();

if (github.isAuthorized) {
  streamDeck.logger.info(`GitHub plugin started — authenticated as ${github.username ?? "unknown"}`);
} else {
  streamDeck.logger.info("GitHub plugin started — not authenticated");
}

// Poll for PR count every 30 seconds
const POLL_INTERVAL_MS = 30_000;

setInterval(async () => {
  if (!github.isAuthorized) return;
  try {
    await openPRListAction.updateFromPoll();
  } catch (err) {
    streamDeck.logger.warn(`Poll error: ${err}`);
  }
}, POLL_INTERVAL_MS);

// Do an immediate fetch if already authed
if (github.isAuthorized) {
  try {
    await openPRListAction.updateFromPoll();
  } catch (err) {
    streamDeck.logger.warn(`Initial fetch error: ${err}`);
  }
}

await streamDeck.connect();
