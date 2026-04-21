# OBS Studio Stream Deck Plugin — Setup Guide

## Prerequisites

- Node.js 20+
- Stream Deck software 6.5+
- OBS Studio 28+ (with obs-websocket built-in)
- Stream Deck MK.2 (15 keys)

## 1. Enable OBS WebSocket

In OBS: **Tools → obs-websocket Settings**

- Enable WebSocket server: ON
- Port: 4455 (default)
- Set a password if desired (optional but recommended)

## 2. Install & Build

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# For development (auto-rebuild on save)
npm run watch
```

## 3. Install the Plugin

Copy `com.dbroesch.obs.sdPlugin/` into the Stream Deck plugins directory:

**macOS:**
```
~/Library/Application Support/com.elgato.StreamDeck/Plugins/
```

Then restart Stream Deck software.

## 4. Configure Connection

1. Drag **Record** or **Stream** action onto your Stream Deck
2. In the Property Inspector (right panel), set:
   - **Host**: `localhost` (or OBS machine IP for remote)
   - **Port**: `4455`
   - **Password**: your OBS WebSocket password
3. Click **Save & Connect**

The plugin auto-reconnects if OBS restarts.

## 5. Configure Actions

### Record Button
- Shows "Record" when idle, "REC" + red background when recording
- Pressing stops recording if active

### Stream Button
- Shows "Stream" when idle, "LIVE" badge when streaming
- Pressing stops streaming if active

### Mic Mute Button
1. In the Property Inspector, set **OBS Input Name** to match your mic exactly (e.g. `Mic/Aux`, `Desktop Audio`)
2. Check it in OBS: **Audio Mixer** panel — use the exact name shown there
3. Green = unmuted, grey with red slash = muted

### Scene Switcher
1. Drag up to 12 Scene Switcher buttons onto your deck (fill the remaining 12 keys)
2. Each button: in Property Inspector, either:
   - Click **Refresh Scene List** then pick from dropdown, OR
   - Type the scene name manually
3. Active scene glows blue. Pressing a button switches to that scene instantly.

## Suggested MK.2 Layout (15 keys, 5 columns × 3 rows)

```
[ Record ] [ Stream ] [ Mic Mute ] [ Scene 1  ] [ Scene 2  ]
[ Scene 3] [ Scene 4] [ Scene 5  ] [ Scene 6  ] [ Scene 7  ]
[ Scene 8] [ Scene 9] [ Scene 10 ] [ Scene 11 ] [ Scene 12 ]
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Buttons show "OBS Offline" | OBS not running or WebSocket disabled |
| Wrong mic input | Check exact name in OBS Audio Mixer |
| Scene not switching | Scene name must match exactly (case-sensitive) |
| Can't connect | Check firewall, OBS port, and password |
| Build errors | Run `npm install` first |
