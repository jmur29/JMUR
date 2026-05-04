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
    { name: 'Add Deal from Inbox',       functionName: 'addDealFromInbox'       },
    { name: 'Fix Totals & References',   functionName: 'fixAllTotalsAndRefs'    },
    { name: 'Fix Status Column',         functionName: 'fixStatusColumn'        },
    { name: 'Refresh Deal Statuses',     functionName: 'refreshDealStatuses'    },
    { name: 'Rebuild Month vs Month',    functionName: 'setupMonthVsMonth'      },
    { name: 'Setup Projected Income',    functionName: 'setupProjectedIncome'   },
    { name: 'Format All Sheets',         functionName: 'formatAllSheets'        },
    { name: 'Run Diagnostic',            functionName: 'runDiagnostic'          },
    { name: 'Create Renewal Trigger',    functionName: 'createRenewalTrigger'   },
    { name: 'Send Renewal Reminders',    functionName: 'sendRenewalReminders'   },
  ]);
}

// ─── writeDeal ────────────────────────────────────────────────────────────────
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
  var dealNum   = insertRow - 3;

  sheet.insertRowBefore(insertRow);
  var r = String(insertRow);

  sheet.getRange(insertRow, 1, 1, 17).setValues([[
    dealNum, borrower, dealType, source, lender,
    closing, amt, term, rateType, rate,
    bps, split, grossComm, yourComm, notes,
    email, phone
  ]]);

  sheet.getRange(insertRow, 7 ).setNumberFormat('$#,##0.00');
  sheet.getRange(insertRow, 10).setNumberFormat('0.00"%"');
  sheet.getRange(insertRow, 11).setNumberFormat('0" bps"');
  sheet.getRange(insertRow, 12).setNumberFormat('0%');
  sheet.getRange(insertRow, 13).setNumberFormat('$#,##0.00');
  sheet.getRange(insertRow, 14).setNumberFormat('$#,##0.00');

  sheet.getRange(insertRow, 18)
    .setFormula(
      '=IF(OR(F'+r+'="",H'+r+'=""),"",EDATE(' +
        'IFERROR(DATEVALUE(IF(ISNUMBER(F'+r+'),TEXT(F'+r+',"yyyy-mm-dd"),F'+r+')),F'+r+'),' +
        'H'+r+'))'
    )
    .setNumberFormat('yyyy-mm-dd');

  sheet.getRange(insertRow, 19)
    .setFormula(
      '=IF(R'+r+'="","",IF(R'+r+'-TODAY()<=30,"🔴 URGENT",' +
        'IF(R'+r+'-TODAY()<=90,"🟡 SOON","🟢 OK")))'
    );

  var statusVal = computeInitialStatus_(closing);
  sheet.getRange(insertRow, 20)
    .setValue(statusVal)
    .setHorizontalAlignment('center')
    .setFontFamily('Arial').setFontSize(10);
  applyStatusValidation_(sheet, insertRow);
  sheet.getRange(insertRow, 21).setNumberFormat('yyyy-mm-dd');

  sheet.getRange(insertRow, 1, 1, 21).setFontFamily('Arial').setFontSize(10);
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
        borrower:  borrower,  year:      year,
        type:      row[2],    source:    row[3],    lender:    row[4],
        closing:   row[5],    amt:       row[6],    term:      row[7],
        rateType:  row[8],    rate:      row[9],    bps:       row[10],
        split:     row[11],   grossComm: row[12],   yourComm:  row[13],
        notes:     row[14],   email:     row[15],   phone:     row[16],
      });
      added++;
    } catch (e) {
      Logger.log('Inbox row ' + (i + 2) + ' error: ' + e.message);
      errors++;
    }
  }

  if (added > 0) inbox.getRange(2, 1, lastRow - 1, 17).clearContent();
  ss.toast(added + ' deal(s) added' + (errors > 0 ? ', ' + errors + ' skipped.' : '.'));
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
// Logs an audit of 2026 Funded to Logger. Open View → Logs to inspect.

