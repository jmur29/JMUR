// Google Apps Script — JM Mortgages Tracker
// Bound to spreadsheet: 1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8

var MONTHS_ = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ─── Menu ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('JM Tools', [
    { name: 'Add Deal from Inbox',       functionName: 'addDealFromInbox'      },
    { name: 'Fix Totals & References',   functionName: 'fixAllTotalsAndRefs'   },
    { name: 'Rebuild Month vs Month',    functionName: 'setupMonthVsMonth'     },
    { name: 'Setup Projected Income',    functionName: 'setupProjectedIncome'  },
    { name: 'Format All Sheets',         functionName: 'formatAllSheets'       },
    { name: 'Create Renewal Trigger',    functionName: 'createRenewalTrigger'  },
    { name: 'Send Renewal Reminders',    functionName: 'sendRenewalReminders'  },
  ]);
}

// ─── writeDeal ────────────────────────────────────────────────────────────────
// Adds a funded deal to the appropriate year sheet.
// params: { year, borrower, type, source, lender, closing, amt, term,
//           rateType, rate, bps, split, grossComm, yourComm, notes,
//           email, phone }

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
  // Handles both text dates and numeric date serials stored by Sheets
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

  // T (col 20): Status — 2026 only
  if (year === 2026) {
    setupProjectedIncome_(ss, sheetName, insertRow);
  }

  // Font / size for whole row
  sheet.getRange(insertRow, 1, 1, year === 2026 ? 20 : 19)
    .setFontFamily('Arial').setFontSize(10);

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

  // Rebuild SUM formulas for numeric columns in TOTALS row
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

// ─── setupProjectedIncome_ (private) ─────────────────────────────────────────
// Writes the robust Status formula into col T for a single row in 2026 Funded.
// Uses DATEVALUE to handle both text dates ("2026-03-15") and numeric date serials.

function setupProjectedIncome_(ss, sheetName, rowNum) {
  if (sheetName !== '2026 Funded') return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var r = String(rowNum);
  sheet.getRange(rowNum, 20)
    .setFormula(
      '=IF(OR(F'+r+'="",F'+r+'=0),"",IF(' +
        'IFERROR(DATEVALUE(IF(ISNUMBER(F'+r+'),TEXT(F'+r+',"yyyy-mm-dd"),F'+r+')),0)' +
        '<=TODAY(),"✅ Closed","⏳ Pending"))'
    )
    .setHorizontalAlignment('center')
    .setFontFamily('Arial')
    .setFontSize(10);
}

// ─── setupStatusColumn_ (private) ────────────────────────────────────────────

function setupStatusColumn_(ss) {
  var sheet = ss.getSheetByName('2026 Funded');
  if (!sheet) return;

  sheet.getRange(2, 20)
    .setValue('Status')
    .setFontWeight('bold')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setBackground('#1B3A6B')
    .setFontColor('#FFFFFF');

  var totalsRow   = findTotalsRow_(sheet);
  var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;

  for (var r = 4; r <= lastDataRow; r++) {
    setupProjectedIncome_(ss, '2026 Funded', r);
  }
}

// ─── setupProjectedIncome (public menu) ──────────────────────────────────────

