'use strict';

/**
 * Google Meet Controller for Stream Deck Plus
 *
 * Buttons (Stream Deck Plus, top row):
 *   [0] Mic toggle    — 🎤 live / 🔇 muted  (grey when not in call)
 *   [1] Camera toggle — 📷 on   / 🚫 off    (grey when not in call)
 *   [2] Hang up       — 📵                  (grey when not in call)
 *   [3] (unused)
 *
 * Detection: polls osascript every 2 s to check whether Chrome is focused
 * on a meet.google.com URL. Keyboard shortcuts are sent to Chrome via
 * osascript when buttons are pressed.
 *
 * Run:
 *   npm install --registry https://global.block-artifacts.com/artifactory/api/npm/square-npm/
 *   node index.js
 *
 * NOTE: Quit the Stream Deck app before running — it holds exclusive USB access.
 */

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const { execSync, exec } = require('node:child_process');

// ---------------------------------------------------------------------------
// Button layout (Stream Deck Plus row 0)
// ---------------------------------------------------------------------------
const BTN_MIC    = 0;
const BTN_CAM    = 1;
const BTN_HANGUP = 2;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  inCall:   false,   // Chrome is focused on a Meet tab
  micMuted: false,   // optimistic local toggle (Meet doesn't expose real state)
  camOff:   false,   // optimistic local toggle
};

let lastRenderedKey = null;
let rendering = false;

// ---------------------------------------------------------------------------
// osascript helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if Chrome's frontmost tab URL contains "meet.google.com"
 * and Chrome is the frontmost application.
 */
function detectMeetCall() {
  const script = `
    tell application "System Events"
      set frontApp to name of first process whose frontmost is true
    end tell
    if frontApp is not "Google Chrome" then return "no"
    tell application "Google Chrome"
      set u to URL of active tab of front window
      if u contains "meet.google.com" then
        return "yes"
      else
        return "no"
      end if
    end tell
  `;
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 2000,
    }).toString().trim();
    return result === 'yes';
  } catch {
    return false;
  }
}

/**
 * Send a keyboard shortcut to Chrome (Meet shortcuts work even when
 * Chrome isn't in front, as long as Meet is the active tab).
 * Meet shortcuts: Cmd+D = toggle mic, Cmd+E = toggle camera, Cmd+Shift+H = hang up.
 */
function sendMeetShortcut(keystroke) {
  // keystroke examples: 'key code 2 using command down'  (D)
  //                     'key code 14 using command down' (E)
  //                     'key code 4 using {command down, shift down}' (H)
  const script = `
    tell application "Google Chrome" to activate
    delay 0.1
    tell application "System Events"
      ${keystroke}
    end tell
  `;
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
    if (err) console.error('osascript error:', err.message);
  });
}

// ---------------------------------------------------------------------------
// Button rendering
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a Stream Deck button as a raw RGB buffer.
 * @param {object} opts
 * @param {string} opts.icon      - Emoji or text drawn large in centre
 * @param {string} opts.label     - Small label below icon (optional)
 * @param {string} opts.bgColor   - CSS hex colour for background
 * @param {number} opts.size      - Pixel size (square), from deck.ICON_SIZE
 * @param {number} [opts.opacity] - Overall opacity of icon (0–1, default 1)
 */
async function renderButton({ icon = '', label = '', bgColor = '#1a1a1a', size = 120, opacity = 1 }) {
  const iconSize  = Math.round(size * 0.38);
  const labelSize = Math.round(size * 0.13);
  const iconY     = label ? size / 2 - 10 : size / 2;
  const labelY    = Math.round(size * 0.80);
  const alpha     = Math.round(opacity * 255).toString(16).padStart(2, '0');

  const bg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="10" fill="${bgColor}"/>
  </svg>`;

  const overlay = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="${size / 2}" y="${iconY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${iconSize}" font-family="Apple Color Emoji, Segoe UI Emoji, Arial"
      opacity="${opacity}">${esc(icon)}</text>
    ${label ? `<text x="${size / 2}" y="${labelY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${labelSize}" font-family="Arial" font-weight="bold"
      fill="#ffffff" opacity="${opacity}">${esc(label)}</text>` : ''}
  </svg>`;

  return sharp(Buffer.from(bg))
    .resize(size, size)
    .composite([{ input: Buffer.from(overlay), blend: 'over' }])
    .removeAlpha()
    .raw()
    .toBuffer();
}

