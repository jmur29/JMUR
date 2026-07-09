// JM Mortgage Tracker v3.1 — 5-feature update 2026-07-09
// Sheet: 1sx0Xi1y9pmUJ-udGQXPbviGayEAcTW9T_VnWREdCsS8
// Deals columns:
//   A Borrower | B 🔁Repeat | C Year | D Type | E Source | F Lender
//   G Closing Date | H Amount | I Term | J BPS | K Split | L Net Comm
//   M Status | N Pay Date | O Expected Pay Date | P Maturity | Q Notes

var S_PAID  = '✅ Paid';
var S_AWAIT = '🔄 Awaiting';
var S_PEND  = '⏳ Pending';
var BROKER_EMAIL = 'jake@thinkhomewise.com';
var RENEWAL_DAYS = 120;

// Column indices (1-based) in Deals sheet
var CC = {
  BORROWER:1, REPEAT:2, YEAR:3, TYPE:4, SOURCE:5, LENDER:6, CLOSING:7,
  AMOUNT:8, TERM:9, BPS:10, SPLIT:11, NETCOMM:12, STATUS:13,
  PAYDATE:14, EXPDATE:15, MATURITY:16, NOTES:17
};
var NCOLS = 17;

// ─── onOpen ───────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏦 JM Tracker')
    .addItem('➕ Process Inbox',       'addDealFromInbox')
    .addItem('🔔 Send Renewal Emails', 'sendRenewalReminders')
    .addItem('🔧 Repair Data & Report','REPAIR')
    .addToUi();
}

// ─── onEdit ───────────────────────────────────────────────────────────────────
// Only rule: typing a Pay Date on the Deals tab flips Status → Paid.
function onEdit(e) {
  if (!e) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== 'Deals') return;
  var row = e.range.getRow(), col = e.range.getColumn();
  if (row < 2 || col !== CC.PAYDATE) return;
  if (e.range.getValue()) sh.getRange(row, CC.STATUS).setValue(S_PAID);
}
function onEditHandler(e) { onEdit(e); }

// ─── dailyStatusFlip ──────────────────────────────────────────────────────────
// 7 am trigger: Pending → Awaiting when Closing Date has passed.
function dailyStatusFlip() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) return;
  var data  = sh.getRange(2, 1, sh.getLastRow() - 1, NCOLS).getValues();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  data.forEach(function(r, i) {
    if (!r[CC.BORROWER - 1]) return;
    var closing = r[CC.CLOSING - 1];
    if (r[CC.STATUS - 1] === S_PEND && closing instanceof Date && closing < today)
      sh.getRange(i + 2, CC.STATUS).setValue(S_AWAIT);
  });
}

// ─── sendRenewalReminders ─────────────────────────────────────────────────────
function sendRenewalReminders() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) return;
  var data  = sh.getRange(2, 1, sh.getLastRow() - 1, NCOLS).getValues();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var due = data.filter(function(r) {
    if (!r[CC.BORROWER - 1] || !(r[CC.MATURITY - 1] instanceof Date)) return false;
    var d = Math.round((r[CC.MATURITY - 1] - today) / 86400000);
    return d >= 0 && d <= RENEWAL_DAYS;
  });
  if (!due.length) return;
  var lines = due.map(function(r) {
    var d = Math.round((r[CC.MATURITY - 1] - today) / 86400000);
    return r[CC.BORROWER - 1] + ' — matures '
      + Utilities.formatDate(r[CC.MATURITY - 1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      + ' (' + d + ' days)';
  }).join('\n');
  MailApp.sendEmail(BROKER_EMAIL,
    '🔔 Renewal Reminders — ' + due.length + ' client(s) due within ' + RENEWAL_DAYS + ' days',
    lines);
}

// ─── installTriggers ──────────────────────────────────────────────────────────
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onEditHandler').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('dailyStatusFlip').timeBased().everyDays(1).atHour(7)
    .inTimezone('America/Toronto').create();
  ScriptApp.newTrigger('sendRenewalReminders').timeBased().everyDays(1).atHour(8)
    .inTimezone('America/Toronto').create();
  ss.toast('✅ Triggers installed.');
}

// ─── addDealFromInbox ─────────────────────────────────────────────────────────
// Inbox cols: A Borrower | B Year | C Type | D Source | E Lender | F Closing
//   G Amount | H Term | I BPS | J Split | K Net Comm | L Notes
function addDealFromInbox() {
  var ss  = SpreadsheetApp.getActive();
  var src = ss.getSheetByName('Inbox');
  var dst = ss.getSheetByName('Deals');
  if (!src || !dst) { ss.toast('⚠️ Inbox or Deals sheet not found.'); return; }
  var lr = src.getLastRow();
  if (lr < 3) { ss.toast('Inbox is empty.'); return; }
  var rows  = src.getRange(3, 1, lr - 2, 12).getValues();
  var added = 0;
  rows.forEach(function(r) {
    var borrower = String(r[0] || '').trim();
    if (!borrower) return;
    var amt   = parseFloat(r[6]) || '';
    var bps   = parseFloat(r[8]) || '';
    var split = parseFloat(r[9]) || 0.9;
    var net   = parseFloat(r[10]) || (amt && bps ? Math.round(amt * bps / 10000 * split * 100) / 100 : '');
    // 17 cols: A=Borrower, B=Repeat(formula), C=Year, D=Type, E=Source, F=Lender,
    //   G=Closing, H=Amount, I=Term, J=BPS, K=Split, L=Net, M=Status,
    //   N=PayDate, O=ExpDate(formula), P=Maturity(formula), Q=Notes
    dst.appendRow([
      borrower, '',
      r[1] || 2026, r[2] || '', r[3] || '', r[4] || '',
      r[5] || '', amt, parseInt(r[7]) || '', bps, split,
      net, S_PEND, '', '', '', String(r[11] || '')
    ]);
    var nr = dst.getLastRow();
    dst.getRange(nr, CC.REPEAT).setFormula(repeatF_(nr));
    dst.getRange(nr, CC.EXPDATE).setFormula(expDateF_(nr));
    dst.getRange(nr, CC.MATURITY).setFormula(maturityF_(nr));
    applyRowFmt_(dst, nr);
    added++;
  });
  if (added) {
    dst.getRange(2, 1, dst.getLastRow() - 1, NCOLS).sort({ column: CC.CLOSING, ascending: true });
    restripe_(dst);
    src.getRange(3, 1, lr - 2, 12).clearContent();
    ss.toast('✅ ' + added + ' deal(s) added to Deals.');
  } else {
    ss.toast('No deals found in Inbox.');
  }
}

