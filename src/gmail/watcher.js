'use strict';

const logger = require('../utils/logger');
const { parseContactEmail, parseDealEmail } = require('./parser');

const SENDER_FILTER = 'from:noreply@hubspot.com';
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// Track processed message IDs to prevent double-processing
const processedIds = new Set();

/**
 * Decode a base64url-encoded Gmail message part.
 */
function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Recursively extract a body part by MIME type from a message payload.
 */
function extractBody(payload, preferredType = 'text/html') {
  if (!payload) return '';

  // Single-part message
  if (payload.mimeType === preferredType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Fallback to text/plain if html not found
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — recurse through parts
  if (payload.parts) {
    // Try preferred type first
    for (const part of payload.parts) {
      const result = extractBody(part, preferredType);
      if (result) return result;
    }
  }

  return '';
}

/**
 * Fetch full message details and extract subject + body.
 */
async function fetchMessage(gmail, messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = res.data.payload?.headers || [];
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '';
  const body = extractBody(res.data.payload);

  return { id: messageId, subject, body };
}

/**
 * Classify the email type based on subject line.
 * Returns 'contact', 'deal', or null.
 */
function classifySubject(subject) {
  if (subject.toLowerCase().includes('contact owner')) return 'contact';
  if (subject.toLowerCase().includes('deal owner')) return 'deal';
  return null;
}

/**
 * Poll Gmail for new HubSpot notification emails and invoke the handler.
 * @param {object} gmail - Authenticated Gmail client
 * @param {function} onEmail - Callback: (type, data) => void
 */
async function pollEmails(gmail, onEmail) {
  logger.debug('Polling Gmail for new HubSpot emails...');

  let nextPageToken = null;
  let fetchedCount = 0;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `${SENDER_FILTER} is:unread`,
      maxResults: 50,
      ...(nextPageToken && { pageToken: nextPageToken }),
    });

    const messages = listRes.data.messages || [];
    nextPageToken = listRes.data.nextPageToken || null;

    for (const msg of messages) {
      if (processedIds.has(msg.id)) continue;

      try {
        const { id, subject, body } = await fetchMessage(gmail, msg.id);
        const type = classifySubject(subject);

        if (!type) {
          // Not a relevant email type — still mark as seen so we skip it next poll
          processedIds.add(id);
          continue;
        }

        logger.info(`New ${type.toUpperCase()} email detected | Subject: "${subject}"`);

        let parsed = null;
        if (type === 'contact') {
          parsed = parseContactEmail(subject, body);
          if (!parsed) {
            logger.warn(`Failed to parse Contact email (id=${id}). Body may not match expected format.`);
          }
        } else if (type === 'deal') {
          parsed = parseDealEmail(subject, body);
          if (!parsed) {
            logger.warn(`Failed to parse Deal email (id=${id}). Body may not match expected format.`);
          }
        }

        if (parsed) {
          onEmail(type, parsed);
        }

        processedIds.add(id);
        fetchedCount++;

        // Mark email as read to keep the inbox clean (optional — remove if you want to keep them unread)
        await gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch (err) {
        logger.error(`Error processing message ${msg.id}: ${err.message}`);
      }
    }
  } while (nextPageToken);

  if (fetchedCount > 0) {
    logger.info(`Processed ${fetchedCount} new email(s) this poll cycle.`);
  }
}

/**
 * Start the Gmail watcher. Polls on a fixed interval.
 * @param {object} gmail - Authenticated Gmail client
 * @param {function} onEmail - Callback: (type, data) => void
 */
function startWatcher(gmail, onEmail) {
  logger.info(`Gmail watcher started. Polling every ${POLL_INTERVAL_MS / 1000}s for emails from noreply@hubspot.com`);

  // Run immediately, then on interval
  pollEmails(gmail, onEmail).catch((err) =>
    logger.error(`Poll error: ${err.message}`)
  );

  setInterval(() => {
    pollEmails(gmail, onEmail).catch((err) =>
      logger.error(`Poll error: ${err.message}`)
    );
  }, POLL_INTERVAL_MS);
}

module.exports = { startWatcher };
