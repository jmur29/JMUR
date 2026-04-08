'use strict';

const logger = require('../utils/logger');

/**
 * Create a new contact in GoHighLevel.
 *
 * @param {object} ghl       - Authenticated GHL axios client
 * @param {object} contactData
 *   { firstName, lastName, email, phone }
 * @returns {string} contactId
 */
async function createContact(ghl, contactData) {
  const { firstName, lastName, email, phone } = contactData;

  const payload = {
    firstName,
    lastName,
    email,
    locationId: process.env.GHL_LOCATION_ID,
    source: 'HubSpot Email Automation',
  };

  if (phone) payload.phone = phone;

  logger.info(`Creating GHL contact: ${firstName} ${lastName} <${email}>`);

  const res = await ghl.post('/contacts/', payload);
  // v2 response: { contact: { id, ... } }
  const contactId = res.data?.contact?.id;

  if (!contactId) {
    throw new Error(
      `GHL createContact: unexpected response — no contact.id returned. ` +
        `Response: ${JSON.stringify(res.data)}`
    );
  }

  logger.info(`Contact created successfully. GHL Contact ID: ${contactId}`);
  return contactId;
}

/**
 * Add a tag to an existing GHL contact.
 *
 * @param {object} ghl       - Authenticated GHL axios client
 * @param {string} contactId
 * @param {string} tag       - e.g. "Purchase", "Refinance", "Switch"
 */
async function addTag(ghl, contactId, tag) {
  logger.info(`Tagging contact ${contactId} with "${tag}"`);

  await ghl.post(`/contacts/${contactId}/tags`, {
    tags: [tag],
  });

  logger.info(`Tag "${tag}" added to contact ${contactId}.`);
}

module.exports = { createContact, addTag };
