// Google Apps Script — JM Mortgages Tracker
// Bound to spreadsheet: 1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8

var MONTHS_ = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Three-state deal lifecycle
var STATUS_PENDING  = '⏳ Pending Close';
var STATUS_AWAITING = '🔄 Awaiting Payment';
var STATUS_PAID     = '✅ Paid';

// ─── Menu ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('JM Tools', [
    { name: 'Add Deal from Inbox',       functionName: 'addDealFromInbox'       },
    { name: 'Fix Totals & References',   functionName: 'fixAllTotalsAndRefs'    },
    { name: 'Rebuild Month vs Month',    functionName: 'setupMonthVsMonth'      },
    { name: 'Setup Projected Income',    functionName: 'setupProjectedIncome'   },
    { name: 'Refresh Deal Statuses',     functionName: 'refreshDealStatuses'    },
    { name: 'Format All Sheets',         functionName: 'formatAllSheets'        },
    { name: 'Create Renewal Trigger',    functionName: 'createRenewalTrigger'   },
    { name: 'Send Renewal Reminders',    functionName: 'sendRenewalReminders'   },
  ]);
}

// ─── writeDeal ────────────────────────────────────────────────────────────────
// Adds a funded deal to the appropriate year sheet.
// params: { year, borrower, type, source, lender, closing, amt, term,
//           rateType, rate, bps, split, grossComm, yourComm, notes,
//           email, phone }
//
// Column layout A–U:
//   A  # | B  Borrower | C  Type | D  Source | E  Lender | F  Closing Date
//   G  Amount | H  Term | I  Rate Type | J  Rate | K  BPS | L  Split
//   M  Gross Comm | N  Your Comm | O  Notes | P  Email | Q  Phone
//   R  Maturity Date | S  Renewal Alert | T  Status | U  Pay Date

function writeDeal(params) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var year = parseInt(params.year);
  if (year !== 2025 && year !== 2026) throw new Error('year must be 2025 or 2026');

  var sheetName = year === 2025 ? '2025 Funded' : '2026 Funded';
  var sheet     = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var borrower  = String(params.borrower  || '').trim();
  var amt       = parseFloat(params.amt)  || 0;
  if (!borrower) throw new Error('Missing required field: borrower');
  if (!amt)      throw new Error('Missing required field: amt');

  var dealType  = String(params.type      || '').trim();
  var source    = String(params.source    || '').trim();
  var lender    = String(params.lender    || '').trim();
  var closing   = String(params.closing   || '').trim();
  var term      = params.term      != null ? parseInt(params.term)       : '';
  var rateType  = String(params.rateType  || '').trim();
  var rate      = params.rate      != null ? parseFloat(params.rate)     : '';
  var bps       = params.bps       != null ? parseInt(params.bps)        : '';
  var split     = params.split     != null ? parseFloat(params.split)    : '';
  var grossComm = params.grossComm != null ? parseFloat(params.grossComm): '';
  var yourComm  = params.yourComm  != null ? parseFloat(params.yourComm) : '';
  var notes     = String(params.notes     || '').trim();
  var email     = String(params.email     || '').trim();
  var phone     = String(params.phone     || '').trim();

  var totalsRow = findTotalsRow_(sheet);
  var insertRow = totalsRow === -1 ? sheet.getLastRow() + 1 : totalsRow;
  var dealNum   = insertRow - 3; // 3 header rows (title, col-headers, blank)

  sheet.insertRowBefore(insertRow);
  var r = String(insertRow);

  // Write cols A–Q (17 cols)
  sheet.getRange(insertRow, 1, 1, 17).setValues([[
    dealNum, borrower, dealType, source, lender,
    closing, amt, term, rateType, rate,
    bps, split, grossComm, yourComm, notes,
    email, phone
  ]]);

  // Number formats
  sheet.getRange(insertRow, 7 ).setNumberFormat('$#,##0.00');  // G: amt
  sheet.getRange(insertRow, 10).setNumberFormat('0.00"%"');     // J: rate
  sheet.getRange(insertRow, 11).setNumberFormat('0" bps"');     // K: bps
  sheet.getRange(insertRow, 12).setNumberFormat('0%');          // L: split
  sheet.getRange(insertRow, 13).setNumberFormat('$#,##0.00');   // M: grossComm
  sheet.getRange(insertRow, 14).setNumberFormat('$#,##0.00');   // N: yourComm

  // R (col 18): Maturity Date = closing + term months
  sheet.getRange(insertRow, 18)
    .setFormula(
      '=IF(OR(F'+r+'="",H'+r+'=""),"",EDATE(' +
        'IFERROR(DATEVALUE(IF(ISNUMBER(F'+r+'),TEXT(F'+r+',"yyyy-mm-dd"),F'+r+')),F'+r+'),' +
        'H'+r+'))'
    )
    .setNumberFormat('yyyy-mm-dd');

  // S (col 19): Renewal Alert
  sheet.getRange(insertRow, 19)
    .setFormula(
      '=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 URGENT",' +
        'IF(R'+r+'-TODAY()<=90,"🟡 SOON","🟢 OK")))'
    );

  // T (col 20): Status — auto-set based on closing date, stays manually editable
  var statusVal = computeInitialStatus_(closing);
  sheet.getRange(insertRow, 20)
    .setValue(statusVal)
    .setHorizontalAlignment('center')
    .setFontFamily('Arial').setFontSize(10);
  applyStatusValidation_(sheet, insertRow);

  // U (col 21): Pay Date — blank, user fills when commission lands
  sheet.getRange(insertRow, 21).setNumberFormat('yyyy-mm-dd');

  // Font / size for whole row
  sheet.getRange(insertRow, 1, 1, 21).setFontFamily('Arial').setFontSize(10);

  // Apply status CF to col T for this sheet
  applyStatusCF_(sheet);

  fixTotalsAndRefs_(sheet);
  SpreadsheetApp.flush();
  checkNewDealRenewal_(sheet, insertRow);

  ss.toast('Deal added: ' + borrower + ' → ' + sheetName + ' row ' + insertRow);
}

