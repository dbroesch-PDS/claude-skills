---
name: streamdeck-button-maker
description: >
  Build standalone Stream Deck tools in plain JavaScript using the @elgato-stream-deck/node
  hardware SDK. This approach talks directly to the Stream Deck hardware — no Stream Deck
  app required — and runs as a simple `node index.js` script with no build step.
  Works on Block/Square machines via the Block Artifactory npm registry.
  Use this skill whenever the user wants to build a Stream Deck script, add custom buttons
  to their Stream Deck, control Stream Deck hardware from Node.js, or says anything like
  "streamdeck button", "stream deck tool", "streamdeck script", "make my Stream Deck do X",
  or wants to automate hardware buttons. Trigger immediately — don't wait for them to say
  the magic words.
---

# Stream Deck Button Maker

You're building a standalone Node.js tool that talks directly to Stream Deck hardware.
This is different from building a Stream Deck *plugin* (which runs inside the Stream Deck app).
Here you write a script, run `node index.js`, and it owns the hardware directly.

## Quick decisions before writing code

1. **Which Stream Deck?** Plus = 4×2 keys + 4 encoders + LCD strip; MK.2 = 5×3 keys; Mini = 2×3; XL = 4×8
2. **Does it need live state?** (playback status, system stats, timers) → polling with `setInterval`
3. **Does it need a third-party API with OAuth?** → see `references/oauth.md`
4. **Does it need encoders/dials?** → see `references/encoders.md`
5. **Multiple "pages" of buttons?** → use the mode-switching pattern below

---

## Keeping the README accurate

When writing or updating a README button layout table, **always read the actual render functions** (`renderMain`, `renderSpotify`, etc.) and the button index constants (`MAIN`, `SPOT`, `MEET`, etc.) directly from the code. Never write the table from memory or assumption.

For each button, capture:
- The exact icon and label as passed to `renderButton()` — including dynamic values (e.g. `micMuted ? '🔇 MUTED' : '🎤 LIVE'`)
- Which index it maps to (determines row/col in the table)
- Any state-dependent behavior (color changes, label changes)

Unrendered button indices should be shown as `—` in the table. Always show all rows, even if Row 1 is all empty.

---

## Setup

### package.json

```json
{
  "name": "my-streamdeck-tool",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": { "start": "node index.js" },
  "dependencies": {
    "@elgato-stream-deck/node": "^7.6.2",
    "sharp": "^0.34.5"
  }
}
```

### Install (Block machines only)

Block's IT blocks the public npm registry. Use the Block Artifactory registry:

```bash
npm install --registry https://global.block-artifacts.com/artifactory/api/npm/square-npm/
```

### Important: quit the Stream Deck app first

The Stream Deck app has exclusive hardware access. If it's running, the script will throw
`cannot open device`. Always quit the app before running the script.

---

## Connecting to the device

