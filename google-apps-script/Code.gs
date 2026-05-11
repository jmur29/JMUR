// Google Apps Script — JM Mortgages Tracker
// Bound to spreadsheet: 1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8

var MONTHS_ = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

var STATUS_PENDING  = '⏳ Pending Close';
var STATUS_AWAITING = '🔄 Awaiting Payment';
var STATUS_PAID     = '✅ Paid';

// ─── Menu ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('JM Tools', [
    { name: '✦ Overhaul All Sheets',     functionName: 'overhaulSheet'          },
    { name: 'Add Deal from Inbox',       functionName: 'addDealFromInbox'       },
    { name: 'Setup Inbox Sheet',        functionName: 'setupInbox'             },
    { name: 'Import Commission Report',  functionName: 'importCommissionReport' },
    { name: 'Rebuild Month vs Month',    functionName: 'setupMonthVsMonth'      },
    { name: 'Rebuild Year Over Year',   functionName: 'rebuildYearOverYear'    },
    { name: 'Fix Maturity Dates',        functionName: 'fixAllMaturityDates'    },
    { name: 'Fix Renewal Alerts',        functionName: 'fixAllRenewalAlerts'    },
    { name: 'Refresh Deal Statuses',     functionName: 'refreshDealStatuses'    },
    { name: 'Fix Status Column',         functionName: 'fixStatusColumn'        },
    { name: 'Fix Totals & References',   functionName: 'fixAllTotalsAndRefs'    },
    { name: 'Setup Projected Income',    functionName: 'setupProjectedIncome'   },
    { name: 'Run Diagnostic',            functionName: 'runDiagnostic'          },
    { name: 'Create Renewal Trigger',    functionName: 'createRenewalTrigger'   },
    { name: 'Send Renewal Reminders',    functionName: 'sendRenewalReminders'   },
  ]);
}

// ─── writeDeal ────────────────────────────────────────────────────────────────
// A–U column layout:
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

  var borrower  = String(params.borrower || '').trim();
  if (!borrower) throw new Error('Missing required field: borrower');

  var dealType  = String(params.type     || '').trim();
  var source    = String(params.source   || '').trim();
  var lender    = String(params.lender   || '').trim();
  var closing   = String(params.closing  || '').trim();
  var notes     = String(params.notes    || '').trim();
  var email     = String(params.email    || '').trim();
  var phone     = String(params.phone    || '').trim();

  // Numeric fields — blank beats NaN so formulas can fill in later
  var amt       = parseFloat(params.amt)      || '';
  var term      = parseInt(params.term)        || '';
  var rateType  = String(params.rateType || '').trim();
  var rate      = parseFloat(params.rate)      || '';
  var bps       = parseInt(params.bps)         || '';
  var split     = parseFloat(params.split)     || '';
  var grossComm = parseFloat(params.grossComm);
  grossComm = (!isNaN(grossComm) && grossComm !== 0) ? grossComm : '';
  var yourComm  = parseFloat(params.yourComm);
  yourComm  = (!isNaN(yourComm)  && yourComm  !== 0) ? yourComm  : '';

  var totalsRow = findTotalsRow_(sheet);
  var insertRow = totalsRow === -1 ? sheet.getLastRow() + 1 : totalsRow;
  var dealNum   = insertRow - 3;

  sheet.insertRowBefore(insertRow);
  var r = String(insertRow);

  sheet.getRange(insertRow, 1, 1, 17).setValues([[
    dealNum, borrower, dealType, source, lender,
    closing, amt, term, rateType, rate,
    bps, split, '', '', notes,
    email, phone
  ]]);

  sheet.getRange(insertRow, 7 ).setNumberFormat('$#,##0.00');
  sheet.getRange(insertRow, 10).setNumberFormat('0.00"%"');
  sheet.getRange(insertRow, 11).setNumberFormat('0" bps"');
  sheet.getRange(insertRow, 12).setNumberFormat('0%');

  // M: Gross Comm — explicit value if provided, otherwise formula from Amount × BPS
  if (grossComm !== '' && grossComm !== 0) {
    sheet.getRange(insertRow, 13).setValue(grossComm);
  } else {
    sheet.getRange(insertRow, 13)
      .setFormula('=IF(G'+r+'="","",IFERROR(ROUND(G'+r+'*(K'+r+'/10000),2),0))');
  }
  sheet.getRange(insertRow, 13).setNumberFormat('$#,##0.00');

  // N: Your Comm — explicit value if provided, otherwise formula from Gross Comm × Split
  if (yourComm !== '' && yourComm !== 0) {
    sheet.getRange(insertRow, 14).setValue(yourComm);
  } else {
    sheet.getRange(insertRow, 14)
      .setFormula('=IF(M'+r+'="","",IFERROR(ROUND(M'+r+'*L'+r+',2),0))');
  }
  sheet.getRange(insertRow, 14).setNumberFormat('$#,##0.00');

  sheet.getRange(insertRow, 18)
    .setFormula('=IF(AND(F'+r+'<>"",H'+r+'<>""),DATE(YEAR(F'+r+')+H'+r+',MONTH(F'+r+'),DAY(F'+r+')),"")')
    .setNumberFormat('yyyy-mm-dd');

  sheet.getRange(insertRow, 19)
    .setFormula('=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 RENEW NOW",IF(R'+r+'-TODAY()<=120,"🟡 SOON","🟢 OK")))');


  // T: status value (NOT formula)
  var statusVal = computeInitialStatus_(closing);
  sheet.getRange(insertRow, 20)
    .setValue(statusVal)
    .setHorizontalAlignment('center').setFontFamily('Arial').setFontSize(10);
  applyStatusValidation_(sheet, insertRow);
  sheet.getRange(insertRow, 21).setNumberFormat('yyyy-mm-dd');

  // Match row formatting of rebuildFundedSheet_
  var rowBg = (insertRow - 4) % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
  sheet.getRange(insertRow, 1, 1, 21)
    .setFontFamily('Arial').setFontSize(10)
    .setBackground(rowBg).setVerticalAlignment('middle');
  sheet.getRange(insertRow, 1).setHorizontalAlignment('center').setFontColor('#999999');
  sheet.getRange(insertRow, 2).setFontWeight('bold');
  sheet.getRange(insertRow, 6).setNumberFormat('yyyy-mm-dd');
  sheet.setRowHeight(insertRow, 22);
  applyStatusCF_(sheet);
  fixTotalsAndRefs_(sheet);
  SpreadsheetApp.flush();
  checkNewDealRenewal_(sheet, insertRow);
  ss.toast('Deal added: ' + borrower + ' → ' + sheetName + ' row ' + insertRow);
}

// ─── addDealFromInbox ─────────────────────────────────────────────────────────

function addDealFromInbox() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var inbox = ss.getSheetByName('Inbox');
  if (!inbox) {
    ss.toast('No Inbox sheet found. Run "Setup Inbox Sheet" first.');
    return;
  }
  var lastRow = inbox.getLastRow();
  if (lastRow < 3) { ss.toast('Inbox has no deals to add (paste below row 2).'); return; }

  // Row 1 = headers, row 2 = hint text — data starts at row 3
  var data   = inbox.getRange(3, 1, lastRow - 2, 17).getValues();
  var added  = 0, errors = 0, errorMsgs = [];

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var borrower = String(row[0] || '').trim();
    var year     = String(row[1] || '').trim();
    if (!borrower && !year) continue; // blank row — skip silently
    if (!borrower || !year) {
      errorMsgs.push('Row '+(i+3)+': missing Borrower or Year');
      errors++;
      continue;
    }
    try {
      writeDeal({
        borrower:  borrower,  year:      year,
        type:      row[2],    source:    row[3],    lender:    row[4],
        closing:   row[5],    amt:       row[6],    term:      row[7],
        rateType:  row[8],    rate:      row[9],    bps:       row[10],
        split:     row[11],   grossComm: row[12],   yourComm:  row[13],
        notes:     row[14],   email:     row[15],   phone:     row[16],
      });
      added++;
    } catch (e) {
      errorMsgs.push('Row '+(i+3)+' ('+borrower+'): '+e.message);
      Logger.log('Inbox row '+(i+3)+' error: '+e.message);
      errors++;
    }
  }
  if (added > 0) inbox.getRange(3, 1, lastRow - 2, 17).clearContent();
  if (errorMsgs.length) Logger.log('Inbox errors:\n' + errorMsgs.join('\n'));
  ss.toast(
    added + ' deal(s) added' +
    (errors > 0 ? ', ' + errors + ' skipped — check View → Logs for details.' : '.')
  );
}

// ─── setupInbox ──────────────────────────────────────────────────────────────
// Creates (or resets) the Inbox sheet with the correct column headers.
// Paste one deal per row starting at row 2. Only Borrower and Year are required.
// Run "Add Deal from Inbox" when ready to push deals into the funded sheets.

function setupInbox() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY  = '#1B3A6B';
  var sheet = ss.getSheetByName('Inbox');
  if (!sheet) sheet = ss.insertSheet('Inbox');

  // Clear only header row; preserve any data rows the user already filled in
  sheet.getRange(1, 1, 1, 17).clearContent().clearFormat();

  var headers = [
    'Borrower*', 'Year*', 'Type', 'Source', 'Lender',
    'Closing Date', 'Loan Amount', 'Term (mo)', 'Rate Type', 'Rate (%)',
    'BPS', 'Split', 'Gross Comm', 'Your Comm', 'Notes',
    'Email', 'Phone'
  ];
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontFamily('Arial').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 30);

  // Column widths
  [160, 60, 110, 90, 110, 110, 110, 80, 90, 80, 60, 60, 110, 110, 130, 140, 110]
    .forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  sheet.setFrozenRows(1);

  // Note row below headers
  sheet.getRange(2, 1).setValue('← Paste deals here. * = required. Year must be 2025 or 2026.')
    .setFontStyle('italic').setFontColor('#999999').setFontSize(9);

  ss.toast('Inbox sheet ready. Paste deals starting at row 3.');
}

