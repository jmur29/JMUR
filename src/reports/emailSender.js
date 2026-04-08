'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Create a Nodemailer transporter using Gmail SMTP with an app password.
 * Requires SMTP_USER and SMTP_PASS environment variables.
 */
function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required for email sending.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an HTML email via Gmail SMTP.
 *
 * @param {string} to       - Recipient email address
 * @param {string} subject  - Email subject
 * @param {string} htmlBody - HTML email body
 */
async function sendEmail(to, subject, htmlBody) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Jake Murray Mortgages" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: htmlBody,
  });

  logger.info(`Email sent to ${to} | Subject: "${subject}"`);
}

module.exports = { sendEmail };