```javascript
'use strict';
const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');

async function main() {
  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error('No Stream Deck found. Is it connected? Is the Stream Deck app closed?');
    process.exit(1);
  }
  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected to ${deck.PRODUCT_NAME}`);

  await deck.setBrightness(80);
  await deck.clearPanel();

  // ... your code here ...

  process.on('SIGINT', async () => {
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## Rendering buttons

Buttons need raw RGB pixel buffers. Use `sharp` to render SVG → raw RGB.
`deck.ICON_SIZE` gives the pixel dimensions (120px for Stream Deck Plus).

```javascript
const sharp = require('sharp');

async function renderButton({ icon = '', label = '', bgColor = '#1a1a1a', bgImage = null, size = 120 }) {
  // bgImage must be a PNG buffer — see references/rendering.md for how to load logos and remote images
  const svgBg = (color) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="8" fill="${color}"/>
  </svg>`;

  const useBgImage = !!bgImage;
  const base = bgImage ? sharp(bgImage).resize(size, size) : sharp(Buffer.from(svgBg(bgColor))).resize(size, size);

  const overlay = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${useBgImage ? `<rect width="${size}" height="${size}" fill="rgba(0,0,0,0.45)"/>` : ''}
    <text x="${size/2}" y="${size/2 - (label ? 10 : 0)}" text-anchor="middle"
      dominant-baseline="middle" font-size="${size * 0.33}" font-family="Arial">${esc(icon)}</text>
    ${label ? `<text x="${size/2}" y="${size*0.78}" text-anchor="middle"
      font-size="${size*0.13}" font-family="Arial" font-weight="bold" fill="white">${esc(label)}</text>` : ''}
  </svg>`;

  try {
    return await base
      .composite([{ input: Buffer.from(overlay), blend: 'over' }])
      .removeAlpha()
      .raw()
      .toBuffer();
  } catch {
    // Fall back to color background if image decoding fails
    return await sharp(Buffer.from(svgBg(bgColor)))
      .resize(size, size)
      .composite([{ input: Buffer.from(overlay), blend: 'over' }])
      .removeAlpha()
      .raw()
      .toBuffer();
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Paint a button
const buf = await renderButton({ icon: '▶', label: 'Play', bgColor: '#1DB954', size: deck.ICON_SIZE });
await deck.fillKeyBuffer(0, buf, { format: 'rgb' });
```

For the LCD strip on Stream Deck Plus (800×100px): see `references/rendering.md`.

---

## Handling button presses

```javascript
deck.on('down', async (control) => {
  if (control.type !== 'button') return; // ignore encoder presses
  console.log(`Button ${control.index} pressed`);
  // do something...
});

deck.on('up', async (control) => { /* optional */ });
```

Button indices for Stream Deck Plus (4 cols × 2 rows):
```
[0][1][2][3]
[4][5][6][7]
```

---

## Polling for live state

For buttons that reflect external state (playback, system stats, API data):

```javascript
let lastState = null;
let rendering = false;
let lastRenderedKey = null;

async function render(deck) {
  const key = JSON.stringify(lastState); // skip if nothing changed
  if (rendering || key === lastRenderedKey) return;
  rendering = true;
  lastRenderedKey = key;
  try {
    // update buttons based on lastState
  } finally {
    rendering = false;
  }
}

async function poll(deck) {
  try {
    lastState = await getStateFromSomewhere();
    await render(deck);
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

setInterval(() => poll(deck), 3000);
```

The render guard (`rendering` flag + state key) prevents flicker from concurrent renders —
important when polling and button presses both trigger re-renders.

---

## Multi-page / mode switching

When you want one "home" button that expands into a full control surface:

```javascript
let mode = 'launcher'; // or 'controls'
let modeEnteredAt = 0;
let prevMode = null;

async function render(deck, force = false) {
  const key = JSON.stringify({ mode, ...relevantState });
  if (rendering || (!force && key === lastRenderedKey)) return;
  rendering = true;
  lastRenderedKey = key;
  try {
    if (mode !== prevMode) {
      await deck.clearPanel(); // only clear on mode transitions to avoid flicker
      prevMode = mode;
    }
    if (mode === 'launcher') await renderLauncher(deck);
    else await renderControls(deck);
  } finally { rendering = false; }
}

function enterControls(deck) {
  mode = 'controls';
  modeEnteredAt = Date.now();
  render(deck, true).catch(() => {});
}

function enterLauncher(deck) {
  mode = 'launcher';
  render(deck, true).catch(() => {});
}

// In button handler:
deck.on('down', async (control) => {
  if (control.type !== 'button') return;
  if (mode === 'launcher' && control.index === HOME_BTN) {
    enterControls(deck);
  } else if (mode === 'controls' && control.index === BACK_BTN) {
    enterLauncher(deck);
  }
  // ...other buttons
});
```

---

## App focus detection (macOS)

Auto-switch modes based on which app is in front:

```javascript
const { execSync } = require('node:child_process');

function getFocusedApp() {
  try {
    return execSync(
      "osascript -e 'tell application \"System Events\" to get name of first process whose frontmost is true'",
      { timeout: 1000 }
    ).toString().trim();
  } catch { return ''; }
}

// Poll focus every 2 seconds
// Grace period prevents mode from flipping back immediately after a button press
setInterval(() => {
  const focused = getFocusedApp() === 'Spotify'; // or whatever app
  const gracePassed = Date.now() - modeEnteredAt > 2000;

  if (focused && mode === 'launcher') enterControls(deck);
  else if (!focused && mode === 'controls' && gracePassed) enterLauncher(deck);
}, 2000);
```

---

## Token / credential storage

Store API tokens in a JSON file — no npm packages needed:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TOKEN_FILE = path.join(os.homedir(), '.my-streamdeck-tokens.json');

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
  catch { return null; }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}
```

---

## Third-party API with OAuth

See `references/oauth.md` for the full PKCE flow using Blockcell as the HTTPS redirect.
The short version: Spotify and most providers require HTTPS redirect URIs. The solution
is to host a tiny static callback page on Blockcell (Block's HTTPS hosting) that shows
the auth code, which the user pastes into the terminal.

---

## Reference files

- `references/rendering.md` — LCD strip, image-as-background, caching album art
- `references/oauth.md` — Full PKCE OAuth implementation with Blockcell redirect
- `references/encoders.md` — Encoder/dial events and volume control pattern