// ─── importCommissionReport ───────────────────────────────────────────────────
// One-shot import of 12 deals extracted from the May 2026 commission report.
// Columns not available in the report (Amount, Term, Rate, Lender) are left blank.
// Status is auto-assigned: ✅ Paid if Pay Date present, 🔄 Awaiting if closing past.

function importCommissionReport() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026 Funded');
  if (!sheet) { ss.toast('2026 Funded sheet not found.'); return; }

  // [borrower, type, source, closing, split, grossComm, yourComm, payDate]
  // Oldest first so chronological order is preserved in the sheet.
  var deals = [
    ['Andrea Campbell', 'Self-Sourced', 'Self',  '2026-01-15', 0.90,  2794.60,  2515.14, '2026-02-25'],
    ['Mike Shaw',       'Switch',       '',      '2026-01-19', 0.35,  3933.00,  1376.55, '2026-01-22'],
    ['Jennifer Barned', 'Switch',       '',      '2026-02-20', 0.35,  2445.52,   855.93, '2026-02-24'],
    ['Kevin Palma',     'Self-Sourced', 'Self',  '2026-02-24', 0.90,  1764.85,  1588.37, '2026-03-09'],
    ['Joe Morrow',      'Self-Sourced', 'Self',  '2026-02-27', 0.90, 11250.00, 10125.00, '2026-03-03'],
    ['Andrew McGuigan', 'Refinance',    '',      '2026-03-05', 0.35,  3455.86,  1209.55, '2026-04-13'],
    ['Roger Bachelor',  'Self-Sourced', 'Self',  '2026-03-16', 0.90,  2920.00,  2628.00, '2026-03-25'],
    ['Phillip Wolfe',   'Purchase',     '',      '2026-03-16', 0.40,  2227.50,   891.00, '2026-03-30'],
    ['Doug Oldenburg',  'Refinance',    '',      '2026-03-16', 0.35,  4410.00,  1543.50, '2026-04-01'],
    ['Megan Mlynczak',  'Purchase',     '',      '2026-03-31', 0.35,  5321.26,  1862.44, '2026-04-08'],
    ['Greg Mason',      'Refinance',    '',      '2026-04-21', 0.35,  5113.50,  1789.73, '2026-04-28'],
    ['Sylvia Murray',   'Self-Sourced', 'Self',  '2026-04-30', 0.90,  5617.50,  5055.75, ''],
  ];

  var today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Build a set of existing (borrower + closing) keys to skip duplicates.
  var lastRow  = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 4) {
    var existingData = sheet.getRange(4, 2, lastRow - 3, 5).getValues(); // cols B–F
    existingData.forEach(function(row) {
      var name = String(row[0] || '').trim().toLowerCase();
      var cl   = row[4]; // col F (index 4 within B–F)
      if (!name) return;
      var clStr = cl instanceof Date
        ? Utilities.formatDate(cl, 'UTC', 'yyyy-MM-dd')
        : String(cl || '').trim();
      existing[name + '|' + clStr] = true;
    });
  }

  var added   = 0;
  var skipped = 0;

  deals.forEach(function(d) {
    var borrower  = d[0];
    var dealType  = d[1];
    var source    = d[2];
    var closing   = d[3];
    var split     = d[4];
    var grossComm = d[5];
    var yourComm  = d[6];
    var payDate   = d[7];

    // Skip if this borrower + closing date combo already exists in the sheet.
    var key = borrower.trim().toLowerCase() + '|' + closing;
    if (existing[key]) { skipped++; return; }

    var totalsRow = findTotalsRow_(sheet);
    var insertRow = totalsRow === -1 ? sheet.getLastRow() + 1 : totalsRow;
    var dealNum   = insertRow - 3;
    sheet.insertRowBefore(insertRow);
    var r = String(insertRow);

    // Cols A–Q (17 cols). Amount, Term, Rate, BPS, Lender left blank.
    var closingDate = parseDateVal_(closing);
    sheet.getRange(insertRow, 1, 1, 17).setValues([[
      dealNum, borrower, dealType, source, '',
      closingDate, '', '', '', '',
      '', split, grossComm, yourComm, '',
      '', ''
    ]]);

    sheet.getRange(insertRow, 6).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(insertRow, 12).setNumberFormat('0%');
    sheet.getRange(insertRow, 13).setNumberFormat('$#,##0.00');
    sheet.getRange(insertRow, 14).setNumberFormat('$#,##0.00');

    // R: Maturity Date
    sheet.getRange(insertRow, 18)
      .setFormula(
        '=IF(OR(F'+r+'="",H'+r+'=""),"",EDATE(' +
          'IFERROR(DATEVALUE(IF(ISNUMBER(F'+r+'),TEXT(F'+r+',"yyyy-mm-dd"),F'+r+')),F'+r+'),' +
          'H'+r+'))'
      )
      .setNumberFormat('yyyy-mm-dd');

    // S: Renewal Alert
    sheet.getRange(insertRow, 19)
      .setFormula(
        '=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 URGENT",' +
          'IF(R'+r+'-TODAY()<=90,"🟡 SOON","🟢 OK")))'
      );

    // T: Status — Paid if pay date recorded, else date-based
    var status;
    if (payDate) {
      status = STATUS_PAID;
    } else {
      var parts = closing.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var closingDate = parts
        ? new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]))
        : new Date(closing);
      status = closingDate <= today ? STATUS_AWAITING : STATUS_PENDING;
    }
    sheet.getRange(insertRow, 20)
      .setValue(status)
      .setHorizontalAlignment('center')
      .setFontFamily('Arial').setFontSize(10);
    applyStatusValidation_(sheet, insertRow);

    // U: Pay Date
    if (payDate) sheet.getRange(insertRow, 21).setValue(parseDateVal_(payDate));
    sheet.getRange(insertRow, 21).setNumberFormat('yyyy-mm-dd');

    sheet.getRange(insertRow, 1, 1, 21).setFontFamily('Arial').setFontSize(10);
    added++;
  });

  applyStatusCF_(sheet);
  fixTotalsAndRefs_(sheet);
  SpreadsheetApp.flush();
  ss.toast(added + ' deal(s) imported' + (skipped > 0 ? ', ' + skipped + ' skipped (already in sheet).' : '.') +
    (added > 0 ? ' Run "Rebuild Month vs Month" to update the dashboard.' : ''));
}

// ─── fixAllTotalsAndRefs ──────────────────────────────────────────────────────

function fixAllTotalsAndRefs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) fixTotalsAndRefs_(sheet);
  });
  ss.toast('Totals & references fixed.');
}

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

function findTotalsRow_(sheet) {
  var data = sheet.getRange('A1:A' + Math.min(sheet.getLastRow(), 200)).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').toUpperCase().indexOf('TOTAL') !== -1) return i + 1;
  }
  return -1;
}

// ─── runDiagnostic ────────────────────────────────────────────────────────────
// Logs the raw content of every data row in 2026 Funded.
// Open View → Logs to inspect results.

function runDiagnostic() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026 Funded');
  if (!sheet) { ss.toast('2026 Funded not found.'); return; }

  var totalsRow   = findTotalsRow_(sheet);
  var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
  Logger.log('=== 2026 Funded audit ===');
  Logger.log('Data rows 4–' + lastDataRow + ' | TOTALS row: ' + totalsRow);

  if (lastDataRow < 4) { Logger.log('No data rows.'); return; }

  var data = sheet.getRange(4, 1, lastDataRow - 3, 21).getValues();
  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var borrower = String(row[1] || '').trim();
    if (!borrower) continue;
    var closing  = row[5];
    var yourComm = row[13];
    var tRaw     = row[19];
    var uRaw     = row[20];
    Logger.log(
      'Row '+(i+4)+': ['+borrower+']' +
      '  F='+JSON.stringify(closing)+'('+typeof closing+')' +
      '  N='+JSON.stringify(yourComm)+'('+typeof yourComm+')' +
      '  T=['+tRaw+'] len='+String(tRaw).length +
      '  U='+JSON.stringify(uRaw)
    );
  }

  // Check if DATEVALUE formula works on a sample closing date
  var sampleF = sheet.getRange(4, 6).getValue();
  Logger.log('Sample F4 value: '+JSON.stringify(sampleF)+' type: '+typeof sampleF);
  Logger.log('Expected STATUS_PENDING="'+STATUS_PENDING+'" len='+STATUS_PENDING.length);
  Logger.log('Expected STATUS_AWAITING="'+STATUS_AWAITING+'" len='+STATUS_AWAITING.length);
  Logger.log('Expected STATUS_PAID="'+STATUS_PAID+'" len='+STATUS_PAID.length);

  // Check MvM May row
  var mvm = ss.getSheetByName('Month vs Month');
  if (mvm) {
    Logger.log('=== MvM May row (row 9) ===');
    for (var c = 3; c <= 16; c++) {
      var cell = mvm.getRange(9, c);
      Logger.log('  col '+c+' formula=['+cell.getFormula()+'] value='+cell.getValue());
    }
  }
  ss.toast('Diagnostic done — View → Logs');
}