// Button visual configs indexed by logical state
function getButtonConfig(btn, inCall, micMuted, camOff, size) {
  if (!inCall) {
    // Dimmed / grey — indicate no active call
    const configs = {
      [BTN_MIC]:    { icon: '🎤', label: 'MIC',    bgColor: '#2a2a2a', opacity: 0.35 },
      [BTN_CAM]:    { icon: '📷', label: 'CAM',    bgColor: '#2a2a2a', opacity: 0.35 },
      [BTN_HANGUP]: { icon: '📵', label: 'END',    bgColor: '#2a2a2a', opacity: 0.35 },
    };
    return { ...configs[btn], size };
  }

  const configs = {
    [BTN_MIC]: micMuted
      ? { icon: '🔇', label: 'MUTED',  bgColor: '#7a1a1a', opacity: 1 }
      : { icon: '🎤', label: 'LIVE',   bgColor: '#1a4a1a', opacity: 1 },
    [BTN_CAM]: camOff
      ? { icon: '🚫', label: 'CAM OFF', bgColor: '#7a1a1a', opacity: 1 }
      : { icon: '📷', label: 'CAM ON',  bgColor: '#1a4a1a', opacity: 1 },
    [BTN_HANGUP]: { icon: '📵', label: 'END CALL', bgColor: '#8b0000', opacity: 1 },
  };
  return { ...configs[btn], size };
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

async function render(deck, force = false) {
  const key = JSON.stringify({ inCall: state.inCall, micMuted: state.micMuted, camOff: state.camOff });
  if (rendering || (!force && key === lastRenderedKey)) return;
  rendering = true;
  lastRenderedKey = key;

  try {
    const size = deck.ICON_SIZE;

    const buttons = [BTN_MIC, BTN_CAM, BTN_HANGUP];
    for (const btn of buttons) {
      const cfg = getButtonConfig(btn, state.inCall, state.micMuted, state.camOff, size);
      const buf = await renderButton(cfg);
      await deck.fillKeyBuffer(btn, buf, { format: 'rgb' });
    }

    // Leave button 3 blank
    await deck.clearKey(3);

    console.log(
      `[render] inCall=${state.inCall}  mic=${state.micMuted ? 'MUTED' : 'live'}  cam=${state.camOff ? 'OFF' : 'on'}`
    );
  } catch (err) {
    console.error('Render error:', err.message);
  } finally {
    rendering = false;
  }
}

// ---------------------------------------------------------------------------
// Polling: detect Meet call state
// ---------------------------------------------------------------------------

function poll(deck) {
  try {
    const nowInCall = detectMeetCall();
    if (nowInCall !== state.inCall) {
      state.inCall = nowInCall;
      if (!nowInCall) {
        // Reset optimistic toggles when call ends
        state.micMuted = false;
        state.camOff   = false;
      }
      render(deck).catch(() => {});
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Button press handlers
// ---------------------------------------------------------------------------

function handleButtonPress(deck, index) {
  if (!state.inCall) {
    console.log(`Button ${index} pressed but not in a call — ignored`);
    return;
  }

  switch (index) {
    case BTN_MIC:
      state.micMuted = !state.micMuted;
      // Google Meet: Cmd+D toggles mic
      sendMeetShortcut('keystroke "d" using command down');
      console.log(`Mic ${state.micMuted ? 'MUTED' : 'unmuted'}`);
      break;

    case BTN_CAM:
      state.camOff = !state.camOff;
      // Google Meet: Cmd+E toggles camera
      sendMeetShortcut('keystroke "e" using command down');
      console.log(`Camera ${state.camOff ? 'OFF' : 'on'}`);
      break;

    case BTN_HANGUP:
      // Google Meet: Cmd+Shift+H hangs up
      sendMeetShortcut('keystroke "h" using {command down, shift down}');
      console.log('Hanging up...');
      // Optimistically clear state — poll will confirm
      state.inCall   = false;
      state.micMuted = false;
      state.camOff   = false;
      break;

    default:
      // Unused button — do nothing
      break;
  }

  render(deck).catch(() => {});
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error('No Stream Deck found. Is it plugged in? Is the Stream Deck app closed?');
    process.exit(1);
  }

  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected to ${deck.PRODUCT_NAME} (icon size: ${deck.ICON_SIZE}px)`);

  await deck.setBrightness(80);
  await deck.clearPanel();

  // Initial render (not in call)
  await render(deck, true);

  // Poll for Meet call state every 2 seconds
  setInterval(() => poll(deck), 2000);

  // Handle button presses
  deck.on('down', async (control) => {
    if (control.type !== 'button') return;
    handleButtonPress(deck, control.index);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });

  console.log('Google Meet Controller running. Press Ctrl+C to quit.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
