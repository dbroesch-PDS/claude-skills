'use strict';

const { openStreamDeck, listStreamDecks } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Button layout (Stream Deck Plus, 4×2 = indices 0–7)
//   [0][1][2][3]
//   [4][5][6][7]
//
// Button 0 → Focus Mode
// Button 1 → Meeting Mode
// Button 2 → Communication Mode
// ---------------------------------------------------------------------------

const BUTTONS = {
  FOCUS:  0,
  MEETING: 1,
  COMMS:  2,
};

// ---------------------------------------------------------------------------
// AppleScript helpers
// ---------------------------------------------------------------------------

/**
 * Run an osascript one-liner. Returns stdout trimmed, or '' on error.
 */
function runScript(script) {
  try {
    return execSync(`osascript -e ${JSON.stringify(script)}`, { timeout: 10000 }).toString().trim();
  } catch (err) {
    console.error('AppleScript error:', err.message);
    return '';
  }
}

/**
 * Run a multi-line AppleScript passed as a heredoc string.
 */
function runScriptFile(scriptText) {
  try {
    return execSync('osascript', {
      input: scriptText,
      timeout: 15000,
    }).toString().trim();
  } catch (err) {
    console.error('AppleScript error:', err.message);
    return '';
  }
}

// Retrieve the primary display bounds: {x, y, width, height}
function getScreenBounds() {
  const raw = runScript(
    'tell application "Finder" to get bounds of window of desktop'
  );
  // Returns something like "0, 0, 2560, 1440"
  const parts = raw.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length === 4 && parts.every(n => !isNaN(n))) {
    return { x: parts[0], y: parts[1], width: parts[2] - parts[0], height: parts[3] - parts[1] };
  }
  // Safe fallback
  return { x: 0, y: 0, width: 1920, height: 1080 };
}

// ---------------------------------------------------------------------------
// Layout actions
// ---------------------------------------------------------------------------

async function activateFocusMode() {
  console.log('Activating Focus Mode...');
  const screen = getScreenBounds();
  const halfW = Math.floor(screen.width / 2);
  const h = screen.height;

  // Chrome: left half
  const chromeX = screen.x;
  const chromeY = screen.y;
  // iTerm: right half
  const itermX = screen.x + halfW;
  const itermY = screen.y;

  const script = `
-- Close Slack
try
  tell application "Slack" to quit
end try

-- Move Chrome to left half
try
  tell application "Google Chrome"
    activate
    set bounds of front window to {${chromeX}, ${chromeY}, ${chromeX + halfW}, ${chromeY + h}}
  end tell
end try

-- Move iTerm to right half
try
  tell application "iTerm2"
    activate
    tell current window
      set bounds to {${itermX}, ${itermY}, ${itermX + halfW}, ${itermY + h}}
    end tell
  end tell
end try
`;
  runScriptFile(script);
  console.log('Focus Mode applied.');
}

async function activateMeetingMode() {
  console.log('Activating Meeting Mode...');
  const screen = getScreenBounds();
  const zoomW = 1200;
  const zoomH = 800;
  // Center Zoom on screen
  const zoomX = screen.x + Math.floor((screen.width - zoomW) / 2);
  const zoomY = screen.y + Math.floor((screen.height - zoomH) / 2);

  // Obsidian: left third
  const thirdW = Math.floor(screen.width / 3);
  const obsX = screen.x;
  const obsY = screen.y;

  const script = `
-- Open Zoom (launch if not running)
try
  tell application "zoom.us" to activate
end try
delay 1

-- Position Zoom centered
try
  tell application "zoom.us"
    activate
  end tell
  tell application "System Events"
    tell process "zoom.us"
      try
        set frontWindow to first window
        set position of frontWindow to {${zoomX}, ${zoomY}}
        set size of frontWindow to {${zoomW}, ${zoomH}}
      end try
    end tell
  end tell
end try

-- Open Obsidian and move to left third
try
  tell application "Obsidian" to activate
end try
delay 0.5
try
  tell application "System Events"
    tell process "Obsidian"
      try
        set frontWindow to first window
        set position of frontWindow to {${obsX}, ${obsY}}
        set size of frontWindow to {${thirdW}, ${screen.height}}
      end try
    end tell
  end tell
end try
`;
  runScriptFile(script);
  console.log('Meeting Mode applied.');
}

