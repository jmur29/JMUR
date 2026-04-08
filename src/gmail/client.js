'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
];

/**
 * Load OAuth2 credentials from env var or local file.
 */
function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  const credPath = path.join(process.cwd(), 'credentials.json');
  if (!fs.existsSync(credPath)) {
    throw new Error(
      'No Google credentials found. Set GOOGLE_CREDENTIALS env var or provide credentials.json.'
    );
  }
  return JSON.parse(fs.readFileSync(credPath, 'utf8'));
}

/**
 * Load stored OAuth token from env var or local file.
 */
function loadToken() {
  if (process.env.GOOGLE_TOKEN) {
    return JSON.parse(process.env.GOOGLE_TOKEN);
  }
  const tokenPath = path.join(process.cwd(), 'token.json');
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      'No Google token found. Run "npm run auth" locally first, then set GOOGLE_TOKEN env var.'
    );
  }
  return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
}

/**
 * Build and return an authenticated OAuth2 client.
 * Shared by Gmail and Sheets API clients.
 */
function createAuthClient() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = loadToken();
  auth.setCredentials(token);

  // Auto-refresh: persist new token if refreshed
  auth.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      logger.info('Google OAuth token refreshed (new refresh_token received).');
    } else {
      logger.info('Google OAuth access token refreshed.');
    }
    if (!process.env.GOOGLE_TOKEN) {
      const tokenPath = path.join(process.cwd(), 'token.json');
      const merged = { ...token, ...newTokens };
      fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
    }
  });

  return auth;
}

/**
 * Build and return an authenticated Gmail API client.
 */
function createGmailClient() {
  return google.gmail({ version: 'v1', auth: createAuthClient() });
}

module.exports = { createGmailClient, createAuthClient, SCOPES };
