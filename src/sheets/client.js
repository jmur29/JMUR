'use strict';

const { google } = require('googleapis');
const { createAuthClient } = require('../gmail/client');

/**
 * Build and return an authenticated Google Sheets API client.
 * Reuses the same OAuth2 auth as the Gmail client.
 */
function createSheetsClient() {
  return google.sheets({ version: 'v4', auth: createAuthClient() });
}

module.exports = { createSheetsClient };
