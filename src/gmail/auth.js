/**
 * Run this script ONCE locally to generate token.json:
 *   node src/gmail/auth.js
 *
 * It will open a URL in your browser for Google OAuth consent.
 * After approval, paste the code back into the terminal.
 * A token.json file will be created — copy its contents into the
 * GOOGLE_TOKEN environment variable in Railway.
 */

'use strict';

require('dotenv').config();

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CRED_PATH = path.join(process.cwd(), 'credentials.json');

if (!fs.existsSync(CRED_PATH)) {
  console.error('ERROR: credentials.json not found in project root.');
  console.error('Download it from Google Cloud Console → APIs & Services → Credentials.');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
const { client_secret, client_id, redirect_uris } =
  credentials.installed || credentials.web;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // force refresh_token to be returned
});

console.log('\n=== Gmail OAuth2 Authorization ===');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Authorize the app, then paste the code below.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the authorization code: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code.trim(), (err, token) => {
    if (err) {
      console.error('Error retrieving access token:', err.message);
      process.exit(1);
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('\ntoken.json saved successfully.');
    console.log('\nFor Railway deployment, set this environment variable:');
    console.log('GOOGLE_TOKEN=' + JSON.stringify(JSON.stringify(token)));
    console.log('\nAnd set GOOGLE_CREDENTIALS to the contents of credentials.json:');
    console.log('GOOGLE_CREDENTIALS=' + JSON.stringify(fs.readFileSync(CRED_PATH, 'utf8')));
  });
});
