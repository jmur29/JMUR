import puppeteer from 'puppeteer';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

// ─── HTML template ────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function formatPercent(n: number): string {
  return `${n.toFixed(3)}%`;
}

function flagBadge(type: string): string {
  const colors: Record<string, string> = {
    PASS: '#16a34a',
    WARN: '#d97706',
    FAIL: '#dc2626',
    INFO: '#2563eb',
  };
  const color = colors[type] ?? '#6b7280';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${color};color:#fff;font-size:11px;font-weight:600;">${type}</span>`;
}

function buildReportHtml(application: ApplicationWithRelations, tenantName: string): string {
  const latestDecision = application.decisions[0] ?? null;
  const primaryBorrower = application.borrowers.find((b) => b.type === 'PRIMARY');
  const coBorrower = application.borrowers.find((b) => b.type === 'CO_BORROWER');
  const prop = application.property;
  const terms = application.mortgageTerms;

  const toNum = (d: Prisma.Decimal | null | undefined): number =>
    d ? parseFloat(d.toString()) : 0;

  const decisionColor =
    latestDecision?.decision === 'APPROVE'
      ? '#16a34a'
      : latestDecision?.decision === 'DECLINE'
      ? '#dc2626'
      : '#d97706';

  const flags = (latestDecision?.flags ?? []) as Array<{
    type: string;
    message: string;
    field?: string;
  }>;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Underwriting Report — ${application.fileNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1f2937; background: #fff; padding: 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; }
    h2 { font-size: 15px; font-weight: 600; color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .header-right { text-align: right; }
    .file-number { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .date { font-size: 12px; color: #9ca3af; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 6px; color: #fff; font-size: 14px; font-weight: 700; }
    .section { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
    th { font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; background: #f9fafb; }
    .ratio-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .ratio-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    .ratio-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .ratio-value { font-size: 22px; font-weight: 700; color: #111827; margin-top: 2px; }
    .ratio-stress { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .flag-row { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 10px; }
    .notes { background: #f9fafb; border-left: 3px solid #d1d5db; padding: 12px 16px; font-size: 12px; color: #6b7280; border-radius: 0 4px 4px 0; }
    .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Underwriting Report</h1>
      <div class="file-number">${application.fileNumber} &nbsp;·&nbsp; ${tenantName}</div>
      <div class="date">Generated ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</div>
    </div>
    <div class="header-right">
      ${
        latestDecision
          ? `<span class="badge" style="background:${decisionColor};">${latestDecision.decision}</span>`
          : '<span class="badge" style="background:#6b7280;">PENDING</span>'
      }
      <div class="date" style="margin-top:6px;">Status: ${application.status}</div>
    </div>
  </div>

  <!-- Ratio summary -->
  ${
    latestDecision
      ? `
  <div class="section">
    <h2>Key Ratios</h2>
    <div class="ratio-grid">
      <div class="ratio-card">
        <div class="ratio-label">GDS</div>
        <div class="ratio-value" style="color:${parseFloat(latestDecision.gds.toString()) > 39 ? '#dc2626' : parseFloat(latestDecision.gds.toString()) > 35 ? '#d97706' : '#16a34a'};">${formatPercent(parseFloat(latestDecision.gds.toString()))}</div>
        <div class="ratio-stress">Stress: ${formatPercent(parseFloat(latestDecision.stressGds.toString()))}</div>
      </div>
      <div class="ratio-card">
        <div class="ratio-label">TDS</div>
        <div class="ratio-value" style="color:${parseFloat(latestDecision.tds.toString()) > 44 ? '#dc2626' : parseFloat(latestDecision.tds.toString()) > 40 ? '#d97706' : '#16a34a'};">${formatPercent(parseFloat(latestDecision.tds.toString()))}</div>
        <div class="ratio-stress">Stress: ${formatPercent(parseFloat(latestDecision.stressTds.toString()))}</div>
      </div>
      <div class="ratio-card">
        <div class="ratio-label">LTV</div>
        <div class="ratio-value" style="color:${parseFloat(latestDecision.ltv.toString()) > 95 ? '#dc2626' : parseFloat(latestDecision.ltv.toString()) > 80 ? '#d97706' : '#16a34a'};">${formatPercent(parseFloat(latestDecision.ltv.toString()))}</div>
        <div class="ratio-stress">&nbsp;</div>
      </div>
    </div>
  </div>
  `
      : ''
  }

  <!-- Borrowers -->
  <div class="section">
    <h2>Borrower(s)</h2>
    <table>
      <thead><tr><th>Role</th><th>Name</th><th>Employment</th><th>Credit Score</th><th>Bankruptcies</th><th>Collections</th></tr></thead>
      <tbody>
        ${[primaryBorrower, coBorrower]
          .filter(Boolean)
          .map(
            (b) =>
              `<tr>
                <td>${b!.type === 'PRIMARY' ? 'Primary' : 'Co-Borrower'}</td>
                <td>${b!.firstName} ${b!.lastName}</td>
                <td>${b!.employmentType}</td>
                <td>${b!.creditScore}</td>
                <td>${b!.bankruptcies ? 'Yes' : 'No'}</td>
                <td>${b!.collections ? 'Yes' : 'No'}</td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <!-- Property -->
  ${
    prop
      ? `
  <div class="section">
    <h2>Property</h2>
    <table>
      <tbody>
        <tr><th>Address</th><td>${prop.address}, ${prop.city}, ${prop.province} ${prop.postalCode}</td><th>Type</th><td>${prop.propertyType}</td></tr>
        <tr><th>Purchase Price</th><td>${formatCurrency(toNum(prop.purchasePrice))}</td><th>Appraised Value</th><td>${formatCurrency(toNum(prop.appraisedValue))}</td></tr>
        <tr><th>Down Payment</th><td>${formatCurrency(toNum(prop.downPayment))}</td><th>Annual Tax</th><td>${formatCurrency(toNum(prop.annualTax))}</td></tr>
        <tr><th>Monthly Heat</th><td>${formatCurrency(toNum(prop.monthlyHeat))}</td><th>Condo Fees</th><td>${formatCurrency(toNum(prop.condoFees))}</td></tr>
        <tr><th>Occupancy</th><td>${prop.occupancy}</td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  <!-- Mortgage Terms -->
  ${
    terms
      ? `
  <div class="section">
    <h2>Mortgage Terms</h2>
    <table>
      <tbody>
        <tr><th>Mortgage Amount</th><td>${formatCurrency(toNum(terms.mortgageAmount))}</td><th>Monthly Payment</th><td>${formatCurrency(toNum(terms.monthlyPayment))}</td></tr>
        <tr><th>Contract Rate</th><td>${formatPercent(toNum(terms.contractRate))}</td><th>Stress Rate</th><td>${formatPercent(toNum(terms.stressRate))}</td></tr>
        <tr><th>Amortization</th><td>${terms.amortizationYears} years</td><th>Term</th><td>${terms.termYears} years</td></tr>
        <tr><th>Insured</th><td>${terms.insured ? 'Yes (CMHC)' : 'No'}</td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  <!-- Flags -->
  ${
    latestDecision && flags.length > 0
      ? `
  <div class="section">
    <h2>Underwriting Flags</h2>
    <div>
      ${flags
        .map(
          (f) =>
            `<div class="flag-row">${flagBadge(f.type)} <span>${f.message}</span>${f.field ? ` <span style="color:#9ca3af;font-size:11px;">(${f.field})</span>` : ''}</div>`
        )
        .join('')}
    </div>
  </div>
  `
      : ''
  }

  <!-- Notes -->
  ${
    latestDecision?.notes
      ? `
  <div class="section">
    <h2>Underwriter Notes</h2>
    <div class="notes">${latestDecision.notes.replace(/\n/g, '<br/>')}</div>
  </div>
  `
      : ''
  }

  <div class="footer">
    <span>ClearPath UW — Confidential</span>
    <span>${application.fileNumber}</span>
  </div>
</body>
</html>`;
}

// ─── Type for the application with all relations ──────────────────────────────

type ApplicationWithRelations = Awaited<ReturnType<typeof loadApplicationForReport>>;

async function loadApplicationForReport(applicationId: string, tenantId: string) {
  return prisma.application.findFirstOrThrow({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: {
      borrowers: { include: { income: true } },
      property: true,
      mortgageTerms: true,
      decisions: {
        orderBy: { decidedAt: 'desc' },
        take: 1,
        include: { decidedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateHtmlReport(
  applicationId: string,
  tenantId: string
): Promise<string | null> {
  let application: ApplicationWithRelations;
  try {
    application = await loadApplicationForReport(applicationId, tenantId);
  } catch {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const tenantName = tenant?.name ?? 'ClearPath UW';

  return buildReportHtml(application, tenantName);
}

export async function generatePdfReport(
  applicationId: string,
  tenantId: string
): Promise<Buffer | null> {
  const html = await generateHtmlReport(applicationId, tenantId);
  if (!html) return null;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
