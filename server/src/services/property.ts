import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { logAction } from './audit';
import type { PropertyType, OccupancyType } from '@prisma/client';

export interface UpsertPropertyInput {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: PropertyType;
  occupancy: OccupancyType;
  purchasePrice: number;
  appraisedValue: number;
  downPayment: number;
  annualTax: number;
  monthlyHeat: number;
  condoFees: number;
}

export async function upsertProperty(
  applicationId: string,
  input: UpsertPropertyInput,
  tenantId: string,
  userId: string
) {
  // Verify application belongs to tenant
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  const property = await prisma.property.upsert({
    where: { applicationId },
    create: {
      applicationId,
      address: input.address,
      city: input.city,
      province: input.province,
      postalCode: input.postalCode.toUpperCase(),
      propertyType: input.propertyType,
      occupancy: input.occupancy,
      purchasePrice: new Prisma.Decimal(input.purchasePrice),
      appraisedValue: new Prisma.Decimal(input.appraisedValue),
      downPayment: new Prisma.Decimal(input.downPayment),
      annualTax: new Prisma.Decimal(input.annualTax),
      monthlyHeat: new Prisma.Decimal(input.monthlyHeat),
      condoFees: new Prisma.Decimal(input.condoFees),
    },
    update: {
      address: input.address,
      city: input.city,
      province: input.province,
      postalCode: input.postalCode.toUpperCase(),
      propertyType: input.propertyType,
      occupancy: input.occupancy,
      purchasePrice: new Prisma.Decimal(input.purchasePrice),
      appraisedValue: new Prisma.Decimal(input.appraisedValue),
      downPayment: new Prisma.Decimal(input.downPayment),
      annualTax: new Prisma.Decimal(input.annualTax),
      monthlyHeat: new Prisma.Decimal(input.monthlyHeat),
      condoFees: new Prisma.Decimal(input.condoFees),
    },
  });

  logAction(tenantId, userId, applicationId, 'PROPERTY_UPDATED', {
    address: input.address,
    city: input.city,
  });

  return property;
}

export async function getPropertyByApplication(applicationId: string, tenantId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
  });
  if (!application) return null;

  return prisma.property.findUnique({ where: { applicationId } });
}