// ─── addDealFromInbox ─────────────────────────────────────────────────────────
// Reads the Inbox sheet (cols A–Q, starting row 2) and calls writeDeal for each.
// Inbox col layout: A borrower | B year | C type | D source | E lender |
//   F closing | G amt | H term | I rateType | J rate | K bps | L split |
//   M grossComm | N yourComm | O notes | P email | Q phone

function addDealFromInbox() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var inbox = ss.getSheetByName('Inbox');
  if (!inbox) { ss.toast('No Inbox sheet found.'); return; }

  var lastRow = inbox.getLastRow();
  if (lastRow < 2) { ss.toast('Inbox is empty.'); return; }

  var data   = inbox.getRange(2, 1, lastRow - 1, 17).getValues();
  var added  = 0;
  var errors = 0;

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var borrower = String(row[0] || '').trim();
    var year     = String(row[1] || '').trim();
    if (!borrower || !year) { errors++; continue; }

    try {
      writeDeal({
        borrower:  borrower,
        year:      year,
        type:      row[2],
        source:    row[3],
        lender:    row[4],
        closing:   row[5],
        amt:       row[6],
        term:      row[7],
        rateType:  row[8],
        rate:      row[9],
        bps:       row[10],
        split:     row[11],
        grossComm: row[12],
        yourComm:  row[13],
        notes:     row[14],
        email:     row[15],
        phone:     row[16],
      });
      added++;
    } catch (e) {
      Logger.log('Inbox row ' + (i + 2) + ' error: ' + e.message);
      errors++;
    }
  }

  if (added > 0) {
    inbox.getRange(2, 1, lastRow - 1, 17).clearContent();
  }

  ss.toast(added + ' deal(s) added' + (errors > 0 ? ', ' + errors + ' skipped.' : '.'));
}

// ─── fixAllTotalsAndRefs (public) ─────────────────────────────────────────────

function fixAllTotalsAndRefs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) fixTotalsAndRefs_(sheet);
  });
  ss.toast('Totals & references fixed.');
}

// ─── fixTotalsAndRefs_ (private) ─────────────────────────────────────────────

function fixTotalsAndRefs_(sheet) {
  var totalsRow = findTotalsRow_(sheet);
  if (totalsRow === -1) return;

  var lastDataRow = totalsRow - 1;
  if (lastDataRow < 4) return;

  var numCols = { 7: 'G', 13: 'M', 14: 'N' };
  for (var col in numCols) {
    var letter = numCols[col];
    sheet.getRange(totalsRow, parseInt(col))
      .setFormula('=SUM(' + letter + '4:' + letter + lastDataRow + ')');
  }
}

// ─── findTotalsRow_ ───────────────────────────────────────────────────────────

