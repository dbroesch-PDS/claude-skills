'use strict';

/**
 * Pomodoro Timer for Stream Deck Plus
 *
 * Button 0 (top-left) shows a live countdown: 25:00 → 24:59 → … → 00:00
 *
 * Click behaviour:
 *   - IDLE   → starts the 25-minute countdown (green background)
 *   - RUNNING → pauses the countdown (dark background)
 *   - PAUSED  → resumes the countdown (green background)
 *   - DONE    → resets to 25:00 (button was red, returns to idle)
 *
 * No external APIs or network calls — pure Node.js timers + Stream Deck hardware SDK.
 *
 * Setup:
 *   npm install
 *   # Close the Stream Deck app first — it holds exclusive USB access
 *   node index.js
 */

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');

// ── Configuration ────────────────────────────────────────────────────────────

const POMODORO_SECONDS = 25 * 60; // 25 minutes
const BUTTON_INDEX = 0;           // first key on the top row of Stream Deck Plus

// ── Timer state ───────────────────────────────────────────────────────────────

/** @type {'idle' | 'running' | 'paused' | 'done'} */
let timerState = 'idle';
let secondsLeft = POMODORO_SECONDS;
let tickInterval = null;

// ── Render guard ──────────────────────────────────────────────────────────────

let rendering = false;
let lastRenderedKey = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** XML-escape a string for safe embedding in SVG text nodes. */
function xmlEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Format a raw second count as MM:SS. */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── SVG → RGB buffer ──────────────────────────────────────────────────────────

/**
 * Build an RGB buffer for one Stream Deck key.
 *
 * Visual layout (top → bottom):
 *   [accent bar]
 *   🍅  (tomato emoji — thematic decoration)
 *   MM:SS  or  DONE   (large, white, bold)
 *   hint text          (small, grey)
 *
 * Colours:
 *   idle    — dark (#111111), amber accent
 *   running — dark green (#0d2b0d), green accent
 *   paused  — dark (#111111), amber accent
 *   done    — red (#9b1c00), bright-red accent
 *
 * @param {number} size  - Pixel dimensions from deck.ICON_SIZE
 * @returns {Promise<Buffer>}  Raw RGB buffer
 */
