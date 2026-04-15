'use strict';
const { refreshTokens } = require('./auth.js');
const { saveTokens } = require('./tokens.js');

const BASE = 'https://api.spotify.com/v1';
const DJ_CONTEXT_URI = 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq';

class SpotifyAPI {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.clientId = null;
    this.expiresAt = 0;
  }

  setTokens({ accessToken, refreshToken, expiresAt, clientId }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    this.clientId = clientId;
  }

  get isAuthorized() {
    return !!(this.accessToken && this.refreshToken && this.clientId);
  }

  async getToken() {
    if (!this.accessToken || !this.refreshToken || !this.clientId) {
      throw new Error('Not authenticated');
    }
    if (Date.now() > this.expiresAt - 60_000) {
      console.log('Refreshing access token...');
      const { accessToken, expiresAt } = await refreshTokens(this.refreshToken, this.clientId);
      this.accessToken = accessToken;
      this.expiresAt = expiresAt;
      saveTokens({ accessToken, refreshToken: this.refreshToken, expiresAt, clientId: this.clientId });
    }
    return this.accessToken;
  }

  async request(method, path, body, query) {
    const token = await this.getToken();
    const url = new URL(`${BASE}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) {
      this.expiresAt = 0;
      return this.request(method, path, body, query);
    }
    return res;
  }

  async getPlaybackState() {
    const res = await this.request('GET', '/me/player', undefined, { additional_types: 'track' });
    if (res.status === 204) return null;
    if (!res.ok) { console.error(`getPlaybackState failed: ${res.status}`); return null; }
    return res.json();
  }

  async togglePlayback(isPlaying) {
    await this.request('PUT', isPlaying ? '/me/player/pause' : '/me/player/play');
  }

  async nextTrack() {
    await this.request('POST', '/me/player/next');
  }

  async previousTrack() {
    await this.request('POST', '/me/player/previous');
  }

  async setRepeat(state) {
    await this.request('PUT', '/me/player/repeat', undefined, { state });
  }

  cycleRepeat(current) {
    const cycle = ['off', 'track', 'context'];
    return cycle[(cycle.indexOf(current) + 1) % cycle.length];
  }

  async setVolume(percent) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    await this.request('PUT', '/me/player/volume', undefined, { volume_percent: String(clamped) });
  }

  async startDJMode() {
    await this.request('PUT', '/me/player/play', { context_uri: DJ_CONTEXT_URI });
  }

  async fetchAlbumArt(imageUrl) {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer);
    } catch {
      return null;
    }
  }
}

module.exports = { SpotifyAPI };