function findTotalsRow_(sheet) {
  var data = sheet.getRange('A1:A' + Math.min(sheet.getLastRow(), 200)).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').toUpperCase().indexOf('TOTAL') !== -1) return i + 1;
  }
  return -1;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

// Determines the initial status value from a closing date string or Date.
// Never auto-sets ✅ Paid — that's always manual.
function computeInitialStatus_(closingDateValue) {
  if (!closingDateValue) return STATUS_PENDING;
  var closing;
  if (closingDateValue instanceof Date) {
    closing = new Date(
      closingDateValue.getFullYear(),
      closingDateValue.getMonth(),
      closingDateValue.getDate()
    );
  } else {
    var s = String(closingDateValue).trim();
    if (!s) return STATUS_PENDING;
    var parts = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    closing = parts
      ? new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]))
      : new Date(s);
  }
  if (isNaN(closing.getTime())) return STATUS_PENDING;
  var today = new Date();
  today   = new Date(today.getFullYear(),   today.getMonth(),   today.getDate());
  closing = new Date(closing.getFullYear(), closing.getMonth(), closing.getDate());
  return closing > today ? STATUS_PENDING : STATUS_AWAITING;
}

// Applies dropdown validation (3 options) to col T for a specific row.
function applyStatusValidation_(sheet, row) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 20).setDataValidation(rule);
}

// Replaces all conditional format rules on the sheet, adding col-T status colours.
// Safe to call repeatedly — re-generates the full rule set.
function applyStatusCF_(sheet) {
  var lastDataRow = Math.max(sheet.getLastRow(), 4);
  var colTRange   = sheet.getRange(4, 20, lastDataRow - 3, 1);

  var statusRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_PAID)
      .setBackground('#C6EFCE').setFontColor('#276221')
      .setRanges([colTRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_AWAITING)
      .setBackground('#FFEB9C').setFontColor('#9C6500')
      .setRanges([colTRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_PENDING)
      .setBackground('#DDEBF7').setFontColor('#1F4E79')
      .setRanges([colTRange]).build(),
  ];

  // Preserve any existing rules that target other columns, append status rules
  var existing = sheet.getConditionalFormatRules().filter(function(rule) {
    return rule.getRanges().every(function(rng) {
      return rng.getColumn() !== 20;
    });
  });
  sheet.setConditionalFormatRules(existing.concat(statusRules));
}

// ─── setupProjectedIncome_ (private) ─────────────────────────────────────────
// Initialises col T (Status) and col U (Pay Date) for a single row.
// Sets the auto-computed status value + dropdown validation — NOT a formula,
// so the user can override by typing ✅ Paid manually.

function setupProjectedIncome_(ss, sheetName, rowNum) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  // Read closing date from col F to compute initial status
  var closingVal = sheet.getRange(rowNum, 6).getValue();
  // Only overwrite if cell currently holds a formula (old approach) or is empty
  var currentVal = sheet.getRange(rowNum, 20).getValue();
  var hasFormula = sheet.getRange(rowNum, 20).getFormula() !== '';
  if (hasFormula || !currentVal) {
    var statusVal = computeInitialStatus_(closingVal);
    sheet.getRange(rowNum, 20)
      .setValue(statusVal)
      .setHorizontalAlignment('center')
      .setFontFamily('Arial').setFontSize(10);
  }

  applyStatusValidation_(sheet, rowNum);
  sheet.getRange(rowNum, 21).setNumberFormat('yyyy-mm-dd');
}

// ─── setupStatusColumn_ (private) ────────────────────────────────────────────
// Initialises col T (Status) and col U (Pay Date) headers + all data rows
// for BOTH funded sheets.

function setupStatusColumn_(ss) {
  var NAVY = '#1B3A6B';

  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // Col T header
    sheet.getRange(2, 20)
      .setValue('Status')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center')
      .setBackground(NAVY).setFontColor('#FFFFFF');

    // Col U header
    sheet.getRange(2, 21)
      .setValue('Pay Date')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center')
      .setBackground(NAVY).setFontColor('#FFFFFF');

    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;

    for (var r = 4; r <= lastDataRow; r++) {
      setupProjectedIncome_(ss, sheetName, r);
    }

    applyStatusCF_(sheet);
  });
}

// ─── setupProjectedIncome (public menu) ──────────────────────────────────────

function setupProjectedIncome() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupStatusColumn_(ss);
  setupMonthVsMonth();
  ss.toast('Projected Income setup complete.');
}

