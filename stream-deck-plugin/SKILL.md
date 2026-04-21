---
name: stream-deck-plugin
description: >
  Build Elgato Stream Deck plugins using the official @elgato/streamdeck TypeScript SDK.
  Use this skill whenever the user wants to create a Stream Deck plugin, add Stream Deck
  support for any app or service, build custom Stream Deck actions, work with encoders/dials
  on the Stream Deck Plus, handle OAuth authentication in a plugin, or wire up dynamic button
  images (like album art). Also triggers for questions about manifest.json format, action
  registration, profile switching, property inspectors, or any Stream Deck SDK concept.
  When a user says "Stream Deck plugin", "streamdeck action", "sdPlugin", or mentions
  @elgato/streamdeck — use this skill immediately.
---

# Stream Deck Plugin Development

You are building a Stream Deck plugin. Follow this guide exactly — it encodes the correct
structure, APIs, and gotchas for the @elgato/streamdeck SDK (SDKVersion 2 / Stream Deck 6.5+).

## Quick decision checklist

Before writing any code, confirm:
1. **Device type** — which Stream Deck? (Plus = 8 keys + 4 encoders; MK.2 = 15 keys; Mini = 6; XL = 32)
2. **Actions needed** — list every distinct button behavior
3. **Third-party API with OAuth?** — use the Elgato proxy flow → see `references/auth-pkce.md`
4. **Dynamic images?** — album art, live counters, status icons → use SVG data URLs
5. **Encoders/dials?** — Stream Deck Plus only → see `references/encoders.md`

---

## Project structure

```
my-plugin/
├── com.author.pluginname.sdPlugin/   ← the folder Stream Deck registers
│   ├── manifest.json
│   ├── bin/
│   │   └── plugin.js                 ← compiled output (never edit by hand)
│   ├── imgs/
│   │   ├── plugin/icon.svg
│   │   └── actions/<action-name>/
│   │       ├── icon.svg              ← action picker (40×40)
│   │       └── key.svg               ← button face (72×72, viewBox 0 0 144 144)
│   ├── ui/
│   │   └── my-action-pi.html         ← property inspector
│   └── profiles/
│       └── MyProfile.streamDeckProfile
├── src/
│   ├── plugin.ts                     ← entry point
│   ├── actions/
│   │   └── my-action.ts
│   └── services/                     ← API clients, auth, etc.
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

See `references/build-setup.md` for the exact content of `package.json`, `tsconfig.json`, and `rollup.config.mjs`.

---

## manifest.json — critical fields

```json
{
  "$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  "UUID": "com.author.pluginname",
  "Name": "My Plugin",
  "Version": "1.0.0",
  "SDKVersion": 2,
  "Author": "Your Name",
  "Description": "What it does",
  "Icon": "imgs/plugin/icon",
  "CodePath": "bin/plugin.js",
  "Software": { "MinimumVersion": "6.5" },
  "OS": [{ "Platform": "mac", "MinimumVersion": "10.15" }],
  "Nodejs": { "Version": "20", "Debug": "enabled" },
  "Actions": [ ... ],
  "Profiles": [ ... ]
}
```

**Key rules:**
- `UUID`: reverse-DNS, lowercase, alphanumeric + hyphens + periods. **Never change after publishing.**
- Image paths omit the extension — Stream Deck resolves `.png`, `.svg`, etc. automatically
- `SDKVersion: 2` is correct for Stream Deck 6.5+
- Keypad action: `"Controllers": ["Keypad"]`
- Encoder (dial) action: `"Controllers": ["Encoder"]` — see `references/encoders.md`
- Both: `"Controllers": ["Keypad", "Encoder"]`

Full manifest reference: `references/manifest.md`

---

## Registering actions

Every action is a class decorated with `@action({ UUID })`. Register all before connecting.

```typescript
// src/plugin.ts
import streamDeck from "@elgato/streamdeck";
import { MyAction } from "./actions/my-action.js";

streamDeck.actions.registerAction(new MyAction());

await streamDeck.connect(); // must be last
```

**`plugin.ts` must use top-level `await`** — it runs as an ES module.

---

## Action anatomy

```typescript
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

@action({ UUID: "com.author.pluginname.myaction" })
export class MyAction extends SingletonAction<MySettings> {

  override async onWillAppear(ev: WillAppearEvent<MySettings>): Promise<void> {
    await ev.action.setTitle("Hello");
  }

