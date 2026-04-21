// src/services/auth.ts
// OAuth 2.0 PKCE flow for GitHub
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import streamDeck from "@elgato/streamdeck";

// GitHub OAuth endpoints
export const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

// Required scopes: read:user to identify the user, repo to see private PR assignments
export const GITHUB_SCOPES = "read:user repo";

// --- PKCE helpers ---

function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url").slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(16).toString("hex");
}

// --- Auth flow ---

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Start the GitHub OAuth PKCE flow.
 * Opens the browser to GitHub's auth page, waits for the callback,
 * then exchanges the code for tokens.
 *
 * NOTE: GitHub's OAuth also supports a simpler device flow, but we use PKCE
 * here so the flow is consistent with other providers and uses the same pattern.
 *
 * IMPORTANT: GitHub does not support the `code_challenge` param in standard OAuth apps —
 * only in GitHub Apps with fine-grained tokens. For a standard OAuth App, we use the
 * standard authorization_code flow without PKCE parameters, but with a local HTTP server
 * for the redirect.
 */
export function startAuthFlow(clientId: string): Promise<TokenResult> {
  return new Promise((resolve, reject) => {
    const state = generateState();
    const CALLBACK_PATH = "/callback";
    const REDIRECT_BASE = "http://127.0.0.1";

    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });

      if (error || !code || returnedState !== state) {
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>Authentication failed</h2>
          <p>${error ?? "State mismatch or missing code"}</p>
          <p>You can close this tab.</p>
        </body></html>`);
        server.close();
        reject(new Error(error ?? "State mismatch or missing code"));
        return;
      }

      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Connected to GitHub!</h2>
        <p>You can close this tab and return to Stream Deck.</p>
      </body></html>`);

      const port = (server.address() as { port: number }).port;
      const redirectUri = `${REDIRECT_BASE}:${port}${CALLBACK_PATH}`;
      server.close();

      try {
        const tokens = await exchangeCode({ code, clientId, redirectUri });
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    // Port 0 = OS picks a free ephemeral port
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      const redirectUri = `${REDIRECT_BASE}:${port}${CALLBACK_PATH}`;

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: GITHUB_SCOPES,
        state,
      });

      const fullAuthUrl = `${GITHUB_AUTH_URL}?${params.toString()}`;
      streamDeck.logger.info(`Opening GitHub OAuth URL (port ${port})`);
      streamDeck.system.openUrl(fullAuthUrl);
    });

    server.on("error", (err) => {
      reject(new Error(`Local auth server error: ${err.message}`));
    });
  });
}

// --- Token exchange ---

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  // GitHub does not return refresh tokens for standard OAuth Apps
  // or expires_in for classic tokens
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function exchangeCode(opts: {
  code: string;
  clientId: string;
  redirectUri: string;
}): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });

  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as GitHubTokenResponse;

  if (data.error) {
    throw new Error(`GitHub token error: ${data.error} — ${data.error_description ?? ""}`);
  }

  if (!data.access_token) {
    throw new Error("No access_token in GitHub response");
  }

  return {
    accessToken: data.access_token,
    // GitHub classic OAuth tokens don't expire and have no refresh token
    refreshToken: data.refresh_token ?? "",
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : Number.MAX_SAFE_INTEGER,
  };
}
