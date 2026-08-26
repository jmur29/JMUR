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
  try {
    SpreadsheetApp.getUi().createMenu('🏦 JM Tracker')
      .addItem('➕ Process Inbox',       'addDealFromInbox')
      .addItem('🔔 Send Renewal Emails', 'sendRenewalReminders')
      .addItem('🔧 Repair Data & Report','REPAIR')
      .addToUi();
  } catch (e) {
    // No UI in this context (e.g. run from the editor) — menu is added
    // automatically whenever the spreadsheet is opened in a browser.
  }
}

// ─── onEdit ───────────────────────────────────────────────────────────────────
// Typing a Pay Date flips Status → Paid, then the edited row self-heals:
// missing Year/Status/formulas/formatting are filled in automatically.
function onEdit(e) {
  if (!e) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== 'Deals') return;
  var row = e.range.getRow();
  if (row < 2) return;
  if (e.range.getColumn() === CC.PAYDATE && e.range.getValue())
    sh.getRange(row, CC.STATUS).setValue(S_PAID);
  smartFillRow_(sh, row);
}
function onEditHandler(e) { onEdit(e); }

// ─── smartFillRow_ ────────────────────────────────────────────────────────────
// Fills anything missing on a Deals row without ever clobbering manual values:
// Year from Closing Date, default Status, Repeat/ExpDate/Maturity/NetComm
// formulas (only when the cell is empty), and row formatting.
function smartFillRow_(sh, row) {
  if (!sh.getRange(row, CC.BORROWER).getValue()) return;
  var g  = sh.getRange(row, CC.CLOSING).getValue();
  var yC = sh.getRange(row, CC.YEAR);
  if (!yC.getValue() && g instanceof Date) yC.setValue(g.getFullYear());
  var sC = sh.getRange(row, CC.STATUS);
  if (!sC.getValue()) sC.setValue(S_PEND);
  if (!sh.getRange(row, CC.REPEAT).getFormula())
    sh.getRange(row, CC.REPEAT).setFormula(repeatF_(row));
  var oC = sh.getRange(row, CC.EXPDATE);
  if (!oC.getValue() && !oC.getFormula()) oC.setFormula(expDateF_(row));
  var pC = sh.getRange(row, CC.MATURITY);
  if (!pC.getValue() && !pC.getFormula()) pC.setFormula(maturityF_(row));
  var lC = sh.getRange(row, CC.NETCOMM);
  if (!lC.getValue() && !lC.getFormula()) lC.setFormula(netCommF_(row));
  applyRowFmt_(sh, row);
}

