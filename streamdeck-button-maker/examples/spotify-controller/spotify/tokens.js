'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TOKEN_FILE = path.join(os.homedir(), '.spotify-streamdeck-tokens.json');

function loadTokens() {
  try {
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

function clearTokens() {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
}

module.exports = { loadTokens, saveTokens, clearTokens };
