import streamDeck from "@elgato/streamdeck";
import { RecordAction } from "./actions/record-action.js";
import { StreamAction } from "./actions/stream-action.js";
import { MuteAction } from "./actions/mute-action.js";
import { SceneAction } from "./actions/scene-action.js";
import { obsService } from "./services/obs-websocket.js";

// Register all actions before connecting to Stream Deck
streamDeck.actions.registerAction(new RecordAction());
streamDeck.actions.registerAction(new StreamAction());
streamDeck.actions.registerAction(new MuteAction());
streamDeck.actions.registerAction(new SceneAction());

// Load OBS connection settings from global settings and connect
await obsService.loadFromSettings();

// Listen for global settings changes (e.g., user changes host/port/password in PI)
streamDeck.settings.onDidReceiveGlobalSettings(() => {
  obsService.loadFromSettings().catch((err) => {
    streamDeck.logger.error(`Failed to reload OBS settings: ${err}`);
  });
});

// Connect to Stream Deck — must be last
await streamDeck.connect();
