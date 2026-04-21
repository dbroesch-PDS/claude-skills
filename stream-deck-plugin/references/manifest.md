# manifest.json Complete Reference

Lives at: `com.author.pluginname.sdPlugin/manifest.json`

## Full example

```json
{
  "$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  "UUID": "com.author.pluginname",
  "Name": "My Plugin",
  "Version": "1.0.0",
  "SDKVersion": 2,
  "Author": "Your Name",
  "Description": "What this plugin does",
  "Category": "My Category",
  "CategoryIcon": "imgs/plugin/category-icon",
  "Icon": "imgs/plugin/icon",
  "CodePath": "bin/plugin.js",
  "Software": { "MinimumVersion": "6.5" },
  "OS": [
    { "Platform": "mac", "MinimumVersion": "10.15" },
    { "Platform": "windows", "MinimumVersion": "10" }
  ],
  "Nodejs": { "Version": "20", "Debug": "enabled" },
  "ApplicationsToMonitor": {
    "mac": ["com.spotify.client"],
    "windows": ["Spotify.exe"]
  },
  "Actions": [
    {
      "UUID": "com.author.pluginname.myaction",
      "Name": "My Action",
      "Tooltip": "What happens when you use this",
      "Icon": "imgs/actions/myaction/icon",
      "States": [
        { "Image": "imgs/actions/myaction/key" }
      ],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/myaction-pi.html"
    },
    {
      "UUID": "com.author.pluginname.mydial",
      "Name": "My Dial",
      "Icon": "imgs/actions/mydial/icon",
      "States": [{ "Image": "imgs/actions/mydial/key" }],
      "Controllers": ["Encoder"],
      "Encoder": {
        "layout": "$A1",
        "TriggerDescription": {
          "Rotate": "Adjust",
          "Push": "Toggle",
          "Touch": "Show value"
        }
      }
    },
    {
      "UUID": "com.author.pluginname.toggleaction",
      "Name": "Toggle Action",
      "Icon": "imgs/actions/toggle/icon",
      "States": [
        { "Image": "imgs/actions/toggle/key-off" },
        { "Image": "imgs/actions/toggle/key-on" }
      ],
      "Controllers": ["Keypad"]
    }
  ],
  "Profiles": [
    {
      "Name": "My Profile",
      "DeviceType": 7,
      "File": "profiles/MyProfile.streamDeckProfile",
      "AutoInstall": true
    }
  ]
}
```

## Field reference

### Top-level required fields

| Field | Type | Notes |
|-------|------|-------|
| `UUID` | string | Reverse-DNS, lowercase, alphanumeric + hyphens + periods. **Never change after publishing.** |
| `Name` | string | Display name in Stream Deck app |
| `Version` | string | Semver (e.g. `"1.0.0"`) |
| `SDKVersion` | number | Use `2` (targets Stream Deck 6.5+) |
| `Author` | string | Your name |
| `Description` | string | Short plugin description |
| `Icon` | string | Path without extension. 512×512px recommended. |
| `CodePath` | string | Entry point JS file, e.g. `"bin/plugin.js"` |
| `Software` | object | `{ "MinimumVersion": "6.5" }` |
| `OS` | array | Platform + minimum OS version |
| `Actions` | array | At least one action required |

### OS platform values

```json
{ "Platform": "mac", "MinimumVersion": "10.15" }
{ "Platform": "windows", "MinimumVersion": "10" }
```

### Action fields

| Field | Required | Notes |
|-------|----------|-------|
| `UUID` | Yes | Must start with plugin UUID. Never change. |
| `Name` | Yes | Shown in action picker |
| `Icon` | Yes | 40×40px — shown in action picker |
| `States` | Yes | Array of 1–2 state objects. `Image` is 72×72px. |
| `Controllers` | No | `["Keypad"]`, `["Encoder"]`, or `["Keypad","Encoder"]`. Default: `["Keypad"]`. |
| `Encoder` | No | Required when Controllers includes "Encoder" |
| `Tooltip` | No | Hover text in UI |
| `PropertyInspectorPath` | No | Path to PI HTML file |
| `Category` | No | Groups actions in picker |

### State fields

```json
{
  "Image": "imgs/actions/myaction/key",
  "Title": "Optional default title",
  "TitleAlignment": "middle",
  "FontFamily": "",
  "FontSize": 12,
  "FontUnderline": false,
  "ShowTitle": true
}
```

Only `Image` is required. Users can override title/font in the Stream Deck app.

### Encoder configuration

```json
"Encoder": {
  "layout": "$A1",
  "TriggerDescription": {
    "Rotate": "Description of rotate",
    "Push": "Description of press",
    "Touch": "Description of tap",
    "LongTouch": "Description of hold"
  }
}
```

Built-in layouts: `$A0`, `$A1`, `$B1`, `$B2`, `$C1`, `$X1`

### Profiles

```json
{
  "Name": "My Profile",
  "DeviceType": 7,
  "File": "profiles/MyProfile.streamDeckProfile",
  "AutoInstall": true
}
```

**Device type values:**
| Value | Device |
|-------|--------|
| `0` | Stream Deck (MK.1, MK.2, MK.3) |
| `1` | Stream Deck Mini |
| `2` | Stream Deck XL |
| `7` | Stream Deck Plus |
| `9` | Stream Deck Neo |

`"AutoInstall": true` prompts the user to install the profile when the plugin is first loaded.

**Profile file format** (`.streamDeckProfile`):

```json
{
  "Name": "My Profile",
  "DeviceType": 7,
  "Pages": {
    "0": {
      "Actions": {
        "0,0": { "UUID": "com.author.plugin.action1", "Settings": {} },
        "1,0": { "UUID": "com.author.plugin.action2", "Settings": {} },
        "2,0": { "UUID": "com.author.plugin.action3", "Settings": {} },
        "3,0": { "UUID": "com.author.plugin.action4", "Settings": {} }
      },
      "Encoders": {
        "0": { "UUID": "com.author.plugin.dial1", "Settings": {} }
      }
    }
  }
}
```

Coordinates are `"col,row"` (0-indexed). Stream Deck Plus: 4 columns × 2 rows of keys + 4 encoder slots.

### ApplicationsToMonitor

Triggers `onApplicationDidLaunch` / `onApplicationDidTerminate` events in the plugin.

```json
"ApplicationsToMonitor": {
  "mac": ["com.spotify.client", "com.apple.Music"],
  "windows": ["Spotify.exe", "iTunes.exe"]
}
```

Mac: use bundle ID (from `Info.plist`). Windows: use executable filename.

## Image path conventions

All image paths in `manifest.json` omit the extension. Stream Deck tries `.png`, `.svg`, etc.
Always provide SVG for best quality. SVG `viewBox` should be `0 0 144 144` for key images
(Stream Deck renders at 2× for HiDPI displays).
