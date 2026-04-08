'use strict';

/**
 * Format a date string for display.
 */
function displayDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  if (!y) return str;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

/**
 * Render a table of leads as an HTML table.
 */
function leadTable(leads, columns) {
  if (leads.length === 0) return '<p style="color:#666;font-style:italic;">None</p>';

  const headers = columns.map((c) => `<th style="${thStyle}">${c.label}</th>`).join('');
  const rows = leads.map((l) => {
    const cells = columns.map((c) => {
      let val = l[c.key] || '—';
      if (c.format === 'date') val = displayDate(val);
      return `<td style="${tdStyle}">${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table style="${tableStyle}">
      <thead><tr style="background:#f0f4ff;">${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const tableStyle = 'width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14px;';
const thStyle = 'padding:8px 12px;text-align:left;border-bottom:2px solid #c8d4f0;color:#1a3a6e;font-weight:600;';
const tdStyle = 'padding:7px 12px;border-bottom:1px solid #e8edf5;color:#333;';

const NAME_EMAIL = [
  { key: 'name',         label: 'Name' },
  { key: 'email',        label: 'Email' },
  { key: 'phone',        label: 'Phone' },
  { key: 'dealType',     label: 'Deal Type' },
];

const NAME_EMAIL_DATE = [
  ...NAME_EMAIL,
  { key: 'dateAssigned', label: 'Assigned', format: 'date' },
];

const NAME_EMAIL_CONTACT = [
  ...NAME_EMAIL,
  { key: 'lastContact',  label: 'Last Contact', format: 'date' },
];

/**
 * Build the full HTML daily report email body.
 * @param {object} data - Output from readPipelineData()
 * @param {string} date - Today's date string for the report heading
 * @returns {string} HTML string
 */
function formatReport(data, date) {
  const { newLast24h, needsFollowUp, applicationStalled, underwriting, totalActive } = data;

  const section = (title, emoji, count, content, note = '') => `
    <div style="margin-bottom:32px;">
      <h2 style="font-size:16px;color:#1a3a6e;margin:0 0 4px;border-left:4px solid #4a6cf7;padding-left:10px;">
        ${emoji} ${title} <span style="color:#888;font-weight:400;font-size:14px;">(${count})</span>
      </h2>
      ${note ? `<p style="font-size:13px;color:#c0392b;margin:4px 0 10px;padding-left:14px;">${note}</p>` : '<div style="margin-bottom:10px;"></div>'}
      ${content}
    </div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:24px;background:#f8f9fc;color:#222;">

  <div style="background:#1a3a6e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;margin-bottom:0;">
    <h1 style="margin:0;font-size:20px;">Jake Murray Mortgages</h1>
    <p style="margin:4px 0 0;font-size:14px;opacity:0.85;">Daily Pipeline Report — ${date}</p>
  </div>

  <div style="background:#fff;border:1px solid #dce4f0;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

    <div style="background:#e8f0fe;border-radius:6px;padding:12px 18px;margin-bottom:28px;display:flex;align-items:center;">
      <span style="font-size:22px;margin-right:12px;">📊</span>
      <span style="font-size:16px;color:#1a3a6e;font-weight:600;">Total Active Leads: ${totalActive}</span>
    </div>

    ${section(
      'New Leads — Last 24 Hours', '🆕', newLast24h.length,
      leadTable(newLast24h, NAME_EMAIL_DATE)
    )}

    ${section(
      'Needs Follow Up', '⚠️', needsFollowUp.length,
      leadTable(needsFollowUp, NAME_EMAIL_CONTACT),
      needsFollowUp.length > 0 ? 'No contact in over 48 hours — reach out today.' : ''
    )}

    ${section(
      'Application Sent — Finmo Not Completed', '📋', applicationStalled.length,
      leadTable(applicationStalled, NAME_EMAIL_DATE),
      applicationStalled.length > 0 ? 'Application sent 2+ days ago with no progression.' : ''
    )}

    ${section(
      'In Underwriting', '🏦', underwriting.length,
      leadTable(underwriting, NAME_EMAIL_DATE)
    )}

  </div>

  <p style="text-align:center;font-size:12px;color:#aaa;margin-top:16px;">
    Generated automatically by Mortgage Lead Automation · ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}
  </p>

</body>
</html>`;
}

module.exports = { formatReport };
