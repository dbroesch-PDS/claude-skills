'use strict';

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const { execSync } = require('node:child_process');

// ─── osascript helpers ────────────────────────────────────────────────────────

function getSystemVolume() {
  try {
    const raw = execSync('osascript -e "output volume of (get volume settings)"', {
      timeout: 1000,
    }).toString().trim();
    return parseInt(raw, 10);
  } catch {
    return null;
  }
}

function getSystemMuted() {
  try {
    const raw = execSync('osascript -e "output muted of (get volume settings)"', {
      timeout: 1000,
    }).toString().trim();
    return raw === 'true';
  } catch {
    return false;
  }
}

function setSystemVolume(vol) {
  const clamped = Math.max(0, Math.min(100, vol));
  execSync(`osascript -e "set volume output volume ${clamped}"`, { timeout: 1000 });
}

function toggleMute(currentlyMuted) {
  const flag = currentlyMuted ? 'false' : 'true';
  execSync(`osascript -e "set volume output muted ${flag}"`, { timeout: 1000 });
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a single encoder button (120×120) showing volume % or mute state.
 */
async function renderEncoderButton({ volume, muted, size }) {
  const bgColor = muted ? '#4a1010' : '#0d2b1a';
  const iconChar = muted ? '🔇' : volume === 0 ? '🔈' : volume < 50 ? '🔉' : '🔊';
  const labelText = muted ? 'MUTED' : `${volume}%`;
  const labelColor = muted ? '#ff6b6b' : '#1DB954';

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="8" fill="${bgColor}"/>
    <text x="${size / 2}" y="${size * 0.42}" text-anchor="middle" dominant-baseline="middle"
      font-size="${size * 0.34}" font-family="Arial">${esc(iconChar)}</text>
    <text x="${size / 2}" y="${size * 0.78}" text-anchor="middle"
      font-size="${size * 0.16}" font-family="Arial" font-weight="bold"
      fill="${labelColor}">${esc(labelText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .removeAlpha()
    .raw()
    .toBuffer();
}

/**
 * Render the full 800×100 LCD strip showing current volume and mute state.
 */
async function renderLcd({ volume, muted }) {
  const w = 800, h = 100;

  // Volume bar dimensions
  const barX = 20, barY = 62, barW = 760, barH = 18, barR = 6;
  const fillW = Math.round((volume / 100) * barW);
  const barColor = muted ? '#6b2020' : '#1DB954';
  const statusText = muted ? 'MUTED' : `${volume}%`;
  const statusColor = muted ? '#ff6b6b' : '#1DB954';
  const speakerIcon = muted ? '🔇' : volume === 0 ? '🔈' : volume < 50 ? '🔉' : '🔊';

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#111111"/>

    <!-- Speaker icon -->
    <text x="20" y="46" font-size="30" font-family="Arial" dominant-baseline="middle">${esc(speakerIcon)}</text>

    <!-- Label: "System Volume" -->
    <text x="64" y="30" font-size="22" font-family="Arial" font-weight="bold" fill="#aaaaaa">System Volume</text>

    <!-- Status value -->
    <text x="64" y="56" font-size="22" font-family="Arial" font-weight="bold" fill="${statusColor}">${esc(statusText)}</text>

    <!-- Hint -->
    <text x="${w - 20}" y="30" text-anchor="end" font-size="17" font-family="Arial" fill="#555555">rotate to adjust  |  press to toggle mute</text>

    <!-- Volume bar background -->
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barR}" fill="#333333"/>

    <!-- Volume bar fill -->
    ${fillW > 0
      ? `<rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" rx="${barR}" fill="${barColor}"/>`
      : ''}
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(w, h)
    .removeAlpha()
    .raw()
    .toBuffer();
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentVolume = 50;
let currentMuted = false;

// Pending volume from encoder rotation — debounced before applying
let pendingVolume = null;
let volumeTimer = null;

// Render guard
let rendering = false;
let lastRenderedKey = null;

// ─── Render ───────────────────────────────────────────────────────────────────

async function render(deck, force = false) {
  const key = JSON.stringify({ vol: currentVolume, muted: currentMuted, pending: pendingVolume });
  if (rendering || (!force && key === lastRenderedKey)) return;
  rendering = true;
  lastRenderedKey = key;

  // Use pending volume for immediate visual feedback while debouncing
  const displayVolume = pendingVolume !== null ? pendingVolume : currentVolume;

  try {
    // Render encoder button on index 0 (leftmost encoder)
    const btnBuf = await renderEncoderButton({
      volume: displayVolume,
      muted: currentMuted,
      size: deck.ICON_SIZE,
    });
    // Encoder buttons are addressed differently from keypad buttons.
    // fillEncoderImage writes to the LCD segment above encoder N.
    // fillKeyBuffer with a high index may not work — use LCD for display.
    // We'll render the button on keypad key 0 as well as the LCD strip.
    await deck.fillKeyBuffer(0, btnBuf, { format: 'rgb' });

    // Render the LCD strip
    const lcdBuf = await renderLcd({ volume: displayVolume, muted: currentMuted });
    try {
      await deck.fillLcd(0, lcdBuf, { format: 'rgb', width: 800, height: 100 });
    } catch (lcdErr) {
      console.warn('LCD fill failed (may not be supported on this SDK version):', lcdErr.message);
    }
  } catch (err) {
    console.error('Render error:', err.message);
  } finally {
    rendering = false;
  }
}

// ─── Poll system volume every 3 seconds ───────────────────────────────────────

async function pollVolume(deck) {
  try {
    const vol = getSystemVolume();
    const muted = getSystemMuted();
    if (vol !== null && (vol !== currentVolume || muted !== currentMuted)) {
      currentVolume = vol;
      currentMuted = muted;
      await render(deck);
    }
  } catch (err) {
    console.error('Poll error:', err.message);
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

  // Read initial state
  const initVol = getSystemVolume();
  const initMuted = getSystemMuted();
  if (initVol !== null) currentVolume = initVol;
  currentMuted = initMuted;

  // Initial render
  await render(deck, true);

  // ── Encoder rotation: adjust volume ──────────────────────────────────────
  deck.on('rotate', async (control, ticks) => {
    // Only respond to encoder 0 (leftmost)
    if (control.index !== 0) return;

    // Accumulate pending volume change (5% per tick, clamped 0–100)
    pendingVolume = Math.max(0, Math.min(100, (pendingVolume ?? currentVolume) + ticks * 5));

    // Immediate visual feedback
    await render(deck);

    // Debounce: apply to system after 100ms of no rotation
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(async () => {
      try {
        setSystemVolume(pendingVolume);
        currentVolume = pendingVolume;
        pendingVolume = null;
        await render(deck, true);
      } catch (err) {
        console.error('Set volume error:', err.message);
        pendingVolume = null;
      }
    }, 100);
  });

  // ── Encoder press: toggle mute ────────────────────────────────────────────
  deck.on('down', async (control) => {
    if (control.type !== 'encoder') return;
    if (control.index !== 0) return;

    try {
      toggleMute(currentMuted);
      currentMuted = !currentMuted;
      await render(deck, true);
    } catch (err) {
      console.error('Toggle mute error:', err.message);
    }
  });

  // ── Poll for external volume changes (e.g. changed by other apps) ─────────
  setInterval(() => pollVolume(deck), 3000);

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    clearTimeout(volumeTimer);
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
