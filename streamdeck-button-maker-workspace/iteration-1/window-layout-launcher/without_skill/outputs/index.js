'use strict';

// Window Layout Launcher for Stream Deck Plus
// Buttons 0-2 trigger macOS window arrangements via osascript.
//
// Button 0 — Focus Mode:    close Slack, Chrome → left half, iTerm → right half
// Button 1 — Meeting Mode:  open Zoom centered 1200×800, Obsidian → left third
// Button 2 — Communication: open Slack, open Chrome to slack.com, tile side-by-side
//
// Usage:
//   1. Quit the Stream Deck app (it has exclusive HID access).
//   2. npm install --registry https://global.block-artifacts.com/artifactory/api/npm/square-npm/
//   3. node index.js

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// AppleScript helpers
// ---------------------------------------------------------------------------

async function runAppleScript(script) {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 15000 });
    return stdout.trim();
  } catch (err) {
    console.error('AppleScript error:', err.message);
    throw err;
  }
}

// Get primary screen dimensions via AppleScript (falls back to 2560×1440 if unavailable).
async function getScreenSize() {
  try {
    const result = await runAppleScript(
      'tell application "Finder" to get bounds of window of desktop'
    );
    // result is "0, 0, width, height"
    const parts = result.split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length === 4) {
      return { width: parts[2], height: parts[3] };
    }
  } catch (_) { /* ignore */ }
  return { width: 2560, height: 1440 };
}

// ---------------------------------------------------------------------------
// Layout scripts
// ---------------------------------------------------------------------------

// Button 0: Focus Mode
// - Quit Slack
// - Chrome → left half of screen
// - iTerm → right half of screen
async function activateFocusMode() {
  console.log('[Focus Mode] Starting…');
  const { width, height } = await getScreenSize();
  const half = Math.floor(width / 2);

  const script = `
    -- Close Slack
    try
      tell application "Slack" to quit
    end try

    -- Chrome: left half
    tell application "Google Chrome"
      activate
      set bounds of front window to {0, 0, ${half}, ${height}}
    end tell

    -- iTerm: right half
    tell application "iTerm"
      activate
      set bounds of front window to {${half}, 0, ${width}, ${height}}
    end tell
  `;

  await runAppleScript(script);
  console.log('[Focus Mode] Done.');
}

// Button 1: Meeting Mode
// - Open / bring Zoom to center at 1200×800
// - Obsidian → left third of screen
async function activateMeetingMode() {
  console.log('[Meeting Mode] Starting…');
  const { width, height } = await getScreenSize();

  const zoomW = 1200;
  const zoomH = 800;
  const zoomX = Math.floor((width - zoomW) / 2);
  const zoomY = Math.floor((height - zoomH) / 2);

  const thirdW = Math.floor(width / 3);

  const script = `
    -- Obsidian: left third
    tell application "Obsidian"
      activate
      set bounds of front window to {0, 0, ${thirdW}, ${height}}
    end tell

    -- Zoom: centered 1200×800
    tell application "zoom.us"
      activate
    end tell
    delay 0.5
    tell application "System Events"
      tell process "zoom.us"
        set frontmost to true
        try
          set position of front window to {${zoomX}, ${zoomY}}
          set size of front window to {${zoomW}, ${zoomH}}
        end try
      end tell
    end tell
  `;

  await runAppleScript(script);
  console.log('[Meeting Mode] Done.');
}

