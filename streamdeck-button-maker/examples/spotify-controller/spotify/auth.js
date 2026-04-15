'use strict';
const crypto = require('node:crypto');
const readline = require('node:readline');
const { exec } = require('node:child_process');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// HTTPS callback page — set SPOTIFY_REDIRECT_URI in your environment
// See .env.example for setup instructions
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

function openBrowser(url) {
  exec(`open "${url}"`, (err) => {
    if (err) console.error('Could not open browser:', err.message);
  });
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

/**
 * Starts the PKCE OAuth flow.
 * Opens Spotify login in the browser — after login, Spotify redirects to the
 * Blockcell callback page which displays the auth code. You paste it here.
 *
 * Register your SPOTIFY_REDIRECT_URI in your Spotify app dashboard
 * (see .env.example for setup instructions)
 */
async function startAuthFlow(clientId) {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;
  console.log('\nOpening Spotify login in your browser...');
  openBrowser(authUrl);

  console.log('\nAfter logging in, the page will show an auth code.');
  const code = await prompt('Paste the code here and press Enter: ');

  if (!code) throw new Error('No code entered');

  return exchangeCode(code, verifier, clientId);
}

async function exchangeCode(code, verifier, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    clientId,
  };
}

async function refreshTokens(refreshToken, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

module.exports = { startAuthFlow, refreshTokens, REDIRECT_URI };
