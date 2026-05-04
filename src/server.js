'use strict';

const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./utils/logger');
const { createSheetsClient } = require('./sheets/client');
const { addFundedDeal } = require('./sheets/addDeal');
const { streamChat, generateReport, getMortgageSuggestions } = require('./ai/jarvis');

const app = express();
app.use(express.json());

// Never cache dashboard.html so deploys take effect immediately
app.get('/dashboard.html', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});
app.use(express.static(path.join(__dirname, '../public')));

// ─── Supabase ─────────────────────────────────────────────────────────────────

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ─── Dashboard auth middleware ─────────────────────────────────────────────────

function dashboardAuth(req, res, next) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return next();
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${password}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Existing routes ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'JM Mortgage Automation' })
);

app.post('/add-deal', async (req, res) => {
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

// ─── Dashboard login ───────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return res.json({ ok: true }); // no password set
  if (password !== expected) return res.status(401).json({ error: 'Wrong password' });
  res.json({ ok: true, token: expected });
});

// ─── Deals ────────────────────────────────────────────────────────────────────

app.get('/api/deals', dashboardAuth, async (req, res) => {
  try {
    const { year } = req.query;
    let query = getSupabase()
      .from('funded_deals')
      .select('*')
      .order('closing', { ascending: false });

    if (year && year !== 'all') query = query.eq('year', parseInt(year));

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Clients ──────────────────────────────────────────────────────────────────

app.get('/api/clients', dashboardAuth, async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('clients')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/clients/:id', dashboardAuth, async (req, res) => {
  try {
    const { data: client, error } = await getSupabase()
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw new Error(error.message);

    // fetch deal history by name match
    const { data: deals } = await getSupabase()
      .from('funded_deals')
      .select('*')
      .ilike('borrower', `%${client.name}%`)
      .order('closing', { ascending: false });

    res.json({ ...client, deals: deals || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients', dashboardAuth, async (req, res) => {
  try {
    const { name, email, phone, notes, income, property_value, existing_mortgage, renewal_date, credit_score } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await getSupabase()
      .from('clients')
      .insert({ name, email, phone, notes, income, property_value, existing_mortgage, renewal_date, credit_score })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clients/:id', dashboardAuth, async (req, res) => {
  try {
    const { name, email, phone, notes, income, property_value, existing_mortgage, renewal_date, credit_score } = req.body;
    const { data, error } = await getSupabase()
      .from('clients')
      .update({ name, email, phone, notes, income, property_value, existing_mortgage, renewal_date, credit_score, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', dashboardAuth, async (req, res) => {
  try {
    const { error } = await getSupabase().from('clients').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Jarvis chat (SSE streaming) ───────────────────────────────────────────────

app.post('/api/jarvis/stream', dashboardAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { messages, context } = req.body;
  logger.info(`Jarvis: received ${Array.isArray(messages) ? messages.length : 'non-array'} messages`);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.write(`data: ${JSON.stringify({ error: 'messages array required' })}\n\n`);
    return res.end();
  }

  // Strip any empty-content messages that would be rejected by the API
  const cleanMessages = messages.filter(m => m.content && String(m.content).trim());
  if (!cleanMessages.length) {
    res.write(`data: ${JSON.stringify({ error: 'all messages have empty content' })}\n\n`);
    return res.end();
  }

  try {
    for await (const chunk of streamChat(cleanMessages, context || '')) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    logger.error(`Jarvis stream error: ${err.message}`);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
});

// ─── Report generation ─────────────────────────────────────────────────────────

app.post('/api/generate-report', dashboardAuth, async (req, res) => {
  try {
    const { clientName, dealType, reportType, details } = req.body;
    if (!clientName || !dealType || !reportType) {
      return res.status(400).json({ error: 'clientName, dealType, reportType required' });
    }
    const report = await generateReport({ clientName, dealType, reportType, details: details || {} });
    res.json({ report });
  } catch (err) {
    logger.error(`Report gen error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI mortgage suggestions ───────────────────────────────────────────────────

app.post('/api/suggestions', dashboardAuth, async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const { data: client, error } = await getSupabase()
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    if (error) throw new Error(error.message);

    const { data: deals } = await getSupabase()
      .from('funded_deals')
      .select('*')
      .ilike('borrower', `%${client.name}%`)
      .order('closing', { ascending: false });

    const suggestions = await getMortgageSuggestions(client, deals || []);
    res.json({ suggestions });
  } catch (err) {
    logger.error(`Suggestions error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => logger.info(`HTTP server listening on port ${port}`));
}

module.exports = { startServer };
