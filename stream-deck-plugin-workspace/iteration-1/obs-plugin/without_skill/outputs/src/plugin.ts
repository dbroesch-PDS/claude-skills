import streamDeck from "@elgato/streamdeck";
import { RecordAction } from "./actions/record.js";
import { StreamAction } from "./actions/stream.js";
import { MuteAction } from "./actions/mute.js";
import { SceneAction } from "./actions/scene.js";
import { obs } from "./obs/client.js";
import type { OBSGlobalSettings } from "./obs/types.js";

// Register all actions
streamDeck.actions.registerAction(new RecordAction());
streamDeck.actions.registerAction(new StreamAction());
streamDeck.actions.registerAction(new MuteAction());
streamDeck.actions.registerAction(new SceneAction());

// Load OBS connection settings from global store and connect
async function loadSettings(): Promise<void> {
  const settings = await streamDeck.settings.getGlobalSettings<OBSGlobalSettings>();
  if (settings.obsHost || settings.obsPort) {
    await obs.loadAndConnect(settings);
  } else {
    // Use defaults (localhost:4455, no password)
    await obs.loadAndConnect({ obsHost: "localhost", obsPort: 4455, obsPassword: "" });
  }
}

await loadSettings();

// Re-connect when global settings change (e.g. user updates host/password in PI)
streamDeck.settings.onDidReceiveGlobalSettings(async (ev) => {
  const settings = ev.payload.settings as OBSGlobalSettings;
  await obs.loadAndConnect(settings);
});

// Connect to Stream Deck
await streamDeck.connect();
