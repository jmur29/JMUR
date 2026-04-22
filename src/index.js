'use strict';

require('dotenv').config();

const logger = require('./utils/logger');
const { createGmailClient } = require('./gmail/client');
const { startWatcher } = require('./gmail/watcher');
const { createGhlClient } = require('./ghl/client');
const { createContact, addTag } = require('./ghl/contacts');
const { enrollInWorkflow } = require('./ghl/workflows');
const { addContact, addDeal, startMatcher, getPendingSnapshot } = require('./matching/matcher');
const { createSheetsClient } = require('./sheets/client');
const { appendLeadRow } = require('./sheets/tracker');
const { scheduleDailyReport } = require('./reports/scheduler');

// ─── Validate required environment variables ─────────────────────────────────

const REQUIRED_ENV = [
  'GHL_API_KEY',
  'GHL_LOCATION_ID',
  'GHL_WORKFLOW_SWITCH',
  'GHL_WORKFLOW_REFINANCE',
  'GHL_WORKFLOW_PURCHASE',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.GOOGLE_SHEET_ID) {
    logger.warn('GOOGLE_SHEET_ID not set — Sheets tracker and daily report will be disabled.');
  }
}

// ─── Match handler ────────────────────────────────────────────────────────────

/**
 * Called when a contact + deal pair are matched by name.
 * 1. Creates the contact in GHL + tags + enrolls in workflow.
 * 2. Appends a row to the Google Sheets pipeline tracker.
 */
async function handleMatch(contactData, dealData) {
  const ghl = createGhlClient();
  const { firstName, lastName, email, phone, fullName } = contactData;
  const { dealType } = dealData;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`Processing matched lead: ${fullName}`);
  logger.info(`  Email:     ${email}`);
  logger.info(`  Phone:     ${phone || 'N/A'}`);
  logger.info(`  Deal type: ${dealType}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Step 1: Create contact in GHL
    const contactId = await createContact(ghl, { firstName, lastName, email, phone });

    // Step 2: Tag with deal type
    const tagLabel = dealType.charAt(0).toUpperCase() + dealType.slice(1);
    await addTag(ghl, contactId, tagLabel);

    // Step 3: Enroll in the correct workflow
    await enrollInWorkflow(ghl, contactId, dealType);

    logger.info(`GHL processing complete for ${fullName} (ID: ${contactId}).`);

    // Step 4: Append row to Google Sheets pipeline tracker
    if (process.env.GOOGLE_SHEET_ID) {
      const sheets = createSheetsClient();
      await appendLeadRow(sheets, contactData, dealType);
    }
  } catch (err) {
    logger.error(`Failed to process lead for ${fullName}: ${err.message}`);
    if (err.data) {
      logger.error(`GHL response data: ${JSON.stringify(err.data)}`);
    }
  }
}

// ─── Email handler (called by watcher) ───────────────────────────────────────

function handleEmail(type, data) {
  if (type === 'contact') {
    addContact(data, handleMatch);
  } else if (type === 'deal') {
    addDeal(data, handleMatch);
  }
}

// ─── Periodic status log ──────────────────────────────────────────────────────

function startStatusLogger() {
  setInterval(() => {
    const pending = getPendingSnapshot();
    if (pending.length === 0) {
      logger.debug('Pending match store: empty');
    } else {
      logger.info(`Pending matches: ${pending.length} item(s)`);
      for (const item of pending) {
        logger.info(
          `  "${item.nameKey}" | contact=${item.hasContact ? '✓' : '✗'} deal=${item.hasDeal ? '✓' : '✗'} | ` +
            `age=${item.ageSeconds}s | expires in ${item.expiresInSeconds}s`
        );
      }
    }
  }, 2 * 60 * 1000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('=== Mortgage Lead Automation starting up ===');
  validateEnv();

  const gmail = createGmailClient();

  startMatcher();startServer();
  startStatusLogger();
  startWatcher(gmail, handleEmail);
  scheduleDailyReport();

  logger.info('=== All systems running. Watching for HubSpot emails... ===');
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  if (err.stack) logger.error(err.stack);
  process.exit(1);
});const { startServer } = require('./server');
