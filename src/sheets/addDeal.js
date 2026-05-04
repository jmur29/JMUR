'use strict';

const logger = require('../utils/logger');

const SPREADSHEET_ID = '1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8';

async function addFundedDeal(sheets, params) {
  const year = parseInt(params.year);
  if (year !== 2025 && year !== 2026) throw new Error('year must be 2025 or 2026');

  const borrower = String(params.borrower || '').trim();
  const amt = parseFloat(params.amt) || 0;
  if (!borrower) throw new Error('Missing required field: borrower');
  if (!amt) throw new Error('Missing required field: amt');

  const sheetName = year === 2025 ? '2025 Funded' : '2026 Funded';
  const dealType = String(params.type || '').trim();
  const source   = String(params.source || '').trim();
  const lender   = String(params.lender || '').trim();
  const closing  = String(params.closing || '').trim();
  const term     = params.term != null ? parseInt(params.term) : '';
  const rateType = String(params.rateType || '').trim();
  const rate     = params.rate != null ? parseFloat(params.rate) : '';
  const bps      = params.bps != null ? parseInt(params.bps) : '';
  const split    = params.split != null ? parseFloat(params.split) : '';
  const grossComm = params.grossComm != null ? parseFloat(params.grossComm) : '';
  const yourComm  = params.yourComm != null ? parseFloat(params.yourComm) : '';
  const notes    = String(params.notes || '').trim();

  // Read col A to locate the TOTALS row
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:A60`,
  });

  const rows = readRes.data.values || [];
  let insertIndex = rows.length + 1; // 1-indexed; default: after last row
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').toUpperCase().includes('TOTAL')) {
      insertIndex = i + 1; // 1-indexed position of the TOTALS row
      break;
    }
  }

  // Sheet has 3 header rows (title, col-headers, blank) before first data row
  const dealNum = insertIndex - 3;

  const tabId = await getSheetTabId(sheets, SPREADSHEET_ID, sheetName);

  // Helper to build a repeatCell format request targeting the new row
  const fmt = (col, endCol, pattern) => ({
    repeatCell: {
      range: {
        sheetId: tabId,
        startRowIndex: insertIndex - 1,
        endRowIndex: insertIndex,
        startColumnIndex: col,
        endColumnIndex: endCol,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern },
        },
      },
      fields: 'userEnteredFormat.numberFormat',
    },
  });

  // Insert blank row before TOTALS and apply column-level number formats in one call
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: tabId,
              dimension: 'ROWS',
              startIndex: insertIndex - 1,
              endIndex: insertIndex,
            },
            inheritFromBefore: true,
          },
        },
        fmt(6, 7, '$#,##0.00'),   // G: amt
        fmt(9, 10, '0.00"%"'),    // J: rate  (4.44 stored → displays "4.44%")
        fmt(10, 11, '0" bps"'),   // K: bps   (60   stored → displays "60 bps")
        fmt(11, 12, '0%'),        // L: split  (0.90 stored → displays "90%")
        fmt(12, 13, '$#,##0.00'), // M: grossComm
        fmt(13, 14, '$#,##0.00'), // N: yourComm
      ],
    },
  });

  // Write deal data into the freshly inserted row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${insertIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        dealNum, borrower, dealType, source, lender,
        closing, amt, term, rateType, rate,
        bps, split, grossComm, yourComm, notes,
      ]],
    },
  });

  logger.info(`Deal added: ${borrower} → ${sheetName} row ${insertIndex} (deal #${dealNum})`);
  return { borrower, sheetName, row: insertIndex };
}

async function getSheetTabId(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find((s) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);
  return sheet.properties.sheetId;
}

module.exports = { addFundedDeal };
