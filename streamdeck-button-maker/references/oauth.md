# OAuth Reference — Blockcell Callback Pattern

## Why not localhost?

Most OAuth providers (Spotify, Google, GitHub OAuth apps, etc.) require HTTPS redirect URIs
even for local tools. A self-signed cert is annoying to set up. Instead, host a tiny static
callback page on **Blockcell** (Block's internal HTTPS hosting). The browser redirects there,
the page shows the auth code, and the user pastes it into the terminal — the same pattern
GitHub CLI uses.

## Step 1: Deploy the callback page (one-time)

Create `/tmp/my-auth-callback/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Auth Complete</title>
  <style>
    body { font-family: Arial, sans-serif; background: #111; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border-radius: 12px; padding: 40px;
            max-width: 500px; text-align: center; }
    #code { background: #000; border: 1px solid #333; border-radius: 8px;
            padding: 16px; font-family: monospace; font-size: 13px;
            word-break: break-all; color: #1DB954; margin: 20px 0;
            cursor: pointer; user-select: all; }
    button { background: #1DB954; color: #000; border: none; border-radius: 24px;
             padding: 12px 32px; font-size: 16px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Connected!</h2>
    <p>Copy the code below and paste it into the terminal:</p>
    <div id="code">Loading...</div>
    <button onclick="navigator.clipboard.writeText(document.getElementById('code').textContent)">
      Copy Code
    </button>
  </div>
  <script>
    const code = new URLSearchParams(window.location.search).get('code');
    document.getElementById('code').textContent = code || 'No code found';
  </script>
</body>
</html>
```

Deploy it once with the MCP blockcell tool or the REST API. Pick a site name that's unique to
your tool, e.g. `yourldap-myapp-auth`. The URL becomes:
`https://blockcell.sqprod.co/sites/yourldap-myapp-auth/`

Register that URL in the OAuth provider's dashboard as the redirect URI.

## Step 2: auth.js implementation

```javascript
'use strict';
const crypto = require('node:crypto');
const readline = require('node:readline');
const { exec } = require('node:child_process');

const REDIRECT_URI = 'https://blockcell.sqprod.co/sites/yourldap-myapp-auth/';

function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}
function generateCodeChallenge(v) {
  return crypto.createHash('sha256').update(v).digest('base64url');
}
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

function prompt(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); resolve(a.trim()); });
  });
}

async function startAuthFlow(clientId, authUrl, tokenUrl, scopes) {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: scopes,
    state,
  });

  exec(`open "${authUrl}?${params.toString()}"`);
  console.log('\nBrowser opened. Log in, then paste the code from the page:');
  const code = await prompt('Code: ');
  if (!code) throw new Error('No code entered');

  const body = new URLSearchParams({
    client_id: clientId, grant_type: 'authorization_code',
    code, redirect_uri: REDIRECT_URI, code_verifier: verifier,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    clientId,
  };
}

async function refreshTokens(refreshToken, clientId, tokenUrl) {
  const body = new URLSearchParams({
    client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

module.exports = { startAuthFlow, refreshTokens, REDIRECT_URI };
```

## Notes

- **GitHub** doesn't support PKCE — use a Personal Access Token stored in a `.env` file instead
- **Spotify** supports PKCE — use this flow, register the Blockcell URL in the Spotify dashboard
- **Google** supports PKCE — use this flow, register the Blockcell URL as an authorized redirect URI
- The `code` alone is useless without the `code_verifier`, so showing it on the page is safe