// ─── refreshDealStatuses (public) ────────────────────────────────────────────
// Scans 2025 Funded and 2026 Funded. For any row where:
//   • Status = ⏳ Pending Close  AND  closing date <= TODAY()
//   → flips status to 🔄 Awaiting Payment
// Never touches ✅ Paid rows. Logs every change to Reminder Log tab.

function refreshDealStatuses() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var log = getReminderLog_(ss);
  var changed = 0;

  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;

    var numRows = lastDataRow - 3;
    var data    = sheet.getRange(4, 1, numRows, 21).getValues();

    for (var i = 0; i < data.length; i++) {
      var row       = data[i];
      var borrower  = String(row[1]  || '').trim();
      var closingV  = row[5];   // col F (index 5)
      var currentT  = String(row[19] || '').trim(); // col T (index 19)

      if (!borrower) continue;
      if (currentT === STATUS_PAID) continue; // never touch paid rows
      if (currentT !== STATUS_PENDING) continue; // only flip Pending Close

      var shouldFlip = computeInitialStatus_(closingV) === STATUS_AWAITING;
      if (!shouldFlip) continue;

      var sheetRow = i + 4;
      sheet.getRange(sheetRow, 20).setValue(STATUS_AWAITING);
      log.appendRow([
        new Date(), sheetName, borrower,
        STATUS_PENDING, STATUS_AWAITING,
        'Auto-flipped by refreshDealStatuses'
      ]);
      changed++;
    }
  });

  SpreadsheetApp.flush();
  SpreadsheetApp.getActiveSpreadsheet()
    .toast(changed + ' deal status(es) updated to 🔄 Awaiting Payment.');
}

// Returns (or creates) the Reminder Log sheet with a header row.
function getReminderLog_(ss) {
  var log = ss.getSheetByName('Reminder Log');
  if (!log) {
    log = ss.insertSheet('Reminder Log');
    log.getRange(1, 1, 1, 6)
      .setValues([['Timestamp', 'Sheet', 'Borrower', 'Old Status', 'New Status', 'Note']])
      .setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
  }
  return log;
}

// ─── Renewal system ───────────────────────────────────────────────────────────

function createRenewalTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendRenewalReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendRenewalReminders')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone('America/Toronto')
    .create();
  SpreadsheetApp.getActiveSpreadsheet()
    .toast('Renewal trigger created — runs daily at 8 am Toronto time.');
}

function sendRenewalReminders() {
  // Auto-refresh statuses before sending reminders
  refreshDealStatuses();

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var urgent = [];
  var soon   = [];

  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var totalsRow = findTotalsRow_(sheet);
    var lastRow   = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastRow < 4) return;

    var data = sheet.getRange(4, 1, lastRow - 3, 19).getValues();
    data.forEach(function(row) {
      var borrower = String(row[1]  || '').trim();
      var alert    = String(row[18] || '').trim(); // col S
      if (!borrower) return;
      if (alert.indexOf('🔴') !== -1) urgent.push(borrower + ' (' + name + ')');
      else if (alert.indexOf('🟡') !== -1) soon.push(borrower + ' (' + name + ')');
    });
  });

  if (urgent.length === 0 && soon.length === 0) return;

  var body = 'JM Mortgages — Renewal Reminders\n' + new Date().toDateString() + '\n\n';
  if (urgent.length) {
    body += '🔴 URGENT (within 30 days):\n';
    urgent.forEach(function(d) { body += '  • ' + d + '\n'; });
    body += '\n';
  }
  if (soon.length) {
    body += '🟡 COMING UP (within 90 days):\n';
    soon.forEach(function(d) { body += '  • ' + d + '\n'; });
  }

  MailApp.sendEmail(
    Session.getActiveUser().getEmail(),
    'JM Mortgages — Renewal Reminders',
    body
  );
}

function checkNewDealRenewal_(sheet, row) {
  var alert = String(sheet.getRange(row, 19).getValue() || '');
  if (alert.indexOf('🔴') === -1 && alert.indexOf('🟡') === -1) return;
  var borrower = String(sheet.getRange(row, 2).getValue() || '');
  try {
    MailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      'New Deal Alert — ' + borrower + ' needs renewal attention',
      'A new deal was added for ' + borrower + ' with renewal status: ' + alert
    );
  } catch (e) {
    Logger.log('checkNewDealRenewal_ email failed: ' + e.message);
  }
}

// ─── columnLetter_ ────────────────────────────────────────────────────────────