async function activateCommunicationMode() {
  console.log('Activating Communication Mode...');
  const screen = getScreenBounds();
  const halfW = Math.floor(screen.width / 2);
  const h = screen.height;

  const slackX = screen.x;
  const slackY = screen.y;
  const chromeX = screen.x + halfW;
  const chromeY = screen.y;

  const script = `
-- Open Slack
try
  tell application "Slack" to activate
end try
delay 1

-- Move Slack to left half
try
  tell application "System Events"
    tell process "Slack"
      try
        set frontWindow to first window
        set position of frontWindow to {${slackX}, ${slackY}}
        set size of frontWindow to {${halfW}, ${h}}
      end try
    end tell
  end tell
end try

-- Open Chrome and navigate to Slack
try
  tell application "Google Chrome"
    activate
    if (count of windows) = 0 then
      make new window
    end if
    set URL of active tab of front window to "https://app.slack.com"
    set bounds of front window to {${chromeX}, ${chromeY}, ${chromeX + halfW}, ${chromeY + h}}
  end tell
end try
`;
  runScriptFile(script);
  console.log('Communication Mode applied.');
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
 * Render a button with an emoji icon and a text label on a colored background.
 * Returns a raw RGB buffer ready for deck.fillKeyBuffer().
 */
async function renderButton({ icon, label, bgColor, size }) {
  const bg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="10" fill="${bgColor}"/>
  </svg>`;

  const overlay = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="${size / 2}" y="${size / 2 - 8}" text-anchor="middle"
      dominant-baseline="middle" font-size="${Math.floor(size * 0.36)}"
      font-family="Apple Color Emoji, Segoe UI Emoji, Arial">${esc(icon)}</text>
    <text x="${size / 2}" y="${Math.floor(size * 0.82)}" text-anchor="middle"
      font-size="${Math.floor(size * 0.13)}" font-family="Arial" font-weight="bold"
      fill="white">${esc(label)}</text>
  </svg>`;

  return sharp(Buffer.from(bg))
    .resize(size, size)
    .composite([{ input: Buffer.from(overlay), blend: 'over' }])
    .removeAlpha()
    .raw()
    .toBuffer();
}

/**
 * Render a "flash" feedback variant (brighter bg) to show the button was pressed.
 */
async function renderButtonPressed({ icon, label, bgColor, size }) {
  const flashColor = lighten(bgColor);
  return renderButton({ icon, label, bgColor: flashColor, size });
}

/** Lighten a hex color by blending toward white. */
function lighten(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = v => Math.min(255, Math.floor(v + (255 - v) * 0.35));
  return `#${blend(r).toString(16).padStart(2, '0')}${blend(g).toString(16).padStart(2, '0')}${blend(b).toString(16).padStart(2, '0')}`;
}

// Button definitions
const BUTTON_DEFS = [
  {
    index: BUTTONS.FOCUS,
    icon: '🎯',
    label: 'Focus',
    bgColor: '#1a3a5c',  // deep blue
    action: activateFocusMode,
  },
  {
    index: BUTTONS.MEETING,
    icon: '📹',
    label: 'Meeting',
    bgColor: '#1a4a2e',  // deep green
    action: activateMeetingMode,
  },
  {
    index: BUTTONS.COMMS,
    icon: '💬',
    label: 'Comms',
    bgColor: '#4a1a4a',  // deep purple
    action: activateCommunicationMode,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function drawAllButtons(deck) {
  const size = deck.ICON_SIZE;
  await Promise.all(
    BUTTON_DEFS.map(async def => {
      const buf = await renderButton({ icon: def.icon, label: def.label, bgColor: def.bgColor, size });
      await deck.fillKeyBuffer(def.index, buf, { format: 'rgb' });
    })
  );
}

async function flashButton(deck, def) {
  const size = deck.ICON_SIZE;
  const pressed = await renderButtonPressed({ icon: def.icon, label: def.label, bgColor: def.bgColor, size });
  await deck.fillKeyBuffer(def.index, pressed, { format: 'rgb' });
  // Restore after 200ms
  setTimeout(async () => {
    try {
      const normal = await renderButton({ icon: def.icon, label: def.label, bgColor: def.bgColor, size });
      await deck.fillKeyBuffer(def.index, normal, { format: 'rgb' });
    } catch { /* ignore if deck closed */ }
  }, 200);
}

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

  // Draw all layout buttons
  await drawAllButtons(deck);
  console.log('Window Layout Launcher ready.');
  console.log('  Button 0 (Focus)    — closes Slack, Chrome left half, iTerm right half');
  console.log('  Button 1 (Meeting)  — opens Zoom centered, Obsidian left third');
  console.log('  Button 2 (Comms)    — opens Slack + Chrome (slack.com) side by side');

  // Button press handler
  deck.on('down', async (control) => {
    if (control.type !== 'button') return;

    const def = BUTTON_DEFS.find(b => b.index === control.index);
    if (!def) return;

    console.log(`Pressed: ${def.label} (button ${def.index})`);

    // Flash feedback first (non-blocking), then run the action
    flashButton(deck, def).catch(() => {});
    try {
      await def.action();
    } catch (err) {
      console.error(`Error running ${def.label} layout:`, err.message);
    }
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await deck.resetToLogo();
    await deck.close();
    process.exit(0);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
