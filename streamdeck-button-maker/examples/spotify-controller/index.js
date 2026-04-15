'use strict';
const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const { execSync, exec } = require('node:child_process');
const { SpotifyAPI } = require('./spotify/api.js');
const { startAuthFlow } = require('./spotify/auth.js');
const { loadTokens, saveTokens } = require('./spotify/tokens.js');
const { renderButton, renderLcd } = require('./spotify/render.js');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;

// ── Modes ──────────────────────────────────────────────────────────────────
// launcher: one Spotify button, everything else blank
// controls: full playback controls
let mode = 'launcher';
let prevMode = null;
let modeEnteredAt = 0; // timestamp when controls mode was entered

// Stream Deck Plus: 8 buttons, 4 cols × 2 rows
//   [0][1][2][3]
//   [4][5][6][7]

const LAUNCHER_BTN = 5; // bottom-center-ish

// Controls layout:
//   [Play/Pause][Prev][Next][Repeat]
//   [Back      ][DJ  ][    ][      ]
const BTN = { PLAY_PAUSE: 0, PREV: 1, NEXT: 2, REPEAT: 3, BACK: 4, DJ_MODE: 5 };

const REPEAT_ICONS   = { off: '🔁', track: '🔂', context: '🔁' };
const REPEAT_LABELS  = { off: 'Repeat', track: 'Repeat 1', context: 'Repeat All' };
const REPEAT_COLORS  = { off: '#333333', track: '#1DB954', context: '#1DB954' };

let lastState = null;
let lastRenderedKey = null; // skip renders when nothing changed
let lastArtUrl = null;
let lastArtBuffer = null;
let debounceTimer = null;
let rendering = false;

const spotify = new SpotifyAPI();

// ── State key — skip renders when nothing relevant changed ─────────────────