// ─── Formula helpers ──────────────────────────────────────────────────────────
// After Repeat col insert: Closing=G, Term=I, Amount=H, BPS=J, Split=K
function expDateF_(r) {
  var f = String(r);
  return '=IF(NOT(ISNUMBER(G'+f+')),"",IF(DAY(G'+f+')<=10,DATE(YEAR(G'+f+'),MONTH(G'+f+'),30),'
    + 'IF(DAY(G'+f+')<=20,'
    + 'DATE(YEAR(G'+f+')+IF(MONTH(G'+f+')=12,1,0),IF(MONTH(G'+f+')=12,1,MONTH(G'+f+')+1),15),'
    + 'DATE(YEAR(G'+f+')+IF(MONTH(G'+f+')=12,1,0),IF(MONTH(G'+f+')=12,1,MONTH(G'+f+')+1),30))))';
}
function maturityF_(r) {
  var f = String(r);
  return '=IF(AND(ISNUMBER(G'+f+'),ISNUMBER(I'+f+')),DATE(YEAR(G'+f+')+I'+f+',MONTH(G'+f+'),DAY(G'+f+')),"")'
}
function netCommF_(r) {
  var f = String(r);
  return '=IF(OR(H'+f+'="",J'+f+'="",K'+f+'=""),"",ROUND(H'+f+'*J'+f+'/10000*K'+f+',2))';
}
function repeatF_(r) {
  var f = String(r);
  return '=IF(A'+f+'="","",IF(COUNTIFS($A$2:$A$500,A'+f+')>1,"🔁",""))';
}
function applyRowFmt_(sh, row) {
  var bg = row % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
  sh.getRange(row, 1, 1, NCOLS).setBackground(bg).setFontFamily('Arial').setFontSize(10);
  sh.getRange(row, CC.CLOSING).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, CC.AMOUNT).setNumberFormat('"$"#,##0');
  sh.getRange(row, CC.BPS).setNumberFormat('0');
  sh.getRange(row, CC.SPLIT).setNumberFormat('0%');
  sh.getRange(row, CC.NETCOMM).setNumberFormat('"$"#,##0.00');
  sh.getRange(row, CC.PAYDATE).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, CC.EXPDATE).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, CC.MATURITY).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, CC.STATUS).setHorizontalAlignment('center');
  sh.getRange(row, CC.REPEAT).setHorizontalAlignment('center');
  sh.getRange(row, CC.YEAR).setNumberFormat('0').setHorizontalAlignment('center');
}
function restripe_(sh) {
  var lr = sh.getLastRow();
  for (var r = 2; r <= lr; r++)
    sh.getRange(r, 1, 1, NCOLS).setBackground(r % 2 === 0 ? '#EEF2F7' : '#FFFFFF');
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPAIR — fixes bad data in Deals and rebuilds the Income Report in place.
// Safe to run any time. Select "REPAIR" from the dropdown and click Run.
// ═══════════════════════════════════════════════════════════════════════════════
function REPAIR() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) { ss.toast('⚠️ Deals sheet not found or empty.'); return; }
  var n = sh.getLastRow() - 1;

  ss.toast('Step 1/4: Fixing closing dates & text...');
  // Text closing dates (e.g. "Fri Jul 17 2026 00:00:00 GMT-0400 (...)") → real dates
  var gVals = sh.getRange(2, CC.CLOSING, n, 1).getValues();
  var fixedDates = 0;
  gVals.forEach(function(r, i) {
    var v = r[0];
    if (v && !(v instanceof Date)) {
      var d = new Date(String(v));
      if (!isNaN(d.getTime())) {
        gVals[i][0] = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        fixedDates++;
      }
    }
  });
  if (fixedDates) sh.getRange(2, CC.CLOSING, n, 1).setValues(gVals);
  sh.getRange(2, CC.CLOSING, n, 1).setNumberFormat('yyyy-mm-dd');

  // Normalize Source spelling so the source table groups correctly
  var eVals = sh.getRange(2, CC.SOURCE, n, 1).getValues();
  eVals.forEach(function(r, i) {
    var s = String(r[0] || '').trim();
    if (/^self[\s-]?sourced$/i.test(s)) s = 'Self-sourced';
    eVals[i][0] = s;
  });
  sh.getRange(2, CC.SOURCE, n, 1).setValues(eVals);

  // Fix Type typos (e.g. "Refiance")
  var tVals = sh.getRange(2, CC.TYPE, n, 1).getValues();
  tVals.forEach(function(r, i) {
    var s = String(r[0] || '').trim();
    if (/^refi/i.test(s) && s !== 'Refinance') s = 'Refinance';
    tVals[i][0] = s;
  });
  sh.getRange(2, CC.TYPE, n, 1).setValues(tVals);

  ss.toast('Step 2/4: Re-applying row formulas...');
  var reps = [], exps = [], mats = [];
  for (var i = 0; i < n; i++) {
    reps.push([repeatF_(i+2)]);
    exps.push([expDateF_(i+2)]);
    mats.push([maturityF_(i+2)]);
  }
  sh.getRange(2, CC.REPEAT,   n, 1).setFormulas(reps);
  sh.getRange(2, CC.EXPDATE,  n, 1).setFormulas(exps).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, CC.MATURITY, n, 1).setFormulas(mats).setNumberFormat('yyyy-mm-dd');

  ss.toast('Step 3/4: Re-applying overdue highlight...');
  var overdueRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($M2="'+S_AWAIT+'",ISNUMBER($O2),$O2<TODAY(),$N2="")')
    .setBackground('#FFCCCC')
    .setRanges([sh.getRange(2, 1, 499, NCOLS)])
    .build();
  sh.setConditionalFormatRules([overdueRule]);

  ss.toast('Step 4/4: Rebuilding Income Report...');
  buildDashboardTab_(ss, '#1B3A6B', '#C9A84C');

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    'REPAIR COMPLETE ✅\n\n'
    + 'Closing dates fixed: ' + fixedDates + '\n'
    + 'Formulas re-applied on ' + n + ' rows\n'
    + 'Income Report rebuilt.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME MIGRATION
