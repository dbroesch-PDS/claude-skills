'use strict';
const sharp = require('sharp');

/**
 * Renders a button as a raw RGB buffer for fillKeyBuffer().
 * @param {object} opts
 * @param {string} opts.icon - emoji or text icon
 * @param {string} opts.label - button label
 * @param {string} opts.bgColor - hex background color
 * @param {Buffer|null} opts.bgImage - raw JPEG/PNG bytes to use as background
 * @param {number} opts.size - button size in pixels
 */
async function renderButton({ icon = '', label = '', bgColor = '#1a1a1a', bgImage = null, size = 120 }) {
  let base;

  if (bgImage) {
    base = sharp(bgImage).resize(size, size);
  } else {
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="8" fill="${bgColor}"/>
    </svg>`;
    base = sharp(Buffer.from(svg)).resize(size, size);
  }

  // Overlay text as SVG composite
  const overlay = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${bgImage ? `<rect width="${size}" height="${size}" fill="rgba(0,0,0,0.45)"/>` : ''}
    <text x="${size / 2}" y="${size / 2 - (label ? 10 : 0)}" text-anchor="middle" dominant-baseline="middle"
      font-size="${size * 0.33}" font-family="Arial">${escapeXml(icon)}</text>
    ${label ? `<text x="${size / 2}" y="${size * 0.75}" text-anchor="middle"
      font-size="${size * 0.13}" font-family="Arial" font-weight="bold" fill="white">${escapeXml(label)}</text>` : ''}
  </svg>`;

  return base
    .composite([{ input: Buffer.from(overlay), blend: 'over' }])
    .removeAlpha()
    .raw()
    .toBuffer();
}

/**
 * Renders the LCD touchstrip (800×100) with track info.
 */
async function renderLcd({ title = '', artist = '', isPlaying = false, volume = null }) {
  const w = 800, h = 100;
  const statusColor = isPlaying ? '#1DB954' : '#888888';
  const statusText = isPlaying ? '▶' : '⏸';
  const volText = volume !== null ? `  🔊 ${volume}%` : '';

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#111111"/>
    <text x="20" y="38" font-size="28" font-family="Arial" font-weight="bold" fill="${statusColor}">${escapeXml(statusText)}</text>
    <text x="58" y="38" font-size="26" font-family="Arial" font-weight="bold" fill="white">${escapeXml(truncate(title, 38))}</text>
    <text x="58" y="72" font-size="20" font-family="Arial" fill="#aaaaaa">${escapeXml(truncate(artist, 45))}${escapeXml(volText)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(w, h)
    .removeAlpha()
    .raw()
    .toBuffer();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

module.exports = { renderButton, renderLcd };
