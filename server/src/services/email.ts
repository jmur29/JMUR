import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import logger from '../utils/logger';

// ─── Lazy transporter ─────────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    logger.warn(
      'Email: SMTP_HOST, SMTP_PORT, SMTP_USER or SMTP_PASS not set — email sending disabled.'
    );
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

// ─── EmailPayload ─────────────────────────────────────────────────────────────

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('Email not sent (no transporter configured)', { to: payload.to, subject: payload.subject });
    return;
  }

  const from = process.env.EMAIL_FROM ?? 'ClearPath UW <noreply@clearpathuw.com>';

  try {
    await transporter.sendMail({ from, to: payload.to, subject: payload.subject, html: payload.html });
    logger.info('Email sent', { to: payload.to, subject: payload.subject });
  } catch (err) {
    logger.error('Failed to send email', {
      to: payload.to,
      subject: payload.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    // Do not rethrow — email failures are non-fatal
  }
}

// ─── Shared template helpers ──────────────────────────────────────────────────

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ClearPath UW</title>
<style>
  body { margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .header { background: #1a56db; padding: 24px 32px; }
  .header-title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
  .header-sub { color: #bfdbfe; font-size: 13px; margin: 4px 0 0 0; }
  .body { padding: 32px; }
  .greeting { font-size: 16px; margin: 0 0 20px 0; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .card-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .card-row:last-child { border-bottom: none; }
  .card-label { color: #64748b; }
  .card-value { font-weight: 600; color: #1e293b; }
  .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-amber { background: #fef9c3; color: #d97706; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .cta { text-align: center; margin: 28px 0; }
  .cta a { background: #1a56db; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; }
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; color: #78350f; white-space: pre-wrap; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <p class="header-title">ClearPath UW</p>
    <p class="header-sub">Mortgage Underwriting Platform</p>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} ClearPath UW. This is an automated notification.
  </div>
</div>
</body>
</html>`;
}

// ─── Decision Email ───────────────────────────────────────────────────────────

const DECISION_BADGE: Record<'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW', { cls: string; label: string }> = {
  APPROVE: { cls: 'badge-green', label: 'Approved' },
  DECLINE: { cls: 'badge-red', label: 'Declined' },
  MANUAL_REVIEW: { cls: 'badge-amber', label: 'Manual Review Required' },
};

export async function sendDecisionEmail(opts: {
  to: string;
  recipientName: string;
  fileNumber: string;
  borrowerName: string;
  decision: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW';
  decidedByName: string;
  notes: string | null;
  applicationUrl: string;
}): Promise<void> {
  const badge = DECISION_BADGE[opts.decision];

  const notesHtml = opts.notes
    ? `<div class="notes-box"><strong>Underwriter Notes:</strong><br/>${opts.notes}</div>`
    : '';

  const content = `
    <p class="greeting">Hi ${opts.recipientName},</p>
    <p style="font-size:15px;color:#475569;">A decision has been recorded for the following mortgage application:</p>
    <div style="text-align:center;margin:20px 0;">
      <span class="badge ${badge.cls}">${badge.label}</span>
    </div>
    <div class="card">
      <div class="card-row"><span class="card-label">File Number</span><span class="card-value">${opts.fileNumber}</span></div>
      <div class="card-row"><span class="card-label">Borrower</span><span class="card-value">${opts.borrowerName}</span></div>
      <div class="card-row"><span class="card-label">Decision By</span><span class="card-value">${opts.decidedByName}</span></div>
    </div>
    ${notesHtml}
    <div class="cta"><a href="${opts.applicationUrl}">View Application</a></div>
  `;

  await sendEmail({
    to: opts.to,
    subject: `[ClearPath UW] Decision: ${badge.label} — File ${opts.fileNumber}`,
    html: wrap(content),
  });
}

// ─── Assignment Email ─────────────────────────────────────────────────────────

export async function sendAssignmentEmail(opts: {
  to: string;
  recipientName: string;
  fileNumber: string;
  borrowerName: string;
  assignedByName: string;
  applicationUrl: string;
}): Promise<void> {
  const content = `
    <p class="greeting">Hi ${opts.recipientName},</p>
    <p style="font-size:15px;color:#475569;">You have been assigned a new mortgage application for review.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">File Number</span><span class="card-value">${opts.fileNumber}</span></div>
      <div class="card-row"><span class="card-label">Borrower</span><span class="card-value">${opts.borrowerName}</span></div>
      <div class="card-row"><span class="card-label">Assigned By</span><span class="card-value">${opts.assignedByName}</span></div>
    </div>
    <div class="cta"><a href="${opts.applicationUrl}">Open File</a></div>
  `;

  await sendEmail({
    to: opts.to,
    subject: `[ClearPath UW] New File Assigned — ${opts.fileNumber}`,
    html: wrap(content),
  });
}

// ─── Status Change Email ──────────────────────────────────────────────────────

export async function sendStatusChangeEmail(opts: {
  to: string;
  recipientName: string;
  fileNumber: string;
  fromStatus: string;
  toStatus: string;
  applicationUrl: string;
}): Promise<void> {
  const content = `
    <p class="greeting">Hi ${opts.recipientName},</p>
    <p style="font-size:15px;color:#475569;">The status of a mortgage application has been updated.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">File Number</span><span class="card-value">${opts.fileNumber}</span></div>
      <div class="card-row"><span class="card-label">Previous Status</span><span class="card-value">${opts.fromStatus}</span></div>
      <div class="card-row"><span class="card-label">New Status</span><span class="card-value">${opts.toStatus}</span></div>
    </div>
    <div class="cta"><a href="${opts.applicationUrl}">View Application</a></div>
  `;

  await sendEmail({
    to: opts.to,
    subject: `[ClearPath UW] Status Changed — ${opts.fileNumber}`,
    html: wrap(content),
  });
}