// Select "MIGRATE" from the function dropdown and click Run.
// ═══════════════════════════════════════════════════════════════════════════════

// Public entry point — visible in the Apps Script function dropdown.
function MIGRATE() { runFullMigration_(); }

function runFullMigration_() {
  var ss   = SpreadsheetApp.getActive();
  var NAVY = '#1B3A6B';
  var GOLD = '#C9A84C';

  // Show all existing tab names so you can spot name mismatches
  var allNames = ss.getSheets().map(function(s) { return s.getName(); });
  Logger.log('Existing tabs: ' + allNames.join(' | '));

  // Guard: once the old source tabs are gone, re-running would wipe Deals.
  if (!ss.getSheetByName('2025 Funded') && !ss.getSheetByName('2026 Funded')) {
    SpreadsheetApp.getUi().alert(
      'Migration already completed — old source tabs no longer exist.\n'
      + 'Re-running would erase your Deals data.\n\n'
      + 'To fix data or rebuild the report, run REPAIR instead.');
    return;
  }

  ss.toast('Step 1/5: Reading deal data...');
  var deals25 = readFundedSheet_(ss, '2025 Funded', 2025);
  var deals26 = readFundedSheet_(ss, '2026 Funded', 2026);
  var all     = deals25.concat(deals26);
  all.sort(function(a, b) {
    var da = a.closing instanceof Date ? a.closing : new Date(a.closing);
    var db = b.closing instanceof Date ? b.closing : new Date(b.closing);
    return da - db;
  });

  ss.toast('Step 2/5: Building new tabs (' + all.length + ' deals)...');
  buildDealsTab_(ss, all, NAVY, GOLD);
  buildDashboardTab_(ss, NAVY, GOLD);
  buildInboxTab_(ss, NAVY, GOLD);
  buildSettingsTab_(ss, NAVY, GOLD);
  buildArchiveInfoTab_(ss);

  ss.toast('Step 3/5: Deleting old tabs...');
  ['2025 Funded','2026 Funded','Command Center','💼 Income Hub',
   'Month vs Month','Year Over Year','Source Stats','Lender Stats',
   'Referral Partners','Client Value','📋 Today\'s Actions',
   'Sanity Check','Reminder Log','_Debug'
  ].forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) try { ss.deleteSheet(s); } catch(e) {}
  });

  ss.toast('Step 4/5: Reordering tabs...');
  ['Deals','📊 Income Report','Inbox','Settings','Archive Info'].forEach(function(name, i) {
    var s = ss.getSheetByName(name);
    if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(i + 1); }
  });

  ss.toast('Step 5/5: Verifying...');
  SpreadsheetApp.flush();

  var ds   = ss.getSheetByName('Deals');
  var data = ds.getLastRow() > 1
    ? ds.getRange(2, 1, ds.getLastRow() - 1, NCOLS).getValues() : [];
  var counts = { p25:0, a25:0, e25:0, p26:0, a26:0, e26:0 };
  var comm   = { p25:0, p26:0 };
  data.forEach(function(r) {
    if (!r[CC.BORROWER-1]) return;
    var yr = r[CC.YEAR-1], st = r[CC.STATUS-1];
    var nc = parseFloat(r[CC.NETCOMM-1]) || 0;
    if (yr === 2025) {
      if (st === S_PAID) { counts.p25++; comm.p25 += nc; }
      else if (st === S_AWAIT) counts.a25++; else counts.e25++;
    } else {
      if (st === S_PAID) { counts.p26++; comm.p26 += nc; }
      else if (st === S_AWAIT) counts.a26++; else counts.e26++;
    }
  });
  var msg = 'MIGRATION COMPLETE ✅\n\n'
    + '2025: ' + (counts.p25+counts.a25+counts.e25) + ' deals'
    + '  (Paid=' + counts.p25 + ', Awaiting=' + counts.a25 + ', Pending=' + counts.e25 + ')\n'
    + '2025 Paid Comm: $' + comm.p25.toFixed(2) + '\n\n'
    + '2026: ' + (counts.p26+counts.a26+counts.e26) + ' deals'
    + '  (Paid=' + counts.p26 + ', Awaiting=' + counts.a26 + ', Pending=' + counts.e26 + ')\n'
    + '2026 Paid Comm: $' + comm.p26.toFixed(2) + '\n\n'
    + 'Expected: 2025=17, 2026=28\n'
    + 'Run installTriggers() next.';
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