function runDiagnostic() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026 Funded');
  if (!sheet) { ss.toast('2026 Funded sheet not found.'); return; }

  var totalsRow   = findTotalsRow_(sheet);
  var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;

  Logger.log('=== 2026 Funded Audit ===');
  Logger.log('Last data row: ' + lastDataRow + ' | TOTALS row: ' + totalsRow);

  if (lastDataRow < 4) { Logger.log('No data rows found.'); return; }

  var data = sheet.getRange(4, 1, lastDataRow - 3, 21).getValues();
  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var borrower = String(row[1]  || '').trim();
    if (!borrower) continue;
    var closing  = row[5];
    var yourComm = row[13];
    var tRaw     = row[19];
    var uRaw     = row[20];

    Logger.log(
      'Row ' + (i + 4) + ': ' + borrower +
      ' | F closing=' + closing + ' (type=' + typeof closing + ')' +
      ' | N yourComm=' + yourComm + ' (type=' + typeof yourComm + ')' +
      ' | T status=[' + String(tRaw) + '] (len=' + String(tRaw).length + ')' +
      ' | U payDate=' + uRaw
    );
  }

  // Also check the MvM tab formula in May cell (row 9, col H = 2026 Paid Comm)
  var mvm = ss.getSheetByName('Month vs Month');
  if (mvm) {
    var mayCell = mvm.getRange(9, 8); // row 9 = May, col H = 2026 Paid Comm
    Logger.log('MvM May 2026 Paid Comm formula: ' + mayCell.getFormula());
    Logger.log('MvM May 2026 Paid Comm value:   ' + mayCell.getValue());
    var summaryCell = mvm.getRange(21, 7); // G21 = Paid Comm total
    Logger.log('MvM Summary G21 (Paid Comm) formula: ' + summaryCell.getFormula());
    Logger.log('MvM Summary G21 (Paid Comm) value:   ' + summaryCell.getValue());
  }

  ss.toast('Diagnostic complete — open View → Logs to see results.');
}

// ─── fixStatusColumn (public) ─────────────────────────────────────────────────
// Reads ALL rows in both funded sheets and sets col T (Status) to the correct
// value based on:
//   1. Pay Date in col U → ✅ Paid (if user has filled it in)
//   2. Closing date <= TODAY() → 🔄 Awaiting Payment
//   3. Closing date > TODAY() or blank → ⏳ Pending Close
//
// Clears any old formula in col T. Applies validation + CF.
// Never auto-sets ✅ Paid — only honours it if Pay Date is present OR if the
// existing value is ✅ Paid and there is no formula (i.e. manually entered).

