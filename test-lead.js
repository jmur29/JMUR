'use strict';

/**
 * test-lead.js
 *
 * Simulates receiving a HubSpot "Contact owner" and "Deal owner" email for a
 * fake lead, runs the full matching logic, and fires the real GHL + Sheets
 * integration so you can verify everything is wired up correctly.
 *
 * Usage:
 *   node test-lead.js
 *
 * Tip: set LOG_LEVEL=debug in your .env for maximum output.
 */

require('dotenv').config();

const logger        = require('./src/utils/logger');
const { createGhlClient }    = require('./src/ghl/client');
const { createContact, addTag } = require('./src/ghl/contacts');
const { enrollInWorkflow }   = require('./src/ghl/workflows');
const { createSheetsClient } = require('./src/sheets/client');
const { appendLeadRow }      = require('./src/sheets/tracker');
const { addContact, addDeal, startMatcher } = require('./src/matching/matcher');

// ─── Fake lead data ───────────────────────────────────────────────────────────

const FAKE_CONTACT = {
  fullName:  'Test User',
  firstName: 'Test',
  lastName:  'User',
  email:     'test@test.com',
  phone:     '416-555-0000',
  nameKey:   'test user',
};

const FAKE_DEAL = {
  fullName:  'Test User',
  firstName: 'Test',
  lastName:  'User',
  dealType:  'switch',
  nameKey:   'test user',
};

// ─── Match handler (mirrors src/index.js handleMatch) ────────────────────────

async function handleMatch(contactData, dealData) {
  const { firstName, lastName, email, phone, fullName } = contactData;
  const { dealType } = dealData;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`[TEST] Processing matched lead: ${fullName}`);
  logger.info(`  Email:     ${email}`);
  logger.info(`  Phone:     ${phone}`);
  logger.info(`  Deal type: ${dealType}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const ghl = createGhlClient();

  // Step 1: Create contact in GHL
  const contactId = await createContact(ghl, { firstName, lastName, email, phone });

  // Step 2: Tag with deal type
  const tagLabel = dealType.charAt(0).toUpperCase() + dealType.slice(1);
  await addTag(ghl, contactId, tagLabel);

  // Step 3: Enroll in workflow
  await enrollInWorkflow(ghl, contactId, dealType);

  logger.info(`GHL processing complete. Contact ID: ${contactId}`);

  // Step 4: Append to Google Sheets
  if (process.env.GOOGLE_SHEET_ID) {
    const sheets = createSheetsClient();
    await appendLeadRow(sheets, contactData, dealType);
  } else {
    logger.warn('GOOGLE_SHEET_ID not set — skipping Sheets step.');
  }

  logger.info('[TEST] ✓ All steps completed successfully.');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function run() {
  logger.info('=== Test Lead Simulation starting ===');
  logger.info(`Contact: ${FAKE_CONTACT.fullName} <${FAKE_CONTACT.email}> ${FAKE_CONTACT.phone}`);
  logger.info(`Deal:    ${FAKE_DEAL.fullName} — ${FAKE_DEAL.dealType}`);
  logger.info('');

  startMatcher();

  // Feed both emails into the matcher — the second one triggers handleMatch
  logger.info('[TEST] Submitting fake Contact owner email...');
  addContact(FAKE_CONTACT, handleMatch);

  logger.info('[TEST] Submitting fake Deal owner email...');
  addDeal(FAKE_DEAL, handleMatch);
}

run().catch((err) => {
  logger.error(`Test failed: ${err.message}`);
  if (err.stack) logger.error(err.stack);
  process.exit(1);
});