// ─── fixStatusColumn (public) ─────────────────────────────────────────────────
// Sets col T status values for all rows based on closing date vs TODAY()
// and Pay Date in col U. Clears any old formula first.
// Run this once to initialise col T on existing deals.

function fixStatusColumn() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var log  = getReminderLog_(ss);
  var NAVY = '#1B3A6B';
  var totalFixed = 0;

  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    sheet.getRange(2, 20).setValue('Status')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center').setBackground(NAVY).setFontColor('#FFFFFF');
    sheet.getRange(2, 21).setValue('Pay Date')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center').setBackground(NAVY).setFontColor('#FFFFFF');

    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;

    var numRows = lastDataRow - 3;
    var data    = sheet.getRange(4, 1, numRows, 21).getValues();
    var newStatuses = [];
    var fixed = 0;

    for (var i = 0; i < data.length; i++) {
      var row      = data[i];
      var borrower = String(row[1]  || '').trim();
      var closingV = row[5];   // F
      var tRaw     = row[19];  // T
      var uVal     = row[20];  // U (Pay Date)

      var tCell      = sheet.getRange(i + 4, 20);
      var hasFormula = tCell.getFormula() !== '';
      var tVal       = String(tRaw || '').trim();
      var hasPayDate = uVal && String(uVal).trim() !== '' && uVal !== 0;

      var correctStatus;
      if (hasPayDate) {
        correctStatus = STATUS_PAID;
      } else if (tVal === STATUS_PAID && !hasFormula) {
        correctStatus = STATUS_PAID; // honour manually-set Paid
      } else {
        correctStatus = computeInitialStatus_(closingV);
      }

      if (!borrower) { newStatuses.push([tVal || '']); continue; }

      if (hasFormula || tVal !== correctStatus) {
        log.appendRow([new Date(), sheetName, borrower,
          hasFormula ? '(formula)' : (tVal || '(blank)'), correctStatus, 'fixStatusColumn']);
        fixed++;
      }
      newStatuses.push([correctStatus]);
    }

    // Batch-clear formulas and write values
    sheet.getRange(4, 20, numRows, 1).clearContent();
    sheet.getRange(4, 20, numRows, 1)
      .setValues(newStatuses)
      .setHorizontalAlignment('center').setFontFamily('Arial').setFontSize(10);

    var valRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
      .setAllowInvalid(false).build();
    sheet.getRange(4, 20, numRows, 1).setDataValidation(valRule);
    sheet.getRange(4, 21, numRows, 1).setNumberFormat('yyyy-mm-dd');

    applyStatusCF_(sheet);
    SpreadsheetApp.flush();
    totalFixed += fixed;
    Logger.log('fixStatusColumn: '+sheetName+' → '+fixed+' change(s)');
  });

  SpreadsheetApp.getActiveSpreadsheet().toast('Status column fixed — '+totalFixed+' update(s).');
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function computeInitialStatus_(closingDateValue) {
  if (!closingDateValue) return STATUS_PENDING;
  var closing;
  if (closingDateValue instanceof Date) {
    closing = new Date(closingDateValue.getFullYear(),
                       closingDateValue.getMonth(),
                       closingDateValue.getDate());
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

function applyStatusValidation_(sheet, row) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
    .setAllowInvalid(false).build();
  sheet.getRange(row, 20).setDataValidation(rule);
}

function applyStatusCF_(sheet) {
  var totalsRow   = findTotalsRow_(sheet);
  var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
  var numRows     = Math.max(1, lastDataRow - 3);
  var colTRange   = sheet.getRange(4, 20, numRows, 1);
  var newRules = [
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
  var existing = sheet.getConditionalFormatRules().filter(function(rule) {
    return rule.getRanges().every(function(rng) { return rng.getColumn() !== 20; });
  });
  sheet.setConditionalFormatRules(existing.concat(newRules));
}

// ─── setupProjectedIncome_ (private) ─────────────────────────────────────────

function setupProjectedIncome_(ss, sheetName, rowNum) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var tCell      = sheet.getRange(rowNum, 20);
  var hasFormula = tCell.getFormula() !== '';
  var currentVal = String(tCell.getValue() || '').trim();
  if (hasFormula || !currentVal) {
    var closingVal = sheet.getRange(rowNum, 6).getValue();
    var uVal       = sheet.getRange(rowNum, 21).getValue();
    var hasPayDate = uVal && String(uVal).trim() !== '' && uVal !== 0;
    tCell.clearContent()
      .setValue(hasPayDate ? STATUS_PAID : computeInitialStatus_(closingVal))
      .setHorizontalAlignment('center').setFontFamily('Arial').setFontSize(10);
  }
  applyStatusValidation_(sheet, rowNum);
  sheet.getRange(rowNum, 21).setNumberFormat('yyyy-mm-dd');
}

function setupStatusColumn_(ss) { fixStatusColumn(); }

function setupProjectedIncome() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  fixStatusColumn();
  setupMonthVsMonth();
  ss.toast('Projected Income setup complete.');
}

// ─── refreshDealStatuses (public) ────────────────────────────────────────────

function refreshDealStatuses() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var log     = getReminderLog_(ss);
  var changed = 0;

  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;

    var data = sheet.getRange(4, 1, lastDataRow - 3, 21).getValues();
    for (var i = 0; i < data.length; i++) {
      var row      = data[i];
      var borrower = String(row[1]  || '').trim();
      var closingV = row[5];
      var currentT = String(row[19] || '').trim();
      var uVal     = row[20];
      if (!borrower || currentT === STATUS_PAID || currentT !== STATUS_PENDING) continue;
      var hasPayDate = uVal && String(uVal).trim() !== '' && uVal !== 0;
      if (hasPayDate || computeInitialStatus_(closingV) !== STATUS_AWAITING) continue;
      sheet.getRange(i + 4, 20).setValue(STATUS_AWAITING);
      log.appendRow([new Date(), sheetName, borrower, STATUS_PENDING, STATUS_AWAITING, 'Auto-flipped']);
      changed++;
    }
  });

  SpreadsheetApp.flush();
  SpreadsheetApp.getActiveSpreadsheet().toast(changed + ' deal(s) updated to ' + STATUS_AWAITING + '.');
}

function getReminderLog_(ss) {
  var log = ss.getSheetByName('Reminder Log');
  if (!log) {
    log = ss.insertSheet('Reminder Log');
    log.getRange(1, 1, 1, 6)
      .setValues([['Timestamp','Sheet','Borrower','Old Status','New Status','Note']])
      .setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
  }
  return log;
}

// ─── Renewal system ───────────────────────────────────────────────────────────

function createRenewalTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendRenewalReminders')
      ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('sendRenewalReminders')
    .timeBased().atHour(8).everyDays(1).inTimezone('America/Toronto').create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Renewal trigger created — 8 am Toronto daily.');
}

function sendRenewalReminders() {
  refreshDealStatuses();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var urgent = [], soon = [];
  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var totalsRow = findTotalsRow_(sheet);
    var lastRow   = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastRow < 4) return;
    var data = sheet.getRange(4, 1, lastRow - 3, 19).getValues();
    data.forEach(function(row) {
      var borrower = String(row[1]  || '').trim();
      var alert    = String(row[18] || '').trim();
      if (!borrower) return;
      if (alert.indexOf('🔴') !== -1) urgent.push(borrower + ' (' + name + ')');
      else if (alert.indexOf('🟡') !== -1) soon.push(borrower + ' (' + name + ')');
    });
  });
  if (!urgent.length && !soon.length) return;
  var body = 'JM Mortgages — Renewal Reminders\n' + new Date().toDateString() + '\n\n';
  if (urgent.length) { body += '🔴 URGENT:\n'; urgent.forEach(function(d) { body += '  • '+d+'\n'; }); body += '\n'; }
  if (soon.length)   { body += '🟡 COMING UP:\n'; soon.forEach(function(d) { body += '  • '+d+'\n'; }); }
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'JM Mortgages — Renewal Reminders', body);
}