function fixStatusColumn() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var log = getReminderLog_(ss);
  var NAVY = '#1B3A6B';
  var totalFixed = 0;

  ['2025 Funded', '2026 Funded'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // Ensure col T + U headers
    sheet.getRange(2, 20)
      .setValue('Status')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center').setBackground(NAVY).setFontColor('#FFFFFF');
    sheet.getRange(2, 21)
      .setValue('Pay Date')
      .setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
      .setHorizontalAlignment('center').setBackground(NAVY).setFontColor('#FFFFFF');

    var totalsRow   = findTotalsRow_(sheet);
    var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
    if (lastDataRow < 4) return;

    var numRows = lastDataRow - 3;
    // Read cols A–U for all data rows in one call
    var data = sheet.getRange(4, 1, numRows, 21).getValues();

    var newStatuses = [];
    var fixed       = 0;

    for (var i = 0; i < data.length; i++) {
      var row      = data[i];
      var borrower = String(row[1]  || '').trim();
      var closingV = row[5];    // col F
      var tVal     = String(row[19] || '').trim(); // col T (may have old formula text)
      var uVal     = row[20];   // col U Pay Date

      // Check if col T currently contains a formula (old approach — must clear it)
      var tCell      = sheet.getRange(i + 4, 20);
      var hasFormula = tCell.getFormula() !== '';

      if (!borrower) {
        newStatuses.push([tVal]); // preserve whatever is there for blank rows
        continue;
      }

      var hasPayDate = uVal && String(uVal).trim() !== '' && uVal !== 0;

      var correctStatus;
      if (hasPayDate) {
        correctStatus = STATUS_PAID;
      } else if (tVal === STATUS_PAID && !hasFormula) {
        // Manually set ✅ Paid — keep it (user confirmed payment even without Pay Date)
        correctStatus = STATUS_PAID;
      } else {
        correctStatus = computeInitialStatus_(closingV);
      }

      if (hasFormula || tVal !== correctStatus) {
        if (borrower) {
          log.appendRow([
            new Date(), sheetName, borrower,
            hasFormula ? '(formula)' : (tVal || '(blank)'),
            correctStatus,
            'fixStatusColumn'
          ]);
          fixed++;
        }
      }

      newStatuses.push([correctStatus]);
    }

    // Clear formulas in bulk, then set values + formatting in bulk
    sheet.getRange(4, 20, numRows, 1).clearContent();
    sheet.getRange(4, 20, numRows, 1)
      .setValues(newStatuses)
      .setHorizontalAlignment('center')
      .setFontFamily('Arial').setFontSize(10);

    // Apply dropdown validation to entire col T data range at once
    var valRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(4, 20, numRows, 1).setDataValidation(valRule);

    // Set Pay Date number format
    sheet.getRange(4, 21, numRows, 1).setNumberFormat('yyyy-mm-dd');

    applyStatusCF_(sheet);
    SpreadsheetApp.flush();
    totalFixed += fixed;
    Logger.log('fixStatusColumn: ' + sheetName + ' → ' + fixed + ' change(s)');
  });

  ss.toast('Status column fixed — ' + totalFixed + ' update(s) applied.');
}

// ─── Status helpers ───────────────────────────────────────────────────────────

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
  var today   = new Date();
  today   = new Date(today.getFullYear(),   today.getMonth(),   today.getDate());
  closing = new Date(closing.getFullYear(), closing.getMonth(), closing.getDate());
  return closing > today ? STATUS_PENDING : STATUS_AWAITING;
}

function applyStatusValidation_(sheet, row) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS_PENDING, STATUS_AWAITING, STATUS_PAID], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 20).setDataValidation(rule);
}

function applyStatusCF_(sheet) {
  var totalsRow   = findTotalsRow_(sheet);
  var lastDataRow = totalsRow === -1 ? sheet.getLastRow() : totalsRow - 1;
  var numRows     = Math.max(1, lastDataRow - 3);
  var colTRange   = sheet.getRange(4, 20, numRows, 1);

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

  var existing = sheet.getConditionalFormatRules().filter(function(rule) {
    return rule.getRanges().every(function(rng) { return rng.getColumn() !== 20; });
  });
  sheet.setConditionalFormatRules(existing.concat(statusRules));
}

// ─── setupProjectedIncome_ (private) ─────────────────────────────────────────
// Sets col T (Status value) + validation for a single row.
// Only overwrites if the cell contains an old formula or is blank.

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
    var statusVal  = hasPayDate ? STATUS_PAID : computeInitialStatus_(closingVal);

    tCell.clearContent()
      .setValue(statusVal)
      .setHorizontalAlignment('center')
      .setFontFamily('Arial').setFontSize(10);
  }

  applyStatusValidation_(sheet, rowNum);
  sheet.getRange(rowNum, 21).setNumberFormat('yyyy-mm-dd');
}

// ─── setupStatusColumn_ (private) ────────────────────────────────────────────

function setupStatusColumn_(ss) {
  // Delegate fully to the public fixStatusColumn function
  fixStatusColumn();
}

// ─── setupProjectedIncome (public menu) ──────────────────────────────────────

function setupProjectedIncome() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  fixStatusColumn();
  setupMonthVsMonth();
  ss.toast('Projected Income setup complete.');
}

