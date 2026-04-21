'use strict';
const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const { execSync, exec } = require('node:child_process');
const sharp = require('sharp');

// ── Button layout (Stream Deck Plus: 8 buttons, 4 cols × 2 rows) ──────────
//   [0][1][2][3]
//   [4][5][6][7]

const BTN = {
  MIC:    0,  // top-left: toggle mic mute
  CAMERA: 1,  // top-second: toggle camera
  HANGUP: 2,  // top-third: hang up / leave call
};

// ── State ─────────────────────────────────────────────────────────────────

let inCall = false;    // whether Chrome is on a Meet URL
let micMuted = false;  // local tracking of mute toggle
let camOff = false;    // local tracking of camera toggle

let lastRenderedKey = null;
let rendering = false;
let debounceTimer = null;

// ── osascript helpers ─────────────────────────────────────────────────────

/**
 * Returns true if Google Chrome has a tab whose URL contains meet.google.com.
 * Uses AppleScript via osascript — safe even when Chrome is not running.
 */
function detectMeetCall() {
  try {
    const script = `
      tell application "System Events"
        if not (exists process "Google Chrome") then return "no"
      end tell
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if URL of t contains "meet.google.com" then return "yes"
          end repeat
        end repeat
      end tell
      return "no"
    `;
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 2000,
    }).toString().trim();
    return result === 'yes';
  } catch {
    return false;
  }
}

/**
 * Send a keyboard shortcut to Chrome (focused window).
 * Google Meet shortcuts work regardless of which element has focus within the page.
 */
function sendMeetShortcut(shortcut) {
  // shortcut format: e.g. "command shift a" or "command d"
  const parts = shortcut.split(' ');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).join(' down, ');
  const modClause = modifiers ? `using {${modifiers} down}` : '';

  const script = `
    tell application "Google Chrome" to activate
    tell application "System Events"
      key code (key code of (get key code "${key}")) ${modClause}
    end tell
  `;

  // Simpler form — use keystroke for letter keys
  const letterScript = `
    tell application "Google Chrome" to activate
    delay 0.05
    tell application "System Events"
      keystroke "${key}" ${modClause}
    end tell
  `;

  exec(`osascript -e '${letterScript.replace(/'/g, "'\\''")}'`, (err) => {
    if (err) console.error('Shortcut error:', err.message);
  });
}

/**
 * Hang up the current Meet call by clicking the "Leave call" button via AppleScript/JavaScript.
 */
