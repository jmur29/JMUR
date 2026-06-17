/**
 * The Murvota Open — RSVP backend (Google Apps Script Web App)
 *
 * Bound to a Google Sheet. Writes each RSVP to a sheet named "RSVPs" and
 * serves the full list back as JSON (with JSONP fallback for the leaderboard).
 *
 * Deploy:  Deploy ▸ New deployment ▸ Web app
 *          Execute as: Me   |   Who has access: Anyone
 * Then paste the /exec URL into SCRIPT_URL at the top of the site's JS.
 */

var SHEET_NAME = 'RSVPs';
var HEADERS = ['Timestamp', 'Name', 'Status', 'Guests', 'Note', 'Submitted'];

/** GET → returns { ok:true, rsvps:[...] }. Supports ?callback= for JSONP. */
function doGet(e) {
  var payload;
  try {
    payload = JSON.stringify({ ok: true, rsvps: readRsvps() });
  } catch (err) {
    payload = JSON.stringify({ ok: false, error: String(err), rsvps: [] });
  }

  var callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + payload + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST → appends one RSVP. Body is text/plain JSON (no-cors friendly). */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    appendRsvp(body);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Returns the RSVP sheet, creating it (with headers) on first use. */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRsvp(body) {
  var sheet = getSheet();
  var name = String(body.name || '').trim();
  if (!name) { throw new Error('Missing name'); }

  var status = String(body.status || '').toLowerCase();        // in | maybe | out
  if (['in', 'maybe', 'out'].indexOf(status) === -1) { status = 'in'; }

  var guests = parseInt(body.guests, 10);
  if (isNaN(guests) || guests < 0) { guests = 0; }
  if (status === 'out') { guests = 0; }

  var note = String(body.note || '').trim().slice(0, 280);
  var clientTs = String(body.ts || '');

  // Lock so concurrent submits don't collide on append.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet.appendRow([clientTs || new Date().toISOString(), name, status, guests, note, new Date()]);
  } finally {
    lock.releaseLock();
  }
}

/** Reads all rows into [{ name, status, guests, note, ts }]. */
function readRsvps() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { return []; }

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.map(function (row) {
    return {
      ts:     toIso(row[0]),
      name:   String(row[1] || ''),
      status: String(row[2] || '').toLowerCase(),
      guests: parseInt(row[3], 10) || 0,
      note:   String(row[4] || '')
    };
  }).filter(function (r) { return r.name; });
}

function toIso(v) {
  if (v instanceof Date) { return v.toISOString(); }
  return String(v || '');
}
