'use strict';
const express = require('express');
const logger = require('./utils/logger');
const { createSheetsClient } = require('./sheets/client');
const { addFundedDeal } = require('./sheets/addDeal');

const app = express();
app.use(express.json());

const SECRET = process.env.DEAL_WEBHOOK_SECRET || 'jm-mortgages-2026';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'JM Mortgage Automation' }));

app.post('/add-deal', async (req, res) => {
  const token = req.headers['x-api-key'] || req.query.token;
  if (token !== SECRET) {
    logger.warn('Unauthorized /add-deal attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sheets = createSheetsClient();
    const result = await addFundedDeal(sheets, req.body);
    logger.info(`/add-deal success: ${result.borrower}`);
    return res.json({ status: 'success', ...result });
  } catch (err) {
    logger.error(`/add-deal error: ${err.message}`);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => logger.info(`HTTP server listening on port ${port}`));
}

module.exports = { startServer };
