# Rendering Reference

## Key sizes by device

| Device | ICON_SIZE | Button count |
|--------|-----------|-------------|
| Stream Deck Plus | 120px | 8 (4×2) + 4 encoders |
| Stream Deck MK.2 | 72px | 15 (5×3) |
| Stream Deck Mini | 80px | 6 (2×3) |
| Stream Deck XL | 96px | 32 (4×8) |

Always use `deck.ICON_SIZE` in code rather than hardcoding.

## LCD strip (Stream Deck Plus only)

The LCD touchstrip is 800×100px, split into 4 segments (one per encoder).
You can fill the whole thing as one buffer:

```javascript
async function renderLcd({ title = '', artist = '', isPlaying = false, volume = null }) {
  const w = 800, h = 100;
  const statusColor = isPlaying ? '#1DB954' : '#888888';
  const volText = volume !== null ? `  🔊 ${volume}%` : '';

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#111111"/>
    <text x="20" y="38" font-size="28" font-family="Arial" font-weight="bold"
      fill="${statusColor}">${isPlaying ? '▶' : '⏸'}</text>
    <text x="58" y="38" font-size="26" font-family="Arial" font-weight="bold"
      fill="white">${esc(truncate(title, 38))}</text>
    <text x="58" y="72" font-size="20" font-family="Arial"
      fill="#aaaaaa">${esc(truncate(artist, 45))}${esc(volText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(w, h)
    .removeAlpha()
    .raw()
    .toBuffer();
}

// Paint it
const lcdBuf = await renderLcd({ title: 'Song Name', artist: 'Artist', isPlaying: true });
try {
  await deck.fillLcd(0, lcdBuf, { format: 'rgb', width: 800, height: 100 });
} catch { /* not all SDK versions support this signature */ }
```

## Using an image as a button background

Fetch a remote image (e.g. album art) and use it as the button background:

```javascript
async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// Cache by URL to avoid re-fetching every poll cycle
let lastArtUrl = null;
let lastArtBuffer = null;

const artUrl = state?.album?.images?.[0]?.url ?? null;
if (artUrl !== lastArtUrl) {
  lastArtUrl = artUrl;
  lastArtBuffer = artUrl ? await fetchImageBuffer(artUrl) : null;
}

// Use in renderButton: pass lastArtBuffer as bgImage
```

## Compositing multiple SVG layers

Sharp composites layers in order. Use this for overlays (dark scrim + icon on top of a photo):

```javascript
const result = await sharp(backgroundBuffer)
  .resize(size, size)
  .composite([
    { input: Buffer.from(scrimSvg), blend: 'over' },   // darkening layer
    { input: Buffer.from(iconSvg),  blend: 'over' },   // icon on top
  ])
  .removeAlpha()
  .raw()
  .toBuffer();
```

## Clearing buttons

```javascript
await deck.clearKey(3);    // clear one button
await deck.clearPanel();   // clear all buttons (causes a brief flash — use sparingly)
```

Only call `clearPanel()` when switching modes, not on every poll cycle — it causes visible flicker.