// ─── refreshDealStatuses (public) ────────────────────────────────────────────

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
      var row      = data[i];
      var borrower = String(row[1]  || '').trim();
      var closingV = row[5];
      var currentT = String(row[19] || '').trim();
      var uVal     = row[20];

      if (!borrower) continue;
      if (currentT === STATUS_PAID) continue;
      if (currentT !== STATUS_PENDING) continue;

      var hasPayDate = uVal && String(uVal).trim() !== '' && uVal !== 0;
      var shouldBeAwaiting = hasPayDate
        ? false // will be set to Paid by fixStatusColumn
        : computeInitialStatus_(closingV) === STATUS_AWAITING;

      if (!shouldBeAwaiting) continue;

      sheet.getRange(i + 4, 20).setValue(STATUS_AWAITING);
      log.appendRow([new Date(), sheetName, borrower, STATUS_PENDING, STATUS_AWAITING, 'Auto-flipped']);
      changed++;
    }
  });

  SpreadsheetApp.flush();
  ss.toast(changed + ' deal(s) flipped to ' + STATUS_AWAITING + '.');
}

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
    .timeBased().atHour(8).everyDays(1).inTimezone('America/Toronto').create();
  SpreadsheetApp.getActiveSpreadsheet()
    .toast('Renewal trigger created — runs daily at 8 am Toronto time.');
}

function sendRenewalReminders() {
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
      var alert    = String(row[18] || '').trim();
      if (!borrower) return;
      if (alert.indexOf('🔴') !== -1) urgent.push(borrower + ' (' + name + ')');
      else if (alert.indexOf('🟡') !== -1) soon.push(borrower + ' (' + name + ')');
    });
  });

  if (urgent.length === 0 && soon.length === 0) return;

  var body = 'JM Mortgages — Renewal Reminders\n' + new Date().toDateString() + '\n\n';
  if (urgent.length) {
    body += '🔴 URGENT:\n';
    urgent.forEach(function(d) { body += '  • ' + d + '\n'; });
    body += '\n';
  }
  if (soon.length) {
    body += '🟡 COMING UP:\n';
    soon.forEach(function(d) { body += '  • ' + d + '\n'; });
  }

  MailApp.sendEmail(Session.getActiveUser().getEmail(),
    'JM Mortgages — Renewal Reminders', body);
}