// ─── readFundedSheet_ ─────────────────────────────────────────────────────────
// Old layout (1-indexed): A=row# | B=Borrower | C=Type | D=Source | E=Lender
//   F=Closing | G=Amount | H=Term | I=RateType | J=Rate | K=BPS | L=Split
//   M=GrossComm | N=NetComm | O=Notes | P=Email | Q=Phone | R=Maturity
//   S=Alert | T=Status | U=PayDate
function readFundedSheet_(ss, sheetName, year) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) { Logger.log('Sheet not found: "' + sheetName + '"'); return []; }
  if (sh.getLastRow() < 4) { Logger.log('Sheet "' + sheetName + '" has fewer than 4 rows'); return []; }
  Logger.log('Reading "' + sheetName + '": ' + sh.getLastRow() + ' rows, ' + sh.getLastColumn() + ' cols');
  var raw = sh.getRange(4, 1, sh.getLastRow() - 3, 21).getValues();
  var out = [];
  raw.forEach(function(r) {
    var borrower = String(r[1] || '').trim();
    if (!borrower || borrower.toUpperCase() === 'TOTALS' || borrower === 'Borrower') return;
    var notes = String(r[14] || '').trim();
    var email = String(r[15] || '').trim();
    var phone = String(r[16] || '').trim();
    if (email) notes = (notes ? notes + ' | ' : '') + 'Email: ' + email;
    if (phone) notes = (notes ? notes + ' | ' : '') + 'Phone: ' + phone;
    var oldSt = String(r[19] || '').trim();
    var newSt = oldSt === S_PAID ? S_PAID
              : oldSt.indexOf('Awaiting') > -1 ? S_AWAIT : S_PEND;
    var amt   = r[6]  !== '' ? parseFloat(r[6])  : '';
    var bps   = r[10] !== '' ? parseFloat(r[10]) : '';
    var split = r[11] !== '' ? parseFloat(r[11]) : '';
    var net   = r[13] !== '' ? parseFloat(r[13]) : '';
    var hasF  = (amt !== '' && amt > 0 && bps !== '' && bps > 0 && split !== '' && split > 0);
    out.push({
      borrower: borrower,
      year:     year,
      type:     String(r[2]  || '').trim(),
      source:   String(r[3]  || '').trim(),
      lender:   String(r[4]  || '').trim(),
      closing:  r[5],
      amount:   amt,
      term:     r[7] !== '' ? parseInt(r[7]) : '',
      bps:      bps,
      split:    split,
      net:      net,
      notes:    notes,
      hasFormula: hasF,
      status:   newSt,
      payDate:  r[20] || ''
    });
  });
  return out;
}

// ─── buildDealsTab_ ───────────────────────────────────────────────────────────
function buildDealsTab_(ss, deals, NAVY, GOLD) {
  var sh = ss.getSheetByName('Deals') || ss.insertSheet('Deals');
  sh.clear();
  sh.clearConditionalFormatRules();

  // A=200 B=60 C=55 D=120 E=110 F=100 G=120 H=80 I=55 J=65 K=60 L=110 M=120 N=105 O=130 P=110 Q=200
  [200,60,55,120,110,100,120,80,55,65,60,110,120,105,130,110,200]
    .forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });

  sh.getRange(1, 1, 1, NCOLS).setValues([[
    'Borrower','🔁','Year','Type','Source','Lender','Closing Date',
    'Amount','Term','BPS','Split','Net Comm','Status',
    'Pay Date','Expected Pay Date','Maturity','Notes'
  ]]).setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  sh.setRowHeight(1, 30);
  sh.setFrozenRows(1);

  if (deals.length) {
    var n = deals.length;

    // ── 1. Write all values in a single call ─────────────────────────────────
    var vals = deals.map(function(d) {
      return [
        d.borrower, '',
        d.year, d.type, d.source, d.lender, d.closing,
        d.amount, d.term, d.bps, d.split,
        d.hasFormula ? '' : (d.net || ''),
        d.status, d.payDate, '', '', d.notes || ''
      ];
    });
    sh.getRange(2, 1, n, NCOLS).setValues(vals);

    // ── 2. Set formula columns in bulk ───────────────────────────────────────
    sh.getRange(2, CC.REPEAT,   n, 1).setFormulas(deals.map(function(d, i) { return [repeatF_(i+2)];  }));
    sh.getRange(2, CC.EXPDATE,  n, 1).setFormulas(deals.map(function(d, i) { return [expDateF_(i+2)]; }));
    sh.getRange(2, CC.MATURITY, n, 1).setFormulas(deals.map(function(d, i) { return [maturityF_(i+2)]; }));
    // Net comm: only rows where all three inputs exist
    deals.forEach(function(d, i) {
      if (d.hasFormula) sh.getRange(i+2, CC.NETCOMM).setFormula(netCommF_(i+2));
    });

    // ── 3. Batch formatting ───────────────────────────────────────────────────
    var bgs = deals.map(function(d, i) {
      var bg = (i+2) % 2 === 0 ? '#EEF2F7' : '#FFFFFF';
      var row = []; for (var c = 0; c < NCOLS; c++) row.push(bg); return row;
    });
    sh.getRange(2, 1, n, NCOLS).setBackgrounds(bgs).setFontFamily('Arial').setFontSize(10);
    sh.getRange(2, CC.CLOSING,  n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, CC.AMOUNT,   n, 1).setNumberFormat('"$"#,##0');
    sh.getRange(2, CC.BPS,      n, 1).setNumberFormat('0');
    sh.getRange(2, CC.SPLIT,    n, 1).setNumberFormat('0%');
    sh.getRange(2, CC.NETCOMM,  n, 1).setNumberFormat('"$"#,##0.00');
    sh.getRange(2, CC.PAYDATE,  n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, CC.EXPDATE,  n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, CC.MATURITY, n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, CC.STATUS,   n, 1).setHorizontalAlignment('center');
    sh.getRange(2, CC.REPEAT,   n, 1).setHorizontalAlignment('center');
    sh.getRange(2, CC.YEAR,     n, 1).setNumberFormat('0').setHorizontalAlignment('center');
  }

  var statusDV = SpreadsheetApp.newDataValidation()
    .requireValueInList([S_PAID, S_AWAIT, S_PEND], true).setAllowInvalid(false).build();
  var typeDV = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Purchase','Refinance','Switch/Transfer','Renewal'], true).build();
  sh.getRange(2, CC.STATUS, 499, 1).setDataValidation(statusDV);
  sh.getRange(2, CC.TYPE,   499, 1).setDataValidation(typeDV);

  // Feature 3: Overdue CF — Status=Awaiting + ExpPayDate past + no PayDate yet → salmon
  // M=Status(13), N=PayDate(14), O=ExpDate(15)
  var overdueRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($M2="'+S_AWAIT+'",ISNUMBER($O2),$O2<TODAY(),$N2="")')
    .setBackground('#FFCCCC')
    .setRanges([sh.getRange(2, 1, 499, NCOLS)])
    .build();
  sh.setConditionalFormatRules([overdueRule]);

  SpreadsheetApp.flush();
}

