'use strict';

const logger = require('../utils/logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and decode common entities for plain-text extraction.
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Normalize a full name to a consistent "firstname lastname" key for matching.
 * Lowercased, trimmed, extra spaces collapsed.
 */
function normalizeNameKey(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Contact Owner Email Parser ───────────────────────────────────────────────

/**
 * HubSpot "Contact owner" email format:
 *
 *   Subject: "[HubSpot CRM] Contact owner assigned: Jane Doe"
 *   or:      "Contact owner: Jane Doe"
 *
 *   Body (HTML) typically contains sections like:
 *     Name:    Jane Doe
 *     Email:   jane@example.com
 *     Phone:   555-123-4567
 *
 * @param {string} subject
 * @param {string} body  - HTML string from Gmail
 * @returns {{ fullName, firstName, lastName, email, phone, nameKey } | null}
 */
function parseContactEmail(subject, body) {
  const text = stripHtml(body);

  // ── Email address ──────────────────────────────────────────────────────────
  // Prefer an explicit "Email: xxx" label; fall back to any email-like pattern
  let email = null;
  const emailLabelMatch = text.match(/e[-\s]?mail\s*[:\|]\s*([\w.+\-]+@[\w.\-]+\.\w+)/i);
  if (emailLabelMatch) {
    email = emailLabelMatch[1].trim().toLowerCase();
  } else {
    const emailFallback = text.match(/\b([\w.+\-]+@[\w.\-]+\.\w+)\b/);
    if (emailFallback) email = emailFallback[1].trim().toLowerCase();
  }

  // Exclude the HubSpot sender address if it leaked into the body
  if (email && email.includes('noreply@hubspot')) email = null;

  // ── Phone number ───────────────────────────────────────────────────────────
  let phone = null;
  const phoneLabelMatch = text.match(/phone\s*[:\|]\s*([\d\s().+\-]{7,20})/i);
  if (phoneLabelMatch) {
    phone = phoneLabelMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    // Generic phone pattern: (555) 123-4567 | 555-123-4567 | +15551234567
    const phoneFallback = text.match(
      /(\+?1?\s*[-.]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/
    );
    if (phoneFallback) phone = phoneFallback[1].trim();
  }

  // ── Full name ──────────────────────────────────────────────────────────────
  // Strategy 1: "Name: Firstname Lastname" label in body
  let fullName = null;
  const nameLabelMatch = text.match(/(?:^|\s)name\s*[:\|]\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/im);
  if (nameLabelMatch) {
    fullName = nameLabelMatch[1].trim();
  }

  // Strategy 2: Subject line — "Contact owner assigned: Firstname Lastname"
  if (!fullName) {
    const subjectNameMatch = subject.match(
      /contact\s+owner[^:]*:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i
    );
    if (subjectNameMatch) fullName = subjectNameMatch[1].trim();
  }

  // Strategy 3: Derive from email address "firstname.lastname@..."
  if (!fullName && email) {
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._\-]/);
    if (parts.length >= 2) {
      fullName = parts
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
    }
  }

  if (!fullName) {
    logger.warn('parseContactEmail: Could not extract full name.');
    return null;
  }

  if (!email) {
    logger.warn('parseContactEmail: Could not extract email address.');
    return null;
  }

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  logger.debug(
    `Parsed contact → name="${fullName}" email="${email}" phone="${phone || 'N/A'}"`
  );

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone: phone || null,
    nameKey: normalizeNameKey(fullName),
  };
}

// ─── Deal Owner Email Parser ──────────────────────────────────────────────────

const VALID_DEAL_TYPES = ['switch', 'refinance', 'purchase'];

/**
 * HubSpot "Deal owner" email format:
 *
 *   Subject: "[HubSpot CRM] Deal owner assigned: Jane Doe - Purchase"
 *   or:      "Deal owner: Jane Doe - Refinance"
 *
 *   Body may also contain the deal name:
 *     Deal name: Jane Doe - Purchase
 *
 * Deal name format:  "Firstname Lastname - DealType"
 * where DealType ∈ { Switch, Refinance, Purchase }
 *
 * @param {string} subject
 * @param {string} body  - HTML string from Gmail
 * @returns {{ fullName, firstName, lastName, dealType, nameKey } | null}
 */
function parseDealEmail(subject, body) {
  const text = stripHtml(body);
  const dealTypePattern = VALID_DEAL_TYPES.join('|');
  const dealNameRegex = new RegExp(
    `([A-Z][a-z]+(?:\\s[A-Z][a-z]+)+)\\s*[-–]\\s*(${dealTypePattern})`,
    'i'
  );

  // Strategy 1: "Deal name: Firstname Lastname - DealType" label in body
  let match = text.match(
    new RegExp(`deal\\s*name\\s*[:\\|]\\s*${dealNameRegex.source}`, 'i')
  );

  // Strategy 2: Anywhere in the plain-text body
  if (!match) {
    match = text.match(dealNameRegex);
  }

  // Strategy 3: In the subject line
  if (!match) {
    match = subject.match(dealNameRegex);
  }

  if (!match) {
    logger.warn('parseDealEmail: Could not extract deal name / deal type.');
    return null;
  }

  // match groups differ by strategy: capture groups for name & type
  // dealNameRegex has 2 groups: (fullName) and (dealType)
  // when prefixed with "deal name:", the groups shift by 1
  const fullName = (match[1] || match[2]).trim();
  const dealType = (match[2] || match[3]).trim().toLowerCase();

  if (!VALID_DEAL_TYPES.includes(dealType)) {
    logger.warn(`parseDealEmail: Unrecognised deal type "${dealType}".`);
    return null;
  }

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  logger.debug(
    `Parsed deal → name="${fullName}" dealType="${dealType}"`
  );

  return {
    fullName,
    firstName,
    lastName,
    dealType,
    nameKey: normalizeNameKey(fullName),
  };
}

module.exports = { parseContactEmail, parseDealEmail, normalizeNameKey };