function checkNewDealRenewal_(sheet, row) {
  var alert    = String(sheet.getRange(row, 19).getValue() || '');
  var borrower = String(sheet.getRange(row,  2).getValue() || '');
  if (alert.indexOf('🔴') === -1 && alert.indexOf('🟡') === -1) return;
  try {
    MailApp.sendEmail(Session.getActiveUser().getEmail(),
      'New Deal Alert — ' + borrower + ' needs renewal attention',
      borrower + ' was added with renewal status: ' + alert);
  } catch (e) { Logger.log('checkNewDealRenewal_ email failed: ' + e.message); }
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
// All formulas use:
//   • TRIM(T range) for exact status matching (handles stray whitespace)
//   • IFERROR(VALUE(amount range), 0) for amounts (handles text-stored numbers)
//   • Robust DATEVALUE pattern for closing dates (handles text AND date serials)
// Range limit $100 covers up to 97 data rows (rows 4–100), safe for this volume.

function mvs2025Count_(mo, status) {
  var fRef     = "'2025 Funded'!F$4:F$100";
  var tRef     = "'2025 Funded'!T$4:T$100";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+fRef+'),TEXT('+fRef+',"yyyy-mm-dd"),'+fRef+')),0)';
  var start    = 'DATE(2025,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) return '=SUMPRODUCT('+dateCond+'*(TRIM('+tRef+')="'+status+'"))';
  return '=SUMPRODUCT('+dateCond+')';
}

function mvs2025Sum_(mo, col, status) {
  var fRef     = "'2025 Funded'!F$4:F$100";
  var tRef     = "'2025 Funded'!T$4:T$100";
  var cLetter  = columnLetter_(col);
  var vRef     = "'2025 Funded'!"+cLetter+"$4:"+cLetter+"$100";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+fRef+'),TEXT('+fRef+',"yyyy-mm-dd"),'+fRef+')),0)';
  var start    = 'DATE(2025,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2025,'+(mo+1)+',1)' : 'DATE(2026,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  var values   = 'IFERROR(VALUE('+vRef+'),0)';
  if (status) return '=SUMPRODUCT('+dateCond+'*(TRIM('+tRef+')="'+status+'")*'+values+')';
  return '=SUMPRODUCT('+dateCond+'*'+values+')';
}

function mvs2026Count_(mo, status) {
  var fRef     = "'2026 Funded'!F$4:F$100";
  var tRef     = "'2026 Funded'!T$4:T$100";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+fRef+'),TEXT('+fRef+',"yyyy-mm-dd"),'+fRef+')),0)';
  var start    = 'DATE(2026,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  if (status) return '=SUMPRODUCT('+dateCond+'*(TRIM('+tRef+')="'+status+'"))';
  return '=SUMPRODUCT('+dateCond+')';
}

function mvs2026Sum_(mo, col, status) {
  var fRef     = "'2026 Funded'!F$4:F$100";
  var tRef     = "'2026 Funded'!T$4:T$100";
  var cLetter  = columnLetter_(col);
  var vRef     = "'2026 Funded'!"+cLetter+"$4:"+cLetter+"$100";
  var dExpr    = 'IFERROR(DATEVALUE(IF(ISNUMBER('+fRef+'),TEXT('+fRef+',"yyyy-mm-dd"),'+fRef+')),0)';
  var start    = 'DATE(2026,'+mo+',1)';
  var end      = mo < 12 ? 'DATE(2026,'+(mo+1)+',1)' : 'DATE(2027,1,1)';
  var dateCond = '('+dExpr+'>='+start+')*('+dExpr+'<'+end+')';
  var values   = 'IFERROR(VALUE('+vRef+'),0)';
  if (status) return '=SUMPRODUCT('+dateCond+'*(TRIM('+tRef+')="'+status+'")*'+values+')';
  return '=SUMPRODUCT('+dateCond+'*'+values+')';
}

// ─── setupMvMSummaryBlock_ ────────────────────────────────────────────────────
// Performance Dashboard rows 19–30.
// Label cols B–F (2–6). Value cols G–P (7–16).
// All summary formulas use SUMPRODUCT + TRIM + IFERROR(VALUE()) for robustness.

function setupMvMSummaryBlock_(sheet, NAVY, GOLD) {
  var NUM_COLS = 15; // B through P

  // Row 19: section header
  sheet.getRange(19, 2, 1, NUM_COLS).clearContent().clearFormat();
  sheet.getRange(19, 2, 1, NUM_COLS).merge()
    .setValue('📊 2026 PERFORMANCE DASHBOARD')
    .setBackground(NAVY).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(13).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(19, 38);

  // T (col T) range in 2026 Funded
  var tRef  = "'2026 Funded'!T$4:T$100";
  var gRef  = "'2026 Funded'!G$4:G$100";   // Amount col
  var nRef  = "'2026 Funded'!N$4:N$100";   // Your Comm col
  var n25   = "'2025 Funded'!N$4:N$100";

  var trimPaid     = 'TRIM('+tRef+')="'+STATUS_PAID+'"';
  var trimAwaiting = 'TRIM('+tRef+')="'+STATUS_AWAITING+'"';
  var trimPending  = 'TRIM('+tRef+')="'+STATUS_PENDING+'"';
  var valN         = 'IFERROR(VALUE('+nRef+'),0)';
  var valG         = 'IFERROR(VALUE('+gRef+'),0)';

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
    'YTD Pace vs 2025 (Paid comm only)',
  ];

  var formats = [
    '0', '$#,##0.00', '$#,##0.00',   // Paid
    '0', '$#,##0.00', '$#,##0.00',   // Awaiting
    '0', '$#,##0.00', '$#,##0.00',   // Pending
    '$#,##0.00',                      // Combined
    '$#,##0.00',                      // 2025 FY
    '0.0%',                           // YTD Pace
  ];

  // All formulas reference col G (7) = top-left of merged value cell.
  // Rows: 20=Paid count, 21=Paid vol, 22=Paid comm,
  //       23=Await count, 24=Await vol, 25=Await comm,
  //       26=Pend count,  27=Pend vol,  28=Pend comm,
  //       29=Combined, 30=2025FY, 31=YTDPace
  var formulas = [
    '=SUMPRODUCT(('+trimPaid+')*1)',
    '=SUMPRODUCT(('+trimPaid+')*'+valG+')',
    '=SUMPRODUCT(('+trimPaid+')*'+valN+')',
    '=SUMPRODUCT(('+trimAwaiting+')*1)',
    '=SUMPRODUCT(('+trimAwaiting+')*'+valG+')',
    '=SUMPRODUCT(('+trimAwaiting+')*'+valN+')',
    '=SUMPRODUCT(('+trimPending+')*1)',
    '=SUMPRODUCT(('+trimPending+')*'+valG+')',
    '=SUMPRODUCT(('+trimPending+')*'+valN+')',
    '=G22+G25+G28',     // Combined = Paid comm + Awaiting comm + Pending comm
    '=SUMPRODUCT(IFERROR(VALUE('+n25+'),0))', // All 2025 Funded comm, no status filter
    '=IF(G30=0,"—",G22/G30)',  // YTD Pace = Paid Comm / 2025 Full Year
  ];

  var cfRules = [];

  for (var i = 0; i < labels.length; i++) {
    var r  = 20 + i; // rows 20–31
    var bg = i % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
    if (i < 3) bg = '#F0FFF0';                     // Paid: green tint
    if (i >= 3 && i < 6) bg = '#FFFDE7';           // Awaiting: yellow tint
    if (i >= 6 && i < 9) bg = '#E8F4FD';           // Pending: blue tint
    if (i === 9) bg = '#F5F5F5';                    // Combined: grey
    if (i === 10) bg = '#FFFFFF';
    if (i === 11) bg = '#F0F0F0';

    sheet.getRange(r, 2, 1, NUM_COLS).clearContent().clearFormat();
    sheet.setRowHeight(r, 26);

    // Label: B–F
    sheet.getRange(r, 2, 1, 5).merge()
      .setValue(labels[i])
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    // Value: G–P
    var valueCell = sheet.getRange(r, 7, 1, 10).merge();
    valueCell
      .setBackground(bg)
      .setFontFamily('Arial').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFormula(formulas[i])
      .setNumberFormat(formats[i]);

    // CF for YTD Pace (i=11, row 31)
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
  }

  return cfRules;
}

