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

  try {
    const info = await transporter.sendMail({
      from: `"Jake Murray Mortgages" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlBody,
    });

    logger.info(`Daily report sent successfully to ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
  } catch (err) {
    logger.error(`Failed to send email to ${to} | ${err.message}`);
    logger.error(err.stack);
    throw err;
  }
}

module.exports = { sendEmail };
