# PKCE OAuth Reference — Elgato Proxy Flow

Use this for any third-party API that requires user authorization (Spotify, Google, etc.).
PKCE (Proof Key for Code Exchange) is the correct OAuth 2.0 flow for desktop/native apps — no
client secret is stored in the plugin.

## Why the Elgato proxy, not a local HTTP server

The natural approach for desktop apps is to spin up a local server on a dynamic port and use
`http://127.0.0.1:{port}/callback` as the redirect URI. This works technically, but most OAuth
providers (including Spotify) **reject HTTP redirect URIs in their dashboards even for loopback**
— their UI enforces HTTPS regardless of what the spec says about loopback exemptions.

The Elgato OAuth redirect proxy solves this:
- It's an HTTPS URL, so every provider accepts it
- It receives the OAuth callback and forwards the code back to your plugin via a Stream Deck deep-link
- No local HTTP server required, no port management, no firewall issues

**Register this exact URI in the OAuth provider's dashboard:**
```
https://oauth2-redirect.elgato.com/streamdeck/plugins/message/com.author.pluginname
```
Replace `com.author.pluginname` with your actual plugin UUID.

## The flow

1. Plugin generates `code_verifier` + `code_challenge` (PKCE), opens browser to provider auth URL
2. User logs in, provider redirects to the Elgato proxy with `?code=...&state=...`
3. Proxy forwards to your plugin via deep-link: `streamdeck://plugins/message/com.author.pluginname?code=...&state=...`
4. Plugin's `onDidReceiveDeepLink` handler receives the URL, exchanges code for tokens, stores in global settings

## Complete implementation

```typescript
// src/services/auth.ts
import { createHash, randomBytes } from "node:crypto";
import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "./types.js";

// --- PKCE helpers ---

function generateCodeVerifier(): string {
  // 43–128 URL-safe characters (PKCE spec)
  return randomBytes(64).toString("base64url").slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(16).toString("hex");
}

// Elgato's OAuth redirect proxy — register this URL in the provider's dashboard
const REDIRECT_URI =
  "https://oauth2-redirect.elgato.com/streamdeck/plugins/message/com.author.pluginname";

// Stored while waiting for the deep-link callback
let pendingAuth: {
  verifier: string;
  state: string;
  clientId: string;
  resolve: (tokens: StoredTokens) => void;
  reject: (err: Error) => void;
} | null = null;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Opens the provider auth page in the browser. Returns a Promise that resolves
 * when handleDeepLink() is called with the OAuth callback.
 * Fire-and-forget from the action — wire the result to update button state.
 */
export function startAuthFlow(
  clientId: string,
  authUrl: string,   // e.g. "https://accounts.spotify.com/authorize"
  scopes: string,    // space-separated
): Promise<StoredTokens> {
  return new Promise((resolve, reject) => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateState();

    pendingAuth = { verifier, state, clientId, resolve, reject };

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: scopes,
      state,
    });

    streamDeck.logger.info("Opening OAuth URL via Elgato proxy");
    streamDeck.system.openUrl(`${authUrl}?${params.toString()}`);
  });
}

/**
 * Call this from plugin.ts inside onDidReceiveDeepLink.
 * Parses the code from the deep-link, validates state, exchanges for tokens,
 * and saves them to global settings.
 *
 * Deep-link format from Elgato proxy:
 *   streamdeck://plugins/message/com.author.pluginname?code=...&state=...
 */
export async function handleDeepLink(
  url: URL,
  tokenUrl: string,  // e.g. "https://accounts.spotify.com/api/token"
): Promise<void> {
  if (!pendingAuth) {
    streamDeck.logger.warn("Deep-link received but no auth flow in progress");
    return;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const { verifier, state: expectedState, clientId, resolve, reject } = pendingAuth;
  pendingAuth = null;

  if (error) {
    reject(new Error(`Auth error: ${error}`));
    return;
  }
  if (!code || state !== expectedState) {
    reject(new Error("Invalid state or missing code in deep-link"));
    return;
  }

  try {
    const data = await exchangeCode(code, verifier, clientId, tokenUrl);
    const tokens: StoredTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    const current = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    await streamDeck.settings.setGlobalSettings<GlobalSettings>({
      ...current,
      clientId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    streamDeck.logger.info("Tokens saved to global settings");
    resolve(tokens);
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
  }
}

// --- Token exchange ---

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string,
  tokenUrl: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

// --- Token refresh ---

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  tokenUrl: string;
}): Promise<{ accessToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
  });

  const res = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as TokenResponse;

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
```