function setupProjectedIncome() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupStatusColumn_(ss);
  setupMonthVsMonth();
  ss.toast('Projected Income setup complete.');
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
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var urgent  = [];
  var soon    = [];

  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var totalsRow = findTotalsRow_(sheet);
    var lastRow   = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastRow < 4) return;

    var data = sheet.getRange(4, 1, lastRow - 3, 19).getValues();
    data.forEach(function(row) {
      var borrower = String(row[1]  || '').trim();
      var alert    = String(row[18] || '').trim(); // col S = index 18
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
// Converts a 1-based column number to its letter string (e.g. 14 → "N")

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
// These return formula strings to be written into MvM cells.

function mvs2025Count_(mo) {
  var ref   = "'2025 Funded'!F$4:F$200";
  var dExpr = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start = 'DATE(2025,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  return '=SUMPRODUCT(('+dExpr+'>='+start+')*('+dExpr+'<'+end+'))';
}

function mvs2025Sum_(mo, col) {
  var ref     = "'2025 Funded'!F$4:F$200";
  var colRef  = "'2025 Funded'!"+columnLetter_(col)+"$4:"+columnLetter_(col)+"$200";
  var dExpr   = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start   = 'DATE(2025,'+mo+',1)';
  var end     = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  return '=SUMPRODUCT(('+dExpr+'>='+start+')*('+dExpr+'<'+end+')*'+colRef+')';
}

function mvs2026Count_(mo, status) {
  var ref   = "'2026 Funded'!F$4:F$200";
  var dExpr = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start = 'DATE(2026,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef    = "'2026 Funded'!T$4:T$200";
    var sCond   = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+')';
  }
  return '=SUMPRODUCT('+dateCond+')';
}

function mvs2026Sum_(mo, col, status) {
  var ref     = "'2026 Funded'!F$4:F$200";
  var colRef  = "'2026 Funded'!"+columnLetter_(col)+"$4:"+columnLetter_(col)+"$200";
  var dExpr   = 'IFERROR(DATEVALUE(IF(ISNUMBER('+ref+'),TEXT('+ref+',"yyyy-mm-dd"),'+ref+')),0)';
  var start   = 'DATE(2026,'+mo+',1)';
  var end     = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) {
    var tRef  = "'2026 Funded'!T$4:T$200";
    var sCond = '(IFERROR('+tRef+'="'+status+'",FALSE))';
    return '=SUMPRODUCT('+dateCond+'*'+sCond+'*'+colRef+')';
  }
  return '=SUMPRODUCT('+dateCond+'*'+colRef+')';
}

// ─── setupMvMSummaryBlock_ ────────────────────────────────────────────────────
// Builds the 2026 Performance Dashboard (rows 18–27).
// Label cells: cols B–F (2–6). Value cells: cols G–M (7–13).
// Returns an array of ConditionalFormatRule objects.

