'use strict';

const PDFDocument = require('pdfkit');

// ─── Brand constants ──────────────────────────────────────────────────────────

const NAVY   = '#0B1F3A';
const BLUE   = '#1A3A6B';
const GOLD   = '#C8982A';
const ACCENT = '#2563EB';
const TEXT   = '#1A1A2E';
const MUTED  = '#64748B';
const LINE   = '#D1DAE8';
const WHITE  = '#FFFFFF';

const BOLD    = 'Helvetica-Bold';
const REGULAR = 'Helvetica';
const OBLIQUE = 'Helvetica-Oblique';

// ─── Inline markdown parser ───────────────────────────────────────────────────

// Returns [{text, bold, italic}]
function parseInline(raw) {
  const segs = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ text: raw.slice(last, m.index) });
    if (m[1]) segs.push({ text: m[1], bold: true });
    else      segs.push({ text: m[2], italic: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segs.push({ text: raw.slice(last) });
  return segs.length ? segs : [{ text: raw }];
}

function renderInline(doc, raw, size, color, opts = {}) {
  const segs = parseInline(raw);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    doc.font(s.bold ? BOLD : (s.italic ? OBLIQUE : REGULAR))
       .fontSize(size)
       .fillColor(color)
       .text(s.text, { continued: i < segs.length - 1, lineGap: 2, ...opts });
  }
}

// ─── Token parser ─────────────────────────────────────────────────────────────

function tokenize(md) {
  const tokens = [];
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.+)/);
    if (h) { tokens.push({ type: 'h', level: h[1].length, text: h[2].trim() }); continue; }
    if (/^[*-]\s/.test(line)) { tokens.push({ type: 'li', text: line.replace(/^[*-]\s+/, '').trim() }); continue; }
    const num = line.match(/^(\d+)\.\s(.+)/);
    if (num) { tokens.push({ type: 'ol', n: num[1], text: num[2].trim() }); continue; }
    if (line.trim() === '') { tokens.push({ type: 'space' }); continue; }
    tokens.push({ type: 'p', text: line.trim() });
  }
  return tokens;
}

// ─── Header / Footer ─────────────────────────────────────────────────────────

function drawPageHeader(doc, clientName, reportType) {
  const W = doc.page.width;

  doc.rect(0, 0, W, 64).fill(NAVY);
  doc.rect(0, 64, W, 4).fill(GOLD);

  // Company name
  doc.font(BOLD).fontSize(17).fillColor(WHITE)
     .text('Jake Murray Mortgages', 48, 18, { lineBreak: false });
  doc.font(REGULAR).fontSize(8).fillColor(GOLD)
     .text('POWERED BY HOMEWISE', 48, 40, { lineBreak: false });

  // Right side: report type + client
  doc.font(BOLD).fontSize(10).fillColor(GOLD)
     .text(reportType.toUpperCase(), W - 200, 18, { width: 152, align: 'right', lineBreak: false });
  doc.font(REGULAR).fontSize(8).fillColor('#94A3B8')
     .text(`Prepared for: ${clientName}`, W - 200, 34, { width: 152, align: 'right', lineBreak: false });

  // Reset cursor below header stripe
  doc.x = 48;
  doc.y = 84;
}

function drawPageFooter(doc, page, total) {
  const W = doc.page.width;
  const H = doc.page.height;
  const y = H - 42;

  doc.rect(48, y, W - 96, 0.5).fill(LINE);

  doc.font(REGULAR).fontSize(8).fillColor(MUTED)
     .text('Jake Murray Mortgages  |  Licensed Mortgage Broker  |  Ontario', 48, y + 6, { lineBreak: false });

  doc.font(REGULAR).fontSize(8).fillColor(MUTED)
     .text(`Powered by Homewise  |  Page ${page} of ${total}`, W - 250, y + 6, { width: 202, align: 'right', lineBreak: false });

  doc.font(OBLIQUE).fontSize(7).fillColor(MUTED)
     .text('This report is for informational purposes only and does not constitute financial advice.',
           48, y + 18, { width: W - 96, lineBreak: false });
}

// ─── Public API ───────────────────────────────────────────────────────────────

function buildReportPdf({ clientName, reportType, dealType, reportText }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true,
      autoFirstPage: false,
      margins: { top: 100, bottom: 60, left: 48, right: 48 },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const usableW = 8.5 * 72 - 96; // LETTER width minus margins

    function newPage() {
      doc.addPage();
      drawPageHeader(doc, clientName || 'Client', reportType || 'Mortgage Report');
    }

    function checkPageBreak(needed = 40) {
      if (doc.y + needed > doc.page.height - 70) newPage();
    }

    newPage();

    // Date line
    const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.font(REGULAR).fontSize(8).fillColor(MUTED)
       .text(`Generated: ${date}`, 48, doc.y, { width: usableW, align: 'right' });
    doc.moveDown(0.4);
    doc.rect(48, doc.y, usableW, 0.75).fill(LINE);
    doc.moveDown(0.8);

    // Render tokens
    for (const tok of tokenize(reportText)) {
      switch (tok.type) {

        case 'h': {
          checkPageBreak(50);
          if (tok.level === 1) {
            doc.moveDown(0.5);
            doc.font(BOLD).fontSize(14).fillColor(NAVY).text(tok.text, 48, doc.y, { width: usableW });
            doc.rect(48, doc.y, usableW, 2).fill(GOLD);
            doc.moveDown(0.7);
          } else if (tok.level === 2) {
            doc.moveDown(0.4);
            doc.font(BOLD).fontSize(11.5).fillColor(BLUE).text(tok.text, 48, doc.y, { width: usableW });
            doc.rect(48, doc.y, 36, 1.5).fill(GOLD);
            doc.moveDown(0.5);
          } else {
            doc.moveDown(0.3);
            doc.font(BOLD).fontSize(10).fillColor(ACCENT).text(tok.text, 48, doc.y, { width: usableW });
            doc.moveDown(0.3);
          }
          break;
        }

        case 'li': {
          checkPageBreak(20);
          doc.font(BOLD).fontSize(9).fillColor(GOLD)
             .text('•', 56, doc.y, { lineBreak: false, width: 10 });
          const ty = doc.y;
          renderInline(doc, tok.text, 9.5, TEXT, { width: usableW - 22, indent: 0 });
          doc.moveDown(0.15);
          break;
        }

        case 'ol': {
          checkPageBreak(20);
          doc.font(BOLD).fontSize(9).fillColor(GOLD)
             .text(`${tok.n}.`, 56, doc.y, { lineBreak: false, width: 14 });
          renderInline(doc, tok.text, 9.5, TEXT, { width: usableW - 22 });
          doc.moveDown(0.15);
          break;
        }

        case 'p': {
          checkPageBreak(25);
          renderInline(doc, tok.text, 10, TEXT, { width: usableW, lineGap: 3, indent: 0 });
          doc.moveDown(0.25);
          break;
        }

        case 'space': {
          doc.moveDown(0.35);
          break;
        }
      }
    }

    // Stamp footers on every page
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawPageFooter(doc, i + 1, total);
    }

    doc.end();
  });
}

module.exports = { buildReportPdf };
