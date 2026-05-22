'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
    });
  }
  return _client;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are Jarvis, an expert AI mortgage business assistant for Jake Murray, a Canadian mortgage broker based in Ontario.

You help with:
- Mortgage deal analysis and client financial assessments
- Professional financial reports for clients
- Optimal mortgage strategies (rate type, term, lender, refinance/renewal timing)
- Canadian mortgage market knowledge (OSFI B-20 stress test, CMHC rules, stress test rate, HELOCs, insured vs conventional, MICs, B lenders)
- Pipeline tracking, commission calculations, and business insights
- Adding funded deals to the tracker when Jake shares deal summaries

DEAL INGESTION: When Jake pastes or describes a deal — even informally (e.g. "just closed Smith, $650k purchase with TD, 5yr fixed at 5.09, 25yr am, closing May 15") — extract all available fields and call add_funded_deal immediately. Do not ask for confirmation first. After adding, confirm what was recorded and flag any fields you had to estimate or leave blank.

Always be concise and immediately actionable. Reference live pipeline data when answering questions about volume, commissions, or deal history.`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'add_funded_deal',
    description: 'Add a funded or closing mortgage deal to the pipeline tracker. Call this whenever Jake shares deal details, even informally.',
    input_schema: {
      type: 'object',
      properties: {
        borrower:  { type: 'string',  description: 'Full name of the borrower' },
        year:      { type: 'integer', description: 'Year: 2025 or 2026', enum: [2025, 2026] },
        type:      { type: 'string',  description: 'Deal type', enum: ['Purchase', 'Refinance', 'Switch', 'Renewal', 'HELOC'] },
        source:    { type: 'string',  description: 'Lead source (e.g. referral, website)' },
        lender:    { type: 'string',  description: 'Lender name (e.g. TD, RBC, MCAP, Scotia, First National)' },
        closing:   { type: 'string',  description: 'Closing date YYYY-MM-DD' },
        amt:       { type: 'number',  description: 'Mortgage amount in dollars' },
        term:      { type: 'integer', description: 'Mortgage term in years (e.g. 5)' },
        rateType:  { type: 'string',  description: 'Rate type', enum: ['Fixed', 'Variable', 'ARM'] },
        rate:      { type: 'number',  description: 'Interest rate as a percentage e.g. 5.14' },
        bps:       { type: 'integer', description: 'Basis points earned' },
        split:     { type: 'number',  description: 'Commission split as decimal e.g. 0.9 for 90%' },
        grossComm: { type: 'number',  description: 'Gross commission in dollars' },
        yourComm:  { type: 'number',  description: 'Net commission after split in dollars' },
        notes:     { type: 'string',  description: 'Additional notes' },
      },
      required: ['borrower', 'amt', 'year'],
    },
  },
];

// ─── Pipeline summary injected into every system prompt ───────────────────────

function buildPipelineSummary(deals) {
  if (!deals || !deals.length) return '\n\n--- PIPELINE: No deals on file yet ---';

  const byYear = {};
  for (const d of deals) {
    const y = d.year || new Date().getFullYear();
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(d);
  }

  let out = '\n\n--- LIVE PIPELINE ---';
  for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
    const yd = byYear[year];
    const vol   = yd.reduce((s, d) => s + (d.amt       || 0), 0);
    const gross = yd.reduce((s, d) => s + (d.gross_comm|| 0), 0);
    const yours = yd.reduce((s, d) => s + (d.your_comm || 0), 0);
    out += `\n${year}: ${yd.length} deals | $${(vol / 1e6).toFixed(2)}M vol | $${Math.round(gross).toLocaleString()} gross | $${Math.round(yours).toLocaleString()} your comm`;

    const sorted = [...yd]
      .sort((a, b) => (b.closing || '').localeCompare(a.closing || ''))
      .slice(0, 30);
    for (const d of sorted) {
      out += `\n  • ${d.borrower} | ${d.type || '—'} | ${d.lender || '—'} | $${(d.amt || 0).toLocaleString()} | ${d.rate ? d.rate + '%' : '—'} | Closes: ${d.closing || '—'} | Your comm: $${Math.round(d.your_comm || 0).toLocaleString()}`;
    }
  }
  return out;
}

function buildSystem(contextText, deals) {
  const fullText =
    SYSTEM +
    buildPipelineSummary(deals) +
    (contextText ? `\n\n--- CURRENT CONTEXT ---\n${contextText}` : '');

  // Mark as cacheable — Anthropic caches this for 5 min, saving tokens + latency
  return [{ type: 'text', text: fullText, cache_control: { type: 'ephemeral' } }];
}

// ─── Streaming chat with tool use + pipeline context ──────────────────────────

async function* streamChat(messages, contextText, deals, onTool) {
  const system = buildSystem(contextText, deals);

  const stream = getClient().messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages,
    tools: TOOLS,
    tool_choice: { type: 'auto' },
  });

  // Stream text deltas live
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { text: event.delta.text };
    }
  }

  const finalMsg = await stream.finalMessage();

  // Handle tool use
  if (finalMsg.stop_reason === 'tool_use') {
    const toolUse = finalMsg.content.find(b => b.type === 'tool_use');
    if (toolUse && onTool) {
      yield { text: '\n\n🔄 Adding to pipeline...' };

      let toolResult;
      try {
        toolResult = await onTool(toolUse.name, toolUse.input);
        yield { action: 'reload', target: 'deals' };
      } catch (err) {
        toolResult = { error: err.message };
      }

      const followUpMessages = [
        ...messages,
        { role: 'assistant', content: finalMsg.content },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
          }],
        },
      ];

      const followUp = getClient().messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system,
        messages: followUpMessages,
      });

      for await (const event of followUp) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          yield { text: event.delta.text };
        }
      }
    }
  }
}

// ─── Report generation ────────────────────────────────────────────────────────

async function generateReport(params) {
  const { clientName, dealType, reportType, details } = params;

  const prompt = `Generate a professional mortgage financial report for client delivery.

Client: ${clientName}
Deal Type: ${dealType}
Report Type: ${reportType}
Deal Details:
${JSON.stringify(details, null, 2)}

Structure with: Executive Summary, Deal Overview, Financial Analysis (monthly payments, total interest, amortization highlights), Rate Analysis, Recommendations, Key Terms & Conditions.

Use professional financial language suitable for sending directly to the client. Format cleanly with bold headers.`;

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0].text;
}

// ─── Client mortgage suggestions ──────────────────────────────────────────────

async function getMortgageSuggestions(client, dealHistory) {
  const prompt = `Advise a Canadian mortgage broker on how to best serve this client.

Client Profile:
${JSON.stringify(client, null, 2)}

Deal History:
${JSON.stringify(dealHistory, null, 2)}

Provide:
1. **Top 3 Mortgage Plays Right Now** — specific, actionable (refinance, HELOC, renewal strategy, rate hold, etc.)
2. **Renewal / Refinance Timing** — when to act and why
3. **Rate Strategy** — fixed vs variable with rationale, ideal term
4. **Lender Match** — A, B, or MIC lender categories and why
5. **Opportunities & Red Flags** — equity, credit, income, market timing

Be specific. Reference their actual numbers.`;

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0].text;
}

module.exports = { streamChat, generateReport, getMortgageSuggestions };