function columnLetter_(n) {
  var s = '';
  while (n > 0) {
    var rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── SUMPRODUCT formula builders ──────────────────────────────────────────────
// Return formula strings written into MvM cells.
// All status params now use the 3-state values defined at the top.

function mvs2025Count_(mo, status) {
  var ref      = "'2025 Funded'!F$4:F$200";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start    = 'DATE(2025,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef  = "'2025 Funded'!T$4:T$200";
    var sCond = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+')';
  }
  return '=SUMPRODUCT('+dateCond+')';
}

function mvs2025Sum_(mo, col, status) {
  var ref      = "'2025 Funded'!F$4:F$200";
  var colRef   = "'2025 Funded'!"+columnLetter_(col)+'$4:'+columnLetter_(col)+'$200';
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start    = 'DATE(2025,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef  = "'2025 Funded'!T$4:T$200";
    var sCond = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+'*'+colRef+')';
  }
  return '=SUMPRODUCT('+dateCond+'*'+colRef+')';
}

function mvs2026Count_(mo, status) {
  var ref      = "'2026 Funded'!F$4:F$200";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start    = 'DATE(2026,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef  = "'2026 Funded'!T$4:T$200";
    var sCond = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+')';
  }
  return '=SUMPRODUCT('+dateCond+')';
}

function mvs2026Sum_(mo, col, status) {
  var ref      = "'2026 Funded'!F$4:F$200";
  var colRef   = "'2026 Funded'!"+columnLetter_(col)+'$4:'+columnLetter_(col)+'$200';
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start    = 'DATE(2026,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef  = "'2026 Funded'!T$4:T$200";
    var sCond = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+'*'+colRef+')';
  }
  return '=SUMPRODUCT('+dateCond+'*'+colRef+')';
}

// ─── setupMvMSummaryBlock_ ────────────────────────────────────────────────────
// Builds the 2026 Performance Dashboard (rows 18–30).
// Table spans cols B–P (15 cols), so:
//   Labels: cols B–F (2–6), 5 merged cells
//   Values: cols G–P (7–16), 10 merged cells  ← value references use col G
// Returns an array of ConditionalFormatRule objects.

function setupMvMSummaryBlock_(sheet, NAVY, GOLD) {
  var NUM_TABLE_COLS = 15; // B through P

  // Row 18: section header spanning full table width
  sheet.getRange(18, 2, 1, NUM_TABLE_COLS).clearContent().clearFormat();
  sheet.getRange(18, 2, 1, NUM_TABLE_COLS).merge()
    .setValue('📊 2026 PERFORMANCE DASHBOARD')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(13).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(18, 38);

  var labels = [
    '✅ Paid — Deal Count (2026)',
    '✅ Paid — Volume (2026)',
    '✅ Paid — Comm Received (2026)',
    '🔄 Awaiting Payment — Deals (2026)',
    '🔄 Awaiting Payment — Volume (2026)',
    '🔄 Awaiting Payment — Comm Due (2026)',
    '⏳ Pending Close — Deals (2026)',
    '⏳ Pending Close — Volume (2026)',
    '⏳ Pending Close — Comm (2026)',
    'Combined Total Comm — Full Pipeline (2026)',
    '2025 Full Year Comm (✅ Paid)',
    'YTD Pace vs 2025 (Paid comm only)',
  ];

  var formats = [
    '0',          // Paid count
    '$#,##0.00',  // Paid vol
    '$#,##0.00',  // Paid comm
    '0',          // Awaiting count
    '$#,##0.00',  // Awaiting vol
    '$#,##0.00',  // Awaiting comm
    '0',          // Pending count
    '$#,##0.00',  // Pending vol
    '$#,##0.00',  // Pending comm
    '$#,##0.00',  // Combined
    '$#,##0.00',  // 2025 FY
    '0.0%',       // YTD Pace
  ];

  // Rows 19–30 (i=0 → row 19, i=11 → row 30)
  // Value cells start at col G (col 7). Reference: G19…G30.
  var formulas = [
    '=COUNTIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PAID+'")',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PAID+'",\'2026 Funded\'!G$4:G$200)',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PAID+'",\'2026 Funded\'!N$4:N$200)',
    '=COUNTIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_AWAITING+'")',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_AWAITING+'",\'2026 Funded\'!G$4:G$200)',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_AWAITING+'",\'2026 Funded\'!N$4:N$200)',
    '=COUNTIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PENDING+'")',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PENDING+'",\'2026 Funded\'!G$4:G$200)',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"'+STATUS_PENDING+'",\'2026 Funded\'!N$4:N$200)',
    '=G21+G24+G27',    // Paid + Awaiting + Pending comm
    '=SUM(E4:E15)',     // 2025 Paid Comm from MvM table col E
    '=IF(G29=0,"—",G21/G29)', // YTD Pace — paid comm / 2025 full-year paid comm
  ];

  var cfRules = [];

  for (var i = 0; i < labels.length; i++) {
    var r  = 19 + i;
    var bg = i % 2 === 0 ? '#EEF2F7' : '#FFFFFF';

    sheet.getRange(r, 2, 1, NUM_TABLE_COLS).clearContent().clearFormat();
    sheet.setRowHeight(r, 27);

    // Label: cols B–F (5 cells)
    sheet.getRange(r, 2, 1, 5).merge()
      .setValue(labels[i])
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    // Value: cols G–P (10 cells)
    var valueCell = sheet.getRange(r, 7, 1, 10).merge();
    valueCell
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFormula(formulas[i])
      .setNumberFormat(formats[i]);

    // CF for YTD Pace (i=11, row 30)
    if (i === 11) {
      var paceRange = sheet.getRange(r, 7);
      cfRules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenNumberGreaterThanOrEqualTo(1)
          .setBackground('#C6EFCE').setFontColor('#276221')
          .setRanges([paceRange]).build()
      );
      cfRules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenNumberLessThan(1)
          .setBackground('#FFCCCC').setFontColor('#9C0006')
          .setRanges([paceRange]).build()
      );
    }

    // Highlight Paid rows (i=0,1,2) with light green tint
    if (i < 3) sheet.getRange(r, 2, 1, NUM_TABLE_COLS).setBackground('#F0FFF0');
    // Highlight Awaiting rows (i=3,4,5) with light yellow tint
    if (i >= 3 && i < 6) sheet.getRange(r, 2, 1, NUM_TABLE_COLS).setBackground('#FFFDE7');
    // Highlight Pending rows (i=6,7,8) with light blue tint
    if (i >= 6 && i < 9) sheet.getRange(r, 2, 1, NUM_TABLE_COLS).setBackground('#E8F4FD');
  }

  return cfRules;
}

