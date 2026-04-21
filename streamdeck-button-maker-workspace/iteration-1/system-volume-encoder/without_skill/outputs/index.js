'use strict';

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const { execSync, execFileSync } = require('node:child_process');

// ─── osascript helpers ────────────────────────────────────────────────────────

function getVolume() {
  try {
    const out = execFileSync('osascript', ['-e', 'output volume of (get volume settings)'], {
      timeout: 1000
    }).toString().trim();
    return parseInt(out, 10);
  } catch {
    return 50;
  }
}

function setVolume(vol) {
  const clamped = Math.max(0, Math.min(100, vol));
  execFileSync('osascript', ['-e', `set volume output volume ${clamped}`], { timeout: 1000 });
}

function getMuted() {
  try {
    const out = execFileSync('osascript', ['-e', 'output muted of (get volume settings)'], {
      timeout: 1000
    }).toString().trim();
    return out === 'true';
  } catch {
    return false;
  }
}

function setMuted(muted) {
  execFileSync('osascript', ['-e', `set volume ${muted ? 'with' : 'without'} output muted`], {
    timeout: 1000
  });
}

// ─── LCD rendering ────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function renderLcd(volume, muted) {
  const w = 800, h = 100;

  const barWidth = Math.round((w * 0.8) * (volume / 100));
  const barX = Math.round(w * 0.1);
  const barY = 62;
  const barH = 14;
  const barTrackW = Math.round(w * 0.8);

  const muteColor = muted ? '#e53935' : '#ffffff';
  const barColor = muted ? '#e53935' : '#1DB954';
  const labelText = muted ? 'MUTED' : `${volume}%`;
  const iconText = muted ? '🔇' : (volume === 0 ? '🔈' : volume < 50 ? '🔉' : '🔊');

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#111111"/>

    <!-- Volume label -->
    <text x="${w / 2}" y="42" text-anchor="middle" dominant-baseline="middle"
      font-size="30" font-family="Arial" font-weight="bold" fill="${muteColor}">${esc(labelText)}</text>

    <!-- Volume bar track -->
    <rect x="${barX}" y="${barY}" width="${barTrackW}" height="${barH}"
      rx="6" fill="#333333"/>

    <!-- Volume bar fill -->
    ${barWidth > 0 ? `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}"
      rx="6" fill="${barColor}"/>` : ''}
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(w, h)
    .removeAlpha()
    .raw()
    .toBuffer();
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

  // ── State ──────────────────────────────────────────────────────────────────
  let currentVolume = getVolume();
  let currentMuted = getMuted();

  // Debounce: accumulate ticks and apply after a short idle period
  let pendingVolume = null;
  let volumeTimer = null;

  // Render guard
  let rendering = false;
  let lastRenderedKey = null;

  async function render() {
    const vol = pendingVolume !== null ? pendingVolume : currentVolume;
    const key = `${vol}:${currentMuted}`;
    if (rendering || key === lastRenderedKey) return;
    rendering = true;
    lastRenderedKey = key;
    try {
      const lcdBuf = await renderLcd(vol, currentMuted);
      try {
        await deck.fillLcd(0, lcdBuf, { format: 'rgb', width: 800, height: 100 });
      } catch {
        // older SDK signature
        await deck.fillLcd(lcdBuf, { format: 'rgb', width: 800, height: 100 });
      }
    } catch (err) {
      console.error('Render error:', err.message);
    } finally {
      rendering = false;
    }
  }

  // ── Initial render ─────────────────────────────────────────────────────────
  await render();

  // ── Encoder rotation → volume ──────────────────────────────────────────────
  deck.on('rotate', async (control, ticks) => {
    if (control.type !== 'encoder') return;

    // Use encoder 0 for volume (leftmost dial).
    // You can extend this to all 4 encoders by removing the index check.
    if (control.index !== 0) return;

    const base = pendingVolume !== null ? pendingVolume : currentVolume;
    pendingVolume = Math.max(0, Math.min(100, base + ticks * 2));

    // Optimistic LCD update while the user is still spinning
    await render();

    // Debounce: apply to macOS after 100 ms of quiet
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(async () => {
      try {
        // If currently muted, un-mute when the user rotates
        if (currentMuted) {
          setMuted(false);
          currentMuted = false;
        }
        setVolume(pendingVolume);
        currentVolume = pendingVolume;
        pendingVolume = null;
        await render();
      } catch (err) {
        console.error('Volume set error:', err.message);
        pendingVolume = null;
      }
    }, 100);
  });

  // ── Encoder press → toggle mute ────────────────────────────────────────────
  deck.on('down', async (control) => {
    if (control.type !== 'encoder') return;
    if (control.index !== 0) return;

    try {
      currentMuted = !currentMuted;
      setMuted(currentMuted);
      console.log(`Mute toggled → ${currentMuted ? 'MUTED' : 'unmuted'}`);
      await render();
    } catch (err) {
      console.error('Mute toggle error:', err.message);
    }
  });

  // ── Polling: keep LCD in sync with external volume changes ─────────────────
  setInterval(async () => {
    // Don't poll during an active rotation debounce
    if (pendingVolume !== null) return;
    try {
      const vol = getVolume();
      const muted = getMuted();
      if (vol !== currentVolume || muted !== currentMuted) {
        currentVolume = vol;
        currentMuted = muted;
        await render();
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, 2000);

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    clearTimeout(volumeTimer);
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });

  console.log('System volume encoder active. Rotate dial 0 to change volume; press to toggle mute. Ctrl+C to quit.');
}

main().catch(e => { console.error(e); process.exit(1); });