  override async onKeyDown(ev: KeyDownEvent<MySettings>): Promise<void> {
    await ev.action.showOk();    // green checkmark flash
    // await ev.action.showAlert(); // yellow alert flash
  }
}

interface MySettings { someValue?: string; }
```

**Core action methods:**

| Method | What it does |
|--------|-------------|
| `ev.action.setTitle(text)` | Set button label |
| `ev.action.setImage(src)` | File path, base64 data URL, or inline SVG string |
| `ev.action.setSettings(obj)` | Persist per-button settings |
| `ev.action.getSettings()` | Read per-button settings |
| `ev.action.showOk()` | Flash green checkmark |
| `ev.action.showAlert()` | Flash yellow alert |

To update all instances of a SingletonAction at once:
```typescript
for (const action of this.actions) {
  await action.setTitle("Updated");
}
```

---

## Settings — where to store what

| Data | Where | Why |
|------|-------|-----|
| Per-button user prefs | `ev.action.setSettings()` | Scoped to that button instance |
| API tokens, credentials | `streamDeck.settings.setGlobalSettings()` | Encrypted, never exported with profiles |
| Shared plugin state (volume, cache) | Global settings | Persists across restarts |

**Never store tokens in action settings** — they are plain-text and get included in `.streamDeckProfile` exports.

```typescript
// Write
await streamDeck.settings.setGlobalSettings({ accessToken: "...", expiresAt: Date.now() + 3_600_000 });

// Read
const { accessToken } = await streamDeck.settings.getGlobalSettings<MyGlobalSettings>();

// React to changes (e.g. after OAuth completes)
streamDeck.settings.onDidReceiveGlobalSettings((ev) => { ... });
```

---

## OAuth in a plugin (PKCE + Elgato proxy)

For any third-party API requiring user login (Spotify, Google, etc.) use **PKCE** via the
**Elgato OAuth redirect proxy**. This is the correct approach for Stream Deck plugins because:

- Providers like Spotify reject `http://` redirect URIs in their dashboards (even though their docs say loopback is allowed — in practice their UI enforces HTTPS)
- The Elgato proxy is an HTTPS URL that providers accept, and it forwards the auth code back to your plugin via a deep-link

**Register this in the OAuth provider's dashboard:**
```
https://oauth2-redirect.elgato.com/streamdeck/plugins/message/com.author.pluginname
```
Replace `com.author.pluginname` with your actual plugin UUID.

**The flow:**
1. Plugin generates `code_verifier` + `code_challenge` (PKCE), opens browser to provider auth URL
2. Provider redirects to the Elgato proxy with `?code=...&state=...`
3. Proxy forwards to your plugin via `streamdeck://plugins/message/com.author.pluginname?code=...&state=...`
4. Plugin handles the deep-link, exchanges code for tokens, stores in global settings

**Wire it up in `plugin.ts`:**
```typescript
import { handleDeepLink } from "./services/auth.js";

streamDeck.system.onDidReceiveDeepLink((ev) => {
  const url = new URL(ev.payload.url);
  handleDeepLink(url).catch((err) =>
    streamDeck.logger.error(`Auth deep-link failed: ${err}`)
  );
});

await streamDeck.connect();
```

Full implementation (auth.ts, token refresh, API class): `references/auth-pkce.md`

---

## Dynamic images (SVG data URLs)

SVG is the best format for live button content — scalable, composable, no file I/O.

```typescript
// Embed an image (e.g. album art) with an overlay
const svg = `<svg xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 144 144">
  <image href="${base64DataUrl}" x="0" y="0" width="144" height="144"/>
  <rect x="52" y="52" width="40" height="40" rx="4" fill="rgba(0,0,0,0.55)"/>
  <polygon points="62,57 90,72 62,87" fill="white"/>
</svg>`;

await ev.action.setImage(
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
);
```

Fetch a remote image as base64:
```typescript
const res = await fetch(imageUrl);
const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
const mime = res.headers.get("content-type") ?? "image/jpeg";
const dataUrl = `data:${mime};base64,${b64}`;
```

Cache by URL — skip re-fetching when the URL hasn't changed.

---

## Profile switching

Plugins can only switch to **profiles they bundle** — not user-created profiles.

```typescript
// manifest.json
"Profiles": [{
  "Name": "My Profile",
  "DeviceType": 7,
  "File": "profiles/MyProfile.streamDeckProfile",
  "AutoInstall": true
}]

// code
const device = [...streamDeck.devices][0];
if (device) streamDeck.profiles.switchToProfile(device.id, "My Profile");
```

