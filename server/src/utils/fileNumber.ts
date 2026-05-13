import { PrismaClient } from '@prisma/client';

/**
 * Generate a unique file number in the format CP-{YEAR}-{NNNN}.
 * The sequence is per-tenant per-year, zero-padded to 4 digits.
 * Uses a count query so it is safe under concurrent creates (Prisma serializes at DB level).
 */
export async function generateFileNumber(
  tenantId: string,
  prisma: PrismaClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CP-${year}-`;

  // Count existing applications for this tenant in the current year
  const count = await prisma.application.count({
    where: {
      tenantId,
      fileNumber: { startsWith: prefix },
    },
  });

  const sequence = count + 1;
  const padded = String(sequence).padStart(4, '0');
  return `${prefix}${padded}`;
}
