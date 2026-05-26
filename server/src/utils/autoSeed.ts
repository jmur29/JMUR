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

export async function seedForTenant(tenantId: string, userId: string): Promise<void> {
  const count = await prisma.application.count({
    where: { tenantId, deletedAt: null },
  });

  if (count === 0) {
    logger.info('Seeding demo data for tenant', { tenantId });
    await runSeed(tenantId, userId);
    logger.info('Tenant seed complete', { tenantId });
  }
}
