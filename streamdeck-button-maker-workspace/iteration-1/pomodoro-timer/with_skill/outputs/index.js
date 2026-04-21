'use strict';

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');

// ─── Pomodoro config ───────────────────────────────────────────────────────────
const POMODORO_SECONDS = 25 * 60; // 25 minutes
const BUTTON_INDEX = 0;           // top-left button on Stream Deck Plus

// ─── Timer state ──────────────────────────────────────────────────────────────
let secondsLeft = POMODORO_SECONDS;
let running = false;
let done = false;
let tickInterval = null;

// ─── Render guard ─────────────────────────────────────────────────────────────
let rendering = false;
let lastRenderedKey = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Button rendering ─────────────────────────────────────────────────────────
async function renderPomodoroButton(size) {
  let bgColor, topText, bottomText, topFontSize, bottomFontSize;

  if (done) {
    // Finished state: red background, DONE label
    bgColor = '#cc2200';
    topText = 'DONE';
    bottomText = 'tap to reset';
    topFontSize = size * 0.28;
    bottomFontSize = size * 0.11;
  } else {
    // Active/paused state
    bgColor = running ? '#1a3a1a' : '#1a1a1a';
    topText = formatTime(secondsLeft);
    bottomText = running ? 'tap to pause' : (secondsLeft === POMODORO_SECONDS ? 'tap to start' : 'tap to resume');
    topFontSize = size * 0.22;
    bottomFontSize = size * 0.11;
  }

  // Accent bar color: green while running, amber while paused, red when done
  const accentColor = done ? '#ff4422' : running ? '#44cc44' : '#cc9900';

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="8" fill="${bgColor}"/>

    <!-- Accent bar at top -->
    <rect x="0" y="0" width="${size}" height="${Math.round(size * 0.055)}" rx="4" fill="${accentColor}"/>

    <!-- Tomato icon (small, top-center) -->
    <text x="${size / 2}" y="${Math.round(size * 0.38)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${Math.round(size * 0.16)}" font-family="Arial">🍅</text>

    <!-- Countdown / DONE text -->
    <text x="${size / 2}" y="${Math.round(size * 0.62)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${Math.round(topFontSize)}" font-family="Arial" font-weight="bold"
      fill="white">${esc(topText)}</text>

    <!-- Hint text at bottom -->
    <text x="${size / 2}" y="${Math.round(size * 0.88)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${Math.round(bottomFontSize)}" font-family="Arial"
      fill="#888888">${esc(bottomText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .removeAlpha()
    .raw()
    .toBuffer();
}

// ─── Render to deck ───────────────────────────────────────────────────────────
async function render(deck) {
  const stateKey = JSON.stringify({ secondsLeft, running, done });
  if (rendering || stateKey === lastRenderedKey) return;
  rendering = true;
  lastRenderedKey = stateKey;
  try {
    const buf = await renderPomodoroButton(deck.ICON_SIZE);
    await deck.fillKeyBuffer(BUTTON_INDEX, buf, { format: 'rgb' });
  } catch (err) {
    console.error('Render error:', err.message);
  } finally {
    rendering = false;
  }
}

// ─── Timer control ────────────────────────────────────────────────────────────
function startTimer(deck) {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    if (!running) return;
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      secondsLeft = 0;
      running = false;
      done = true;
      clearInterval(tickInterval);
      tickInterval = null;
    }
    await render(deck);
  }, 1000);
}

function stopTimer() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function resetTimer() {
  stopTimer();
  secondsLeft = POMODORO_SECONDS;
  running = false;
  done = false;
}

// ─── Button press handler ─────────────────────────────────────────────────────
async function handlePress(deck) {
  if (done) {
    // Reset to initial state
    resetTimer();
    await render(deck);
    return;
  }

  if (running) {
    // Pause
    running = false;
    stopTimer();
    await render(deck);
  } else {
    // Start or resume
    running = true;
    startTimer(deck);
    await render(deck);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  // Initial render
  await render(deck);

  // Button press
  deck.on('down', async (control) => {
    if (control.type !== 'button') return;
    if (control.index !== BUTTON_INDEX) return;
    await handlePress(deck);
  });

  // Graceful exit
  process.on('SIGINT', async () => {
    stopTimer();
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });

  console.log('Pomodoro timer ready. Press button 0 to start.');
  console.log('  - Press to start / pause / resume');
  console.log('  - When done, button turns red — press to reset');
  console.log('  - Ctrl+C to exit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
