'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./utils/logger');
const { createSheetsClient } = require('./sheets/client');
const { addFundedDeal } = require('./sheets/addDeal');

const app = express();
app.use(express.json());

// Lazily initialised so the module can be required before env vars are loaded
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'JM Mortgage Automation' })
);

app.post('/add-deal', async (req, res) => {
  // Auth
  const token = req.headers['x-api-key'];
  const secret = process.env.DEAL_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('DEAL_WEBHOOK_SECRET env var is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  if (token !== secret) {
    logger.warn('Unauthorized /add-deal attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate required fields
  const { year, borrower, amt } = req.body;
  if (!borrower || !amt) {
    return res.status(400).json({ error: 'Missing required fields: borrower, amt' });
  }
  const yearNum = parseInt(year);
  if (yearNum !== 2025 && yearNum !== 2026) {
    return res.status(400).json({ error: 'year must be 2025 or 2026' });
  }

  try {
    const sheets = createSheetsClient();

    // Write to Google Sheets and Supabase simultaneously
    const [sheetResult] = await Promise.all([
      addFundedDeal(sheets, req.body),
      insertSupabaseDeal(req.body),
    ]);

    logger.info(`/add-deal success: ${sheetResult.borrower} → ${sheetResult.sheetName} row ${sheetResult.row}`);
    return res.json({ status: 'success', ...sheetResult });
  } catch (err) {
    logger.error(`/add-deal error: ${err.message}`);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Supabase insert ──────────────────────────────────────────────────────────

async function insertSupabaseDeal(params) {
  const { error } = await getSupabase().from('funded_deals').insert({
    year:       parseInt(params.year),
    borrower:   String(params.borrower).trim(),
    type:       String(params.type || '').trim() || null,
    source:     String(params.source || '').trim() || null,
    lender:     String(params.lender || '').trim() || null,
    closing:    params.closing || null,
    amt:        parseFloat(params.amt),
    term:       params.term != null ? parseInt(params.term) : null,
    rate_type:  String(params.rateType || '').trim() || null,
    rate:       params.rate != null ? parseFloat(params.rate) : null,
    bps:        params.bps != null ? parseInt(params.bps) : null,
    split:      params.split != null ? parseFloat(params.split) : null,
    gross_comm: params.grossComm != null ? parseFloat(params.grossComm) : null,
    your_comm:  params.yourComm != null ? parseFloat(params.yourComm) : null,
    notes:      String(params.notes || '').trim() || null,
  });
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// ─── Start ────────────────────────────────────────────────────────────────────

function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => logger.info(`HTTP server listening on port ${port}`));
}

module.exports = { startServer };
