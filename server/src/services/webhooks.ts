// Outbound webhook dispatcher — notifies external systems on key events.
// Configure via WEBHOOK_URL and WEBHOOK_SECRET env vars.
// Payload is signed with HMAC-SHA256 (X-ClearPath-Signature header).

import crypto from 'crypto';
import logger from '../utils/logger';

export type WebhookEvent =
  | 'application.created'
  | 'application.status_changed'
  | 'decision.approved'
  | 'decision.declined'
  | 'decision.manual_review'
  | 'document.uploaded';

export interface WebhookPayload {
  event: WebhookEvent;
  tenantId: string;
  applicationId: string;
  fileNumber: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(payload: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function dispatchWebhook(payload: WebhookPayload): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url) return; // No webhook configured — silently skip

  const body = JSON.stringify(payload);
  const signature = secret ? sign(body, secret) : '';

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ClearPath-Signature': signature,
        'X-ClearPath-Event': payload.event,
        'User-Agent': 'ClearPath-UW/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      logger.warn('Webhook delivery failed', { status: resp.status, url, event: payload.event });
    } else {
      logger.info('Webhook delivered', { event: payload.event, url });
    }
  } catch (err) {
    logger.error('Webhook dispatch error', { error: String(err), url, event: payload.event });
  }
}