// ─── buildDashboardTab_ ───────────────────────────────────────────────────────
function buildDashboardTab_(ss, NAVY, GOLD) {
  var sh = ss.getSheetByName('📊 Income Report') || ss.insertSheet('📊 Income Report');
  sh.clear();
  sh.getCharts().forEach(function(c) { sh.removeChart(c); });
  sh.clearConditionalFormatRules();

  var D  = 'Deals';
  var NC = 6;  // content in cols B–G
  [20,170,110,110,110,110,120].forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });

  // ── Row 1: Title ─────────────────────────────────────────────────────────
  sh.getRange(1,2,1,NC).merge().setValue('🏦  JM MORTGAGES — INCOME REPORT')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(16).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);

  // ── Rows 2–3: Big 4 KPIs ─────────────────────────────────────────────────
  // Deals cols after shift: C=Year, G=Closing, L=NetComm, M=Status, O=ExpPayDate
  var kpiLabels = ['✅  PAID YTD','🔄  AWAITING','⏳  PENDING','📅  NEXT CHEQUE'];
  var kpiBgs    = ['#1E4D2B','#7B4B00','#1F4E79', NAVY];
  var nextChqF  =
    '=IF(COUNTIFS('+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY())=0,"—",'
    + 'TEXT(MINIFS('+D+'!O:O,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY()),"Mmm d")&"  ·  $"'
    + '&TEXT(SUMIFS('+D+'!L:L,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,'
    + 'MINIFS('+D+'!O:O,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY())),"#,##0"))';
  var kpiF = [
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,YEAR(TODAY()),'+D+'!M:M,"'+S_PAID+'")',
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,YEAR(TODAY()),'+D+'!M:M,"'+S_AWAIT+'")',
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,YEAR(TODAY()),'+D+'!M:M,"'+S_PEND+'")',
    nextChqF
  ];
  sh.setRowHeight(2, 26); sh.setRowHeight(3, 52);
  for (var k = 0; k < 4; k++) {
    sh.getRange(2, 2+k).setValue(kpiLabels[k])
      .setBackground(kpiBgs[k]).setFontColor('#FFFFFF').setFontWeight('bold')
      .setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    var vc = sh.getRange(3, 2+k);
    vc.setBackground(kpiBgs[k]).setFontColor('#FFFFFF').setFontWeight('bold')
      .setFontSize(k < 3 ? 20 : 14).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    if (k < 3) vc.setFormula(kpiF[k]).setNumberFormat('"$"#,##0');
    else        vc.setFormula(kpiF[k]);
  }

  // ── Row 4: Goal pace line (Feature 4) ────────────────────────────────────
  // B3 = Paid YTD KPI; Settings!B4 = Annual Target
  sh.setRowHeight(4, 28);
  sh.getRange(4,2,1,NC).merge()
    .setFormula(
      '="YTD paid "&TEXT(B3,"$#,##0")'
      + '&" · on pace for "&TEXT(B3*(365/((TODAY()-DATE(YEAR(TODAY()),1,1))+1)),"$#,##0")'
      + '&" vs "&TEXT(Settings!B4,"$#,##0")&" goal ("'
      + '&TEXT(IFERROR(B3*(365/((TODAY()-DATE(YEAR(TODAY()),1,1))+1))/Settings!B4,0),"0%")&")"'
    )
    .setBackground('#FFF8E7').setFontColor(NAVY).setFontWeight('bold')
    .setFontSize(11).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  sh.setRowHeight(5, 10);

  // ── Rows 6–20: Monthly breakdown ─────────────────────────────────────────
  sh.getRange(6,2,1,NC).merge().setValue('📊  MONTHLY COMMISSION BREAKDOWN')
    .setBackground('#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(6, 28);

  ['Month','2025 Paid','2026 Paid','2026 Awaiting','2026 Pending','2026 Total'].forEach(function(h,i) {
    sh.getRange(7, 2+i).setValue(h).setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.setRowHeight(7, 24);

  ['January','February','March','April','May','June',
   'July','August','September','October','November','December'].forEach(function(mon, mi) {
    var r  = 8 + mi;
    var m  = mi + 1;
    var bg = mi % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
    sh.setRowHeight(r, 22);
    sh.getRange(r, 2).setValue(mon).setBackground(bg).setFontWeight('bold').setFontFamily('Arial').setFontSize(9);
    // C=Year, G=Closing, L=NetComm, M=Status.
    // ISNUMBER + IFERROR(MONTH(...)) so a text/blank date can't error the whole sum.
    var mkF = function(yr, st) {
      var stPart = st ? '*('+D+'!M$2:M$500="'+st+'")' : '';
      return '=SUMPRODUCT(('+D+'!C$2:C$500='+yr+')*ISNUMBER('+D+'!G$2:G$500)'
           + '*(IFERROR(MONTH('+D+'!G$2:G$500),0)='+m+')'+stPart+'*IFERROR(N('+D+'!L$2:L$500),0))';
    };
    sh.getRange(r,3).setFormula(mkF(2025,S_PAID)) .setNumberFormat('"$"#,##0').setHorizontalAlignment('right').setBackground(bg).setFontSize(9);
    sh.getRange(r,4).setFormula(mkF(2026,S_PAID)) .setNumberFormat('"$"#,##0').setHorizontalAlignment('right').setBackground(bg).setFontSize(9);
    sh.getRange(r,5).setFormula(mkF(2026,S_AWAIT)).setNumberFormat('"$"#,##0').setHorizontalAlignment('right').setBackground(bg).setFontSize(9);
    sh.getRange(r,6).setFormula(mkF(2026,S_PEND)) .setNumberFormat('"$"#,##0').setHorizontalAlignment('right').setBackground(bg).setFontSize(9);
    sh.getRange(r,7).setFormula('=D'+r+'+E'+r+'+F'+r)
      .setNumberFormat('"$"#,##0').setHorizontalAlignment('right').setBackground(bg).setFontWeight('bold').setFontSize(9);
  });

  // Row 20: TOTALS (months = rows 8–19)
  sh.setRowHeight(20, 26);
  sh.getRange(20,2,1,NC).setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontFamily('Arial').setFontSize(9);
  sh.getRange(20,2).setValue('TOTALS');
  ['C','D','E','F','G'].forEach(function(col) {
    sh.getRange(20, col.charCodeAt(0) - 64)
      .setFormula('=SUM('+col+'8:'+col+'19)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  });
  sh.setRowHeight(21, 10);

  // ── Rows 22–25: Year-over-year ────────────────────────────────────────────
  sh.getRange(22,2,1,NC).merge().setValue('📈  YEAR OVER YEAR — Same Period (Jan 1 → Today)')
    .setBackground('#276221').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11)
    .setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(22, 28);

  ['METRIC','2025 (thru today)','2026 (thru today)','Δ','% Change','2026 On-Pace'].forEach(function(h,i) {
    sh.getRange(23, 2+i).setValue(h).setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.setRowHeight(23, 24);

  var opf = '365/((TODAY()-DATE(YEAR(TODAY()),1,1))+1)';
  // C=Year, G=Closing, M=Status, L=NetComm
  [
    { label:'Deals funded',
      f25:'=SUMPRODUCT(('+D+'!C$2:C$500=2025)*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(2025,1,1))*('+D+'!G$2:G$500<=DATE(2025,MONTH(TODAY()),DAY(TODAY()))))',
      f26:'=SUMPRODUCT(('+D+'!C$2:C$500=2026)*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(2026,1,1))*('+D+'!G$2:G$500<=TODAY()))',
      fmt:'0', round:true },
    { label:'Comm received (paid)',
      f25:'=SUMPRODUCT(('+D+'!C$2:C$500=2025)*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(2025,1,1))*('+D+'!G$2:G$500<=DATE(2025,MONTH(TODAY()),DAY(TODAY())))*('+D+'!M$2:M$500="'+S_PAID+'")*IFERROR(N('+D+'!L$2:L$500),0))',
      f26:'=SUMPRODUCT(('+D+'!C$2:C$500=2026)*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(2026,1,1))*('+D+'!G$2:G$500<=TODAY())*('+D+'!M$2:M$500="'+S_PAID+'")*IFERROR(N('+D+'!L$2:L$500),0))',
      fmt:'"$"#,##0', round:false },
  ].forEach(function(m, i) {
    var r  = 24 + i;
    var bg = i % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
    sh.setRowHeight(r, 22);
    sh.getRange(r,2).setValue(m.label).setBackground(bg).setFontWeight('bold').setFontFamily('Arial').setFontSize(9);
    sh.getRange(r,3).setFormula(m.f25).setNumberFormat(m.fmt).setBackground(bg).setFontSize(9).setHorizontalAlignment('right');
    sh.getRange(r,4).setFormula(m.f26).setNumberFormat(m.fmt).setBackground(bg).setFontSize(9).setHorizontalAlignment('right');
    sh.getRange(r,5).setFormula('=IF(AND(C'+r+'=0,D'+r+'=0),"—",D'+r+'-C'+r+')')
      .setNumberFormat(m.fmt === '0' ? '+0;-0;"-"' : '+"$"#,##0;-"$"#,##0;"-"')
      .setBackground(bg).setFontSize(9).setHorizontalAlignment('right');
    sh.getRange(r,6).setFormula('=IFERROR(IF(C'+r+'=0,"—",(D'+r+'-C'+r+')/C'+r+'),"—")')
      .setNumberFormat('0.0%').setBackground(bg).setFontSize(9).setHorizontalAlignment('right');
    sh.getRange(r,7).setFormula(m.round ? '=IFERROR(ROUND(D'+r+'*('+opf+'),0),"")' : '=IFERROR(D'+r+'*('+opf+'),"")' )
      .setNumberFormat(m.fmt).setBackground('#FFF8E7').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('right');
  });
  sh.setRowHeight(26, 10);

  // ── Rows 27–45: Source Performance (Feature 2) — dynamic source list ──────
  // Sources are free-form in the data (Homewise, Self-sourced, Realtor, ...),
  // so the list is pulled live with UNIQUE instead of hardcoded names.
  sh.getRange(27,2,1,NC).merge().setValue('📊  SOURCE PERFORMANCE (this year vs last year)')
    .setBackground('#5C3A9E').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11)
    .setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(27, 28);

  ['Source','This Yr #','This Yr $','Last Yr #','Last Yr $'].forEach(function(h, i) {
    sh.getRange(28, 2+i).setValue(h).setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center');
  });
  sh.setRowHeight(28, 24);

  // B29 spills up to 16 unique sources; C–F compute per spilled row
  sh.getRange(29,2).setFormula(
    '=IFERROR(ARRAY_CONSTRAIN(SORT(UNIQUE(FILTER('+D+'!E$2:E$500,'+D+'!E$2:E$500<>""))),16,1),"—")'
  );
  for (var si = 0; si < 16; si++) {
    var sr = 29 + si;
    var bg2 = si % 2 === 0 ? '#FFFFFF' : '#F2F5FA';
    sh.setRowHeight(sr, 20);
    sh.getRange(sr,2,1,5).setBackground(bg2).setFontFamily('Arial').setFontSize(9);
    sh.getRange(sr,2).setFontWeight('bold');
    sh.getRange(sr,3).setFormula('=IF($B'+sr+'="","",COUNTIFS('+D+'!E$2:E$500,$B'+sr+','+D+'!C$2:C$500,YEAR(TODAY())))').setNumberFormat('0').setHorizontalAlignment('right');
    sh.getRange(sr,4).setFormula('=IF($B'+sr+'="","",SUMIFS('+D+'!L$2:L$500,'+D+'!E$2:E$500,$B'+sr+','+D+'!C$2:C$500,YEAR(TODAY())))').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(sr,5).setFormula('=IF($B'+sr+'="","",COUNTIFS('+D+'!E$2:E$500,$B'+sr+','+D+'!C$2:C$500,YEAR(TODAY())-1))').setNumberFormat('0').setHorizontalAlignment('right');
    sh.getRange(sr,6).setFormula('=IF($B'+sr+'="","",SUMIFS('+D+'!L$2:L$500,'+D+'!E$2:E$500,$B'+sr+','+D+'!C$2:C$500,YEAR(TODAY())-1))').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  }
  // Row 45: TOTAL
  sh.setRowHeight(45, 24);
  sh.getRange(45,2,1,5).setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontFamily('Arial').setFontSize(9);
  sh.getRange(45,2).setValue('TOTAL');
  sh.getRange(45,3).setFormula('=SUM(C29:C44)').setNumberFormat('0').setHorizontalAlignment('right');
  sh.getRange(45,4).setFormula('=SUM(D29:D44)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(45,5).setFormula('=SUM(E29:E44)').setNumberFormat('0').setHorizontalAlignment('right');
  sh.getRange(45,6).setFormula('=SUM(F29:F44)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.setRowHeight(46, 10);

  // ── Rows 47–48: Overdue payments (Feature 3) ──────────────────────────────
  // M=Status, O=ExpPayDate, N=PayDate
  sh.getRange(47,2,1,NC).merge().setValue('⚠️  OVERDUE PAYMENTS (awaiting · past expected pay date)')
    .setBackground('#C0392B').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11)
    .setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(47, 28);

  sh.setRowHeight(48, 26);
  sh.getRange(48,2).setValue('# Deals Overdue').setFontWeight('bold').setFontFamily('Arial').setFontSize(9).setBackground('#FFF2F2');
  sh.getRange(48,3)
    .setFormula('=COUNTIFS('+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,"<"&TODAY(),'+D+'!N$2:N$500,"")')
    .setNumberFormat('0').setBackground('#FFF2F2').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('right');
  sh.getRange(48,4).setValue('$ Commission Overdue').setFontWeight('bold').setFontFamily('Arial').setFontSize(9).setBackground('#FFF2F2');
  sh.getRange(48,5)
    .setFormula('=SUMIFS('+D+'!L$2:L$500,'+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,"<"&TODAY(),'+D+'!N$2:N$500,"")')
    .setNumberFormat('"$"#,##0').setBackground('#FFF2F2').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('right');
  sh.setRowHeight(49, 10);

  // ── Rows 50–52+: Renewal Radar (Feature 1) ────────────────────────────────
  // D=Type, G=Closing, P=Maturity, L=NetComm
  sh.getRange(50,2,1,NC).merge().setValue('🔄  RENEWAL RADAR (next ' + RENEWAL_DAYS + ' days)')
    .setBackground('#9C6500').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11)
    .setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(50, 28);

  ['Borrower','Type','Closing','Maturity','Net Comm'].forEach(function(h, i) {
    sh.getRange(51, 2+i).setValue(h).setBackground('#2C5F9E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center');
  });
  sh.setRowHeight(51, 22);

  // FILTER spills starting at B52; comparisons only (no subtraction) so a ""
  // maturity can never produce #VALUE!.
  sh.getRange(52,2).setFormula(
    '=IFERROR(SORT(FILTER('
    + 'CHOOSE({1,2,3,4,5},'+D+'!A$2:A$500,'+D+'!D$2:D$500,'+D+'!G$2:G$500,'+D+'!P$2:P$500,'+D+'!L$2:L$500),'
    + 'ISNUMBER('+D+'!P$2:P$500)*('+D+'!P$2:P$500>=TODAY())*('+D+'!P$2:P$500<=(TODAY()+'+RENEWAL_DAYS+'))'
    + '),4,1),"No renewals due within '+RENEWAL_DAYS+' days")'
  );
  sh.getRange(52, 4, 25, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(52, 5, 25, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(52, 6, 25, 1).setNumberFormat('"$"#,##0');

  // Renewal urgency CF — urgent ≤30 days = red, warning ≤60 days = yellow
  var urgentRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($E52),$E52>=TODAY(),$E52<=TODAY()+30)')
    .setBackground('#FF9999')
    .setRanges([sh.getRange(52, 2, 25, 5)])
    .build();
  var warnRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($E52),$E52>=TODAY(),$E52<=TODAY()+60)')
    .setBackground('#FFE599')
    .setRanges([sh.getRange(52, 2, 25, 5)])
    .build();
  sh.setConditionalFormatRules([urgentRule, warnRule]);

  // ── Chart: monthly 2025 vs 2026 Paid (col headers row 7, months rows 8–19) ─
  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(7, 2, 13, 1))
    .addRange(sh.getRange(7, 3, 13, 1))
    .addRange(sh.getRange(7, 4, 13, 1))
    .setNumHeaders(1)
    .setOption('title', 'Monthly Commission: 2025 vs 2026 Paid')
    .setOption('titleTextStyle', {fontSize:13, bold:true, color:NAVY})
    .setOption('legend', {position:'bottom'})
    .setOption('series', {0:{color:'#4472C4'}, 1:{color:'#70AD47'}})
    .setOption('vAxis', {format:'$#,##0', minValue:0})
    .setOption('bar',  {groupWidth:'65%'})
    .setPosition(80, 2, 0, 0)
    .setOption('width', 650).setOption('height', 300)
    .build());

  sh.setFrozenRows(1);
  SpreadsheetApp.flush();
}

// ─── buildInboxTab_ ───────────────────────────────────────────────────────────
function buildInboxTab_(ss, NAVY, GOLD) {
  var sh = ss.getSheetByName('Inbox') || ss.insertSheet('Inbox');
  sh.clear();
  [20,190,55,110,100,100,120,55,65,60,110,200].forEach(function(w,i) { sh.setColumnWidth(i+1, w); });

  sh.getRange(1,1,1,12).merge().setValue('📥  INBOX — Fill rows below, then run ➕ Process Inbox')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(13)
    .setFontFamily('Arial').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 36);

  sh.getRange(2,1,1,12).setValues([['Borrower','Year','Type','Source','Lender',
    'Closing Date','Amount','Term','BPS','Split','Net Comm','Notes']])
    .setBackground('#2C5F9E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontFamily('Arial').setFontSize(9);
  sh.setRowHeight(2, 26);
  sh.setFrozenRows(2);

  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Purchase','Refinance','Switch/Transfer','Renewal'], true).build();
  var srcRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Self-Sourced','HW Pre-Approval','HW Switch/Refi'], true).build();
  sh.getRange(3, 3, 50, 1).setDataValidation(typeRule);
  sh.getRange(3, 4, 50, 1).setDataValidation(srcRule);
  sh.getRange(3, 2, 50, 1).setNumberFormat('0');
  sh.getRange(3, 6, 50, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(3, 7, 50, 1).setNumberFormat('"$"#,##0');
  sh.getRange(3,10, 50, 1).setNumberFormat('0%');
  sh.getRange(3,11, 50, 1).setNumberFormat('"$"#,##0.00');
  SpreadsheetApp.flush();
}

// ─── buildSettingsTab_ ────────────────────────────────────────────────────────
function buildSettingsTab_(ss, NAVY, GOLD) {
  var sh = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  sh.clear();
  [20,200,120].forEach(function(w,i) { sh.setColumnWidth(i+1, w); });
  sh.getRange(1,1,1,2).merge().setValue('⚙️  Settings')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(13).setFontFamily('Arial');
  sh.setRowHeight(1, 32);
  var rows = [
    ['Broker Name','Jake Murrant'],
    ['Broker Email','jake@thinkhomewise.com'],
    ['Annual Target',150000],
    ['Renewal Days',120],
    [''],
    ['Split Table — Source','Split'],
    ['Self-Sourced',0.9],
    ['HW Pre-Approval',0.4],
    ['HW Switch/Refi',0.35],
  ];
  rows.forEach(function(r, i) {
    if (r[0]) sh.getRange(i+2,1).setValue(r[0]).setFontWeight('bold');
    if (r[1] !== undefined) sh.getRange(i+2,2).setValue(r[1]);
  });
  sh.getRange(4,2).setNumberFormat('"$"#,##0');  // Annual Target
  sh.getRange(8,2,3,1).setNumberFormat('0%');
  SpreadsheetApp.flush();
}

// ─── buildArchiveInfoTab_ ─────────────────────────────────────────────────────
function buildArchiveInfoTab_(ss) {
  var sh = ss.getSheetByName('Archive Info') || ss.insertSheet('Archive Info');
  sh.clear();
  [20,180,400].forEach(function(w,i) { sh.setColumnWidth(i+1, w); });
  sh.getRange(1,1,4,2).setValues([
    ['Archive Copy','JM Tracker — ARCHIVE pre-simplification'],
    ['Archive Date','2026-07-09'],
    ['Archive ID','1faXW1Ss7zOl_BBOmcjTZAENGF1DWcEAWTmg6ydd5-0A'],
    ['Note','Spreadsheet simplified 2026-07-09. Archive contains all original tabs and script.'],
  ]);
  sh.getRange(1,1,4,1).setFontWeight('bold');
  SpreadsheetApp.flush();
}