// ─── dailyStatusFlip ──────────────────────────────────────────────────────────
// 7 am trigger: Pending → Awaiting when Closing Date has passed, then a
// self-heal sweep — every row gets missing formulas/formats filled and the
// stripe banding is fixed after any manual sorting or row moves.
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
    smartFillRow_(sh, i + 2);
  });
  restripe_(sh);
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
// Alert if a UI is available, otherwise toast + log (getUi() throws in some
// run contexts, e.g. when the sheet isn't open in a browser tab).
function say_(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    try { SpreadsheetApp.getActive().toast(msg.split('\n')[0] + ' — details in Execution log'); } catch (e2) {}
  }
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

  // Normalize lender spelling so the lender table groups correctly
  var lVals = sh.getRange(2, CC.LENDER, n, 1).getValues();
  lVals.forEach(function(r, i) {
    var s = String(r[0] || '').trim();
    if (/^scotia/i.test(s)) s = 'Scotia';
    else if (/^pine/i.test(s)) s = 'Pine';
    else if (/^first national/i.test(s)) s = 'First National';
    else if (/^strive/i.test(s)) s = 'Strive';
    else if (/^hosper/i.test(s)) s = 'Hosper';
    lVals[i][0] = s;
  });
  sh.getRange(2, CC.LENDER, n, 1).setValues(lVals);

  // Fix Type typos (e.g. "Refiance")
  var tVals = sh.getRange(2, CC.TYPE, n, 1).getValues();
  tVals.forEach(function(r, i) {
    var s = String(r[0] || '').trim();
    if (/^refi/i.test(s) && s !== 'Refinance') s = 'Refinance';
    tVals[i][0] = s;
  });
  sh.getRange(2, CC.TYPE, n, 1).setValues(tVals);

  ss.toast('Step 2/4: Re-applying row formulas...');
  // Static manual values (e.g. a brokerage-confirmed Expected Pay Date) are
  // kept; only empty or already-formula cells get the standard formula.
  var oVals = sh.getRange(2, CC.EXPDATE,  n, 1).getValues();
  var oFors = sh.getRange(2, CC.EXPDATE,  n, 1).getFormulas();
  var pVals = sh.getRange(2, CC.MATURITY, n, 1).getValues();
  var pFors = sh.getRange(2, CC.MATURITY, n, 1).getFormulas();
  for (var i = 0; i < n; i++) {
    var r = i + 2;
    sh.getRange(r, CC.REPEAT).setFormula(repeatF_(r));
    if (!(oVals[i][0] && !oFors[i][0])) sh.getRange(r, CC.EXPDATE).setFormula(expDateF_(r));
    if (!(pVals[i][0] && !pFors[i][0])) sh.getRange(r, CC.MATURITY).setFormula(maturityF_(r));
  }
  sh.getRange(2, CC.EXPDATE,  n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, CC.MATURITY, n, 1).setNumberFormat('yyyy-mm-dd');

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
  say_(
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
    say_(
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
  say_(msg);
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
// Layout (cols B–G, col A/H gutters, chart docked at col I):
//   1 title · 3–5 status cards · 7–9 outlook cards
//   11–26 monthly revenue (LY vs TY, growth, pipeline, cumulative + TOTAL/AVG)
//   28–32 year-over-year · 34–52 source · 54–72 lender
//   74–75 cash flow watch · 77+ renewal radar
// One table per fact — no number appears in two sections. All year references
// are dynamic (YEAR(TODAY())) so the report rolls over every January untouched.
function buildDashboardTab_(ss, NAVY, GOLD) {
  var sh = ss.getSheetByName('📊 Income Report') || ss.insertSheet('📊 Income Report');
  sh.clear();
  sh.getCharts().forEach(function(c) { sh.removeChart(c); });
  sh.clearConditionalFormatRules();
  sh.setHiddenGridlines(true);

  var D    = 'Deals';
  var NC   = 6;                              // content columns B–G
  var FONT = 'Inter';
  var INK  = '#1F2A3D', MUT = '#5A6B85';
  var GRN  = '#1E6B3C', AMB = '#976A17', BLU = '#44618F', RED = '#B3362B';
  var CARD2 = '#F4F6FA', BAND = '#F1F3F6', TOTBG = '#EDF1F7';

  [24,150,105,105,105,105,115,24].forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
  sh.getRange(1,1,125,10).setBackground('#FFFFFF').setFontFamily(FONT).setFontSize(9).setFontColor(INK);

  // Section header: left-aligned navy text over a thin rule
  function hdr(row, txt) {
    sh.getRange(row,2,1,NC).merge().setValue(txt)
      .setFontColor(NAVY).setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('left').setVerticalAlignment('bottom');
    sh.getRange(row,2,1,NC)
      .setBorder(null,null,true,null,null,null,NAVY,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(row, 34);
  }
  // Column header strip; entries starting with '=' are formulas (dynamic years)
  function heads(row, arr) {
    for (var i = 0; i < NC; i++) {
      var c = sh.getRange(row,2+i);
      var v = arr[i] || '';
      if (String(v).charAt(0) === '=') c.setFormula(v); else c.setValue(v);
      c.setBackground(BAND).setFontColor(MUT).setFontWeight('bold').setFontSize(8)
       .setHorizontalAlignment(i===0?'left':'right').setVerticalAlignment('middle');
    }
    sh.setRowHeight(row, 20);
  }
  // KPI card: label / value / subline stacked in a 2-col block
  function card(rowTop, colLeft, label, valueF, subF, bg, fg, subFg, fmt) {
    sh.getRange(rowTop, colLeft, 3, 2).setBackground(bg)
      .setBorder(true,true,true,true,null,null,'#FFFFFF',SpreadsheetApp.BorderStyle.SOLID_THICK);
    sh.getRange(rowTop, colLeft, 1, 2).merge().setValue(label)
      .setFontColor(subFg).setFontSize(8).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('bottom');
    var V = sh.getRange(rowTop+1, colLeft, 1, 2).merge().setFormula(valueF)
      .setFontColor(fg).setFontSize(18).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    if (fmt) V.setNumberFormat(fmt);
    sh.getRange(rowTop+2, colLeft, 1, 2).merge().setFormula(subF)
      .setFontColor(subFg).setFontSize(8)
      .setHorizontalAlignment('center').setVerticalAlignment('top');
  }

  // ── Row 1: title band with live date ──────────────────────────────────────
  sh.getRange(1,1,1,8).setBackground(NAVY);
  sh.getRange(1,2,1,NC+1).merge()
    .setFormula('="🏦  JM MORTGAGES — INCOME REPORT     ·     "&TEXT(TODAY(),"mmmm d, yyyy")')
    .setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(1, 46);
  sh.setRowHeight(2, 12);

  // ── Rows 3–5: status cards (this year's money by state) ────────────────────
  // Deals cols: C=Year, G=Closing, H=Amount, L=NetComm, M=Status, O=ExpPayDate
  var Y = 'YEAR(TODAY())';
  sh.setRowHeight(3,18); sh.setRowHeight(4,36); sh.setRowHeight(5,18);
  card(3,2,'PAID YTD',
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,'+Y+','+D+'!M:M,"'+S_PAID+'")',
    '=COUNTIFS('+D+'!C:C,'+Y+','+D+'!M:M,"'+S_PAID+'")&" deals paid"',
    GRN,'#FFFFFF','#D3E5DA','"$"#,##0');
  card(3,4,'AWAITING PAYMENT',
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,'+Y+','+D+'!M:M,"'+S_AWAIT+'")',
    '=COUNTIFS('+D+'!C:C,'+Y+','+D+'!M:M,"'+S_AWAIT+'")&" funded, cheque pending"',
    AMB,'#FFFFFF','#EBDDC3','"$"#,##0');
  card(3,6,'PENDING CLOSE',
    '=SUMIFS('+D+'!L:L,'+D+'!C:C,'+Y+','+D+'!M:M,"'+S_PEND+'")',
    '=COUNTIFS('+D+'!C:C,'+Y+','+D+'!M:M,"'+S_PEND+'")&" deals in pipeline"',
    BLU,'#FFFFFF','#CDD9EA','"$"#,##0');
  sh.setRowHeight(6, 8);

  // ── Rows 7–9: outlook cards ────────────────────────────────────────────────
  sh.setRowHeight(7,18); sh.setRowHeight(8,36); sh.setRowHeight(9,18);
  var awaitCnt = 'COUNTIFS('+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY())';
  var nextDate = 'MINIFS('+D+'!O:O,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY())';
  // "Cheque run" = everything expected within 6 days of the earliest upcoming
  // date, since the brokerage pays same-run deals together.
  var runEnd   = '('+nextDate+'+6)';
  var runMax   = 'MAXIFS('+D+'!O:O,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY(),'+D+'!O:O,"<="&'+runEnd+')';
  card(7,2,'NEXT CHEQUE RUN',
    '=IF('+awaitCnt+'=0,"—",TEXT(SUMIFS('+D+'!L:L,'+D+'!M:M,"'+S_AWAIT+'",'+D+'!O:O,">"&TODAY(),'+D+'!O:O,"<="&'+runEnd+'),"$#,##0"))',
    '=IF('+awaitCnt+'=0,"no cheques scheduled","expected "&TEXT('+nextDate+',"mmm d")'
      + '&IF('+runMax+'>'+nextDate+',"–"&TEXT('+runMax+',"mmm d"),""))',
    CARD2,NAVY,MUT,null);
  card(7,4,'PROJECTED YEAR-END',
    '=B4*365/((TODAY()-DATE(YEAR(TODAY()),1,1))+1)',
    '=IFERROR("goal: "&TEXT(Settings!B4,"$#,##0"),"goal not set")',
    CARD2,NAVY,MUT,'"$"#,##0');
  card(7,6,'GOAL PROGRESS',
    '=IFERROR(D8/Settings!B4,0)',
    '=IFERROR(SPARKLINE(MIN(B4,Settings!B4),{"charttype","bar";"max",Settings!B4;"color1","'+NAVY+'"}),"")',
    CARD2,NAVY,MUT,'0%');
  sh.setRowHeight(10, 14);

  // ── Rows 11–26: monthly revenue — the single monthly table ─────────────────
  // LY paid · TY paid · growth % · TY awaiting · TY pending
  hdr(11, 'MONTHLY REVENUE — THIS YEAR VS LAST');
  heads(12, ['Month',
    '=(YEAR(TODAY())-1)&" Paid"', '=YEAR(TODAY())&" Paid"',
    '% Growth', '=YEAR(TODAY())&" Awaiting"', '=YEAR(TODAY())&" Pending"']);

  ['January','February','March','April','May','June',
   'July','August','September','October','November','December'].forEach(function(mon, mi) {
    var r = 13 + mi, m = mi + 1;
    sh.setRowHeight(r, 21);
    sh.getRange(r,2).setValue(mon);
    // ISNUMBER + IFERROR(MONTH(...)) so one bad date can't error the whole sum
    var mkF = function(yrExpr, stPart) {
      return '=SUMPRODUCT(('+D+'!C$2:C$500='+yrExpr+')*ISNUMBER('+D+'!G$2:G$500)'
           + '*(IFERROR(MONTH('+D+'!G$2:G$500),0)='+m+')'+stPart+'*IFERROR(N('+D+'!L$2:L$500),0))';
    };
    var paid  = '*('+D+'!M$2:M$500="'+S_PAID+'")';
    var await_= '*('+D+'!M$2:M$500="'+S_AWAIT+'")';
    var pend  = '*('+D+'!M$2:M$500="'+S_PEND+'")';
    sh.getRange(r,3).setFormula(mkF('(YEAR(TODAY())-1)', paid))
      .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(r,4).setFormula(mkF('YEAR(TODAY())', paid))
      .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    // Growth only for months that have started — never a fake -100% for the future
    sh.getRange(r,5).setFormula('=IF('+m+'>=MONTH(TODAY()),"—",IF(C'+r+'=0,"—",(D'+r+'-C'+r+')/C'+r+'))')
      .setNumberFormat('+0.0%;-0.0%;"—"').setFontWeight('bold').setHorizontalAlignment('right');
    sh.getRange(r,6).setFormula(mkF('YEAR(TODAY())', await_))
      .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(r,7).setFormula(mkF('YEAR(TODAY())', pend))
      .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(r,2,1,NC)
      .setBorder(null,null,true,null,null,null,'#EEF1F6',SpreadsheetApp.BorderStyle.SOLID);
  });
  // Row 25: TOTAL · Row 26: AVG / MONTH
  sh.setRowHeight(25, 24);
  sh.getRange(25,2,1,NC).setBackground(TOTBG).setFontWeight('bold')
    .setBorder(true,null,null,null,null,null,NAVY,SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(25,2).setValue('TOTAL');
  sh.getRange(25,3).setFormula('=SUM(C13:C24)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(25,4).setFormula('=SUM(D13:D24)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(25,5).setFormula('=IF(C25=0,"—",(D25-C25)/C25)')
    .setNumberFormat('+0.0%;-0.0%;"—"').setHorizontalAlignment('right');
  sh.getRange(25,6).setFormula('=SUM(F13:F24)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(25,7).setFormula('=SUM(G13:G24)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.setRowHeight(26, 24);
  sh.getRange(26,2,1,NC).setBackground(TOTBG).setFontWeight('bold');
  sh.getRange(26,2).setValue('AVG / MONTH');
  sh.getRange(26,3).setFormula('=C25/12').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(26,4).setFormula('=IFERROR(D25/MONTH(TODAY()),0)').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
  sh.getRange(26,5).setFormula('=IF(C26=0,"—",(D26-C26)/C26)')
    .setNumberFormat('+0.0%;-0.0%;"—"').setHorizontalAlignment('right');
  sh.setRowHeight(27, 14);

  // ── Rows 28–32: year over year (same calendar window both years) ───────────
  hdr(28, 'YEAR OVER YEAR — SAME PERIOD (JAN 1 → TODAY)');
  heads(29, ['Metric',
    '=(YEAR(TODAY())-1)&" (thru today)"', '=YEAR(TODAY())&" (thru today)"',
    'Δ','% Change','=YEAR(TODAY())&" On-Pace"']);

  var opf = '365/((TODAY()-DATE(YEAR(TODAY()),1,1))+1)';
  var pyWin = '*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(YEAR(TODAY())-1,1,1))'
            + '*('+D+'!G$2:G$500<=DATE(YEAR(TODAY())-1,MONTH(TODAY()),DAY(TODAY())))';
  var cyWin = '*ISNUMBER('+D+'!G$2:G$500)*('+D+'!G$2:G$500>=DATE(YEAR(TODAY()),1,1))'
            + '*('+D+'!G$2:G$500<=TODAY())';
  [
    { label:'Deals funded',
      fPY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY())-1)'+pyWin+')',
      fCY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY()))'+cyWin+')',
      fmt:'0', round:true },
    { label:'Commission received',
      fPY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY())-1)'+pyWin+'*('+D+'!M$2:M$500="'+S_PAID+'")*IFERROR(N('+D+'!L$2:L$500),0))',
      fCY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY()))'+cyWin+'*('+D+'!M$2:M$500="'+S_PAID+'")*IFERROR(N('+D+'!L$2:L$500),0))',
      fmt:'"$"#,##0', round:false },
    { label:'Loan volume funded',
      fPY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY())-1)'+pyWin+'*IFERROR(N('+D+'!H$2:H$500),0))',
      fCY:'=SUMPRODUCT(('+D+'!C$2:C$500=YEAR(TODAY()))'+cyWin+'*IFERROR(N('+D+'!H$2:H$500),0))',
      fmt:'"$"#,##0', round:false },
  ].forEach(function(m, i) {
    var r = 30 + i;
    sh.setRowHeight(r, 21);
    sh.getRange(r,2).setValue(m.label);
    sh.getRange(r,3).setFormula(m.fPY).setNumberFormat(m.fmt).setHorizontalAlignment('right');
    sh.getRange(r,4).setFormula(m.fCY).setNumberFormat(m.fmt).setHorizontalAlignment('right');
    sh.getRange(r,5).setFormula('=IF(AND(C'+r+'=0,D'+r+'=0),"—",D'+r+'-C'+r+')')
      .setNumberFormat(m.fmt==='0' ? '+0;-0;"—"' : '+"$"#,##0;-"$"#,##0;"—"')
      .setFontWeight('bold').setHorizontalAlignment('right');
    sh.getRange(r,6).setFormula('=IFERROR(IF(C'+r+'=0,"—",(D'+r+'-C'+r+')/C'+r+'),"—")')
      .setNumberFormat('+0.0%;-0.0%;"—"').setFontWeight('bold').setHorizontalAlignment('right');
    sh.getRange(r,7).setFormula(m.round
        ? '=IFERROR(ROUND(D'+r+'*('+opf+'),0),"")'
        : '=IFERROR(D'+r+'*('+opf+'),"")')
      .setNumberFormat(m.fmt).setBackground('#FBF7EC').setFontWeight('bold').setHorizontalAlignment('right');
    sh.getRange(r,2,1,NC)
      .setBorder(null,null,true,null,null,null,'#EEF1F6',SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(33, 14);

  // Generic breakdown table: dynamic UNIQUE list over a Deals column, with
  // this-year vs last-year deal counts, commission AND loan volume, TOTAL row.
  function breakdown(hdrRow, title, label, colLetter, nRows) {
    hdr(hdrRow, title);
    heads(hdrRow+1, [label,'#','Comm YTD','Volume YTD','LY Comm','LY Volume']);
    var first = hdrRow + 2, last = first + nRows - 1;
    var K = D+'!'+colLetter+'$2:'+colLetter+'$500';
    sh.getRange(first,2).setFormula(
      '=IFERROR(ARRAY_CONSTRAIN(SORT(UNIQUE(FILTER('+K+','+K+'<>""))),'+nRows+',1),"—")');
    for (var i = 0; i < nRows; i++) {
      var r = first + i;
      sh.setRowHeight(r, 19);
      sh.getRange(r,3).setFormula('=IF($B'+r+'="","",COUNTIFS('+K+',$B'+r+','+D+'!C$2:C$500,YEAR(TODAY())))')
        .setNumberFormat('0').setHorizontalAlignment('right');
      sh.getRange(r,4).setFormula('=IF($B'+r+'="","",SUMIFS('+D+'!L$2:L$500,'+K+',$B'+r+','+D+'!C$2:C$500,YEAR(TODAY())))')
        .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
      sh.getRange(r,5).setFormula('=IF($B'+r+'="","",SUMIFS('+D+'!H$2:H$500,'+K+',$B'+r+','+D+'!C$2:C$500,YEAR(TODAY())))')
        .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
      sh.getRange(r,6).setFormula('=IF($B'+r+'="","",SUMIFS('+D+'!L$2:L$500,'+K+',$B'+r+','+D+'!C$2:C$500,YEAR(TODAY())-1))')
        .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
      sh.getRange(r,7).setFormula('=IF($B'+r+'="","",SUMIFS('+D+'!H$2:H$500,'+K+',$B'+r+','+D+'!C$2:C$500,YEAR(TODAY())-1))')
        .setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
      sh.getRange(r,2,1,NC)
        .setBorder(null,null,true,null,null,null,'#EEF1F6',SpreadsheetApp.BorderStyle.SOLID);
    }
    var tr = last + 1;
    sh.setRowHeight(tr, 24);
    sh.getRange(tr,2,1,NC).setBackground(TOTBG).setFontWeight('bold')
      .setBorder(true,null,null,null,null,null,NAVY,SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(tr,2).setValue('TOTAL');
    sh.getRange(tr,3).setFormula('=SUM(C'+first+':C'+last+')').setNumberFormat('0').setHorizontalAlignment('right');
    sh.getRange(tr,4).setFormula('=SUM(D'+first+':D'+last+')').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(tr,5).setFormula('=SUM(E'+first+':E'+last+')').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(tr,6).setFormula('=SUM(F'+first+':F'+last+')').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.getRange(tr,7).setFormula('=SUM(G'+first+':G'+last+')').setNumberFormat('"$"#,##0').setHorizontalAlignment('right');
    sh.setRowHeight(tr+1, 14);
  }

  // ── Rows 34–53: source performance ─────────────────────────────────────────
  breakdown(34, 'SOURCE PERFORMANCE — DEALS, COMMISSION & VOLUME', 'Source', 'E', 16);

  // ── Rows 54–73: lender breakdown ───────────────────────────────────────────
  breakdown(54, 'LENDER BREAKDOWN — WHERE THE VOLUME IS GOING', 'Lender', 'F', 16);

  // ── Rows 74–91: cash flow — upcoming cheques ───────────────────────────────
  // Stats strip, then every Awaiting deal sorted by expected pay date so you
  // can see exactly who is paying when.
  hdr(74, 'CASH FLOW — UPCOMING CHEQUES');
  sh.setRowHeight(75, 26);
  sh.getRange(75,2).setValue('Overdue cheques').setFontColor(MUT);
  sh.getRange(75,3)
    .setFormula('=COUNTIFS('+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,"<"&TODAY(),'+D+'!N$2:N$500,"")')
    .setNumberFormat('0').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange(75,4).setValue('$ overdue').setFontColor(MUT).setHorizontalAlignment('right');
  sh.getRange(75,5)
    .setFormula('=SUMIFS('+D+'!L$2:L$500,'+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,"<"&TODAY(),'+D+'!N$2:N$500,"")')
    .setNumberFormat('"$"#,##0').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange(75,6).setValue('Due next 30 days').setFontColor(MUT).setHorizontalAlignment('right');
  sh.getRange(75,7)
    .setFormula('=SUMIFS('+D+'!L$2:L$500,'+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,">="&TODAY(),'+D+'!O$2:O$500,"<="&(TODAY()+30))')
    .setNumberFormat('"$"#,##0').setFontWeight('bold').setHorizontalAlignment('right');
  heads(76, ['Expected','Borrower','Lender','Net Comm','','']);
  sh.getRange(77,2).setFormula(
    '=IFERROR(SORT(FILTER('
    + '{'+D+'!O$2:O$500,'+D+'!A$2:A$500,'+D+'!F$2:F$500,'+D+'!L$2:L$500},'
    + D+'!M$2:M$500="'+S_AWAIT+'"'
    + '),1,1),"No cheques awaiting")');
  sh.getRange(77,2,15,1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(77,5,15,1).setNumberFormat('"$"#,##0');
  sh.setRowHeight(92, 14);

  // ── Rows 93+: renewal radar ────────────────────────────────────────────────
  hdr(93, 'RENEWAL RADAR — NEXT ' + RENEWAL_DAYS + ' DAYS');
  heads(94, ['Borrower','Type','Closing','Maturity','Net Comm','']);
  // Comparisons only (no date subtraction) so "" can never produce #VALUE!
  sh.getRange(95,2).setFormula(
    '=IFERROR(SORT(FILTER('
    + '{'+D+'!A$2:A$500,'+D+'!D$2:D$500,'+D+'!G$2:G$500,'+D+'!P$2:P$500,'+D+'!L$2:L$500},'
    + 'ISNUMBER('+D+'!P$2:P$500)*('+D+'!P$2:P$500>=TODAY())*('+D+'!P$2:P$500<=(TODAY()+'+RENEWAL_DAYS+'))'
    + '),4,1),"No renewals due within '+RENEWAL_DAYS+' days")');
  sh.getRange(95,4,25,2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(95,6,25,1).setNumberFormat('"$"#,##0');

  // ── Conditional formatting ─────────────────────────────────────────────────
  var rules = [
    // highlight the current month row
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$B13=TEXT(TODAY(),"mmmm")')
      .setBackground('#EAF1FB')
      .setRanges([sh.getRange(13,2,12,NC)]).build(),
    // growth column: green up, red down (months + TOTAL + AVG rows)
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(E13),E13>0)')
      .setFontColor(GRN)
      .setRanges([sh.getRange(13,5,14,1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(E13),E13<0)')
      .setFontColor(RED)
      .setRanges([sh.getRange(13,5,14,1)]).build(),
    // YoY deltas: green up, red down
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(E30),E30>0)')
      .setFontColor(GRN)
      .setRanges([sh.getRange(30,5,3,2)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(E30),E30<0)')
      .setFontColor(RED)
      .setRanges([sh.getRange(30,5,3,2)]).build(),
    // overdue stats turn red when nonzero
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setFontColor(RED)
      .setRanges([sh.getRange(75,3), sh.getRange(75,5)]).build(),
    // cheque schedule: overdue rows red tint, next cheque run green tint
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($B77),$B77<TODAY())')
      .setBackground('#FBE3E0')
      .setRanges([sh.getRange(77,2,15,4)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($B77),$B77>=TODAY(),$B77<='
        + 'MINIFS('+D+'!O$2:O$500,'+D+'!M$2:M$500,"'+S_AWAIT+'",'+D+'!O$2:O$500,">"&TODAY())+6)')
      .setBackground('#E3F2E5')
      .setRanges([sh.getRange(77,2,15,4)]).build(),
    // renewal urgency: ≤30 days red tint, ≤60 days amber tint
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($E95),$E95>=TODAY(),$E95<=TODAY()+30)')
      .setBackground('#FBE3E0')
      .setRanges([sh.getRange(95,2,25,5)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($E95),$E95>=TODAY(),$E95<=TODAY()+60)')
      .setBackground('#FCF3DC')
      .setRanges([sh.getRange(95,2,25,5)]).build(),
  ];
  sh.setConditionalFormatRules(rules);

  // ── Chart docked top-right beside the tables ───────────────────────────────
  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(12,2,13,1))
    .addRange(sh.getRange(12,3,13,1))
    .addRange(sh.getRange(12,4,13,1))
    .setNumHeaders(1)
    .setOption('title', 'Monthly Paid Commission — Prior vs Current Year')
    .setOption('titleTextStyle', {fontSize:12, bold:true, color:INK})
    .setOption('colors', ['#B9C6D8', NAVY])
    .setOption('legend', {position:'bottom'})
    .setOption('vAxis', {format:'$#,##0', minValue:0})
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('bar', {groupWidth:'62%'})
    .setPosition(3, 9, 10, 0)
    .setOption('width', 620).setOption('height', 340)
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

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME COMMISSION UPDATE (2026-07-11) — brokerage-verified actuals.
// Select "UPDATE_COMMISSIONS" from the dropdown and click Run. Matches rows by
// borrower name, writes static verified values (replacing formulas where noted),
// then refreshes the Income Report and shows a verification alert.
// ═══════════════════════════════════════════════════════════════════════════════
function UPDATE_COMMISSIONS() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) { ss.toast('⚠️ Deals sheet not found or empty.'); return; }
  var n = sh.getLastRow() - 1;
  var names = sh.getRange(2, CC.BORROWER, n, 1).getValues();

  function ymd(s) { var p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }

  // key = unique lowercase fragment of the borrower cell
  var updates = [
    // ── mark Paid ──
    { key:'spencer roberts', net:8212.43, pay:'2026-07-09', status:S_PAID },
    { key:'kartik manohar',  net:1431.33, split:0.40, pay:'2026-06-18', status:S_PAID },
    { key:'kassandra',       net:1667.75, pay:'2026-05-26', status:S_PAID },
    { key:'myrtille',        net:4725.00, pay:'2026-05-21', status:S_PAID },
    { key:'scott mckinley',  net:2409.75, pay:'2026-05-12', status:S_PAID },
    { key:'sylvia murray',   net:3020.50, pay:'2026-05-05', status:S_PAID },
    { key:'greg mason',      net:1789.73, closing:'2026-04-21', pay:'2026-04-28', status:S_PAID },
    { key:'megan mlynczak',  pay:'2026-04-08', status:S_PAID },
    { key:'doug oldenburg',  pay:'2026-04-01', status:S_PAID },
    { key:'phillip wolfe',   pay:'2026-03-30', status:S_PAID },
    { key:'irina marchenkova', pay:'2026-03-25', status:S_PAID },
    // ── keep Awaiting, update Net Comm + Expected Pay Date ──
    { key:'derek duffield',  net:1492.57, exp:'2026-07-14', status:S_AWAIT },
    { key:'eric cole',       net:1756.10, exp:'2026-07-15', status:S_AWAIT },
    { key:'van zutphen',     net:2650.27, exp:'2026-07-15', status:S_AWAIT },
    { key:'szemberg',        net:2366.72, exp:'2026-07-15', status:S_AWAIT },
    { key:'joe palma',       net:2268.75, exp:'2026-07-15', status:S_AWAIT },
    { key:'owen burrows',    net:2151.53, exp:'2026-07-15', status:S_AWAIT },
  ];

  var applied = [], missing = [];
  updates.forEach(function(u) {
    var row = -1;
    for (var i = 0; i < n; i++) {
      if (String(names[i][0]).toLowerCase().indexOf(u.key) > -1) { row = i + 2; break; }
    }
    if (row === -1) { missing.push(u.key); return; }
    if (u.net   !== undefined) sh.getRange(row, CC.NETCOMM).setValue(u.net);  // static — replaces formula
    if (u.split !== undefined) sh.getRange(row, CC.SPLIT).setValue(u.split);
    if (u.closing) sh.getRange(row, CC.CLOSING).setValue(ymd(u.closing));
    if (u.pay)     sh.getRange(row, CC.PAYDATE).setValue(ymd(u.pay));
    if (u.exp)     sh.getRange(row, CC.EXPDATE).setValue(ymd(u.exp));         // static — replaces formula
    if (u.status)  sh.getRange(row, CC.STATUS).setValue(u.status);
    applied.push(u.key);
  });

  // Refresh the Income Report (also applies the new Next-Cheque-Run card)
  buildDashboardTab_(ss, '#1B3A6B', '#C9A84C');
  SpreadsheetApp.flush();

  // Verify totals straight from the sheet
  var data  = sh.getRange(2, 1, n, NCOLS).getValues();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var yr = today.getFullYear();
  var paidYTD = 0, nextDt = null;
  data.forEach(function(r) {
    if (r[CC.YEAR-1] === yr && r[CC.STATUS-1] === S_PAID)
      paidYTD += parseFloat(r[CC.NETCOMM-1]) || 0;
    if (r[CC.STATUS-1] === S_AWAIT && r[CC.EXPDATE-1] instanceof Date && r[CC.EXPDATE-1] > today
        && (!nextDt || r[CC.EXPDATE-1] < nextDt))
      nextDt = r[CC.EXPDATE-1];
  });
  var run = 0;
  if (nextDt) {
    var runEnd = new Date(nextDt.getTime() + 6 * 86400000);
    data.forEach(function(r) {
      if (r[CC.STATUS-1] === S_AWAIT && r[CC.EXPDATE-1] instanceof Date
          && r[CC.EXPDATE-1] > today && r[CC.EXPDATE-1] <= runEnd)
        run += parseFloat(r[CC.NETCOMM-1]) || 0;
    });
  }
  var msg = 'COMMISSION UPDATE COMPLETE ✅\n\n'
    + 'Rows updated: ' + applied.length + ' / ' + updates.length
    + (missing.length ? '\n⚠️ NOT FOUND: ' + missing.join(', ') : '')
    + '\n\nPaid YTD (' + yr + '): $' + paidYTD.toFixed(2)
    + '\nNext cheque run: ' + (nextDt
        ? Utilities.formatDate(nextDt, Session.getScriptTimeZone(), 'MMM d')
          + ' → $' + run.toFixed(2)
        : '—')
    + '\n\nExpected: next cheque run $12,685.94 (Jul 14–15, 6 deals)';
  Logger.log(msg);
  say_(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME (2026-07-16) — next cheque run pushed to Jul 30.
// Select "MOVE_CHEQUE_TO_JUL30" from the dropdown and click Run.
// Moves Expected Pay Date to 2026-07-30 for the six Awaiting deals.
// ═══════════════════════════════════════════════════════════════════════════════
function MOVE_CHEQUE_TO_JUL30() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) { ss.toast('⚠️ Deals sheet not found or empty.'); return; }
  var n = sh.getLastRow() - 1;
  var names = sh.getRange(2, CC.BORROWER, n, 1).getValues();
  var newDate = new Date(2026, 6, 30);  // 2026-07-30

  var keys = ['derek duffield','eric cole','van zutphen','szemberg','joe palma','owen burrows'];
  var applied = [], missing = [];
  keys.forEach(function(key) {
    var row = -1;
    for (var i = 0; i < n; i++) {
      if (String(names[i][0]).toLowerCase().indexOf(key) > -1) { row = i + 2; break; }
    }
    if (row === -1) { missing.push(key); return; }
    sh.getRange(row, CC.EXPDATE).setValue(newDate);
    applied.push(key);
  });
  SpreadsheetApp.flush();

  // Verify: total awaiting commission now expected on Jul 30
  var data = sh.getRange(2, 1, n, NCOLS).getValues();
  var total = 0;
  data.forEach(function(r) {
    if (r[CC.STATUS-1] === S_AWAIT && r[CC.EXPDATE-1] instanceof Date
        && r[CC.EXPDATE-1].getTime() === newDate.getTime())
      total += parseFloat(r[CC.NETCOMM-1]) || 0;
  });
  say_('CHEQUE DATE MOVED ✅\n\n'
    + 'Updated: ' + applied.length + ' / ' + keys.length + ' deals → 2026-07-30'
    + (missing.length ? '\n⚠️ NOT FOUND: ' + missing.join(', ') : '')
    + '\n\nAwaiting commission expected Jul 30: $' + total.toFixed(2)
    + '\nExpected: $12,685.94');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME (2026-08-05) — remove the two static legacy tabs that survived the
// 5-tab consolidation because their full names didn't match the delete list.
// Both are preserved in the archive copy. Run DELETE_LEGACY_TABS from the
// dropdown to remove them.
// ═══════════════════════════════════════════════════════════════════════════════
function DELETE_LEGACY_TABS() {
  var ss = SpreadsheetApp.getActive();
  var gone = [], notFound = [];
  ['💎 Client Lifetime Value', '🤝 Referral Partner ROI'].forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) { ss.deleteSheet(s); gone.push(name); }
    else   { notFound.push(name); }
  });
  say_('LEGACY TAB CLEANUP ✅\n\n'
    + (gone.length ? 'Deleted: ' + gone.join(', ') : 'Nothing deleted.')
    + (notFound.length ? '\nNot found (already gone?): ' + notFound.join(', ') : '')
    + '\n\nBoth remain available in the archive copy\n(JM Tracker — ARCHIVE pre-simplification).');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME (2026-08-28) — Aug 28 pay run + verified figures from pay stub.
// Select "UPDATE_AUG28" from the dropdown and click Run. Applies the updates,
// rebuilds the report, then reconciles Paid YTD against Homewise's official
// $86,492.96 and logs every paid 2026 deal for line-by-line comparison.
// ═══════════════════════════════════════════════════════════════════════════════
function UPDATE_AUG28() {
  var HOMEWISE_YTD = 86492.96;
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Deals');
  if (!sh || sh.getLastRow() < 2) { ss.toast('⚠️ Deals sheet not found or empty.'); return; }
  var n = sh.getLastRow() - 1;
  var names = sh.getRange(2, CC.BORROWER, n, 1).getValues();

  function ymd(s) { var p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }

  var updates = [
    // ── Aug 28 cheque: mark Paid ──
    { key:'traceyann',        net:3603.60, pay:'2026-08-28', status:S_PAID },
    { key:'richard ozolins',  net:2047.50, pay:'2026-08-28', status:S_PAID },
    { key:'ted ghanime',      net:1785.00, pay:'2026-08-28', status:S_PAID },
    { key:'sheila white',     net:1779.75, pay:'2026-08-28', status:S_PAID },
    { key:'michelle gagnon',  net:1193.82, pay:'2026-08-28', status:S_PAID },
    { key:'zareh',            net:1031.26, pay:'2026-08-28', status:S_PAID },
    // ── keep Awaiting ──
    { key:'tina boras',       net:2332.80, exp:'2026-09-15', status:S_AWAIT },
    { key:'kathleen jinkerson', net:1916.00, split:0.40, type:'Renewal', exp:'2026-09-15', status:S_AWAIT },
    { key:'erin somers',      net:1715.00, type:'Renewal', exp:'2026-09-15', status:S_AWAIT },
    { key:'wasylik',          net:846.30, split:0.35, exp:'2026-09-15', status:S_AWAIT },
    { key:'steven curran',    net:2168.25, exp:'2026-09-15', status:S_AWAIT },
  ];

  var applied = [], missing = [];
  updates.forEach(function(u) {
    var row = -1;
    for (var i = 0; i < n; i++) {
      if (String(names[i][0]).toLowerCase().indexOf(u.key) > -1) { row = i + 2; break; }
    }
    if (row === -1) { missing.push(u.key); return; }
    if (u.net   !== undefined) sh.getRange(row, CC.NETCOMM).setValue(u.net);  // static — replaces formula
    if (u.split !== undefined) sh.getRange(row, CC.SPLIT).setValue(u.split);
    if (u.type)    sh.getRange(row, CC.TYPE).setValue(u.type);
    if (u.pay)     sh.getRange(row, CC.PAYDATE).setValue(ymd(u.pay));
    if (u.exp)     sh.getRange(row, CC.EXPDATE).setValue(ymd(u.exp));         // static — replaces formula
    if (u.status)  sh.getRange(row, CC.STATUS).setValue(u.status);
    applied.push(u.key);
  });

  buildDashboardTab_(ss, '#1B3A6B', '#C9A84C');
  SpreadsheetApp.flush();

  // ── Reconcile Paid YTD against the Homewise pay-stub figure ──────────────
  var data = sh.getRange(2, 1, n, NCOLS).getValues();
  var yr = new Date().getFullYear();
  var paidYTD = 0, paidCnt = 0, lines = [];
  data.forEach(function(r) {
    if (r[CC.YEAR-1] === yr && r[CC.STATUS-1] === S_PAID) {
      var v = parseFloat(r[CC.NETCOMM-1]) || 0;
      paidYTD += v; paidCnt++;
      lines.push('  ' + r[CC.BORROWER-1] + ' — $' + v.toFixed(2));
    }
  });
  var diff = Math.round((paidYTD - HOMEWISE_YTD) * 100) / 100;
  var msg = 'AUG 28 UPDATE COMPLETE ✅\n\n'
    + 'Rows updated: ' + applied.length + ' / ' + updates.length
    + (missing.length ? '\n⚠️ NOT FOUND: ' + missing.join(', ') : '')
    + '\n\nPaid YTD (' + yr + '): $' + paidYTD.toFixed(2) + '  (' + paidCnt + ' deals)'
    + '\nHomewise official YTD: $' + HOMEWISE_YTD.toFixed(2)
    + '\nVariance: ' + (diff === 0 ? '✅ EXACT MATCH'
        : (diff > 0 ? '+' : '') + '$' + diff.toFixed(2)
          + ' — see Execution log for the full paid-deal list to reconcile');
  Logger.log(msg + '\n\nPaid ' + yr + ' deals:\n' + lines.join('\n'));
  say_(msg);
}
