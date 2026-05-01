'use strict';

const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory lead store — populated by the main automation
const leads = [];
const stats = { today: 0, thisWeek: 0, switch: 0, refinance: 0, purchase: 0, total: 0 };

function recordLead(contactData, dealType) {
  const lead = {
    id: Date.now(),
    name: contactData.fullName,
    email: contactData.email,
    phone: contactData.phone || '—',
    type: dealType,
    timestamp: new Date().toISOString(),
  };
  leads.unshift(lead);
  if (leads.length > 500) leads.pop();

  stats.total++;
  stats[dealType] = (stats[dealType] || 0) + 1;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
  stats.today = leads.filter(l => new Date(l.timestamp) >= today).length;
  stats.thisWeek = leads.filter(l => new Date(l.timestamp) >= weekAgo).length;
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/leads', (req, res) => {
  res.json({ leads: leads.slice(0, 100), stats });
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const systemPrompt = `You are Jarvis, a sharp AI assistant for a mortgage company called JMUR.
You have access to the following live pipeline data:
- Total leads processed: ${stats.total}
- Leads today: ${stats.today}
- This week: ${stats.thisWeek}
- Switch loans: ${stats.switch}
- Refinances: ${stats.refinance}
- Purchases: ${stats.purchase}
- Recent leads: ${JSON.stringify(leads.slice(0, 10))}

Help the user understand their pipeline, identify trends, follow up on leads, draft emails, strategize, or anything else to grow their mortgage business. Be direct, specific, and actionable.`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

function startDashboard(port = process.env.DASHBOARD_PORT || 3001) {
  app.listen(port, () => {
    logger.info(`Dashboard running at http://localhost:${port}`);
  });
}

module.exports = { startDashboard, recordLead };
