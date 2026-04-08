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
 * Build and send the daily pipeline report.
 * @param {object} gmail - Authenticated Gmail API client
 */
async function sendDailyReport(gmail) {
  logger.info('Building daily pipeline report...');

  try {
    const sheets = createSheetsClient();
    const data   = await readPipelineData(sheets);

    const dateStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = formatReport(data, dateStr);
    await sendEmail(gmail, REPORT_TO, REPORT_SUBJECT, html);

    logger.info(
      `Daily report sent to ${REPORT_TO} — ` +
        `${data.totalActive} active leads, ${data.newLast24h.length} new today.`
    );
  } catch (err) {
    logger.error(`Failed to send daily report: ${err.message}`);
  }
}

/**
 * Schedule the daily report at 8:00am Toronto time.
 * Also optionally fires immediately on startup if REPORT_ON_STARTUP=true.
 * @param {object} gmail - Authenticated Gmail API client
 */
function scheduleDailyReport(gmail) {
  if (!process.env.GOOGLE_SHEET_ID) {
    logger.warn('GOOGLE_SHEET_ID not set — daily report scheduler disabled.');
    return;
  }

  // 0 8 * * * = 8:00am every day, Toronto timezone
  cron.schedule('0 8 * * *', () => {
    sendDailyReport(gmail).catch((err) =>
      logger.error(`Unhandled error in daily report: ${err.message}`)
    );
  }, { timezone: 'America/Toronto' });

  logger.info('Daily report scheduled for 8:00am Toronto time → ' + REPORT_TO);

  // Allow instant test run via env var
  if (process.env.REPORT_ON_STARTUP === 'true') {
    logger.info('REPORT_ON_STARTUP=true — sending report now...');
    sendDailyReport(gmail).catch((err) =>
      logger.error(`Startup report error: ${err.message}`)
    );
  }
}

module.exports = { scheduleDailyReport, sendDailyReport };