// ─── setupMonthVsMonth (public) ──────────────────────────────────────────────
// Column layout B–P (cols 2–16):
//   B   Month
//   C–E 2025 ✅ Paid (#, Vol, Comm)
//   F–H 2026 ✅ Paid (#, Vol, Comm)
//   I–K 2026 🔄 Awaiting (#, Vol, Comm)
//   L–N 2026 ⏳ Pending (#, Vol, Comm)
//   O   Total 2026 Comm
//   P   Δ vs 2025
//
// Row structure:
//   1  Title
//   2  Subtitle
//   3  Group headers (merged)
//   4  Sub-headers
//   5–16  January–December
//   17  TOTALS
//   18  Spacer
//   19  Dashboard header
//   20–31  Summary rows

function setupMonthVsMonth() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var NAVY  = '#1B3A6B';
  var GOLD  = '#C9A84C';
  var LGOLD = '#FFF8E7';

  var sheet = ss.getSheetByName('Month vs Month');
  if (!sheet) sheet = ss.insertSheet('Month vs Month');
  sheet.clear();

  var NUM_COLS = 15; // B through P

  // Column widths: A spacer, B–P
  var widths = [25, 115, 65, 95, 105, 65, 95, 105, 68, 95, 105, 68, 95, 105, 115, 88];
  for (var w = 0; w < widths.length; w++) sheet.setColumnWidth(w + 1, widths[w]);

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

  // ── Row 3: Group headers ────────────────────────────────────────────────────
  var groups = [
    { col: 2,  span: 1, label: 'Month',            bg: NAVY      },
    { col: 3,  span: 3, label: '2025  ✅ Paid',     bg: '#276221' },
    { col: 6,  span: 3, label: '2026  ✅ Paid',     bg: '#276221' },
    { col: 9,  span: 3, label: '2026  🔄 Awaiting', bg: '#9C6500' },
    { col: 12, span: 3, label: '2026  ⏳ Pending',  bg: '#1F4E79' },
    { col: 15, span: 1, label: 'Total 2026',        bg: NAVY      },
    { col: 16, span: 1, label: 'Δ vs 2025',         bg: NAVY      },
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
  sheet.setRowHeight(3, 30);

  // ── Row 4: Sub-headers ──────────────────────────────────────────────────────
  var subHeaders = [
    'Month',
    '#', 'Volume', 'Comm',
    '#', 'Volume', 'Comm',
    '#', 'Volume', 'Comm',
    '#', 'Volume', 'Comm',
    'Comm', 'Δ vs 2025',
  ];
  for (var sh = 0; sh < subHeaders.length; sh++) {
    sheet.getRange(4, 2 + sh)
      .setValue(subHeaders[sh])
      .setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(8).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  sheet.setRowHeight(4, 26);

  // ── Rows 5–16: Monthly data ─────────────────────────────────────────────────
  for (var mo = 1; mo <= 12; mo++) {
    var r  = mo + 4; // rows 5–16
    var bg = mo % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
    sheet.setRowHeight(r, 22);
    sheet.getRange(r, 2, 1, NUM_COLS).setBackground(bg).setFontFamily('Arial').setFontSize(9);

    // B: Month
    sheet.getRange(r, 2).setValue(MONTHS_[mo - 1]).setFontWeight('bold').setHorizontalAlignment('left');

    // C–E: 2025 Paid
    sheet.getRange(r, 3).setFormula(mvs2025Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    sheet.getRange(r, 4).setFormula(mvs2025Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    sheet.getRange(r, 5).setFormula(mvs2025Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // F–H: 2026 Paid
    sheet.getRange(r, 6).setFormula(mvs2026Count_(mo, STATUS_PAID)).setHorizontalAlignment('center');
    sheet.getRange(r, 7).setFormula(mvs2026Sum_(mo, 7, STATUS_PAID)).setNumberFormat('$#,##0');
    sheet.getRange(r, 8).setFormula(mvs2026Sum_(mo, 14, STATUS_PAID)).setNumberFormat('$#,##0.00');

    // I–K: 2026 Awaiting
    sheet.getRange(r, 9).setFormula(mvs2026Count_(mo, STATUS_AWAITING)).setHorizontalAlignment('center');
    sheet.getRange(r, 10).setFormula(mvs2026Sum_(mo, 7, STATUS_AWAITING)).setNumberFormat('$#,##0');
    sheet.getRange(r, 11).setFormula(mvs2026Sum_(mo, 14, STATUS_AWAITING)).setNumberFormat('$#,##0.00');

    // L–N: 2026 Pending
    sheet.getRange(r, 12).setFormula(mvs2026Count_(mo, STATUS_PENDING)).setHorizontalAlignment('center');
    sheet.getRange(r, 13).setFormula(mvs2026Sum_(mo, 7, STATUS_PENDING)).setNumberFormat('$#,##0');
    sheet.getRange(r, 14).setFormula(mvs2026Sum_(mo, 14, STATUS_PENDING)).setNumberFormat('$#,##0.00');

    // O: Total 2026 Comm = Paid + Awaiting + Pending
    sheet.getRange(r, 15)
      .setFormula('=H'+r+'+K'+r+'+N'+r)
      .setNumberFormat('$#,##0.00').setFontWeight('bold');

    // P: Δ vs 2025
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

  // ── Rows 19–31: Performance Dashboard ──────────────────────────────────────
  var cfRules = setupMvMSummaryBlock_(sheet, NAVY, GOLD);

  // CF for Δ vs 2025 (col P = 16, rows 5–16)
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
