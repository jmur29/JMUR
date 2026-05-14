import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { encryptSIN } from '../utils/crypto';
import { generateFileNumber } from '../utils/fileNumber';

const prisma = new PrismaClient();

// Stable IDs used by e2e tests so Playwright can reference known users
// without querying the database.
export const SEED_IDS = {
  TENANT_ID:     '00000000-0000-0000-0000-000000000001',
  ADMIN_USER_ID: '00000000-0000-0000-0000-000000000002',
  UW_USER_ID:    '00000000-0000-0000-0000-000000000003',
} as const;

async function main() {
  console.log('Seeding ClearPath UW database...');

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-cu' },
    create: {
      id: SEED_IDS.TENANT_ID,
      name: 'Demo Credit Union',
      slug: 'demo-cu',
      primaryColor: '#1a56db',
    },
    update: {
      name: 'Demo Credit Union',
      primaryColor: '#1a56db',
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { clerkId: 'user_admin_demo' },
    create: {
      id: SEED_IDS.ADMIN_USER_ID,
      tenantId: tenant.id,
      clerkId: 'user_admin_demo',
      firstName: 'Admin',
      lastName: 'Demo',
      email: 'admin@democu.ca',
      role: 'ADMIN',
    },
    update: {
      firstName: 'Admin',
      lastName: 'Demo',
      email: 'admin@democu.ca',
      role: 'ADMIN',
    },
  });
  console.log(`Admin user: ${adminUser.email}`);

  const uwUser = await prisma.user.upsert({
    where: { clerkId: 'user_uw_demo' },
    create: {
      id: SEED_IDS.UW_USER_ID,
      tenantId: tenant.id,
      clerkId: 'user_uw_demo',
      firstName: 'Sarah',
      lastName: 'Underwriter',
      email: 'uw@democu.ca',
      role: 'UNDERWRITER',
    },
    update: {
      firstName: 'Sarah',
      lastName: 'Underwriter',
      email: 'uw@democu.ca',
      role: 'UNDERWRITER',
    },
  });
  console.log(`Underwriter user: ${uwUser.email}`);

  // ── Application 1 — APPROVED ─────────────────────────────────────────────
  const fileNumber1 = await generateFileNumber(tenant.id, prisma);
  const app1 = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      fileNumber: fileNumber1,
      status: 'APPROVED',
      assignedToId: uwUser.id,
    },
  });
  console.log(`Application 1: ${app1.fileNumber} (APPROVED)`);

  const borrower1 = await prisma.borrower.create({
    data: {
      applicationId: app1.id,
      type: 'PRIMARY',
      firstName: 'James',
      lastName: 'Mackenzie',
      dob: new Date('1985-03-15'),
      email: 'james.mackenzie@email.ca',
      phone: '6135550101',
      sinEncrypted: encryptSIN('123456789'),
      employmentType: 'EMPLOYED',
      creditScore: 760,
      bankruptcies: false,
      collections: false,
      existingMortgages: 0,
    },
  });

  await prisma.income.create({
    data: {
      borrowerId: borrower1.id,
      employerName: 'Rogers Communications',
      jobTitle: 'Senior Engineer',
      yearsEmployed: new Prisma.Decimal(5),
      baseSalary: new Prisma.Decimal(110000),
      bonus: new Prisma.Decimal(10000),
      overtime: new Prisma.Decimal(0),
      otherIncome: new Prisma.Decimal(0),
      rentalIncome: new Prisma.Decimal(0),
    },
  });

  await prisma.property.create({
    data: {
      applicationId: app1.id,
      address: '142 Rideau Terrace',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1M 0Z1',
      propertyType: 'DETACHED',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(750000),
      appraisedValue: new Prisma.Decimal(765000),
      downPayment: new Prisma.Decimal(150000),
      annualTax: new Prisma.Decimal(6000),
      monthlyHeat: new Prisma.Decimal(200),
      condoFees: new Prisma.Decimal(0),
    },
  });

  await prisma.mortgageTerms.create({
    data: {
      applicationId: app1.id,
      contractRate: new Prisma.Decimal(5.14),
      stressRate: new Prisma.Decimal(7.14),
      amortizationYears: 25,
      termYears: 5,
      insured: false,
      monthlyPayment: new Prisma.Decimal(3530.42),
      mortgageAmount: new Prisma.Decimal(600000),
    },
  });

  await prisma.underwritingDecision.create({
    data: {
      applicationId: app1.id,
      gds: new Prisma.Decimal(28.512),
      tds: new Prisma.Decimal(28.512),
      ltv: new Prisma.Decimal(78.431),
      stressGds: new Prisma.Decimal(33.102),
      stressTds: new Prisma.Decimal(33.102),
      decision: 'APPROVE',
      flags: [
        { type: 'PASS', message: 'Strong credit profile', field: 'creditScore' },
        { type: 'PASS', message: 'Conventional mortgage — no default insurance required', field: 'downPayment' },
      ],
      notes: 'Strong file. Conventional mortgage with excellent credit.',
      decidedById: uwUser.id,
    },
  });

  // ── Application 2 — IN_REVIEW ────────────────────────────────────────────
  const fileNumber2 = await generateFileNumber(tenant.id, prisma);
  const app2 = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      fileNumber: fileNumber2,
      status: 'IN_REVIEW',
      assignedToId: uwUser.id,
    },
  });
  console.log(`Application 2: ${app2.fileNumber} (IN_REVIEW)`);

  const borrower2 = await prisma.borrower.create({
    data: {
      applicationId: app2.id,
      type: 'PRIMARY',
      firstName: 'Priya',
      lastName: 'Sharma',
      dob: new Date('1990-07-22'),
      email: 'priya.sharma@email.ca',
      phone: '4165550199',
      sinEncrypted: encryptSIN('987654321'),
      employmentType: 'SELF_EMPLOYED',
      creditScore: 680,
      bankruptcies: false,
      collections: false,
      existingMortgages: 1,
    },
  });

  await prisma.income.create({
    data: {
      borrowerId: borrower2.id,
      employerName: null,
      jobTitle: 'Consultant',
      yearsEmployed: new Prisma.Decimal(3),
      baseSalary: new Prisma.Decimal(0),
      bonus: new Prisma.Decimal(0),
      overtime: new Prisma.Decimal(0),
      otherIncome: new Prisma.Decimal(0),
      selfEmployedAvg: new Prisma.Decimal(95000),
      rentalIncome: new Prisma.Decimal(18000),
    },
  });

  const coBorrower2 = await prisma.borrower.create({
    data: {
      applicationId: app2.id,
      type: 'CO_BORROWER',
      firstName: 'Raj',
      lastName: 'Sharma',
      dob: new Date('1988-11-03'),
      email: 'raj.sharma@email.ca',
      phone: '4165550188',
      sinEncrypted: encryptSIN('112233445'),
      employmentType: 'EMPLOYED',
      creditScore: 720,
      bankruptcies: false,
      collections: false,
      existingMortgages: 0,
    },
  });

  await prisma.income.create({
    data: {
      borrowerId: coBorrower2.id,
      employerName: 'TD Bank',
      jobTitle: 'Financial Analyst',
      yearsEmployed: new Prisma.Decimal(4),
      baseSalary: new Prisma.Decimal(85000),
      bonus: new Prisma.Decimal(5000),
      overtime: new Prisma.Decimal(0),
      otherIncome: new Prisma.Decimal(0),
      rentalIncome: new Prisma.Decimal(0),
    },
  });

  await prisma.property.create({
    data: {
      applicationId: app2.id,
      address: '510 King St W',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 1M3',
      propertyType: 'CONDO',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(680000),
      appraisedValue: new Prisma.Decimal(675000),
      downPayment: new Prisma.Decimal(68000),
      annualTax: new Prisma.Decimal(5200),
      monthlyHeat: new Prisma.Decimal(75),
      condoFees: new Prisma.Decimal(650),
    },
  });

  await prisma.mortgageTerms.create({
    data: {
      applicationId: app2.id,
      contractRate: new Prisma.Decimal(5.29),
      stressRate: new Prisma.Decimal(7.29),
      amortizationYears: 25,
      termYears: 5,
      insured: true,
      monthlyPayment: new Prisma.Decimal(3450.00),
      mortgageAmount: new Prisma.Decimal(612000),
    },
  });

  // ── Application 3 — DRAFT ────────────────────────────────────────────────
  const fileNumber3 = await generateFileNumber(tenant.id, prisma);
  const app3 = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      fileNumber: fileNumber3,
      status: 'DRAFT',
    },
  });
  console.log(`Application 3: ${app3.fileNumber} (DRAFT)`);

  const borrower3 = await prisma.borrower.create({
    data: {
      applicationId: app3.id,
      type: 'PRIMARY',
      firstName: 'Luc',
      lastName: 'Tremblay',
      dob: new Date('1978-01-30'),
      email: 'luc.tremblay@email.ca',
      phone: '5145550277',
      sinEncrypted: encryptSIN('554433221'),
      employmentType: 'EMPLOYED',
      creditScore: 635,
      bankruptcies: false,
      collections: true,
      existingMortgages: 0,
    },
  });

  await prisma.income.create({
    data: {
      borrowerId: borrower3.id,
      employerName: 'City of Montreal',
      jobTitle: 'Inspector',
      yearsEmployed: new Prisma.Decimal(8),
      baseSalary: new Prisma.Decimal(72000),
      bonus: new Prisma.Decimal(0),
      overtime: new Prisma.Decimal(4000),
      otherIncome: new Prisma.Decimal(0),
      rentalIncome: new Prisma.Decimal(0),
    },
  });

  await prisma.property.create({
    data: {
      applicationId: app3.id,
      address: '1450 Rue Sherbrooke O',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H3G 1L2',
      propertyType: 'CONDO',
      occupancy: 'OWNER',
      purchasePrice: new Prisma.Decimal(425000),
      appraisedValue: new Prisma.Decimal(420000),
      downPayment: new Prisma.Decimal(25000),
      annualTax: new Prisma.Decimal(3800),
      monthlyHeat: new Prisma.Decimal(90),
      condoFees: new Prisma.Decimal(420),
    },
  });

  await prisma.mortgageTerms.create({
    data: {
      applicationId: app3.id,
      contractRate: new Prisma.Decimal(5.49),
      stressRate: new Prisma.Decimal(7.49),
      amortizationYears: 25,
      termYears: 3,
      insured: true,
      monthlyPayment: new Prisma.Decimal(2400.00),
      mortgageAmount: new Prisma.Decimal(400000),
    },
  });

  // Audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: adminUser.id,
        applicationId: app1.id,
        action: 'APPLICATION_CREATED',
        metadata: { fileNumber: fileNumber1 },
      },
      {
        tenantId: tenant.id,
        userId: uwUser.id,
        applicationId: app1.id,
        action: 'DECISION_SAVED',
        metadata: { decision: 'APPROVE', gds: 28.512, tds: 28.512, ltv: 78.431 },
      },
      {
        tenantId: tenant.id,
        userId: adminUser.id,
        applicationId: app2.id,
        action: 'APPLICATION_CREATED',
        metadata: { fileNumber: fileNumber2 },
      },
    ],
  });

  console.log('Seed complete.');
  console.log(`  Tenant:       ${tenant.name} (slug: ${tenant.slug})`);
  console.log(`  Users:        admin@democu.ca (ADMIN), uw@democu.ca (UNDERWRITER)`);
  console.log(`  Applications: ${fileNumber1} (APPROVED), ${fileNumber2} (IN_REVIEW), ${fileNumber3} (DRAFT)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
