'use strict';

require('dotenv').config();

const logger = require('./utils/logger');
const { createGmailClient } = require('./gmail/client');
const { startWatcher } = require('./gmail/watcher');
const { createGhlClient } = require('./ghl/client');
const { createContact, addTag } = require('./ghl/contacts');
const { enrollInWorkflow } = require('./ghl/workflows');
const { addContact, addDeal, startMatcher, getPendingSnapshot } = require('./matching/matcher');

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
}

// ─── Match handler ────────────────────────────────────────────────────────────

/**
 * Called when a contact + deal pair are matched by name.
 * Performs the full GHL integration: create contact, tag, enroll.
 */
async function handleMatch(contactData, dealData) {
  const ghl = createGhlClient();
  const { firstName, lastName, email, phone } = contactData;
  const { dealType } = dealData;
  const fullName = `${firstName} ${lastName}`;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`Processing matched lead: ${fullName}`);
  logger.info(`  Email:     ${email}`);
  logger.info(`  Phone:     ${phone || 'N/A'}`);
  logger.info(`  Deal type: ${dealType}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Step 1: Create contact in GHL
    const contactId = await createContact(ghl, { firstName, lastName, email, phone });

    // Step 2: Tag the contact with the deal type
    const tagLabel = dealType.charAt(0).toUpperCase() + dealType.slice(1);
    await addTag(ghl, contactId, tagLabel);

    // Step 3: Enroll in the correct workflow
    await enrollInWorkflow(ghl, contactId, dealType);

    logger.info(`Lead processing complete for ${fullName} (GHL ID: ${contactId}).`);
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
  }, 2 * 60 * 1000); // every 2 minutes
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('=== Mortgage Lead Automation starting up ===');
  validateEnv();

  const gmail = createGmailClient();
  startMatcher();
  startStatusLogger();
  startWatcher(gmail, handleEmail);

  logger.info('=== All systems running. Watching for HubSpot emails... ===');
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  if (err.stack) logger.error(err.stack);
  process.exit(1);
});