async function buildKeyImage(size) {
  // ── Colours & text per state ─────────────────────────────────────────────
  let bgColor, accentColor, mainText, hintText;

  switch (timerState) {
    case 'idle':
      bgColor     = '#111111';
      accentColor = '#cc8800';
      mainText    = formatTime(secondsLeft);
      hintText    = 'tap to start';
      break;

    case 'running':
      bgColor     = '#0d2b0d';
      accentColor = '#33cc33';
      mainText    = formatTime(secondsLeft);
      hintText    = 'tap to pause';
      break;

    case 'paused':
      bgColor     = '#111111';
      accentColor = '#cc8800';
      mainText    = formatTime(secondsLeft);
      hintText    = 'tap to resume';
      break;

    case 'done':
      bgColor     = '#9b1c00';
      accentColor = '#ff4422';
      mainText    = 'DONE';
      hintText    = 'tap to reset';
      break;

    default:
      bgColor     = '#111111';
      accentColor = '#444444';
      mainText    = '--:--';
      hintText    = '';
  }

  // ── Font sizes (relative to key size) ───────────────────────────────────
  const emojiSize = Math.round(size * 0.18);
  // DONE is shorter than MM:SS, so we can use a larger font
  const mainSize  = timerState === 'done'
    ? Math.round(size * 0.28)
    : Math.round(size * 0.22);
  const hintSize  = Math.round(size * 0.11);

  // ── Vertical layout positions ────────────────────────────────────────────
  const accentBarH = Math.round(size * 0.055);
  const emojiY     = Math.round(size * 0.36);
  const mainY      = Math.round(size * 0.63);
  const hintY      = Math.round(size * 0.88);

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="${size}" height="${size}" rx="8" fill="${bgColor}"/>

    <!-- Accent bar (top edge) -->
    <rect x="0" y="0" width="${size}" height="${accentBarH}" fill="${accentColor}"/>

    <!-- Tomato emoji -->
    <text
      x="${size / 2}" y="${emojiY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${emojiSize}"
      font-family="Apple Color Emoji, Segoe UI Emoji, Arial">🍅</text>

    <!-- Main countdown / DONE text -->
    <text
      x="${size / 2}" y="${mainY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${mainSize}"
      font-family="'SF Mono', 'Courier New', monospace"
      font-weight="bold"
      fill="#ffffff">${xmlEsc(mainText)}</text>

    <!-- Hint text -->
    <text
      x="${size / 2}" y="${hintY}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${hintSize}"
      font-family="Arial, sans-serif"
      fill="#777777">${xmlEsc(hintText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .removeAlpha()
    .raw()
    .toBuffer();
}

// ── Render to hardware ────────────────────────────────────────────────────────

/**
 * Render the current timer state to the physical button.
 * Skips re-renders when nothing has changed.
 *
 * @param {import('@elgato-stream-deck/node').StreamDeck} deck
 * @param {boolean} [force=false]  Skip change-detection and always render
 */
async function render(deck, force = false) {
  const stateKey = `${timerState}:${secondsLeft}`;
  if (!force && (rendering || stateKey === lastRenderedKey)) return;

  rendering = true;
  lastRenderedKey = stateKey;

  try {
    const buf = await buildKeyImage(deck.ICON_SIZE);
    await deck.fillKeyBuffer(BUTTON_INDEX, buf, { format: 'rgb' });
  } catch (err) {
    console.error('[render] Error:', err.message);
  } finally {
    rendering = false;
  }
}

// ── Timer control ─────────────────────────────────────────────────────────────

/**
 * Start the one-second tick interval.
 * Each tick decrements secondsLeft; reaching zero transitions to 'done'.
 *
 * @param {import('@elgato-stream-deck/node').StreamDeck} deck
 */
function startTick(deck) {
  if (tickInterval) clearInterval(tickInterval);

  tickInterval = setInterval(async () => {
    if (timerState !== 'running') return;

    secondsLeft -= 1;

    if (secondsLeft <= 0) {
      secondsLeft = 0;
      timerState  = 'done';
      clearInterval(tickInterval);
      tickInterval = null;
      console.log('[pomodoro] Time is up!');
    }

    await render(deck);
  }, 1000);
}

/** Clear the tick interval without changing state. */
function stopTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// ── Button press handler ──────────────────────────────────────────────────────

/**
 * Handle a press on the Pomodoro button.
 *
 * State machine:
 *   idle    → running  (start)
 *   running → paused   (pause)
 *   paused  → running  (resume)
 *   done    → idle     (reset)
 *
 * @param {import('@elgato-stream-deck/node').StreamDeck} deck
 */
async function handlePress(deck) {
  switch (timerState) {
    case 'idle':
      timerState = 'running';
      startTick(deck);
      console.log('[pomodoro] Started');
      break;

    case 'running':
      timerState = 'paused';
      stopTick();
      console.log(`[pomodoro] Paused at ${formatTime(secondsLeft)}`);
      break;

    case 'paused':
      timerState = 'running';
      startTick(deck);
      console.log(`[pomodoro] Resumed from ${formatTime(secondsLeft)}`);
      break;

    case 'done':
      stopTick();
      secondsLeft = POMODORO_SECONDS;
      timerState  = 'idle';
      console.log('[pomodoro] Reset');
      break;
  }

  await render(deck);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error(
      'No Stream Deck found.\n' +
      '  • Is the device plugged in?\n' +
      '  • Is the Stream Deck app closed? (it holds exclusive USB access)'
    );
    process.exit(1);
  }

  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected: ${deck.PRODUCT_NAME}  (key size: ${deck.ICON_SIZE}px)`);

  await deck.setBrightness(80);
  await deck.clearPanel();

  // Draw initial state
  await render(deck, true);

  // Listen for button presses
  deck.on('down', async (control) => {
    // Stream Deck Plus also emits encoder and touch events — ignore those
    if (control.type !== 'button') return;
    if (control.index !== BUTTON_INDEX) return;
    await handlePress(deck);
  });

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n[pomodoro] Shutting down…');
    stopTick();
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });

  console.log('Pomodoro timer running on button 0.');
  console.log('  tap once  → start  |  tap again → pause/resume  |  after DONE → reset');
  console.log('  Ctrl+C to exit');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
