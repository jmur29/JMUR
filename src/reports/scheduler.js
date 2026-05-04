'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
const { createSheetsClient } = require('../sheets/client');
const { readPipelineData } = require('./reader');
const { formatReport } = require('./formatter');
const { sendEmail } = require('./emailSender');

const REPORT_TO      = process.env.REPORT_EMAIL || 'jaker.murray96@gmail.com';
const REPORT_SUBJECT = 'Daily Pipeline Report — Jake Murray Mortgages';

/**
 * Build and send the daily pipeline report via Gmail SMTP (Nodemailer).
 */
async function sendDailyReport() {
  logger.info('=== Daily report starting ===');

  // Step 1: Read pipeline data from Google Sheets
  let data;
  try {
    logger.info('[Report] Step 1/3 — Reading pipeline data from Google Sheets...');
    const sheets = createSheetsClient();
    data = await readPipelineData(sheets);
    logger.info(`[Report] Step 1/3 — OK. Active leads: ${data.totalActive}, new today: ${data.newLast24h.length}`);
  } catch (err) {
    logger.error(`[Report] Step 1/3 FAILED — Google Sheets read error: ${err.message}`);
    logger.error(err.stack);
    return;
  }

  // Step 2: Format the report HTML
  let html;
  try {
    logger.info('[Report] Step 2/3 — Formatting report HTML...');
    const dateStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    html = formatReport(data, dateStr);
    logger.info('[Report] Step 2/3 — OK.');
  } catch (err) {
    logger.error(`[Report] Step 2/3 FAILED — Formatter error: ${err.message}`);
    logger.error(err.stack);
    return;
  }

  // Step 3: Send email via Nodemailer SMTP
  try {
    logger.info(`[Report] Step 3/3 — Sending email to ${REPORT_TO} via SMTP (user: ${process.env.SMTP_USER || 'NOT SET'})...`);
    await sendEmail(REPORT_TO, REPORT_SUBJECT, html);
    logger.info('[Report] Step 3/3 — OK. Daily report delivered successfully.');
  } catch (err) {
    logger.error(`[Report] Step 3/3 FAILED — Email send error: ${err.message}`);
    logger.error(err.stack);
  }

  logger.info('=== Daily report finished ===');
}

/**
 * Schedule the daily report at 8:00am Toronto time.
 * Also optionally fires immediately on startup if REPORT_ON_STARTUP=true.
 */
function scheduleDailyReport() {
  if (!process.env.GOOGLE_SHEET_ID) {
    logger.warn('GOOGLE_SHEET_ID not set — daily report scheduler disabled.');
    return;
  }

  // 0 8 * * * = 8:00am every day, Toronto timezone
  cron.schedule('0 8 * * *', () => {
    sendDailyReport().catch((err) =>
      logger.error(`Unhandled error in daily report: ${err.message}`)
    );
  }, { timezone: 'America/Toronto' });

  logger.info('Daily report scheduled for 8:00am Toronto time → ' + REPORT_TO);

  // Allow instant test run via env var
  if (process.env.REPORT_ON_STARTUP === 'true') {
    logger.info('REPORT_ON_STARTUP=true — sending report now...');
    sendDailyReport().catch((err) =>
      logger.error(`Startup report error: ${err.message}`)
    );
  }
}

module.exports = { scheduleDailyReport, sendDailyReport };