function checkNewDealRenewal_(sheet, row) {
  var alert    = String(sheet.getRange(row, 19).getValue() || '');
  var borrower = String(sheet.getRange(row,  2).getValue() || '');
  if (alert.indexOf('🔴') === -1 && alert.indexOf('🟡') === -1) return;
  try {
    MailApp.sendEmail(Session.getActiveUser().getEmail(),
      'New Deal Alert — ' + borrower, borrower + ' renewal status: ' + alert);
  } catch(e) { Logger.log('checkNewDealRenewal_ email failed: ' + e.message); }
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
//
// DESIGN: Awaiting and Pending categories are driven by CLOSING DATE vs TODAY(),
// NOT by the status column. This means formulas show correct data the moment
// deals are in the sheet, regardless of whether fixStatusColumn() has been run.
//
//   Awaiting = closing date <= TODAY()  AND  col T ≠ "✅ Paid"
//   Pending  = closing date >  TODAY()  AND  col T ≠ "✅ Paid"
//   Paid     = col T = "✅ Paid"  (always manual)
//
// IFERROR wraps the status comparison so broken/empty T cells are treated as
// not-Paid (they'll appear in Awaiting/Pending, not silently dropped).
//
// All formulas cap ranges at row 100 (covers 97 data rows = plenty).

function dExpr_(sheetName, colF) {
  var ref = "'"+sheetName+"'!"+colF+"$4:"+colF+"$100";
  // Numeric dates (serials): use directly — avoids locale-sensitive TEXT/DATEVALUE round-trip.
  // Text dates (fallback): attempt DATEVALUE; IFERROR → 0 so empty/bad cells don't count.
  return 'IF(ISNUMBER('+ref+'),'+ref+',IFERROR(DATEVALUE('+ref+'),0))';
}

function isPaid_(sheetName) {
  var tRef = "'"+sheetName+"'!T$4:T$100";
  return '(IFERROR(TRIM('+tRef+')="'+STATUS_PAID+'",0))';
}

function notPaid_(sheetName) {
  var tRef = "'"+sheetName+"'!T$4:T$100";
  return '(1-IFERROR(TRIM('+tRef+')="'+STATUS_PAID+'",0))';
}

function mvs2025Count_(mo, status) {
  var d     = dExpr_('2025 Funded', 'F');
  var start = 'DATE(2025,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var inMo  = '('+d+'>='+start+')*('+d+'<'+end+')';
  if (status === STATUS_PAID) return '=SUMPRODUCT('+inMo+'*'+isPaid_('2025 Funded')+')';
  if (status === STATUS_AWAITING) return '=SUMPRODUCT('+inMo+'*('+d+'<=TODAY())*'+notPaid_('2025 Funded')+')';
  if (status === STATUS_PENDING)  return '=SUMPRODUCT('+inMo+'*('+d+'>TODAY())*'+notPaid_('2025 Funded')+')';
  return '=SUMPRODUCT('+inMo+')';
}

function mvs2025Sum_(mo, col, status) {
  var d     = dExpr_('2025 Funded', 'F');
  var cL    = columnLetter_(col);
  var vRef  = "'2025 Funded'!"+cL+"$4:"+cL+"$100";
  var vals  = 'IFERROR(VALUE('+vRef+'),0)';
  var start = 'DATE(2025,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var inMo  = '('+d+'>='+start+')*('+d+'<'+end+')';
  if (status === STATUS_PAID) return '=SUMPRODUCT('+inMo+'*'+isPaid_('2025 Funded')+'*'+vals+')';
  if (status === STATUS_AWAITING) return '=SUMPRODUCT('+inMo+'*('+d+'<=TODAY())*'+notPaid_('2025 Funded')+'*'+vals+')';
  if (status === STATUS_PENDING)  return '=SUMPRODUCT('+inMo+'*('+d+'>TODAY())*'+notPaid_('2025 Funded')+'*'+vals+')';
  return '=SUMPRODUCT('+inMo+'*'+vals+')';
}

function mvs2026Count_(mo, status) {
  var d     = dExpr_('2026 Funded', 'F');
  var start = 'DATE(2026,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var inMo  = '('+d+'>='+start+')*('+d+'<'+end+')';
  if (status === STATUS_PAID) return '=SUMPRODUCT('+inMo+'*'+isPaid_('2026 Funded')+')';
  if (status === STATUS_AWAITING) return '=SUMPRODUCT('+inMo+'*('+d+'<=TODAY())*'+notPaid_('2026 Funded')+')';
  if (status === STATUS_PENDING)  return '=SUMPRODUCT('+inMo+'*('+d+'>TODAY())*'+notPaid_('2026 Funded')+')';
  return '=SUMPRODUCT('+inMo+')';
}

function mvs2026Sum_(mo, col, status) {
  var d     = dExpr_('2026 Funded', 'F');
  var cL    = columnLetter_(col);
  var vRef  = "'2026 Funded'!"+cL+"$4:"+cL+"$100";
  var vals  = 'IFERROR(VALUE('+vRef+'),0)';
  var start = 'DATE(2026,'+mo+',1)';
  var end   = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var inMo  = '('+d+'>='+start+')*('+d+'<'+end+')';
  if (status === STATUS_PAID) return '=SUMPRODUCT('+inMo+'*'+isPaid_('2026 Funded')+'*'+vals+')';
  if (status === STATUS_AWAITING) return '=SUMPRODUCT('+inMo+'*('+d+'<=TODAY())*'+notPaid_('2026 Funded')+'*'+vals+')';
  if (status === STATUS_PENDING)  return '=SUMPRODUCT('+inMo+'*('+d+'>TODAY())*'+notPaid_('2026 Funded')+'*'+vals+')';
  return '=SUMPRODUCT('+inMo+'*'+vals+')';
}

// ─── setupMvMSummaryBlock_ ────────────────────────────────────────────────────
// Dashboard rows 19 (header) + 20–31 (data).
// Labels: cols B–F (2–6). Values: cols G–P (7–16). Value references = col G.
//
// Summary rows use the same date-based logic as the monthly formulas:
//   Awaiting = any 2026 deal where closing <= TODAY() AND not Paid
//   Pending  = any 2026 deal where closing >  TODAY() AND not Paid

function setupMvMSummaryBlock_(sheet, NAVY, GOLD) {
  var NC = 15; // total table cols B–P

  var d26 = dExpr_('2026 Funded', 'F');
  var ip  = isPaid_('2026 Funded');
  var np  = notPaid_('2026 Funded');
  var gV  = 'IFERROR(VALUE(\'2026 Funded\'!G$4:G$100),0)';
  var nV  = 'IFERROR(VALUE(\'2026 Funded\'!N$4:N$100),0)';
  var n25 = 'IFERROR(VALUE(\'2025 Funded\'!N$4:N$100),0)';

  // "is a 2026 deal" guard
  var is26 = '(('+d26+'>=DATE(2026,1,1))*('+d26+'<DATE(2027,1,1)))';
  var awCond = is26+'*('+d26+'<=TODAY())*'+np;
  var peCond = is26+'*('+d26+'>TODAY())*'+np;
  var pdCond = is26+'*'+ip;

  // Row 19: header
  sheet.getRange(19, 2, 1, NC).clearContent().clearFormat();
  sheet.getRange(19, 2, 1, NC).merge()
    .setValue('📊 2026 PERFORMANCE DASHBOARD')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(13).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(19, 38);

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
    '2025 Full Year Comm (all deals)',
    'YTD Pace vs 2025  (Paid comm only)',
  ];
  var formats = [
    '0','$#,##0.00','$#,##0.00',
    '0','$#,##0.00','$#,##0.00',
    '0','$#,##0.00','$#,##0.00',
    '$#,##0.00','$#,##0.00','0.0%',
  ];
  // Rows 20–31: i=0→row20, i=2→row22(Paid comm/G22),
  //             i=5→row25(Await comm/G25), i=8→row28(Pend comm/G28)
  var formulas = [
    '=SUMPRODUCT('+pdCond+')',
    '=SUMPRODUCT('+pdCond+'*'+gV+')',
    '=SUMPRODUCT('+pdCond+'*'+nV+')',       // G22
    '=SUMPRODUCT('+awCond+')',
    '=SUMPRODUCT('+awCond+'*'+gV+')',
    '=SUMPRODUCT('+awCond+'*'+nV+')',       // G25
    '=SUMPRODUCT('+peCond+')',
    '=SUMPRODUCT('+peCond+'*'+gV+')',
    '=SUMPRODUCT('+peCond+'*'+nV+')',       // G28
    '=G22+G25+G28',                         // G29 Combined
    '=SUMPRODUCT('+n25+')',                 // G30 2025 FY
    '=IF(G30=0,"—",G22/G30)',              // G31 YTD Pace
  ];

  var cfRules = [];
  for (var i = 0; i < labels.length; i++) {
    var r  = 20 + i;
    var bg = '#FFFFFF';
    if (i < 3)           bg = '#F0FFF0'; // Paid: green tint
    else if (i < 6)      bg = '#FFFDE7'; // Awaiting: yellow tint
    else if (i < 9)      bg = '#E8F4FD'; // Pending: blue tint
    else if (i === 9)    bg = '#F5F5F5'; // Combined
    else if (i === 11)   bg = '#F0F0F0'; // YTD Pace

    sheet.getRange(r, 2, 1, NC).clearContent().clearFormat();
    sheet.setRowHeight(r, 26);

    sheet.getRange(r, 2, 1, 5).merge()
      .setValue(labels[i]).setBackground(bg)
      .setFontFamily('Arial').setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    var vc = sheet.getRange(r, 7, 1, 10).merge();
    vc.setBackground(bg).setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFormula(formulas[i]).setNumberFormat(formats[i]);

    if (i === 11) { // YTD Pace CF
      var pr = sheet.getRange(r, 7);
      cfRules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThanOrEqualTo(1).setBackground('#C6EFCE').setFontColor('#276221')
        .setRanges([pr]).build());
      cfRules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(1).setBackground('#FFCCCC').setFontColor('#9C0006')
        .setRanges([pr]).build());
    }
  }
  return cfRules;
}

// ─── setupMonthVsMonth (public) ──────────────────────────────────────────────
// Column layout B–P (cols 2–16):
//   B   Month
//   C–E 2025 ✅ Paid (# / Vol / Comm)
//   F–H 2026 ✅ Paid (# / Vol / Comm)
//   I–K 2026 🔄 Awaiting (# / Vol / Comm)  ← date-based: closing ≤ today, not paid
//   L–N 2026 ⏳ Pending (# / Vol / Comm)   ← date-based: closing > today, not paid
//   O   Total 2026 Comm
//   P   Δ vs 2025
//
// Row layout:
//   1  Title    2  Subtitle    3  Group headers    4  Sub-headers
//   5–16  Jan–Dec data         17  TOTALS           18  Spacer
//   19  Dashboard header       20–31  Summary rows

