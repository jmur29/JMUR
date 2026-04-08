'use strict';

const logger = require('../utils/logger');

const MATCH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;  // check for expired entries every 1 minute

/**
 * In-memory store keyed by normalised "firstname lastname".
 * Each entry:
 * {
 *   nameKey:   string,
 *   contact:   { fullName, firstName, lastName, email, phone, nameKey } | null,
 *   deal:      { fullName, firstName, lastName, dealType, nameKey } | null,
 *   createdAt: number (ms epoch),
 * }
 */
const pendingMatches = new Map();

/**
 * Add a contact email payload to the store and check for a match.
 * @param {object} contactData - Parsed contact data from parser.js
 * @param {function} onMatch - Called with (contactData, dealData) when matched
 */
function addContact(contactData, onMatch) {
  const { nameKey } = contactData;
  const existing = pendingMatches.get(nameKey);

  if (existing) {
    if (existing.deal) {
      // Deal already arrived — we have a full match
      logger.info(`MATCH found (contact arrived second) → "${nameKey}"`);
      pendingMatches.delete(nameKey);
      onMatch(contactData, existing.deal);
      return;
    }
    // Contact already stored — update it (duplicate or re-send)
    logger.warn(`Duplicate contact received for "${nameKey}" — overwriting.`);
    existing.contact = contactData;
    existing.createdAt = Date.now();
  } else {
    logger.info(`Contact stored, awaiting deal → "${nameKey}"`);
    pendingMatches.set(nameKey, {
      nameKey,
      contact: contactData,
      deal: null,
      createdAt: Date.now(),
    });
  }
}

/**
 * Add a deal email payload to the store and check for a match.
 * @param {object} dealData - Parsed deal data from parser.js
 * @param {function} onMatch - Called with (contactData, dealData) when matched
 */
function addDeal(dealData, onMatch) {
  const { nameKey } = dealData;
  const existing = pendingMatches.get(nameKey);

  if (existing) {
    if (existing.contact) {
      // Contact already arrived — we have a full match
      logger.info(`MATCH found (deal arrived second) → "${nameKey}"`);
      pendingMatches.delete(nameKey);
      onMatch(existing.contact, dealData);
      return;
    }
    // Deal already stored — update it
    logger.warn(`Duplicate deal received for "${nameKey}" — overwriting.`);
    existing.deal = dealData;
    existing.createdAt = Date.now();
  } else {
    logger.info(`Deal stored, awaiting contact → "${nameKey}"`);
    pendingMatches.set(nameKey, {
      nameKey,
      contact: null,
      deal: dealData,
      createdAt: Date.now(),
    });
  }
}

/**
 * Remove entries that have exceeded the match window.
 * Called on a timer so stale unmatched entries don't accumulate.
 */
function cleanupExpired() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [key, entry] of pendingMatches) {
    if (now - entry.createdAt > MATCH_WINDOW_MS) {
      const hasContact = !!entry.contact;
      const hasDeal = !!entry.deal;
      logger.warn(
        `Match window expired for "${key}" — ` +
          `contact=${hasContact ? 'YES' : 'NO'} deal=${hasDeal ? 'YES' : 'NO'}. Discarding.`
      );
      pendingMatches.delete(key);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    logger.info(`Cleanup removed ${expiredCount} expired pending match(es).`);
  }
}

/**
 * Return a snapshot of the current pending store (for debugging/logging).
 */
function getPendingSnapshot() {
  const now = Date.now();
  return Array.from(pendingMatches.values()).map((e) => ({
    nameKey: e.nameKey,
    hasContact: !!e.contact,
    hasDeal: !!e.deal,
    ageSeconds: Math.round((now - e.createdAt) / 1000),
    expiresInSeconds: Math.round((MATCH_WINDOW_MS - (now - e.createdAt)) / 1000),
  }));
}

/**
 * Start the cleanup timer.
 */
function startMatcher() {
  setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
  logger.info(
    `Matcher started. Match window: ${MATCH_WINDOW_MS / 60000} min, ` +
      `cleanup interval: ${CLEANUP_INTERVAL_MS / 1000}s`
  );
}

module.exports = { addContact, addDeal, startMatcher, getPendingSnapshot };
