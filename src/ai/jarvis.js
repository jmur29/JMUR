'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const SYSTEM = `You are Jarvis, an expert AI mortgage business assistant for Jake Murray, a Canadian mortgage broker.

You help with:
- Mortgage deal analysis and client financial assessments
- Professional financial reports for clients
- Optimal mortgage strategies (rate type, term, lender, refinance/renewal timing)
- Canadian mortgage market knowledge (OSFI B-20 stress test, CMHC rules, HELOCs, insured vs conventional)
- Pipeline tracking, commission calculations, and business insights

Always be concise, professional, and immediately actionable. Reference specific client or deal data when it's provided in context. When you don't have specific data, give concrete Canadian-market guidance based on current conditions.`;

async function* streamChat(messages, contextText) {
  const system = contextText
    ? `${SYSTEM}\n\n--- CURRENT CONTEXT ---\n${contextText}`
    : SYSTEM;

  const stream = getClient().messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

async function generateReport(params) {
  const { clientName, dealType, reportType, details } = params;

  const prompt = `Generate a professional mortgage financial report for client delivery.

Client: ${clientName}
Deal Type: ${dealType}
Report Type: ${reportType}
Deal Details:
${JSON.stringify(details, null, 2)}

Structure the report with these sections:
1. **Executive Summary** — one paragraph overview
2. **Deal Overview** — key terms, lender, closing date
3. **Financial Analysis** — monthly payment breakdown, total interest over term, amortization schedule highlights
4. **Rate Analysis** — context on the rate secured vs market, fixed/variable comparison if relevant
5. **Recommendations** — 2–3 actionable next steps or things to watch
6. **Key Terms & Conditions** — prepayment privileges, penalties, portability

Use professional financial language suitable for sending directly to the client. Format cleanly with bold headers.`;

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0].text;
}

async function getMortgageSuggestions(client, dealHistory) {
  const prompt = `You are advising a Canadian mortgage broker on how to best serve this client. Analyze their profile and deal history, then provide specific mortgage strategy recommendations.

Client Profile:
${JSON.stringify(client, null, 2)}

Deal History:
${JSON.stringify(dealHistory, null, 2)}

Provide a structured analysis with:
1. **Top 3 Mortgage Plays Right Now** — specific, actionable opportunities (refinance, HELOC, renewal strategy, rate hold, etc.)
2. **Renewal / Refinance Timing** — when to act and why
3. **Rate Strategy** — fixed vs variable recommendation with rationale, ideal term length
4. **Lender Match** — which lender categories best fit this client (A, B, MIC) and why
5. **Opportunities & Red Flags** — equity position, credit concerns, income changes, market timing

Be specific. Reference their actual numbers where available.`;

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0].text;
}

module.exports = { streamChat, generateReport, getMortgageSuggestions };