function setupMonthVsMonth() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY  = '#1B3A6B';
  var GOLD  = '#C9A84C';
  var LGOLD = '#FFF8E7';

  var sheet = ss.getSheetByName('Month vs Month');
  if (!sheet) sheet = ss.insertSheet('Month vs Month');
  sheet.clear();

  var NC = 15; // B through P

  var widths = [25, 115, 65, 95, 105, 65, 95, 105, 68, 95, 105, 68, 95, 105, 115, 88];
  for (var w = 0; w < widths.length; w++) sheet.setColumnWidth(w + 1, widths[w]);

  // Row 1: Title
  sheet.getRange(1, 2, 1, NC).merge()
    .setValue('JM MORTGAGES — MONTH vs MONTH + PIPELINE')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(16).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // Row 2: Subtitle
  sheet.getRange(2, 2, 1, NC).merge()
    .setValue('Live data  •  ✅ Paid | 🔄 Awaiting | ⏳ Pending  •  Today: ' +
      Utilities.formatDate(new Date(), 'America/Toronto', 'MMMM d, yyyy'))
    .setBackground(LGOLD).setFontColor(GOLD).setFontStyle('italic')
    .setFontSize(10).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 28);

  // Row 3: Group headers
  var groups = [
    { col:2,  span:1, label:'Month',            bg:NAVY      },
    { col:3,  span:3, label:'2025  ✅ Paid',     bg:'#276221' },
    { col:6,  span:3, label:'2026  ✅ Paid',     bg:'#276221' },
    { col:9,  span:3, label:'2026  🔄 Awaiting', bg:'#9C6500' },
    { col:12, span:3, label:'2026  ⏳ Pending',  bg:'#1F4E79' },
    { col:15, span:1, label:'Total 2026',        bg:NAVY      },
    { col:16, span:1, label:'Δ vs 2025',         bg:NAVY      },
  ];
  groups.forEach(function(g) {
    var rng = g.span > 1 ? sheet.getRange(3, g.col, 1, g.span).merge() : sheet.getRange(3, g.col);
    rng.setValue(g.label).setBackground(g.bg).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.setRowHeight(3, 30);

  // Row 4: Sub-headers
  var subH = ['Month','#','Volume','Comm','#','Volume','Comm','#','Volume','Comm','#','Volume','Comm','Comm','Δ vs 2025'];
  for (var sh = 0; sh < subH.length; sh++) {
    sheet.getRange(4, 2 + sh).setValue(subH[sh])
      .setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(8).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  sheet.setRowHeight(4, 26);

  // Rows 5–16: Monthly data
  for (var mo = 1; mo <= 12; mo++) {
    var r  = mo + 4;
    var bg = mo % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
    sheet.setRowHeight(r, 22);
    sheet.getRange(r, 2, 1, NC).setBackground(bg).setFontFamily('Arial').setFontSize(9);

    sheet.getRange(r, 2).setValue(MONTHS_[mo-1]).setFontWeight('bold').setHorizontalAlignment('left');

    // C–E: 2025 Paid
    sheet.getRange(r, 3).setFormula(mvs2025Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    sheet.getRange(r, 4).setFormula(mvs2025Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    sheet.getRange(r, 5).setFormula(mvs2025Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // F–H: 2026 Paid
    sheet.getRange(r, 6).setFormula(mvs2026Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    sheet.getRange(r, 7).setFormula(mvs2026Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    sheet.getRange(r, 8).setFormula(mvs2026Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // I–K: 2026 Awaiting (date-based)
    sheet.getRange(r, 9).setFormula(mvs2026Count_(mo, STATUS_AWAITING)).setHorizontalAlignment('center');
    sheet.getRange(r, 10).setFormula(mvs2026Sum_(mo, 7, STATUS_AWAITING)).setNumberFormat('$#,##0');
    sheet.getRange(r, 11).setFormula(mvs2026Sum_(mo, 14, STATUS_AWAITING)).setNumberFormat('$#,##0.00');

    // L–N: 2026 Pending (date-based)
    sheet.getRange(r, 12).setFormula(mvs2026Count_(mo, STATUS_PENDING)).setHorizontalAlignment('center');
    sheet.getRange(r, 13).setFormula(mvs2026Sum_(mo, 7, STATUS_PENDING)).setNumberFormat('$#,##0');
    sheet.getRange(r, 14).setFormula(mvs2026Sum_(mo, 14, STATUS_PENDING)).setNumberFormat('$#,##0.00');

    // O: Total 2026 Comm
    sheet.getRange(r, 15).setFormula('=IFERROR(H'+r+'+K'+r+'+N'+r+',0)').setNumberFormat('$#,##0.00').setFontWeight('bold');

    // P: Δ vs 2025
    sheet.getRange(r, 16).setFormula('=IFERROR(IF(E'+r+'=0,"—",O'+r+'-E'+r+'),"—")').setNumberFormat('$#,##0.00');
  }

  // Row 17: TOTALS
  sheet.setRowHeight(17, 28);
  sheet.getRange(17, 2, 1, NC).setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontFamily('Arial').setFontSize(9);
  sheet.getRange(17, 2).setValue('TOTALS').setHorizontalAlignment('center');
  var totCols = [3,4,5,6,7,8,9,10,11,12,13,14,15];
  var totFmts = ['0','$#,##0','$#,##0.00','0','$#,##0','$#,##0.00','0','$#,##0','$#,##0.00','0','$#,##0','$#,##0.00','$#,##0.00'];
  var totLets = ['C','D','E','F','G','H','I','J','K','L','M','N','O'];
  for (var t = 0; t < totLets.length; t++) {
    var tc = sheet.getRange(17, totCols[t]);
    tc.setFormula('=SUM('+totLets[t]+'5:'+totLets[t]+'16)').setNumberFormat(totFmts[t]);
    if (totCols[t] === 3 || totCols[t] === 6 || totCols[t] === 9 || totCols[t] === 12)
      tc.setHorizontalAlignment('center');
  }
  sheet.getRange(17, 16)
    .setFormula('=IF(SUM(E5:E16)=0,"—",SUM(O5:O16)-SUM(E5:E16))')
    .setNumberFormat('$#,##0.00');

  // Row 18: spacer
  sheet.setRowHeight(18, 16);

  // Rows 19–31: Dashboard
  var cfRules = setupMvMSummaryBlock_(sheet, NAVY, GOLD);

  // CF: Δ vs 2025 column (P=16, rows 5–16)
  var vsRange = sheet.getRange(5, 16, 12, 1);
  cfRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground('#C6EFCE').setFontColor('#276221')
    .setRanges([vsRange]).build());
  cfRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0).setBackground('#FFCCCC').setFontColor('#9C0006')
    .setRanges([vsRange]).build());

  sheet.setConditionalFormatRules(cfRules);
  SpreadsheetApp.flush();
  ss.toast('Month vs Month rebuilt. May row should now show 2026 Awaiting + Pending deals.');
}

// ─── overhaulSheet (public) ───────────────────────────────────────────────────
// Full clean rebuild of both funded sheets:
//   • Deduplicates rows by borrower + closing date (keeps most-complete version)
//   • Sorts chronologically by closing date
//   • Clears and re-writes headers, data, and TOTALS cleanly
//   • Applies professional formatting, column widths, freeze panes
//   • Hides Email / Phone columns (clutter-free daily view)
//   • Rebuilds Month vs Month dashboard

function overhaulSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  rebuildFundedSheet_(ss, '2025 Funded');
  rebuildFundedSheet_(ss, '2026 Funded');
  setupMonthVsMonth();
  rebuildYearOverYear_(ss);
  ss.toast('Overhaul complete — duplicates removed, all sheets rebuilt cleanly.');
}

// ─── rebuildYearOverYear (public) ────────────────────────────────────────────
function rebuildYearOverYear() {
  rebuildYearOverYear_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getActiveSpreadsheet().toast('Year Over Year tab rebuilt.');
}

// ─── rebuildYearOverYear_ ─────────────────────────────────────────────────────
// Finds (or creates) the Year Over Year comparison tab and rebuilds it with
// SUMIF/COUNTIF formulas pointing at the canonical column positions in the
// funded sheets (col G = Amount, col M = Gross Comm, col N = Net Comm,
// col T = Status, col C = Type, col L = Split).
function rebuildYearOverYear_(ss) {
  var NAVY  = '#1B3A6B';
  var GOLD  = '#C9A84C';
  var LGOLD = '#FFF8E7';

  // Find the YoY tab: first by tab name, then by scanning every sheet's title cell.
  // This handles cases where the tab has an unexpected name.
  var sheet = null;
  var TARGET_NAME = 'Year Over Year';
  ss.getSheets().forEach(function(s) {
    if (sheet) return;
    var n = s.getName().toLowerCase();
    if (n === 'year over year' || n === 'yoy' || n === 'year-over-year') { sheet = s; return; }
    if ((n.indexOf('year') > -1 || n.indexOf('yoy') > -1 || n.indexOf('comparison') > -1)
        && n.indexOf('funded') === -1) { sheet = s; return; }
    // Fallback: check if any cell in row 1 contains "YEAR OVER YEAR"
    try {
      var row1 = s.getRange(1, 1, 1, s.getLastColumn() || 1).getDisplayValues()[0].join('');
      if (row1.toUpperCase().indexOf('YEAR OVER YEAR') > -1) { sheet = s; }
    } catch(e) {}
  });
  if (!sheet) sheet = ss.insertSheet(TARGET_NAME);
  // Ensure the tab is named consistently so it can be found reliably next time.
  if (sheet.getName() !== TARGET_NAME) sheet.setName(TARGET_NAME);
  sheet.clear();

  var NC = 6; // cols B–G (2–7)
  [24, 200, 110, 120, 110, 100, 115].forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Row 1: title
  sheet.getRange(1, 2, 1, NC).merge()
    .setValue('JM MORTGAGES — YEAR OVER YEAR COMPARISON')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(15).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);

  // Row 2: gold accent
  sheet.getRange(2, 2, 1, NC).setBackground(GOLD);
  sheet.setRowHeight(2, 3);

  // ── Metrics table ──────────────────────────────────────────────────────────
  ['METRIC','2025 ACTUAL','2026 YTD ACTUAL','$ / # CHANGE','% CHANGE','ON PACE (full yr)']
    .forEach(function(h, i) {
      sheet.getRange(3, 2 + i)
        .setValue(h)
        .setBackground(i === 5 ? GOLD : '#2C5F9E').setFontColor('#FFFFFF')
        .setFontWeight('bold').setFontSize(10).setFontFamily('Arial')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    });
  sheet.setRowHeight(3, 28);

  var paid = '"' + STATUS_PAID + '"';
  var t25  = "'2025 Funded'!T$4:T$100";
  var t26  = "'2026 Funded'!T$4:T$100";
  var g25  = "'2025 Funded'!G$4:G$100";
  var g26  = "'2026 Funded'!G$4:G$100";
  var m25  = "'2025 Funded'!M$4:M$100";
  var m26  = "'2026 Funded'!M$4:M$100";
  var n25  = "'2025 Funded'!N$4:N$100";
  var n26  = "'2026 Funded'!N$4:N$100";
  // months elapsed in 2026 (e.g. Apr 21 → 3.7)
  var pf   = '12/MAX(1,MONTH(TODAY())-1+DAY(TODAY())/DAY(EOMONTH(TODAY(),0)))';

  // Each entry: [label, f25, f26, fDelta, fPct, fPace, fmtVal, fmtPace]
  var mRows = [
    ['Funded deals',
     '=IFERROR(COUNTIF('+t25+','+paid+'),0)',
     '=IFERROR(COUNTIF('+t26+','+paid+'),0)',
     '=IFERROR(D4-C4,0)',
     '=IFERROR(IF(C4=0,"—",(D4-C4)/C4),"—")',
     '=IFERROR(ROUND(D4*('+pf+'),0),"")',
     '0','0'],
    ['Total volume',
     '=IFERROR(SUMIF('+t25+','+paid+','+g25+'),0)',
     '=IFERROR(SUMIF('+t26+','+paid+','+g26+'),0)',
     '=IFERROR(D5-C5,0)',
     '=IFERROR(IF(C5=0,"—",(D5-C5)/C5),"—")',
     '=IFERROR(D5*('+pf+'),"")',
     '$#,##0','$#,##0'],
    ['Gross commission',
     '=IFERROR(SUMIF('+t25+','+paid+','+m25+'),0)',
     '=IFERROR(SUMIF('+t26+','+paid+','+m26+'),0)',
     '=IFERROR(D6-C6,0)',
     '=IFERROR(IF(C6=0,"—",(D6-C6)/C6),"—")',
     '=IFERROR(D6*('+pf+'),"")',
     '$#,##0','$#,##0'],
    ['Your commission',
     '=IFERROR(SUMIF('+t25+','+paid+','+n25+'),0)',
     '=IFERROR(SUMIF('+t26+','+paid+','+n26+'),0)',
     '=IFERROR(D7-C7,0)',
     '=IFERROR(IF(C7=0,"—",(D7-C7)/C7),"—")',
     '=IFERROR(D7*('+pf+'),"")',
     '$#,##0','$#,##0'],
    ['Avg mortgage / deal',
     '=IFERROR(IF(C4=0,"—",C5/C4),"—")',
     '=IFERROR(IF(D4=0,"—",D5/D4),"—")',
     '=IFERROR(IF(OR(C8="—",D8="—"),"—",D8-C8),"—")',
     '=IFERROR(IF(OR(C8="—",D8="—",C8=0),"—",(D8-C8)/C8),"—")',
     '=IFERROR(IF(D4=0,"—",D5*('+pf+')/ROUND(D4*('+pf+'),0)),"—")',
     '$#,##0','$#,##0'],
    ['Avg your comm / deal',
     '=IFERROR(IF(C4=0,"—",C7/C4),"—")',
     '=IFERROR(IF(D4=0,"—",D7/D4),"—")',
     '=IFERROR(IF(OR(C9="—",D9="—"),"—",D9-C9),"—")',
     '=IFERROR(IF(OR(C9="—",D9="—",C9=0),"—",(D9-C9)/C9),"—")',
     '=IFERROR(IF(D4=0,"—",D7*('+pf+')/ROUND(D4*('+pf+'),0)),"—")',
     '$#,##0','$#,##0'],
  ];

  mRows.forEach(function(m, i) {
    var r  = 4 + i;
    var bg = i % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
    sheet.setRowHeight(r, 24);
    sheet.getRange(r, 2).setValue(m[0]).setBackground(bg)
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
    sheet.getRange(r, 3).setFormula(m[1]).setNumberFormat(m[6]).setBackground(bg)
      .setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 4).setFormula(m[2]).setNumberFormat(m[6]).setBackground(bg)
      .setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 5).setFormula(m[3]).setNumberFormat(m[6]).setBackground(bg)
      .setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 6).setFormula(m[4]).setNumberFormat('0.0%').setBackground(bg)
      .setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 7).setFormula(m[5]).setNumberFormat(m[7]).setBackground(LGOLD)
      .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('right').setVerticalAlignment('middle');
  });

  sheet.setRowHeight(10, 16); // spacer

  // ── Deal type breakdown ────────────────────────────────────────────────────
  sheet.getRange(11, 2, 1, NC).merge()
    .setValue('DEAL TYPE BREAKDOWN')
    .setBackground('#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(11, 28);

  ['DEAL TYPE','2025 deals','2026 deals','2025 volume','2026 volume','2026 your comm']
    .forEach(function(h, i) {
      sheet.getRange(12, 2 + i).setValue(h)
        .setBackground('#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
        .setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
    });
  sheet.setRowHeight(12, 24);

  var c25 = "'2025 Funded'!C$4:C$100";
  var c26 = "'2026 Funded'!C$4:C$100";
  ['Purchase','Refinance','Switch/Transfer','Renewal'].forEach(function(dt, i) {
    var r  = 13 + i;
    var bg = i % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
    var q  = '"' + dt + '"';
    sheet.setRowHeight(r, 22);
    sheet.getRange(r, 2).setValue(dt).setBackground(bg)
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
    sheet.getRange(r, 3)
      .setFormula('=IFERROR(COUNTIFS('+t25+','+paid+','+c25+','+q+'),0)').setNumberFormat('0')
      .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(r, 4)
      .setFormula('=IFERROR(COUNTIFS('+t26+','+paid+','+c26+','+q+'),0)').setNumberFormat('0')
      .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(r, 5)
      .setFormula('=IFERROR(SUMIFS('+g25+','+t25+','+paid+','+c25+','+q+'),0)').setNumberFormat('$#,##0')
      .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 6)
      .setFormula('=IFERROR(SUMIFS('+g26+','+t26+','+paid+','+c26+','+q+'),0)').setNumberFormat('$#,##0')
      .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.getRange(r, 7)
      .setFormula('=IFERROR(SUMIFS('+n26+','+t26+','+paid+','+c26+','+q+'),0)').setNumberFormat('$#,##0')
      .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
  });

  sheet.setRowHeight(17, 16); // spacer

  // ── Split type breakdown ───────────────────────────────────────────────────
  sheet.getRange(18, 2, 1, NC).merge()
    .setValue('SPLIT TYPE BREAKDOWN')
    .setBackground('#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(18, 28);

  ['SPLIT TYPE','2025 deals','2026 deals','2025 your comm','2026 your comm','2026 on pace']
    .forEach(function(h, i) {
      sheet.getRange(19, 2 + i).setValue(h)
        .setBackground(i === 5 ? GOLD : '#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
        .setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
    });
  sheet.setRowHeight(19, 24);

  var l25 = "'2025 Funded'!L$4:L$100";
  var l26 = "'2026 Funded'!L$4:L$100";
  [{label:'Self-sourced (90%)',val:0.9},{label:'HW Pre-Appr (40%)',val:0.4},{label:'HW Switch/Refi (35%)',val:0.35}]
    .forEach(function(st, i) {
      var r  = 20 + i;
      var bg = i % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
      sheet.setRowHeight(r, 22);
      sheet.getRange(r, 2).setValue(st.label).setBackground(bg)
        .setFontWeight('bold').setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
      sheet.getRange(r, 3)
        .setFormula('=IFERROR(COUNTIFS('+t25+','+paid+','+l25+','+st.val+'),0)').setNumberFormat('0')
        .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
      sheet.getRange(r, 4)
        .setFormula('=IFERROR(COUNTIFS('+t26+','+paid+','+l26+','+st.val+'),0)').setNumberFormat('0')
        .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
      sheet.getRange(r, 5)
        .setFormula('=IFERROR(SUMIFS('+n25+','+t25+','+paid+','+l25+','+st.val+'),0)').setNumberFormat('$#,##0')
        .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
      sheet.getRange(r, 6)
        .setFormula('=IFERROR(SUMIFS('+n26+','+t26+','+paid+','+l26+','+st.val+'),0)').setNumberFormat('$#,##0')
        .setBackground(bg).setFontFamily('Arial').setFontSize(10).setHorizontalAlignment('right').setVerticalAlignment('middle');
      sheet.getRange(r, 7)
        .setFormula('=IFERROR(F'+r+'*('+pf+'),0)').setNumberFormat('$#,##0')
        .setBackground(LGOLD).setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
        .setHorizontalAlignment('right').setVerticalAlignment('middle');
    });

  sheet.setRowHeight(23, 16); // spacer

  // Row 24: on-pace footnote
  sheet.getRange(24, 2, 1, NC).merge()
    .setFormula(
      '="On-pace factor: "&TEXT('+pf+',"0.00")&"x  (based on ~"' +
      '&TEXT(MONTH(TODAY())-1+DAY(TODAY())/DAY(EOMONTH(TODAY(),0)),"0.0")' +
      '&" months elapsed in 2026 as of "&TEXT(TODAY(),"Mmmm d, yyyy")&")"'
    )
    .setBackground('#F5F5F5').setFontColor('#666666').setFontStyle('italic')
    .setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(24, 22);

  // ── Pipeline Summary block ────────────────────────────────────────────────
  sheet.setRowHeight(25, 16); // spacer

  sheet.getRange(26, 2, 1, NC).merge()
    .setValue('📊 PIPELINE SUMMARY (2026)')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(26, 28);

  // Rows 27-35: pipeline metrics. Label = cols B-D merged, value = cols E-G merged.
  // Row 30 (Total Pipeline) sums rows 27-29 — using IFERROR to prevent #VALUE! if any cell is text.
  // Row 32 (YTD Pace) divides Paid comm (E27) by 2025 Full Year Comm (E31).
  var pipRows = [
    // [label, formula, numFmt, bg, fontColor]
    ['✅ Comm Received (Paid)',     '=IFERROR(SUMIF('+t26+','+paid+','+n26+'),0)',                         '$#,##0.00', '#F0FFF0', '#276221'],
    ['🔄 Comm Due (Awaiting)',      '=IFERROR(SUMIF('+t26+',"'+STATUS_AWAITING+'",'+n26+'),0)',            '$#,##0.00', '#FFFDE7', '#9C6500'],
    ['⏳ Projected if Closed',      '=IFERROR(SUMIF('+t26+',"'+STATUS_PENDING+'",'+n26+'),0)',             '$#,##0.00', '#E8F4FD', '#1F4E79'],
    ['💰 Total Pipeline',           '=IFERROR(E27+E28+E29,0)',                                            '$#,##0.00', '#F5F5F5', '#333333'],
    ['📈 2025 Full Year Comm',      '=IFERROR(SUM('+n25+'),0)',                                           '$#,##0.00', '#FFFFFF', '#333333'],
    ['🔄 YTD Pace vs 2025',        '=IFERROR(IF(E31=0,"—",E27/E31),"—")',                               '0.0%',      '#FFFFFF', '#333333'],
    ['📋 Deals Pending Close',     '=IFERROR(COUNTIF('+t26+',"'+STATUS_PENDING+'"),0)',                   '0',         '#E8F4FD', '#1F4E79'],
    ['🔄 Deals Awaiting Payment',  '=IFERROR(COUNTIF('+t26+',"'+STATUS_AWAITING+'"),0)',                  '0',         '#FFFDE7', '#9C6500'],
    ['📦 Pipeline Volume (Pending)','=IFERROR(SUMIF('+t26+',"'+STATUS_PENDING+'",'+g26+'),0)',            '$#,##0',    '#E8F4FD', '#1F4E79'],
  ];

  for (var pi = 0; pi < pipRows.length; pi++) {
    var pr  = 27 + pi;
    var pbg = pipRows[pi][3];
    var pfc = pipRows[pi][4];
    sheet.setRowHeight(pr, 24);
    sheet.getRange(pr, 2, 1, 3).merge()
      .setValue(pipRows[pi][0]).setBackground(pbg).setFontColor(pfc)
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    sheet.getRange(pr, 5, 1, 3).merge()
      .setFormula(pipRows[pi][1]).setNumberFormat(pipRows[pi][2])
      .setBackground(pbg).setFontColor(pfc).setFontWeight('bold')
      .setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('right').setVerticalAlignment('middle');
  }

  sheet.setFrozenRows(1);
}

function rebuildFundedSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var NAVY = '#1B3A6B';
  var year = sheetName.indexOf('2025') !== -1 ? '2025' : '2026';

  // ── 1. Read every row and keep only real data rows ───────────────────────
  var lastRow = sheet.getLastRow();
  var rawData = [];
  if (lastRow > 0) {
    var allVals = sheet.getRange(1, 1, lastRow, 21).getValues();
    allVals.forEach(function(row) {
      var aNum = parseFloat(row[0]);
      var b    = String(row[1] || '').trim();
      if (!isNaN(aNum) && aNum > 0 && b && b.toLowerCase() !== 'borrower') {
        rawData.push(row.slice());
      }
    });
  }

  // ── 2. Deduplicate: same borrower + closing date → keep most complete row ─
  var seen     = {};
  var keyOrder = [];
  rawData.forEach(function(row) {
    var borrower = String(row[1] || '').trim().toLowerCase();
    var cl       = row[5];
    var clStr    = cl instanceof Date
      ? cl.getFullYear() + '-' + pad2_(cl.getMonth() + 1) + '-' + pad2_(cl.getDate())
      : String(cl || '').trim();
    var key   = borrower + '|' + clStr;
    var score = row.filter(function(v) { return v !== '' && v !== null && v !== 0; }).length;
    if (!seen[key]) {
      seen[key] = { row: row, score: score };
      keyOrder.push(key);
    } else if (score > seen[key].score) {
      seen[key].row = row;
      seen[key].score = score;
    }
  });
  var deduped = keyOrder.map(function(k) { return seen[k].row; });

  // Sort oldest → newest closing date
  deduped.sort(function(a, b) {
    var da = a[5] instanceof Date ? a[5] : new Date(String(a[5]));
    var db = b[5] instanceof Date ? b[5] : new Date(String(b[5]));
    return da - db;
  });
  var n = deduped.length;

  // ── 3. Clear sheet ────────────────────────────────────────────────────────
  sheet.clear();
  sheet.clearNotes();

  // ── 4. Row 1: Title banner ────────────────────────────────────────────────
  sheet.getRange(1, 1, 1, 21).merge()
    .setValue('JM MORTGAGES — ' + year + ' FUNDED DEALS')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(15).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);

  // ── 5. Row 2: Column headers ──────────────────────────────────────────────
  sheet.getRange(2, 1, 1, 21)
    .setValues([['#','Borrower','Type','Source','Lender','Closing',
                 'Amount','Term','Rate Type','Rate','BPS','Split',
                 'Gross Comm','Net Comm','Notes','Email','Phone',
                 'Maturity','Alert','Status','Pay Date']])
    .setBackground('#2C5F9E').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 30);

  // ── 6. Row 3: gold accent line ────────────────────────────────────────────
  sheet.getRange(3, 1, 1, 21).setBackground('#C9A84C');
  sheet.setRowHeight(3, 3);

  // ── 7. Write data rows ────────────────────────────────────────────────────
  if (n > 0) {
    // Cols A–Q batch write
    var aToQ = deduped.map(function(d, i) {
      return [
        i + 1,
        String(d[1] || '').trim(),
        d[2]  || '', d[3]  || '', d[4]  || '',   // Type, Source, Lender
        parseDateVal_(d[5]),                       // Closing Date
        d[6]  !== '' ? d[6]  : '',                 // Amount
        d[7]  !== '' ? d[7]  : '',                 // Term
        d[8]  || '',                               // Rate Type
        d[9]  !== '' ? d[9]  : '',                 // Rate
        d[10] !== '' ? d[10] : '',                 // BPS
        d[11] !== '' ? d[11] : '',                 // Split
        '', '',                                    // Gross Comm + Net Comm set below
        d[14] || '', d[15] || '', d[16] || '',     // Notes, Email, Phone
      ];
    });
    sheet.getRange(4, 1, n, 17).setValues(aToQ);

    // Status (col T) and Pay Date (col U) batch write
    var VALID_STATUSES = [STATUS_PAID, STATUS_AWAITING, STATUS_PENDING];
    var tU = deduped.map(function(d) {
      var tVal = String(d[19] || '').trim();
      if (VALID_STATUSES.indexOf(tVal) === -1) tVal = computeInitialStatus_(d[5]);
      return [tVal, parseDateVal_(d[20])];
    });
    sheet.getRange(4, 20, n, 2).setValues(tU);
    sheet.getRange(4, 20, n, 1).setHorizontalAlignment('center');
    sheet.getRange(4, 21, n, 1).setNumberFormat('yyyy-mm-dd');

    // Dropdown validation for Status column
    var dropRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
      .setAllowInvalid(false).build();
    sheet.getRange(4, 20, n, 1).setDataValidation(dropRule);

    // M, N, R, S — row-by-row (need row refs)
    for (var i = 0; i < n; i++) {
      var rn = i + 4;
      var r  = String(rn);
      var d  = deduped[i];

      // M: Gross Comm — explicit value if present, else formula: Amount × (BPS/10000)
      var gc = parseFloat(d[12]);
      if (!isNaN(gc) && gc !== 0) {
        sheet.getRange(rn, 13).setValue(gc);
      } else {
        sheet.getRange(rn, 13)
          .setFormula('=IF(G'+r+'="","",IFERROR(ROUND(G'+r+'*(K'+r+'/10000),2),0))');
      }

      // N: Your Comm — explicit value if present, else formula: Gross Comm × Split
      var nc = parseFloat(d[13]);
      if (!isNaN(nc) && nc !== 0) {
        sheet.getRange(rn, 14).setValue(nc);
      } else {
        sheet.getRange(rn, 14)
          .setFormula('=IF(M'+r+'="","",IFERROR(ROUND(M'+r+'*L'+r+',2),0))');
      }

      // R: Maturity Date — term (col H) is in years
      sheet.getRange(rn, 18)
        .setFormula('=IF(AND(F'+r+'<>"",H'+r+'<>""),DATE(YEAR(F'+r+')+H'+r+',MONTH(F'+r+'),DAY(F'+r+')),"")')
        .setNumberFormat('yyyy-mm-dd');

      // S: Renewal Alert — 120-day threshold from RENEWAL_DAYS setting
      sheet.getRange(rn, 19)
        .setFormula('=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 RENEW NOW",IF(R'+r+'-TODAY()<=120,"🟡 SOON","🟢 OK")))');

    }

    // Alternating row colours (batch setBackgrounds)
    var bgGrid = deduped.map(function(_, i) {
      var bg = i % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
      var rowBg = [];
      for (var c = 0; c < 21; c++) rowBg.push(bg);
      return rowBg;
    });
    sheet.getRange(4, 1, n, 21).setBackgrounds(bgGrid);

    // Font / size / alignment
    sheet.getRange(4, 1, n, 21).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
    sheet.getRange(4, 1, n, 1).setHorizontalAlignment('center').setFontColor('#999999'); // # col
    sheet.getRange(4, 2, n, 1).setFontWeight('bold');  // Borrower name bold

    // Number formats
    sheet.getRange(4, 6,  n, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(4, 7,  n, 1).setNumberFormat('$#,##0');
    sheet.getRange(4, 10, n, 1).setNumberFormat('0.00"%"');
    sheet.getRange(4, 11, n, 1).setNumberFormat('0" bps"');
    sheet.getRange(4, 12, n, 1).setNumberFormat('0%');
    sheet.getRange(4, 13, n, 1).setNumberFormat('$#,##0.00');
    sheet.getRange(4, 14, n, 1).setNumberFormat('$#,##0.00');

    // Row heights
    for (var rh = 4; rh < 4 + n; rh++) sheet.setRowHeight(rh, 22);
  }

  // ── 8. TOTALS row ─────────────────────────────────────────────────────────
  var totalsRow = n + 4;
  sheet.getRange(totalsRow, 1, 1, 21)
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(totalsRow, 30);
  sheet.getRange(totalsRow, 1).setValue('TOTALS').setHorizontalAlignment('center');
  if (n > 0) {
    var lastData = n + 3;
    sheet.getRange(totalsRow, 7)
      .setFormula('=SUM(G4:G' + lastData + ')').setNumberFormat('$#,##0');
    sheet.getRange(totalsRow, 13)
      .setFormula('=SUM(M4:M' + lastData + ')').setNumberFormat('$#,##0.00');
    sheet.getRange(totalsRow, 14)
      .setFormula('=SUM(N4:N' + lastData + ')').setNumberFormat('$#,##0.00');
  }

  // ── 8b. Pipeline Summary block ────────────────────────────────────────────
  if (n > 0) {
    var lastData    = n + 3;
    var spacerRow   = totalsRow + 1;
    var pHdrRow     = totalsRow + 2;
    var paidRow     = totalsRow + 3;
    var awaitRow    = totalsRow + 4;
    var pendRow     = totalsRow + 5;
    var totalPipRow = totalsRow + 6;

    sheet.setRowHeight(spacerRow, 8);

    sheet.getRange(pHdrRow, 1, 1, 21).merge()
      .setValue('PIPELINE SUMMARY')
      .setBackground(NAVY).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setRowHeight(pHdrRow, 28);

    var pRows = [
      [paidRow,     '✅ Comm Received',       STATUS_PAID,     '#C6EFCE', '#276221'],
      [awaitRow,    '🔄 Comm Due (Awaiting)', STATUS_AWAITING, '#FFFDE7', '#9C6500'],
      [pendRow,     '⏳ Projected if Closed', STATUS_PENDING,  '#E8F4FD', '#1F4E79'],
      [totalPipRow, '📊 Total Pipeline',      null,            '#F0F0F0', '#333333'],
    ];

    pRows.forEach(function(pr) {
      var rn     = pr[0];
      var label  = pr[1];
      var status = pr[2];
      var bg     = pr[3];
      var fc     = pr[4];
      sheet.setRowHeight(rn, 24);
      sheet.getRange(rn, 1, 1, 13).merge()
        .setValue(label)
        .setBackground(bg).setFontColor(fc)
        .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
      var fml = status
        ? '=IFERROR(SUMIF(T4:T' + lastData + ',"' + status + '",N4:N' + lastData + '),0)'
        : '=IFERROR(SUM(N4:N' + lastData + '),0)';
      sheet.getRange(rn, 14)
        .setFormula(fml)
        .setNumberFormat('$#,##0.00')
        .setBackground(bg).setFontColor(fc)
        .setFontWeight('bold').setFontFamily('Arial').setFontSize(11)
        .setHorizontalAlignment('right').setVerticalAlignment('middle');
      sheet.getRange(rn, 15, 1, 7).setBackground(bg);
    });
  }

  // ── 9. Column widths ──────────────────────────────────────────────────────
  var widths = [36, 165, 95, 80, 115, 100, 110, 52, 90, 68, 58, 55, 112, 112, 120, 140, 105, 100, 78, 135, 100];
  for (var ci = 0; ci < widths.length; ci++) sheet.setColumnWidth(ci + 1, widths[ci]);

  // ── 10. Freeze rows 1–2 and cols A–B; hide Email + Phone ─────────────────
  sheet.setFrozenRows(2);
  sheet.hideColumns(16, 2); // P: Email, Q: Phone

  // ── 11. Status conditional formatting ────────────────────────────────────
  applyStatusCF_(sheet);
}

