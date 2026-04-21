# GitHub PRs — Stream Deck Plugin

A Stream Deck plugin for GitHub PR tracking. Shows the number of open PRs assigned to you
and opens the GitHub PR list in your browser when pressed.

## Features

- Shows count of open GitHub PRs (review-requested, authored, or assigned — your choice)
- Polls GitHub every 60 seconds to keep the count fresh
- Pressing the button opens `github.com/pulls` filtered to your selected mode
- Full GitHub OAuth 2.0 authentication (no Personal Access Token required)
- Credentials stored securely in Stream Deck global settings

## Requirements

- Stream Deck MK.2 (or any Stream Deck with keypad buttons)
- Stream Deck software 6.5+
- macOS 10.15+
- Node.js 20 (used by Stream Deck's built-in runtime)
- A GitHub account and a GitHub OAuth App

## Setup

### 1. Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Stream Deck GitHub PRs (or any name you like)
   - **Homepage URL:** `http://127.0.0.1`
   - **Authorization callback URL:** `http://127.0.0.1:57321/callback`
4. Click **Register application**
5. On the next page, note your **Client ID**
6. Click **Generate a new client secret** and copy the secret immediately

### 2. Build the plugin

```bash
cd /path/to/com.dbroesch.github-prs-plugin

# Install dependencies (use Homebrew npm if Block IT blocks npm registry)
npm install

# Build
npm run build
```

The built plugin will be output to `com.dbroesch.github-prs.sdPlugin/bin/plugin.js`.

### 3. Install the plugin

Copy or symlink the `com.dbroesch.github-prs.sdPlugin` folder to:

```
~/Library/Application Support/com.elgato.StreamDeck/Plugins/
```

Then restart the Stream Deck software or reload plugins.

### 4. Add the action

1. Open the Stream Deck app
2. Find **GitHub PRs** > **My Open PRs** in the action list
3. Drag it to a button
4. In the Property Inspector (right panel), paste your **Client ID** and **Client Secret**
5. Choose what PRs to show (review-requested, authored, or assigned)
6. Click **Connect to GitHub** — your browser will open for OAuth consent
7. Approve access. The button will immediately show your PR count.

## Development

```bash
# Watch mode — rebuilds on source changes and reloads the plugin
npm run watch
```

## File structure

```
com.dbroesch.github-prs.sdPlugin/   ← plugin bundle (install this)
  bin/plugin.js                       ← compiled plugin (after build)
  manifest.json
  ui/
    open-prs-pi.html                  ← Property Inspector UI
  imgs/
    plugin/
      icon.svg
      category-icon.svg
    actions/open-prs/
      icon.svg
      key.svg

src/
  plugin.ts                           ← entry point
  actions/
    open-prs.ts                       ← main button action
  github/
    api.ts                            ← GitHub REST API wrapper
    auth.ts                           ← OAuth 2.0 flow
    types.ts                          ← TypeScript interfaces

package.json
tsconfig.json
rollup.config.mjs
```

## How OAuth works

The plugin uses the standard GitHub OAuth Authorization Code flow:

1. User enters Client ID + Secret in the Property Inspector
2. Plugin opens the GitHub auth URL in the default browser
3. Plugin starts a temporary HTTP server on port **57321** to receive the callback
4. User approves access in the browser
5. GitHub redirects to `http://127.0.0.1:57321/callback?code=...`
6. Plugin exchanges the code for an access token
7. Token is stored in Stream Deck global settings (encrypted by Stream Deck)

GitHub OAuth tokens do not expire, so no token refresh is needed.

## Rate limits

The GitHub Search API allows **30 requests/minute** for authenticated users.
This plugin polls every **60 seconds**, so it uses at most 1 request/minute — well within limits.