## Wiring into plugin.ts

```typescript
// src/plugin.ts
import streamDeck from "@elgato/streamdeck";
import { handleDeepLink, startAuthFlow } from "./services/auth.js";

// ... register actions ...

streamDeck.system.onDidReceiveDeepLink((ev) => {
  const url = new URL(ev.payload.url);
  handleDeepLink(url, "https://provider.com/token").catch((err) =>
    streamDeck.logger.error(`Deep-link auth failed: ${err}`)
  );
});

await streamDeck.connect();
```

## Triggering auth from an action

Since `startAuthFlow` resolves asynchronously (the deep-link may arrive seconds later),
call it fire-and-forget and handle the result in `.then()`:

```typescript
// In your action class
private async beginAuth(clientId: string): Promise<void> {
  for (const action of this.actions) {
    await action.setTitle("Waiting\nfor login…");
  }

  startAuthFlow(clientId, "https://provider.com/authorize", "scope1 scope2")
    .then(async () => {
      await api.loadFromSettings();
      for (const action of this.actions) {
        await action.setTitle("Connected");
        await action.showOk();
      }
    })
    .catch(async (err) => {
      streamDeck.logger.error(`Auth failed: ${err}`);
      for (const action of this.actions) {
        await action.setTitle("Auth\nFailed");
        await action.showAlert();
      }
    });
  // Don't await — returns immediately, resolves when deep-link arrives
}
```

## Wiring tokens to an API class

```typescript
// src/services/api.ts
import streamDeck from "@elgato/streamdeck";
import { refreshAccessToken } from "./auth.js";

interface GlobalSettings {
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class MyAPI {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private clientId: string | null = null;
  private expiresAt = 0;
  private readonly tokenUrl = "https://provider.com/token";

  async loadFromSettings(): Promise<boolean> {
    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    if (!s.accessToken || !s.refreshToken || !s.clientId) return false;
    this.accessToken = s.accessToken;
    this.refreshToken = s.refreshToken;
    this.clientId = s.clientId;
    this.expiresAt = s.expiresAt ?? 0;
    return true;
  }

  get isAuthorized(): boolean {
    return !!(this.accessToken && this.refreshToken);
  }

  private async getToken(): Promise<string> {
    if (!this.accessToken || !this.refreshToken || !this.clientId) {
      throw new Error("Not authenticated");
    }
    // Proactively refresh 60 seconds before expiry
    if (Date.now() > this.expiresAt - 60_000) {
      const { accessToken, expiresAt } = await refreshAccessToken({
        refreshToken: this.refreshToken,
        clientId: this.clientId,
        tokenUrl: this.tokenUrl,
      });
      this.accessToken = accessToken;
      this.expiresAt = expiresAt;
      const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      await streamDeck.settings.setGlobalSettings({ ...s, accessToken, expiresAt });
    }
    return this.accessToken;
  }

  async get(path: string): Promise<Response> {
    const token = await this.getToken();
    const res = await fetch(`https://api.provider.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      // Force refresh and retry once
      this.expiresAt = 0;
      return this.get(path);
    }
    return res;
  }
}

export const api = new MyAPI();
```

## Provider-specific notes

### Spotify
- Register `https://oauth2-redirect.elgato.com/streamdeck/plugins/message/com.author.pluginname` in the Spotify developer dashboard
- Required scopes for playback control: `user-read-currently-playing user-read-playback-state user-modify-playback-state`
- Auth endpoint: `https://accounts.spotify.com/authorize`
- Token endpoint: `https://accounts.spotify.com/api/token`
- Spotify supports PKCE — no client secret needed

### GitHub
- GitHub does **not** support PKCE. For GitHub integrations, use a **Personal Access Token** stored in global settings instead — skip the OAuth flow entirely. PATs are simpler and avoid the client_secret problem.

## Security reminders

- Store tokens in **global settings only** (`streamDeck.settings.setGlobalSettings`)
- Never put tokens in action settings — they appear in plain text in profile exports
- No client secret needed for PKCE — do not add one
- `pendingAuth` is module-level state — only one auth flow can be in progress at a time (fine for a single-user desktop plugin)