function pad2_(n) { return n < 10 ? '0' + n : String(n); }

function parseDateVal_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  var s = String(v).trim();
  if (!s) return '';
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : d;
}

// ─── fixAllMaturityDates (public) ────────────────────────────────────────────
// Re-writes col R for every existing deal row using DATE(YEAR(F)+H, MONTH(F), DAY(F)).
// Run once after upgrading from the old EDATE(months) formula.

function fixAllMaturityDates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixed = 0;
  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;
    for (var rn = 4; rn <= lastDataRow; rn++) {
      var borrower = String(sheet.getRange(rn, 2).getValue() || '').trim();
      if (!borrower) continue;
      var r = String(rn);
      sheet.getRange(rn, 18)
        .setFormula('=IF(AND(F'+r+'<>"",H'+r+'<>""),DATE(YEAR(F'+r+')+H'+r+',MONTH(F'+r+'),DAY(F'+r+')),"")')
        .setNumberFormat('yyyy-mm-dd');
      fixed++;
    }
  });
  SpreadsheetApp.flush();
  ss.toast('Maturity dates fixed — ' + fixed + ' rows updated. Run "Fix Renewal Alerts" next.');
}

// ─── fixAllRenewalAlerts (public) ─────────────────────────────────────────────
// Re-writes col S for every existing deal row: 120-day threshold, "RENEW NOW" text.