function setupMvMSummaryBlock_(sheet, NAVY, GOLD) {
  // Row 18: section header
  sheet.getRange(18, 2, 1, 12).clearContent().clearFormat();
  sheet.getRange(18, 2, 1, 12).merge()
    .setValue('📊 2026 PERFORMANCE DASHBOARD')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(13).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(18, 36);

  var labels = [
    '2026 Deals Closed',
    '2026 Volume Closed ($)',
    '2026 Comm Earned ($)',
    'Deals Pending',
    'Pipeline Volume ($)',
    'Projected Comm ($)',
    'Combined Outlook ($)',
    '2025 Full Year Comm ($)',
    'YTD Pace vs 2025',
  ];

  // Row indices: 19 = labels[0], ..., 27 = labels[8]
  // G-column cell references: G19, G20, …, G27
  var formats = [
    '0',          // Deals Closed
    '$#,##0.00',  // Volume Closed
    '$#,##0.00',  // Comm Earned
    '0',          // Pending #
    '$#,##0.00',  // Pipeline Vol
    '$#,##0.00',  // Projected Comm
    '$#,##0.00',  // Combined Outlook
    '$#,##0.00',  // 2025 Full Year Comm
    '0.0%',       // YTD Pace
  ];

  var formulas = [
    '=COUNTIF(\'2026 Funded\'!T$4:T$200,"✅ Closed")',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"✅ Closed",\'2026 Funded\'!G$4:G$200)',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"✅ Closed",\'2026 Funded\'!N$4:N$200)',
    '=COUNTIF(\'2026 Funded\'!T$4:T$200,"⏳ Pending")',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"⏳ Pending",\'2026 Funded\'!G$4:G$200)',
    '=SUMIF(\'2026 Funded\'!T$4:T$200,"⏳ Pending",\'2026 Funded\'!N$4:N$200)',
    '=G21+G24',                         // Comm Earned + Projected Comm
    '=SUM(E4:E15)',                      // 2025 Full Year Comm from MvM table col E
    '=IF(G26=0,"—",G25/G26)',           // YTD Pace
  ];

  var cfRules = [];

  for (var i = 0; i < labels.length; i++) {
    var r  = 19 + i;
    var bg = i % 2 === 0 ? '#EEF2F7' : '#FFFFFF';

    // Clear full row span first to avoid merge conflicts on re-runs
    sheet.getRange(r, 2, 1, 12).clearContent().clearFormat();
    sheet.setRowHeight(r, 28);

    // Label: cols B–F
    sheet.getRange(r, 2, 1, 5).merge()
      .setValue(labels[i])
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    // Value: cols G–M
    var valueCell = sheet.getRange(r, 7, 1, 7).merge();
    valueCell
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFormula(formulas[i])
      .setNumberFormat(formats[i]);

    // Conditional formatting for YTD Pace row
    if (i === 8) {
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
  }

  return cfRules;
}

// ─── setupMonthVsMonth (public) ──────────────────────────────────────────────
// Completely rebuilds the "Month vs Month" tab.
//
// Column layout (cols B–M = 2–13):
//   B  Month
//   C  2025 Closed #
//   D  2025 Volume
//   E  2025 Comm
//   F  2026 Closed #
//   G  2026 Closed Vol
//   H  2026 Closed Comm
//   I  2026 Pending #
//   J  2026 Pending Vol
//   K  2026 Pending Comm
//   L  Total 2026 Comm
//   M  vs 2025

function setupMonthVsMonth() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY  = '#1B3A6B';
  var GOLD  = '#C9A84C';
  var LGOLD = '#FFF8E7';

  var sheet = ss.getSheetByName('Month vs Month');
  if (!sheet) sheet = ss.insertSheet('Month vs Month');
  sheet.clear();

  // Column widths
  var widths = [30, 115, 80, 110, 110, 80, 110, 110, 80, 110, 110, 120, 100];
  for (var w = 0; w < widths.length; w++) sheet.setColumnWidth(w + 1, widths[w]);

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  sheet.getRange(1, 2, 1, 12).merge()
    .setValue('JM MORTGAGES — MONTH vs MONTH + PIPELINE')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(16).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // ── Row 2: Subtitle ─────────────────────────────────────────────────────────
  sheet.getRange(2, 2, 1, 12).merge()
    .setValue(
      'Live data  •  Updates automatically  •  Today: ' +
      Utilities.formatDate(new Date(), 'America/Toronto', 'MMMM d, yyyy')
    )
    .setBackground(LGOLD).setFontColor(GOLD)
    .setFontStyle('italic').setFontSize(10).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 28);

  // ── Row 3: Column headers ───────────────────────────────────────────────────
  var headers = [
    'Month',
    '2025\nClosed #', '2025\nVolume', '2025\nComm',
    '2026\nClosed #', '2026\nClosed Vol', '2026\nClosed Comm',
    '2026\nPending #', '2026\nPending Vol', '2026\nPending Comm',
    'Total 2026\nComm', 'vs 2025',
  ];
  for (var h = 0; h < headers.length; h++) {
    sheet.getRange(3, 2 + h)
      .setValue(headers[h])
      .setBackground(NAVY).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrap(true);
  }
  sheet.setRowHeight(3, 44);

  // ── Rows 4–15: Monthly data ─────────────────────────────────────────────────
  for (var mo = 1; mo <= 12; mo++) {
    var r  = mo + 3;
    var bg = mo % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
    sheet.setRowHeight(r, 24);
    sheet.getRange(r, 2, 1, 12).setBackground(bg).setFontFamily('Arial').setFontSize(10);

    // B: Month name
    sheet.getRange(r, 2).setValue(MONTHS_[mo - 1])
      .setFontWeight('bold').setHorizontalAlignment('left');

    // C: 2025 Closed #
    sheet.getRange(r, 3).setFormula(mvs2025Count_(mo)).setHorizontalAlignment('center');

    // D: 2025 Volume
    sheet.getRange(r, 4).setFormula(mvs2025Sum_(mo, 7)).setNumberFormat('$#,##0');

    // E: 2025 Comm
    sheet.getRange(r, 5).setFormula(mvs2025Sum_(mo, 14)).setNumberFormat('$#,##0.00');

    // F: 2026 Closed #
    sheet.getRange(r, 6).setFormula(mvs2026Count_(mo, '✅ Closed')).setHorizontalAlignment('center');

    // G: 2026 Closed Vol
    sheet.getRange(r, 7).setFormula(mvs2026Sum_(mo, 7, '✅ Closed')).setNumberFormat('$#,##0');

    // H: 2026 Closed Comm
    sheet.getRange(r, 8).setFormula(mvs2026Sum_(mo, 14, '✅ Closed')).setNumberFormat('$#,##0.00');

    // I: 2026 Pending #
    sheet.getRange(r, 9).setFormula(mvs2026Count_(mo, '⏳ Pending')).setHorizontalAlignment('center');

    // J: 2026 Pending Vol
    sheet.getRange(r, 10).setFormula(mvs2026Sum_(mo, 7, '⏳ Pending')).setNumberFormat('$#,##0');

    // K: 2026 Pending Comm
    sheet.getRange(r, 11).setFormula(mvs2026Sum_(mo, 14, '⏳ Pending')).setNumberFormat('$#,##0.00');

    // L: Total 2026 Comm = Closed + Pending
    sheet.getRange(r, 12)
      .setFormula('=H'+r+'+K'+r)
      .setNumberFormat('$#,##0.00')
      .setFontWeight('bold');

    // M: vs 2025 — show "—" when 2025 has no data yet
    sheet.getRange(r, 13)
      .setFormula('=IF(E'+r+'=0,"—",L'+r+'-E'+r+')')
      .setNumberFormat('$#,##0.00');
  }

  // ── Row 16: TOTALS ──────────────────────────────────────────────────────────
  sheet.setRowHeight(16, 28);
  sheet.getRange(16, 2, 1, 12)
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontFamily('Arial').setFontSize(10);

  sheet.getRange(16, 2).setValue('TOTALS').setHorizontalAlignment('center');
  sheet.getRange(16, 3).setFormula('=SUM(C4:C15)').setHorizontalAlignment('center');
  sheet.getRange(16, 4).setFormula('=SUM(D4:D15)').setNumberFormat('$#,##0');
  sheet.getRange(16, 5).setFormula('=SUM(E4:E15)').setNumberFormat('$#,##0.00');
  sheet.getRange(16, 6).setFormula('=SUM(F4:F15)').setHorizontalAlignment('center');
  sheet.getRange(16, 7).setFormula('=SUM(G4:G15)').setNumberFormat('$#,##0');
  sheet.getRange(16, 8).setFormula('=SUM(H4:H15)').setNumberFormat('$#,##0.00');
  sheet.getRange(16, 9).setFormula('=SUM(I4:I15)').setHorizontalAlignment('center');
  sheet.getRange(16, 10).setFormula('=SUM(J4:J15)').setNumberFormat('$#,##0');
  sheet.getRange(16, 11).setFormula('=SUM(K4:K15)').setNumberFormat('$#,##0.00');
  sheet.getRange(16, 12).setFormula('=SUM(L4:L15)').setNumberFormat('$#,##0.00').setFontWeight('bold');
  sheet.getRange(16, 13)
    .setFormula('=IF(SUM(E4:E15)=0,"—",SUM(L4:L15)-SUM(E4:E15))')
    .setNumberFormat('$#,##0.00');

  // ── Row 17: Spacer ──────────────────────────────────────────────────────────
  sheet.setRowHeight(17, 18);

  // ── Rows 18–27: Performance Dashboard ──────────────────────────────────────
  var cfRules = setupMvMSummaryBlock_(sheet, NAVY, GOLD);

  // Conditional formatting for vs 2025 column (M = col 13, rows 4–15)
  var vsRange = sheet.getRange(4, 13, 12, 1);
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
      'Maturity Date', 'Renewal Alert',
    ];
    if (name === '2026 Funded') headers.push('Status');

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
    }
  });

  ss.toast('All sheets formatted.');
}
