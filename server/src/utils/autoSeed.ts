import prisma from '../prisma/client';
import logger from './logger';
import { main as runSeed } from '../prisma/seed';

const SEED_TENANT_ID = 'seed-tenant-id';

export async function autoSeedIfEmpty(): Promise<void> {
  const count = await prisma.application.count({
    where: { tenantId: SEED_TENANT_ID, deletedAt: null },
  });

  if (count === 0) {
    logger.info('No seed data found — running auto-seed');
    await runSeed();
    logger.info('Auto-seed complete');
  }
}