function fixAllRenewalAlerts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixed = 0;
  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;
    for (var rn = 4; rn <= lastDataRow; rn++) {
      var borrower = String(sheet.getRange(rn, 2).getValue() || '').trim();
      if (!borrower) continue;
      var r = String(rn);
      sheet.getRange(rn, 19)
        .setFormula('=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 RENEW NOW",IF(R'+r+'-TODAY()<=120,"🟡 SOON","🟢 OK")))');
      fixed++;
    }
  });
  SpreadsheetApp.flush();
  ss.toast('Renewal alerts fixed — ' + fixed + ' rows updated.');
}

// ─── formatAllSheets (public) ─────────────────────────────────────────────────

function formatAllSheets() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY = '#1B3A6B';
  ['2025 Funded', '2026 Funded'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var headers = [
      '#','Borrower','Type','Source','Lender','Closing Date',
      'Amount','Term','Rate Type','Rate','BPS','Split',
      'Gross Comm','Your Comm','Notes','Email','Phone',
      'Maturity Date','Renewal Alert','Status','Pay Date',
    ];
    sheet.getRange(2, 1, 1, headers.length)
      .setValues([headers]).setBackground(NAVY).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center');
    var totalsRow = findTotalsRow_(sheet);
    var lastRow   = totalsRow === -1 ? sheet.getLastRow() : totalsRow;
    if (lastRow >= 4) {
      var rows = lastRow - 3;
      sheet.getRange(4, 7,  rows).setNumberFormat('$#,##0.00');
      sheet.getRange(4, 10, rows).setNumberFormat('0.00"%"');
      sheet.getRange(4, 11, rows).setNumberFormat('0" bps"');
      sheet.getRange(4, 12, rows).setNumberFormat('0%');
      sheet.getRange(4, 13, rows).setNumberFormat('$#,##0.00');
      sheet.getRange(4, 14, rows).setNumberFormat('$#,##0.00');
      sheet.getRange(4, 18, rows).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(4, 21, rows).setNumberFormat('yyyy-mm-dd');
    }
    applyStatusCF_(sheet);
  });
  ss.toast('All sheets formatted.');
}
