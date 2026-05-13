import { generateFileNumber } from '../utils/fileNumber';
import { PrismaClient } from '@prisma/client';

// Build a minimal mock of PrismaClient with just application.count
function makePrisma(countValue: number): PrismaClient {
  return {
    application: {
      count: jest.fn().mockResolvedValue(countValue),
    },
  } as unknown as PrismaClient;
}

describe('generateFileNumber', () => {
  const YEAR = new Date().getFullYear();

  it('returns CP-{YEAR}-0001 when no applications exist yet', async () => {
    const prisma = makePrisma(0);
    const result = await generateFileNumber('tenant-1', prisma);
    expect(result).toBe(`CP-${YEAR}-0001`);
  });

  it('returns CP-{YEAR}-0043 when the highest existing sequence is 0042', async () => {
    // count = 42 means 42 existing records → next = 43
    const prisma = makePrisma(42);
    const result = await generateFileNumber('tenant-1', prisma);
    expect(result).toBe(`CP-${YEAR}-0043`);
  });

  it('pads to at least 4 digits: count=9998 → CP-{YEAR}-9999', async () => {
    const prisma = makePrisma(9998);
    const result = await generateFileNumber('tenant-1', prisma);
    expect(result).toBe(`CP-${YEAR}-9999`);
  });

  it('overflows gracefully: count=9999 → CP-{YEAR}-10000 (5 digits)', async () => {
    const prisma = makePrisma(9999);
    const result = await generateFileNumber('tenant-1', prisma);
    expect(result).toBe(`CP-${YEAR}-10000`);
  });

  it('uses the current year (not a previous year file number)', async () => {
    // Even if the mock somehow returned nothing, the prefix is always current year
    const prisma = makePrisma(0);
    const result = await generateFileNumber('tenant-abc', prisma);
    expect(result).toMatch(new RegExp(`^CP-${YEAR}-`));
  });

  it('passes the correct prefix and tenantId to prisma.application.count', async () => {
    const prisma = makePrisma(0);
    await generateFileNumber('my-tenant', prisma);
    expect(prisma.application.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'my-tenant',
        fileNumber: { startsWith: `CP-${YEAR}-` },
      },
    });
  });
});
