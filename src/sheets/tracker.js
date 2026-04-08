'use strict';

const logger = require('../utils/logger');

const SHEET_NAME = 'Pipeline';
const HEADERS = ['Name', 'Email', 'Phone', 'Deal Type', 'Date Assigned', 'Stage', 'Last Contact', 'Notes'];

/**
 * Format today's date as YYYY-MM-DD in Toronto timezone.
 */
function todayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

/**
 * Ensure the header row exists in the sheet. If the sheet is empty, write it.
 * @param {object} sheets - Authenticated Sheets API client
 * @param {string} sheetId
 */
async function ensureHeaders(sheets, sheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:H1`,
  });

  const existing = res.data.values?.[0] || [];
  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
    logger.info('Sheet headers written.');
  }
}

/**
 * Append a new lead row to the pipeline tracker sheet.
 *
 * @param {object} sheets     - Authenticated Sheets API client
 * @param {object} contactData - { fullName, email, phone }
 * @param {string} dealType   - "switch" | "refinance" | "purchase"
 */
async function appendLeadRow(sheets, contactData, dealType) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    logger.warn('GOOGLE_SHEET_ID not set — skipping Sheets tracker.');
    return;
  }

  const today = todayString();
  const dealLabel = dealType.charAt(0).toUpperCase() + dealType.slice(1);

  const row = [
    contactData.fullName,
    contactData.email,
    contactData.phone || '',
    dealLabel,
    today,       // Date Assigned
    'New Lead',  // Stage (default)
    today,       // Last Contact
    '',          // Notes
  ];

  try {
    await ensureHeaders(sheets, sheetId);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    logger.info(`Sheet row added for ${contactData.fullName} (${dealLabel}).`);
  } catch (err) {
    logger.error(`Failed to append sheet row: ${err.message}`);
  }
}

module.exports = { appendLeadRow };
