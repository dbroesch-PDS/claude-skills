import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "./types.js";

const AUTH_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const REDIRECT_BASE = "http://127.0.0.1";
const REDIRECT_PATH = "/callback";

// GitHub OAuth scopes needed to read PRs assigned to the user
const SCOPES = "read:user repo";

function generateState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Starts a temporary local HTTP server, opens the GitHub OAuth URL in the
 * default browser, and waits for the redirect with the auth code.
 *
 * GitHub OAuth Apps support loopback (127.0.0.1) redirect URIs.
 * The full redirect URI including port must be registered in the GitHub OAuth App.
 *
 * Note: We use port 57321 so users can register a single fixed redirect URI
 * (http://127.0.0.1:57321/callback) in their GitHub OAuth App settings.
 */
const CALLBACK_PORT = 57321;

function openAuthServerAndWait(
  authUrl: string,
  expectedState: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CALLBACK_PORT}`);
      if (url.pathname !== REDIRECT_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });

      if (error || !code || state !== expectedState) {
        res.end(
          `<html><body style="font-family:sans-serif;background:#0d1117;color:#e6edf3;padding:32px">
            <h2>GitHub auth failed</h2>
            <p>${error ?? "Invalid state or missing code"}</p>
            <p>You can close this tab.</p>
          </body></html>`
        );
        server.close();
        reject(new Error(error ?? "Invalid state or missing code"));
        return;
      }

      res.end(
        `<html><body style="font-family:sans-serif;background:#0d1117;color:#e6edf3;padding:32px">
          <h2 style="color:#3fb950">GitHub connected!</h2>
          <p>Your Stream Deck is now connected to GitHub. You can close this tab.</p>
        </body></html>`
      );

      server.close();
      resolve(code);
    });

    server.on("error", (err) => {
      reject(new Error(`Auth server error: ${err.message}`));
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      streamDeck.logger.info(`GitHub auth server listening on port ${CALLBACK_PORT}`);
      streamDeck.system.openUrl(authUrl);
    });

    // Timeout after 5 minutes if the user doesn't complete auth
    setTimeout(() => {
      server.close();
      reject(new Error("Auth timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${REDIRECT_BASE}:${CALLBACK_PORT}${REDIRECT_PATH}`,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;

  if (data.error) {
    throw new Error(`Token exchange error: ${data.error} — ${data.error_description ?? ""}`);
  }

  if (!data.access_token) {
    throw new Error("No access_token in token response");
  }

  return data.access_token;
}

/**
 * Runs the full GitHub OAuth Device Flow (Authorization Code flow).
 * Opens a browser window, waits for the callback, exchanges the code,
 * and persists the token to Stream Deck global settings.
 *
 * GitHub OAuth tokens don't expire, so no refresh token is needed.
 */
export async function startAuthFlow(clientId: string, clientSecret: string): Promise<void> {
  const state = generateState();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${REDIRECT_BASE}:${CALLBACK_PORT}${REDIRECT_PATH}`,
    scope: SCOPES,
    state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;

  streamDeck.logger.info("Starting GitHub OAuth flow");

  const code = await openAuthServerAndWait(authUrl, state);
  const accessToken = await exchangeCode(code, clientId, clientSecret);

  const settings: GlobalSettings = {
    clientId,
    accessToken,
  };

  await streamDeck.settings.setGlobalSettings(settings);
  streamDeck.logger.info("GitHub token saved to global settings");
}

export async function revokeAuth(): Promise<void> {
  const current = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  await streamDeck.settings.setGlobalSettings<GlobalSettings>({
    ...current,
    accessToken: undefined,
  });
}