function hangUp() {
  // Google Meet keyboard shortcut to leave: Ctrl+W closes the tab (works in most cases)
  // Better: use the Meet shortcut — no standard "leave" keyboard shortcut, so we use Ctrl+W
  // Actually Meet has no universal keyboard shortcut for leave, so we execute JS in the page.
  const script = `
    tell application "Google Chrome"
      set meetTab to missing value
      repeat with w in windows
        repeat with t in tabs of w
          if URL of t contains "meet.google.com" then
            set meetTab to t
            set index of w to 1
            set active tab index of w to tab index of t
            exit repeat
          end if
        end repeat
        if meetTab is not missing value then exit repeat
      end repeat
      if meetTab is not missing value then
        execute meetTab javascript "document.querySelector('[data-call-id],[jsname=\\"CQylAd\\"], button[aria-label*=\\"Leave\\"], button[aria-label*=\\"leave\\"]')?.click()"
      end if
    end tell
  `;
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
    if (err) console.error('Hang up error:', err.message);
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a single button as a raw RGB buffer for fillKeyBuffer().
 *
 * @param {object} opts
 * @param {string} opts.icon      - emoji or symbol
 * @param {string} opts.label     - small label below icon
 * @param {string} opts.bgColor   - hex background
 * @param {boolean} opts.dimmed   - grey out when not in call
 * @param {number} opts.size      - pixel size (square)
 */
async function renderButton({ icon = '', label = '', bgColor = '#1a1a1a', dimmed = false, size = 120 }) {
  const effectiveBg = dimmed ? '#1e1e1e' : bgColor;
  const iconOpacity = dimmed ? '0.25' : '1';
  const labelColor = dimmed ? '#555555' : '#ffffff';

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="10" fill="${effectiveBg}"/>
    <text x="${size / 2}" y="${size / 2 - (label ? 10 : 0)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${Math.floor(size * 0.36)}"
      font-family="Apple Color Emoji, Segoe UI Emoji, Arial"
      opacity="${iconOpacity}">${escapeXml(icon)}</text>
    ${label ? `<text x="${size / 2}" y="${size * 0.76}"
      text-anchor="middle"
      font-size="${Math.floor(size * 0.13)}"
      font-family="Arial" font-weight="bold"
      fill="${labelColor}">${escapeXml(label)}</text>` : ''}
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .removeAlpha()
    .raw()
    .toBuffer();
}

function getStateKey() {
  return JSON.stringify({ inCall, micMuted, camOff });
}

async function render(deck, force = false) {
  const key = getStateKey();
  if (rendering || (!force && key === lastRenderedKey)) return;
  rendering = true;
  lastRenderedKey = key;

  const size = deck.ICON_SIZE;

  try {
    // Mic button: 🎤 (live) / 🔇 (muted) — green when live, red when muted, grey when not in call
    const micIcon  = micMuted ? '🔇' : '🎤';
    const micLabel = micMuted ? 'Muted' : 'Live';
    const micBg    = micMuted ? '#b22222' : '#1a7a1a';

    // Camera button: 📷 (on) / 🚫 (off) — green when on, red/dark when off
    const camIcon  = camOff ? '🚫' : '📷';
    const camLabel = camOff ? 'Cam Off' : 'Camera';
    const camBg    = camOff ? '#b22222' : '#1a7a1a';

    // Hang-up button: always red phone / end call icon
    const hangIcon  = '📵';
    const hangLabel = 'Hang Up';
    const hangBg    = '#cc0000';

    const [micBuf, camBuf, hangBuf] = await Promise.all([
      renderButton({ icon: micIcon,  label: micLabel,  bgColor: micBg,  dimmed: !inCall, size }),
      renderButton({ icon: camIcon,  label: camLabel,  bgColor: camBg,  dimmed: !inCall, size }),
      renderButton({ icon: hangIcon, label: hangLabel, bgColor: hangBg, dimmed: !inCall, size }),
    ]);

    await Promise.all([
      deck.fillKeyBuffer(BTN.MIC,    micBuf,  { format: 'rgb' }),
      deck.fillKeyBuffer(BTN.CAMERA, camBuf,  { format: 'rgb' }),
      deck.fillKeyBuffer(BTN.HANGUP, hangBuf, { format: 'rgb' }),
    ]);

    // Render LCD strip: show call status
    const lcdBuf = await renderLcd({ inCall, micMuted, camOff });
    try {
      await deck.fillLcd(0, lcdBuf, { format: 'rgb', width: 800, height: 100 });
    } catch { /* ignore on devices without LCD */ }

  } finally {
    rendering = false;
  }
}

async function renderLcd({ inCall, micMuted, camOff }) {
  const w = 800, h = 100;

  const statusColor = inCall ? '#34a853' : '#555555';
  const statusText  = inCall ? 'In Call' : 'Not in Call';
  const micText     = inCall ? (micMuted ? '🔇 Muted'  : '🎤 Live')   : '';
  const camText     = inCall ? (camOff   ? '📷 Cam Off' : '📷 Cam On') : '';
  const detailColor = '#aaaaaa';

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#111111"/>
    <circle cx="28" cy="50" r="10" fill="${inCall ? '#34a853' : '#555555'}"/>
    <text x="50" y="38" font-size="26" font-family="Arial" font-weight="bold" fill="${statusColor}">${escapeXml(statusText)}</text>
    <text x="50" y="70" font-size="20" font-family="Apple Color Emoji, Arial" fill="${detailColor}">${escapeXml(micText)}  ${escapeXml(camText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(w, h)
    .removeAlpha()
    .raw()
    .toBuffer();
}

function scheduleRender(deck, delayMs = 100) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => render(deck).catch(console.error), delayMs);
}

// ── Poll for Meet call state ───────────────────────────────────────────────

function poll(deck) {
  const wasInCall = inCall;
  inCall = detectMeetCall();

  // When we leave a call, reset local toggle state so next call starts fresh
  if (wasInCall && !inCall) {
    micMuted = false;
    camOff   = false;
  }

  render(deck).catch(console.error);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error('No Stream Deck found. Ensure it is connected and the Stream Deck app is closed.');
    process.exit(1);
  }

  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected to ${deck.PRODUCT_NAME}`);
  await deck.setBrightness(80);
  await deck.clearPanel();

  // Initial render (not in call)
  await render(deck, true);

  // Poll for Meet call presence every 2 seconds
  poll(deck);
  const pollInterval = setInterval(() => poll(deck), 2000);

  // ── Button press handler ─────────────────────────────────────────────────
  deck.on('down', async (control) => {
    if (control.type !== 'button') return;
    const idx = control.index;

    // Ignore buttons when not in a call (they look dimmed — no action)
    if (!inCall && idx !== BTN.HANGUP) return;

    try {
      if (idx === BTN.MIC) {
        // Google Meet: Cmd+D to toggle mic on Mac
        sendMeetShortcut('command d');
        micMuted = !micMuted;
        scheduleRender(deck);

      } else if (idx === BTN.CAMERA) {
        // Google Meet: Cmd+E to toggle camera on Mac
        sendMeetShortcut('command e');
        camOff = !camOff;
        scheduleRender(deck);

      } else if (idx === BTN.HANGUP) {
        if (!inCall) return; // safety guard
        hangUp();
        // Optimistically clear call state — poll will confirm
        inCall   = false;
        micMuted = false;
        camOff   = false;
        scheduleRender(deck);
      }
    } catch (err) {
      console.error(`Button ${idx} error:`, err.message);
    }
  });

  console.log('Google Meet controller running. Ctrl+C to exit.');
  console.log('Polling for Meet call every 2 seconds...');

  process.on('SIGINT', async () => {
    clearInterval(pollInterval);
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