Device type numbers: Plus = `7`, MK.2 = `0`, XL = `2`, Mini = `3`.

Profile file format: `references/manifest.md` (Profiles section).

---

## Polling for live state

For buttons that reflect external state (playback, system stats, API data), poll on an interval.

```typescript
const myAction = new MyAction();
streamDeck.actions.registerAction(myAction);

setInterval(async () => {
  if (!service.isReady) return;
  try {
    const state = await service.getState();
    await myAction.update(state); // public method you define on the action
  } catch (err) {
    streamDeck.logger.warn(`Poll failed: ${err}`);
  }
}, 3000);

await streamDeck.connect();
```

Keep actions stateful so `update()` can skip redundant `setImage` calls when nothing changed.

If the service emits events (e.g. WebSocket), prefer event-driven updates over polling — subscribe
in the action's `onWillAppear` and push state to buttons immediately on change.

---

## Encoders (Stream Deck Plus dials)

See `references/encoders.md` for complete encoder reference.

Quick pattern:
```typescript
@action({ UUID: "com.author.plugin.mydial" })
export class MyDialAction extends SingletonAction {
  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const ticks = ev.payload.ticks; // positive = clockwise
    // adjust value, debounce API call to ~100ms
  }
  override async onDialDown(_ev: DialDownEvent): Promise<void> {
    // toggle / reset
  }
  private async updateFeedback(): Promise<void> {
    for (const action of this.actions) {
      if (!action.isDial()) continue; // always guard before calling dial methods
      await action.setFeedback({
        title: "Volume",
        value: "75%",
        indicator: { value: 75, enabled: true },
      });
    }
  }
}
```

Manifest for encoder:
```json
"Controllers": ["Encoder"],
"Encoder": {
  "layout": "$A1",
  "TriggerDescription": { "Rotate": "Adjust value", "Push": "Toggle" }
}
```

---

## Property Inspector (settings UI)

The PI is an HTML page shown when the user right-clicks a button.

```html
<script>
function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  const context = JSON.parse(actionInfo).context;
  const ws = new WebSocket(`ws://localhost:${port}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ event: registerEvent, uuid }));
    ws.send(JSON.stringify({ event: "getSettings", context }));
  };

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.event === "didReceiveSettings") {
      // populate form from msg.payload.settings
    }
  };

  document.getElementById("myInput").addEventListener("change", () => {
    ws.send(JSON.stringify({
      event: "setSettings", context,
      payload: { myValue: document.getElementById("myInput").value }
    }));
  });
}
</script>
```

Send a message from the PI to the plugin (e.g. a "Connect" button):
```javascript
ws.send(JSON.stringify({ event: "sendToPlugin", context, payload: { action: "startAuth" } }));
```

Handle it in your action class:
```typescript
override async onSendToPlugin(ev: SendToPluginEvent<{ action: string }, MySettings>) {
  if (ev.payload.action === "startAuth") { ... }
}
```

---

## Icons — dimensions

| Usage | Size | Path |
|-------|------|------|
| Plugin icon | 512×512 | `imgs/plugin/icon.svg` |
| Action picker | 40×40 | `imgs/actions/<name>/icon.svg` |
| Button face | 72×72 (viewBox 0 0 144 144) | `imgs/actions/<name>/key.svg` |
| Category icon | 28×28 | `imgs/plugin/category-icon.svg` |

Omit the extension in `manifest.json` image paths and `setImage()` file paths.

---

## Logging

```typescript
streamDeck.logger.info("Connected");
streamDeck.logger.warn("Retrying...");
streamDeck.logger.error(`Failed: ${err}`);
```

Logs go to `.sdPlugin/logs/` (auto-rotated). Never use `console.log` in plugins.

---

## Install and run

```bash
npm install
npm run build

# macOS
cp -r com.author.pluginname.sdPlugin \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/
```

Restart the Stream Deck app. Use `npm run watch` for hot reload during development.

---

## Common mistakes

- **Forgetting `await streamDeck.connect()`** at the end of `plugin.ts` — plugin silently won't start
- **Changing action UUIDs** after publishing — breaks every user's button configuration
- **Storing tokens in action settings** — plain-text, exported with profile backups
- **Using `http://localhost` as OAuth redirect** — providers reject it; use the Elgato proxy
- **Calling dial methods on keypad actions** — always check `action.isDial()` first
- **Not debouncing encoder rotation** — a fast spin fires dozens of ticks; debounce API calls to ~100ms
- **Not handling the deep-link** in `plugin.ts` — OAuth flow will open the browser but never complete