// Button 2: Communication Mode
// - Open Slack
// - Open Chrome and navigate to slack.com
// - Tile Slack (left half) and Chrome (right half) side by side
async function activateCommunicationMode() {
  console.log('[Communication Mode] Starting…');
  const { width, height } = await getScreenSize();
  const half = Math.floor(width / 2);

  const script = `
    -- Open Slack
    tell application "Slack"
      activate
    end tell
    delay 0.8

    -- Open Chrome and go to slack.com
    tell application "Google Chrome"
      activate
      if (count windows) = 0 then
        make new window
      end if
      set URL of active tab of front window to "https://slack.com"
    end tell
    delay 0.5

    -- Tile: Slack left, Chrome right
    tell application "Slack"
      activate
      set bounds of front window to {0, 0, ${half}, ${height}}
    end tell

    tell application "Google Chrome"
      activate
      set bounds of front window to {${half}, 0, ${width}, ${height}}
    end tell
  `;

  await runAppleScript(script);
  console.log('[Communication Mode] Done.');
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
 * @param {string} opts.icon      - Single emoji or Unicode glyph used as the main icon
 * @param {string} opts.label     - Short label text drawn below the icon
 * @param {string} opts.bgColor   - Hex background colour
 * @param {string} opts.textColor - Hex text colour (default: white)
 * @param {number} opts.size      - Pixel dimensions (deck.ICON_SIZE)
 * @returns {Promise<Buffer>} Raw RGB pixel buffer
 */
async function renderButton({ icon = '', label = '', bgColor = '#1a1a2e', textColor = '#ffffff', size = 120 }) {
  const iconFontSize = Math.round(size * 0.38);
  const labelFontSize = Math.round(size * 0.13);
  const iconY = label ? Math.round(size * 0.44) : Math.round(size * 0.52);
  const labelY = Math.round(size * 0.82);

  const bg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="10" fill="${bgColor}"/>
  </svg>`;

  const overlay = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${size / 2}" y="${iconY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${iconFontSize}" font-family="Apple Color Emoji, Segoe UI Emoji, Arial"
    >${esc(icon)}</text>
    ${label ? `<text
      x="${size / 2}" y="${labelY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${labelFontSize}" font-family="Arial, Helvetica, sans-serif"
      font-weight="bold" fill="${textColor}"
    >${esc(label)}</text>` : ''}
  </svg>`;

  return sharp(Buffer.from(bg))
    .resize(size, size)
    .composite([{ input: Buffer.from(overlay), blend: 'over' }])
    .removeAlpha()
    .raw()
    .toBuffer();
}

// Button definitions
const BUTTONS = [
  {
    index: 0,
    icon: '🎯',
    label: 'Focus',
    bgColor: '#0d3b66',   // deep blue — calm, concentrated
    action: activateFocusMode,
  },
  {
    index: 1,
    icon: '📹',
    label: 'Meeting',
    bgColor: '#1b4332',   // deep green — productive
    action: activateMeetingMode,
  },
  {
    index: 2,
    icon: '💬',
    label: 'Comms',
    bgColor: '#4a1f63',   // purple — communication
    action: activateCommunicationMode,
  },
];

// "Busy" overlay: dim the button while the layout script runs
const ACTIVE_COLOR = '#555555';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error('No Stream Deck found. Is it connected? Is the Stream Deck app closed?');
    process.exit(1);
  }

  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected to ${deck.PRODUCT_NAME} (icon size: ${deck.ICON_SIZE}px)`);

  await deck.setBrightness(80);
  await deck.clearPanel();

  const size = deck.ICON_SIZE;

  // Pre-render all button images
  const buffers = {};
  for (const btn of BUTTONS) {
    buffers[btn.index] = await renderButton({
      icon: btn.icon,
      label: btn.label,
      bgColor: btn.bgColor,
      size,
    });
  }

  // Paint all buttons
  async function renderAll() {
    for (const btn of BUTTONS) {
      await deck.fillKeyBuffer(btn.index, buffers[btn.index], { format: 'rgb' });
    }
  }

  await renderAll();

  // Track which button is actively running so we don't double-fire
  const running = new Set();

  deck.on('down', async (control) => {
    if (control.type !== 'button') return;

    const btn = BUTTONS.find(b => b.index === control.index);
    if (!btn) return;
    if (running.has(btn.index)) return;

    running.add(btn.index);

    // Show a dim "active" state while the script runs
    const activeBuf = await renderButton({
      icon: btn.icon,
      label: btn.label,
      bgColor: ACTIVE_COLOR,
      size,
    });
    await deck.fillKeyBuffer(btn.index, activeBuf, { format: 'rgb' });

    try {
      await btn.action();
    } catch (err) {
      console.error(`Layout error for button ${btn.index}:`, err.message);
    } finally {
      running.delete(btn.index);
      // Restore original button appearance
      await deck.fillKeyBuffer(btn.index, buffers[btn.index], { format: 'rgb' });
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down…');
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });

  console.log('Window Layout Launcher ready. Press Ctrl+C to exit.');
  console.log('  Button 0 → Focus Mode     (close Slack, Chrome left, iTerm right)');
  console.log('  Button 1 → Meeting Mode   (Zoom centered, Obsidian left third)');
  console.log('  Button 2 → Communication  (Slack + Chrome to slack.com, side-by-side)');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