function getStateKey() {
  return JSON.stringify({
    mode,
    isPlaying: lastState?.is_playing,
    repeat: lastState?.repeat_state,
    volume: lastState?.device?.volume_percent,
    trackId: lastState?.item?.id ?? null,
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────

async function renderLauncher(deck) {
  const size = deck.ICON_SIZE;
  const isPlaying = lastState?.is_playing ?? false;
  const buf = await renderButton({
    icon: '🎵',
    label: isPlaying ? '▶ Spotify' : 'Spotify',
    bgColor: isPlaying ? '#1DB954' : '#333333',
    size,
  });
  await deck.fillKeyBuffer(LAUNCHER_BTN, buf, { format: 'rgb' });
}

async function renderControls(deck) {
  const size = deck.ICON_SIZE;
  const isPlaying = lastState?.is_playing ?? false;
  const repeat = lastState?.repeat_state ?? 'off';
  const track = lastState?.item;
  const volume = lastState?.device?.volume_percent ?? null;

  // Fetch album art only when track changes
  const artUrl = track?.album?.images?.[0]?.url ?? null;
  if (artUrl !== lastArtUrl) {
    lastArtUrl = artUrl;
    lastArtBuffer = artUrl ? await spotify.fetchAlbumArt(artUrl) : null;
  }

  const [playBuf, prevBuf, nextBuf, repeatBuf, backBuf, djBuf] = await Promise.all([
    renderButton({ icon: isPlaying ? '⏸' : '▶', bgImage: lastArtBuffer, bgColor: '#1DB954', size }),
    renderButton({ icon: '⏮', label: 'Prev', bgColor: '#222222', size }),
    renderButton({ icon: '⏭', label: 'Next', bgColor: '#222222', size }),
    renderButton({ icon: REPEAT_ICONS[repeat], label: REPEAT_LABELS[repeat], bgColor: REPEAT_COLORS[repeat], size }),
    renderButton({ icon: '←', label: 'Back', bgColor: '#111111', size }),
    renderButton({ icon: '🎧', label: 'DJ Mode', bgColor: '#6B35C4', size }),
  ]);

  await Promise.all([
    deck.fillKeyBuffer(BTN.PLAY_PAUSE, playBuf, { format: 'rgb' }),
    deck.fillKeyBuffer(BTN.PREV,       prevBuf, { format: 'rgb' }),
    deck.fillKeyBuffer(BTN.NEXT,       nextBuf, { format: 'rgb' }),
    deck.fillKeyBuffer(BTN.REPEAT,     repeatBuf, { format: 'rgb' }),
    deck.fillKeyBuffer(BTN.BACK,       backBuf, { format: 'rgb' }),
    deck.fillKeyBuffer(BTN.DJ_MODE,    djBuf, { format: 'rgb' }),
  ]);

  const lcdBuf = await renderLcd({
    title: track?.name ?? 'Nothing playing',
    artist: track?.artists?.map(a => a.name).join(', ') ?? '',
    isPlaying,
    volume,
  });
  try {
    await deck.fillLcd(0, lcdBuf, { format: 'rgb', width: 800, height: 100 });
  } catch { /* ignore if device doesn't support LCD */ }
}

async function render(deck, force = false) {
  const key = getStateKey();
  if (rendering || (!force && key === lastRenderedKey)) return;
  rendering = true;
  lastRenderedKey = key;

  try {
    const modeChanged = mode !== prevMode;
    if (modeChanged) {
      await deck.clearPanel();
      prevMode = mode;
    }

    if (mode === 'launcher') {
      await renderLauncher(deck);
    } else {
      await renderControls(deck);
    }
  } finally {
    rendering = false;
  }
}

// ── Spotify focus detection ───────────────────────────────────────────────

function isSpotifyFocused() {
  try {
    const name = execSync(
      "osascript -e 'tell application \"System Events\" to get name of first process whose frontmost is true'",
      { timeout: 1000 }
    ).toString().trim();
    return name === 'Spotify';
  } catch {
    return false;
  }
}

// ── Poll ──────────────────────────────────────────────────────────────────

async function poll(deck) {
  try {
    lastState = await spotify.getPlaybackState();
    await render(deck);
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

function scheduleRefresh(deck, delayMs = 600) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => poll(deck), delayMs);
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

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!CLIENT_ID) {
    console.error('Error: set SPOTIFY_CLIENT_ID environment variable first.');
    console.error('  export SPOTIFY_CLIENT_ID=your_client_id_here');
    process.exit(1);
  }

  const stored = loadTokens();
  if (stored) spotify.setTokens(stored);

  const devices = await listStreamDecks();
  if (devices.length === 0) {
    console.error('No Stream Deck found. Make sure it is connected and the Stream Deck app is closed.');
    process.exit(1);
  }
  const deck = await openStreamDeck(devices[0].path);
  console.log(`Connected to ${deck.PRODUCT_NAME}`);
  await deck.setBrightness(80);
  await deck.clearPanel();

  if (!spotify.isAuthorized) {
    console.log('Not authenticated. Starting Spotify login...');
    const tokens = await startAuthFlow(CLIENT_ID);
    spotify.setTokens(tokens);
    saveTokens(tokens);
    console.log('Authenticated!');
  }

  await poll(deck);

  // Poll Spotify state every 3 seconds
  const pollInterval = setInterval(() => poll(deck), 3000);

  // Focus-based mode switching:
  // - Switch TO controls when Spotify comes into focus
  // - Switch BACK to launcher when Spotify loses focus, but only after a 4s
  //   grace period so clicking a button doesn't immediately switch back
  setInterval(() => {
    const focused = isSpotifyFocused();
    const gracePassed = Date.now() - modeEnteredAt > 2000;

    if (focused && mode === 'launcher') {
      enterControls(deck);
    } else if (!focused && mode === 'controls' && gracePassed) {
      enterLauncher(deck);
    }
  }, 2000);

  // Button press handler
  deck.on('down', async (control) => {
    if (control.type !== 'button') return;
    const idx = control.index;

    try {
      if (mode === 'launcher') {
        if (idx === LAUNCHER_BTN) enterControls(deck);
        return;
      }

      // Controls mode
      if (idx === BTN.BACK) {
        enterLauncher(deck);
      } else if (idx === BTN.PLAY_PAUSE) {
        await spotify.togglePlayback(lastState?.is_playing ?? false);
        scheduleRefresh(deck);
      } else if (idx === BTN.PREV) {
        await spotify.previousTrack();
        scheduleRefresh(deck);
      } else if (idx === BTN.NEXT) {
        await spotify.nextTrack();
        scheduleRefresh(deck);
      } else if (idx === BTN.REPEAT) {
        const next = spotify.cycleRepeat(lastState?.repeat_state ?? 'off');
        await spotify.setRepeat(next);
        scheduleRefresh(deck);
      } else if (idx === BTN.DJ_MODE) {
        exec('open "spotify:playlist:37i9dQZF1EYkqdzj48dyYq"', (err) => {
          if (err) console.error('Could not open DJ mode:', err.message);
        });
        scheduleRefresh(deck, 1500);
      }
    } catch (err) {
      console.error(`Button ${idx} error:`, err.message);
    }
  });

  // Encoder rotation → volume
  deck.on('rotate', async (control, ticks) => {
    const current = lastState?.device?.volume_percent ?? 50;
    try {
      await spotify.setVolume(current + ticks * 5);
      scheduleRefresh(deck);
    } catch (err) {
      console.error('Volume error:', err.message);
    }
  });

  console.log('Running. Ctrl+C to exit.');

  process.on('SIGINT', async () => {
    clearInterval(pollInterval);
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
