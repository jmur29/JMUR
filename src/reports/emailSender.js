'use strict';

const logger = require('../utils/logger');

/**
 * Encode a string as base64url (URL-safe base64, no padding).
 */
function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send an HTML email via the Gmail API.
 *
 * @param {object} gmail    - Authenticated Gmail API client
 * @param {string} to       - Recipient email address
 * @param {string} subject  - Email subject
 * @param {string} htmlBody - HTML email body
 */
async function sendEmail(gmail, to, subject, htmlBody) {
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];

  const raw = toBase64Url(messageParts.join('\r\n'));

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  logger.info(`Email sent to ${to} | Subject: "${subject}"`);
}

module.exports = { sendEmail };
