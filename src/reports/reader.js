'use strict';

const logger = require('../utils/logger');

const SHEET_NAME = 'Pipeline';
const COL = { NAME: 0, EMAIL: 1, PHONE: 2, DEAL_TYPE: 3, DATE_ASSIGNED: 4, STAGE: 5, LAST_CONTACT: 6, NOTES: 7 };
const CLOSED_STAGES = ['closed', 'declined', 'cancelled', 'lost'];

/**
 * Parse a YYYY-MM-DD string to a Date (midnight Toronto time).
 */
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Return true if dateStr is more than `hours` hours before now.
 */
function olderThanHours(dateStr, hours) {
  const d = parseDate(dateStr);
  if (!d) return false;
  return (Date.now() - d.getTime()) > hours * 60 * 60 * 1000;
}

/**
 * Read all lead rows from the pipeline sheet and return categorised report data.
 * @param {object} sheets - Authenticated Sheets API client
 * @returns {object} report categories
 */
async function readPipelineData(sheets) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID env var is not set.');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:H`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) {
    // Only headers or empty
    return { newLast24h: [], needsFollowUp: [], applicationStalled: [], underwriting: [], totalActive: 0 };
  }

  // Skip header row
  const leads = rows.slice(1).map((row) => ({
    name:         row[COL.NAME]          || '',
    email:        row[COL.EMAIL]         || '',
    phone:        row[COL.PHONE]         || '',
    dealType:     row[COL.DEAL_TYPE]     || '',
    dateAssigned: row[COL.DATE_ASSIGNED] || '',
    stage:        row[COL.STAGE]         || '',
    lastContact:  row[COL.LAST_CONTACT]  || '',
    notes:        row[COL.NOTES]         || '',
  }));

  const active = leads.filter((l) => !CLOSED_STAGES.includes(l.stage.toLowerCase()));

  return {
    // New leads assigned in the last 24 hours
    newLast24h: active.filter((l) => !olderThanHours(l.dateAssigned, 24)),

    // Active leads with Last Contact > 48 hours ago — need follow up
    needsFollowUp: active.filter((l) => olderThanHours(l.lastContact, 48)),

    // Stage = "Application Sent" and assigned > 2 days ago — Finmo not completed
    applicationStalled: active.filter(
      (l) => l.stage.toLowerCase() === 'application sent' && olderThanHours(l.dateAssigned, 48)
    ),

    // Stage = "Underwriting"
    underwriting: active.filter((l) => l.stage.toLowerCase() === 'underwriting'),

    // Total active
    totalActive: active.length,
  };
}

module.exports = { readPipelineData };
