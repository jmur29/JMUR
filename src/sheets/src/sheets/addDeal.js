'use strict';
const logger = require('../utils/logger');

async function addFundedDeal(sheets, params) {
  const sheetId = '1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8';
  const year = parseInt(params.year);
  const sheetName = year === 2025 ? '2025 Funded' : '2026 Funded';

  const borrower  = String(params.borrower || '').trim();
  const dealType  = String(params.type || '').trim();
  const source    = String(params.source || '').trim();
  const lender    = String(params.lender || '').trim();
  const closing   = String(params.closing || '').trim();
  const amt       = parseFloat(params.amt) || 0;
  const term      = params.term || '';
  const rateType  = String(params.rateType || '').trim();
  const rate      = params.rate || '';
  const bps       = params.bps || '';
  const split     = params.split || '';
  const grossComm = parseFloat(params.grossComm) || '';
  const yourComm  = parseFloat(params.yourComm) || '';
  const notes     = String(params.notes || '').trim();

  if (!borrower || !year || !amt) throw new Error('Missing required fields: year, borrower, amt');
  if (year !== 2025 && year !== 2026) throw new Error('Year must be 2025 or 2026');

  // Read current sheet to find TOTALS row
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1:A50`,
  });

  const rows = readRes.data.values || [];
  let insertIndex = rows.length + 1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').toUpperCase().includes('TOTAL')) {
      insertIndex = i + 1; // 1-indexed
      break;
    }
  }

  const dealNum = insertIndex - 3;

  // Insert blank row before TOTALS
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        insertDimension: {
          range: {
            sheetId: await getSheetId(sheets, sheetId, sheetName),
            dimension: 'ROWS',
            startIndex: insertIndex - 1,
            endIndex: insertIndex,
          },
          inheritFromBefore: true,
        }
      }]
    }
  });

  // Write the deal row
  const rowData = [
    dealNum, borrower, dealType, source, lender,
    closing, amt, term, rateType, rate,
    bps, split, grossComm, yourComm, notes
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!A${insertIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });

  logger.info(`Deal added: ${borrower} → ${sheetName} row ${insertIndex}`);
  return { borrower, sheetName, row: insertIndex, dealNum };
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);
  return sheet.properties.sheetId;
}

module.exports = { addFundedDeal };
