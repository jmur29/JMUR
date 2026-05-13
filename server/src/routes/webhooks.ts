import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import prisma from '../prisma/client';
import logger from '../utils/logger';

const router = Router();

interface ClerkUserCreatedEvent {
  type: string;
  data: {
    id: string;
    first_name: string;
    last_name: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    public_metadata: {
      tenantId?: string;
      role?: 'ADMIN' | 'UNDERWRITER' | 'VIEWER';
    };
  };
}

/**
 * POST /api/webhooks/clerk
 * Svix-verified Clerk webhook. Handles user lifecycle events.
 */
router.post('/clerk', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET ?? '';

  if (!webhookSecret) {
    logger.error('CLERK_WEBHOOK_SECRET is not set');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Verify signature using svix
  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing svix headers' });
    return;
  }

  let payload: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    // req.body is a raw Buffer (express.raw middleware applied in index.ts for this route)
    const body = req.body instanceof Buffer ? req.body.toString('utf-8') : JSON.stringify(req.body);
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    logger.warn('Clerk webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  try {
    switch (payload.type) {
      case 'user.created':
      case 'user.updated': {
        const { data } = payload;
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id
        );
        const email = primaryEmail?.email_address ?? '';
        const tenantId = data.public_metadata?.tenantId;
        const role = data.public_metadata?.role ?? 'VIEWER';

        if (!tenantId) {
          logger.warn('Clerk webhook: user has no tenantId in public_metadata', {
            clerkId: data.id,
          });
          res.status(200).json({ received: true, skipped: true });
          return;
        }

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
          logger.warn('Clerk webhook: tenantId does not exist', { tenantId, clerkId: data.id });
          res.status(200).json({ received: true, skipped: true });
          return;
        }

        await prisma.user.upsert({
          where: { clerkId: data.id },
          create: {
            clerkId: data.id,
            tenantId,
            firstName: data.first_name ?? '',
            lastName: data.last_name ?? '',
            email,
            role,
          },
          update: {
            firstName: data.first_name ?? '',
            lastName: data.last_name ?? '',
            email,
            role,
          },
        });

        logger.info('Clerk webhook: user upserted', { clerkId: data.id, email, tenantId });
        break;
      }

      case 'user.deleted': {
        const { data } = payload;
        await prisma.user.updateMany({
          where: { clerkId: data.id },
          data: { deletedAt: new Date() },
        });
        logger.info('Clerk webhook: user soft-deleted', { clerkId: data.id });
        break;
      }

      default:
        logger.info('Clerk webhook: unhandled event type', { type: payload.type });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Clerk webhook processing error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
