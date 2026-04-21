# GitHub PRs — Stream Deck Plugin

Shows open GitHub pull requests assigned to you. Press the button to open GitHub.

## What it does

- Polls GitHub every 30 seconds for open PRs assigned to you
- Displays the count on the button (green = 0, red = 1+)
- Press the button to open `github.com/pulls` in your browser
- Authenticates via OAuth — no tokens in config files

## Setup

### 1. Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set:
   - **Application name:** Stream Deck GitHub PRs
   - **Homepage URL:** `http://localhost`
   - **Authorization callback URL:** `http://127.0.0.1` (important: IP literal, no port)
4. Click **Register application**
5. Copy the **Client ID** (you do NOT need a client secret for this plugin)

### 2. Install the plugin

```bash
npm install
npm run build
cp -r com.dbroesch.githubprs.sdPlugin \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/
```

Restart Stream Deck.

### 3. Add the action and connect

1. Drag the **Open PRs** action to a button on your Stream Deck MK.2
2. Right-click the button → **Properties**
3. Paste your **Client ID** and click **Save Client ID**
4. Click **Connect with GitHub**
5. Authenticate in the browser
6. Done — the button will show your open PR count

## Button states

| Display | Meaning |
|---------|---------|
| Green number (0) | No open PRs |
| Red/orange number | N open PRs assigned to you |
| `—` (dash) | Not connected — set up in Properties |
| `!` (exclamation) | API error — check logs |

## Development

```bash
npm run watch   # hot reload
```

Logs: `~/Library/Application Support/com.elgato.StreamDeck/logs/`

## Notes

- GitHub classic OAuth tokens don't expire, so no refresh logic is needed
- Scopes requested: `read:user repo` (read:user for username, repo for private PR access)
- Tokens are stored in Stream Deck global settings (encrypted), never in action settings