// ─── setupMonthVsMonth (public) ──────────────────────────────────────────────
// Completely rebuilds the "Month vs Month" tab.
//
// Column layout (cols B–P = 2–16):
//   B   Month
//   C   2025 ✅ Paid #      D   2025 Paid Vol     E   2025 Paid Comm
//   F   2026 ✅ Paid #      G   2026 Paid Vol     H   2026 Paid Comm
//   I   2026 🔄 Awaiting #  J   Awaiting Vol      K   Awaiting Comm
//   L   2026 ⏳ Pending #   M   Pending Vol       N   Pending Comm
//   O   Total 2026 Comm
//   P   vs 2025

function setupMonthVsMonth() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY  = '#1B3A6B';
  var GOLD  = '#C9A84C';
  var LGOLD = '#FFF8E7';

  var sheet = ss.getSheetByName('Month vs Month');
  if (!sheet) sheet = ss.insertSheet('Month vs Month');
  sheet.clear();

  // Column widths: A(spacer), B–P
  var widths = [25, 115, 68, 98, 105, 68, 98, 105, 72, 98, 105, 72, 98, 105, 115, 90];
  for (var w = 0; w < widths.length; w++) sheet.setColumnWidth(w + 1, widths[w]);

  var NUM_COLS = 15; // B through P

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  sheet.getRange(1, 2, 1, NUM_COLS).merge()
    .setValue('JM MORTGAGES — MONTH vs MONTH + PIPELINE')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(16).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // ── Row 2: Subtitle ─────────────────────────────────────────────────────────
  sheet.getRange(2, 2, 1, NUM_COLS).merge()
    .setValue(
      'Live data  •  ✅ Paid | 🔄 Awaiting | ⏳ Pending  •  Today: ' +
      Utilities.formatDate(new Date(), 'America/Toronto', 'MMMM d, yyyy')
    )
    .setBackground(LGOLD).setFontColor(GOLD)
    .setFontStyle('italic').setFontSize(10).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 28);

  // ── Row 3: Column headers ───────────────────────────────────────────────────
  // Group headers row (row 3) — merge the 3-col groups
  var groups = [
    { col: 2,  span: 1,  label: 'Month',             bg: NAVY },
    { col: 3,  span: 3,  label: '2025  ✅ Paid',      bg: '#276221' },
    { col: 6,  span: 3,  label: '2026  ✅ Paid',      bg: '#276221' },
    { col: 9,  span: 3,  label: '2026  🔄 Awaiting',  bg: '#9C6500' },
    { col: 12, span: 3,  label: '2026  ⏳ Pending',   bg: '#1F4E79' },
    { col: 15, span: 1,  label: 'Total 2026',         bg: NAVY      },
    { col: 16, span: 1,  label: 'vs 2025',            bg: NAVY      },
  ];
  groups.forEach(function(g) {
    var rng = g.span > 1
      ? sheet.getRange(3, g.col, 1, g.span).merge()
      : sheet.getRange(3, g.col);
    rng.setValue(g.label)
      .setBackground(g.bg).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  // Sub-headers row (row 4)
  var subHeaders = [
    'Month',
    '#', 'Volume', 'Comm',          // 2025 Paid
    '#', 'Volume', 'Comm',          // 2026 Paid
    '#', 'Volume', 'Comm',          // 2026 Awaiting
    '#', 'Volume', 'Comm',          // 2026 Pending
    'Comm', 'Δ vs 2025',
  ];
  for (var sh = 0; sh < subHeaders.length; sh++) {
    sheet.getRange(4, 2 + sh)
      .setValue(subHeaders[sh])
      .setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(8).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  sheet.setRowHeight(3, 30);
  sheet.setRowHeight(4, 26);

  // ── Rows 5–16: Monthly data ─────────────────────────────────────────────────
  for (var mo = 1; mo <= 12; mo++) {
    var r  = mo + 4; // rows 5–16
    var bg = mo % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
    sheet.setRowHeight(r, 22);
    sheet.getRange(r, 2, 1, NUM_COLS).setBackground(bg).setFontFamily('Arial').setFontSize(9);

    // B: Month name
    sheet.getRange(r, 2).setValue(MONTHS_[mo - 1])
      .setFontWeight('bold').setHorizontalAlignment('left');

    // C: 2025 Paid #
    sheet.getRange(r, 3).setFormula(mvs2025Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    // D: 2025 Paid Vol
    sheet.getRange(r, 4).setFormula(mvs2025Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    // E: 2025 Paid Comm
    sheet.getRange(r, 5).setFormula(mvs2025Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // F: 2026 Paid #
    sheet.getRange(r, 6).setFormula(mvs2026Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    // G: 2026 Paid Vol
    sheet.getRange(r, 7).setFormula(mvs2026Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    // H: 2026 Paid Comm
    sheet.getRange(r, 8).setFormula(mvs2026Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // I: 2026 Awaiting #
    sheet.getRange(r, 9).setFormula(mvs2026Count_(mo, STATUS_AWAITING)).setHorizontalAlignment('center');
    // J: 2026 Awaiting Vol
    sheet.getRange(r, 10).setFormula(mvs2026Sum_(mo, 7, STATUS_AWAITING)).setNumberFormat('$#,##0');
    // K: 2026 Awaiting Comm
    sheet.getRange(r, 11).setFormula(mvs2026Sum_(mo, 14, STATUS_AWAITING)).setNumberFormat('$#,##0.00');

    // L: 2026 Pending #
    sheet.getRange(r, 12).setFormula(mvs2026Count_(mo, STATUS_PENDING)).setHorizontalAlignment('center');
    // M: 2026 Pending Vol
    sheet.getRange(r, 13).setFormula(mvs2026Sum_(mo, 7, STATUS_PENDING)).setNumberFormat('$#,##0');
    // N: 2026 Pending Comm
    sheet.getRange(r, 14).setFormula(mvs2026Sum_(mo, 14, STATUS_PENDING)).setNumberFormat('$#,##0.00');

    // O: Total 2026 Comm = Paid + Awaiting + Pending
    sheet.getRange(r, 15)
      .setFormula('=H'+r+'+K'+r+'+N'+r)
      .setNumberFormat('$#,##0.00').setFontWeight('bold');

    // P: vs 2025 (blank dash when 2025 has no data)
    sheet.getRange(r, 16)
      .setFormula('=IF(E'+r+'=0,"—",O'+r+'-E'+r+')')
      .setNumberFormat('$#,##0.00');
  }

  // ── Row 17: TOTALS ──────────────────────────────────────────────────────────
  sheet.setRowHeight(17, 28);
  sheet.getRange(17, 2, 1, NUM_COLS)
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontFamily('Arial').setFontSize(9);

  sheet.getRange(17, 2).setValue('TOTALS').setHorizontalAlignment('center');
  sheet.getRange(17, 3).setFormula('=SUM(C5:C16)').setHorizontalAlignment('center');
  sheet.getRange(17, 4).setFormula('=SUM(D5:D16)').setNumberFormat('$#,##0');
  sheet.getRange(17, 5).setFormula('=SUM(E5:E16)').setNumberFormat('$#,##0.00');
  sheet.getRange(17, 6).setFormula('=SUM(F5:F16)').setHorizontalAlignment('center');
  sheet.getRange(17, 7).setFormula('=SUM(G5:G16)').setNumberFormat('$#,##0');
  sheet.getRange(17, 8).setFormula('=SUM(H5:H16)').setNumberFormat('$#,##0.00');
  sheet.getRange(17, 9).setFormula('=SUM(I5:I16)').setHorizontalAlignment('center');
  sheet.getRange(17, 10).setFormula('=SUM(J5:J16)').setNumberFormat('$#,##0');
  sheet.getRange(17, 11).setFormula('=SUM(K5:K16)').setNumberFormat('$#,##0.00');
  sheet.getRange(17, 12).setFormula('=SUM(L5:L16)').setHorizontalAlignment('center');
  sheet.getRange(17, 13).setFormula('=SUM(M5:M16)').setNumberFormat('$#,##0');
  sheet.getRange(17, 14).setFormula('=SUM(N5:N16)').setNumberFormat('$#,##0.00');
  sheet.getRange(17, 15).setFormula('=SUM(O5:O16)').setNumberFormat('$#,##0.00').setFontWeight('bold');
  sheet.getRange(17, 16)
    .setFormula('=IF(SUM(E5:E16)=0,"—",SUM(O5:O16)-SUM(E5:E16))')
    .setNumberFormat('$#,##0.00');

  // ── Row 18: Spacer ──────────────────────────────────────────────────────────
  sheet.setRowHeight(18, 16);

  // ── Rows 19–30: Performance Dashboard ──────────────────────────────────────
  var cfRules = setupMvMSummaryBlock_(sheet, NAVY, GOLD);

  // CF for vs 2025 column (P = col 16, rows 5–16)
  var vsRange = sheet.getRange(5, 16, 12, 1);
  cfRules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground('#C6EFCE').setFontColor('#276221')
      .setRanges([vsRange]).build()
  );
  cfRules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setBackground('#FFCCCC').setFontColor('#9C0006')
      .setRanges([vsRange]).build()
  );

  sheet.setConditionalFormatRules(cfRules);
  SpreadsheetApp.flush();
  ss.toast('Month vs Month rebuilt successfully.');
}

// ─── formatAllSheets (public) ─────────────────────────────────────────────────

function formatAllSheets() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY = '#1B3A6B';

  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    var headers = [
      '#', 'Borrower', 'Type', 'Source', 'Lender', 'Closing Date',
      'Amount', 'Term', 'Rate Type', 'Rate', 'BPS', 'Split',
      'Gross Comm', 'Your Comm', 'Notes', 'Email', 'Phone',
      'Maturity Date', 'Renewal Alert', 'Status', 'Pay Date',
    ];

    sheet.getRange(2, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(NAVY).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center');

    var totalsRow = findTotalsRow_(sheet);
    var lastRow   = totalsRow === -1 ? sheet.getLastRow() : totalsRow;
    if (lastRow >= 4) {
      var rows = lastRow - 3;
      sheet.getRange(4, 7,  rows).setNumberFormat('$#,##0.00');   // G: amt
      sheet.getRange(4, 10, rows).setNumberFormat('0.00"%"');      // J: rate
      sheet.getRange(4, 11, rows).setNumberFormat('0" bps"');      // K: bps
      sheet.getRange(4, 12, rows).setNumberFormat('0%');           // L: split
      sheet.getRange(4, 13, rows).setNumberFormat('$#,##0.00');    // M: grossComm
      sheet.getRange(4, 14, rows).setNumberFormat('$#,##0.00');    // N: yourComm
      sheet.getRange(4, 18, rows).setNumberFormat('yyyy-mm-dd');   // R: maturity
      sheet.getRange(4, 21, rows).setNumberFormat('yyyy-mm-dd');   // U: pay date
    }

    applyStatusCF_(sheet);
  });

  ss.toast('All sheets formatted.');
}
