-- ClearPath UW — Initial Migration
-- Generated from prisma/schema.prisma
-- Provider: postgresql

-- ─── Enable pgcrypto for gen_random_uuid() ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'UNDERWRITER', 'VIEWER');

CREATE TYPE "ApplicationStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'DECLINED',
  'CONDITIONALLY_APPROVED'
);

CREATE TYPE "BorrowerType" AS ENUM ('PRIMARY', 'CO_BORROWER');

CREATE TYPE "EmploymentType" AS ENUM (
  'EMPLOYED',
  'SELF_EMPLOYED',
  'CONTRACT',
  'RETIRED',
  'OTHER'
);

CREATE TYPE "PropertyType" AS ENUM (
  'DETACHED',
  'SEMI',
  'TOWNHOUSE',
  'CONDO',
  'DUPLEX',
  'OTHER'
);

CREATE TYPE "OccupancyType" AS ENUM ('OWNER', 'RENTAL', 'SECONDARY');

CREATE TYPE "UWDecision" AS ENUM ('APPROVE', 'DECLINE', 'MANUAL_REVIEW');

CREATE TYPE "DocumentType" AS ENUM (
  'PAYSTUB',
  'T4',
  'NOA',
  'BANK_STATEMENT',
  'ID',
  'APPRAISAL',
  'OTHER'
);

CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED');

-- ─── tenants ─────────────────────────────────────────────────────────────────

CREATE TABLE "tenants" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "name"         TEXT        NOT NULL,
  "slug"         TEXT        NOT NULL,
  "logoUrl"      TEXT,
  "primaryColor" TEXT        NOT NULL DEFAULT '#1a56db',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tenantId"  TEXT        NOT NULL,
  "clerkId"   TEXT        NOT NULL,
  "firstName" TEXT        NOT NULL,
  "lastName"  TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "role"      "UserRole"  NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- ─── applications ─────────────────────────────────────────────────────────────

CREATE TABLE "applications" (
  "id"           TEXT                NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tenantId"     TEXT                NOT NULL,
  "fileNumber"   TEXT                NOT NULL,
  "status"       "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "assignedToId" TEXT,
  "createdAt"    TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)        NOT NULL,
  "deletedAt"    TIMESTAMP(3),

  CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "applications_tenantId_fkey"     FOREIGN KEY ("tenantId")     REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "applications_fileNumber_key" ON "applications"("fileNumber");
CREATE INDEX "applications_tenantId_idx"     ON "applications"("tenantId");
CREATE INDEX "applications_status_idx"       ON "applications"("status");
CREATE INDEX "applications_assignedToId_idx" ON "applications"("assignedToId");

-- ─── borrowers ────────────────────────────────────────────────────────────────

CREATE TABLE "borrowers" (
  "id"                TEXT             NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId"     TEXT             NOT NULL,
  "type"              "BorrowerType"   NOT NULL,
  "firstName"         TEXT             NOT NULL,
  "lastName"          TEXT             NOT NULL,
  "dob"               TIMESTAMP(3)     NOT NULL,
  "email"             TEXT             NOT NULL,
  "phone"             TEXT             NOT NULL,
  "sinEncrypted"      TEXT             NOT NULL,
  "employmentType"    "EmploymentType" NOT NULL,
  "creditScore"       INTEGER          NOT NULL,
  "bankruptcies"      BOOLEAN          NOT NULL DEFAULT false,
  "collections"       BOOLEAN          NOT NULL DEFAULT false,
  "existingMortgages" INTEGER          NOT NULL DEFAULT 0,

  CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "borrowers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "borrowers_applicationId_idx" ON "borrowers"("applicationId");

-- ─── incomes ──────────────────────────────────────────────────────────────────

CREATE TABLE "incomes" (
  "id"              TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "borrowerId"      TEXT         NOT NULL,
  "employerName"    TEXT,
  "jobTitle"        TEXT,
  "yearsEmployed"   DECIMAL(5,2),
  "baseSalary"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  "bonus"           DECIMAL(14,2) NOT NULL DEFAULT 0,
  "overtime"        DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otherIncome"     DECIMAL(14,2) NOT NULL DEFAULT 0,
  "selfEmployedAvg" DECIMAL(14,2),
  "rentalIncome"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "incomes_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "incomes_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "incomes_borrowerId_key" ON "incomes"("borrowerId");

-- ─── properties ───────────────────────────────────────────────────────────────

CREATE TABLE "properties" (
  "id"             TEXT            NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId"  TEXT            NOT NULL,
  "address"        TEXT            NOT NULL,
  "city"           TEXT            NOT NULL,
  "province"       TEXT            NOT NULL,
  "postalCode"     TEXT            NOT NULL,
  "propertyType"   "PropertyType"  NOT NULL,
  "occupancy"      "OccupancyType" NOT NULL,
  "purchasePrice"  DECIMAL(14,2)   NOT NULL,
  "appraisedValue" DECIMAL(14,2)   NOT NULL,
  "downPayment"    DECIMAL(14,2)   NOT NULL,
  "annualTax"      DECIMAL(10,2)   NOT NULL,
  "monthlyHeat"    DECIMAL(10,2)   NOT NULL,
  "condoFees"      DECIMAL(10,2)   NOT NULL DEFAULT 0,
  "updatedAt"      TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "properties_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "properties_applicationId_key" ON "properties"("applicationId");

-- ─── mortgage_terms ───────────────────────────────────────────────────────────

CREATE TABLE "mortgage_terms" (
  "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId"     TEXT         NOT NULL,
  "contractRate"      DECIMAL(6,4) NOT NULL,
  "stressRate"        DECIMAL(6,4) NOT NULL,
  "amortizationYears" INTEGER      NOT NULL,
  "termYears"         INTEGER      NOT NULL,
  "insured"           BOOLEAN      NOT NULL DEFAULT false,
  "monthlyPayment"    DECIMAL(12,2) NOT NULL,
  "mortgageAmount"    DECIMAL(14,2) NOT NULL,
  "updatedAt"         TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "mortgage_terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mortgage_terms_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mortgage_terms_applicationId_key" ON "mortgage_terms"("applicationId");

-- ─── underwriting_decisions ───────────────────────────────────────────────────

CREATE TABLE "underwriting_decisions" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId" TEXT         NOT NULL,
  "gds"           DECIMAL(6,3) NOT NULL,
  "tds"           DECIMAL(6,3) NOT NULL,
  "ltv"           DECIMAL(6,3) NOT NULL,
  "stressGds"     DECIMAL(6,3) NOT NULL,
  "stressTds"     DECIMAL(6,3) NOT NULL,
  "decision"      "UWDecision" NOT NULL,
  "flags"         JSONB        NOT NULL,
  "notes"         TEXT,
  "decidedById"   TEXT         NOT NULL,
  "decidedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "underwriting_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "underwriting_decisions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "underwriting_decisions_decidedById_fkey"   FOREIGN KEY ("decidedById")   REFERENCES "users"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "underwriting_decisions_applicationId_idx" ON "underwriting_decisions"("applicationId");

-- ─── documents ────────────────────────────────────────────────────────────────

CREATE TABLE "documents" (
  "id"            TEXT             NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId" TEXT             NOT NULL,
  "uploadedById"  TEXT             NOT NULL,
  "name"          TEXT             NOT NULL,
  "type"          "DocumentType"   NOT NULL,
  "s3Key"         TEXT             NOT NULL,
  "url"           TEXT             NOT NULL,
  "uploadedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"        "DocumentStatus" NOT NULL DEFAULT 'PENDING',

  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "documents_uploadedById_fkey"  FOREIGN KEY ("uploadedById")  REFERENCES "users"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "documents_applicationId_idx" ON "documents"("applicationId");

-- ─── audit_logs ───────────────────────────────────────────────────────────────

CREATE TABLE "audit_logs" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tenantId"      TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "applicationId" TEXT,
  "action"        TEXT         NOT NULL,
  "metadata"      JSONB        NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_tenantId_fkey"      FOREIGN KEY ("tenantId")      REFERENCES "tenants"("id")      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_userId_fkey"        FOREIGN KEY ("userId")        REFERENCES "users"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_tenantId_idx"      ON "audit_logs"("tenantId");
CREATE INDEX "audit_logs_applicationId_idx" ON "audit_logs"("applicationId");
CREATE INDEX "audit_logs_userId_idx"        ON "audit_logs"("userId");

-- ─── application_notes ────────────────────────────────────────────────────────

CREATE TABLE "application_notes" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId" TEXT         NOT NULL,
  "authorId"      TEXT         NOT NULL,
  "body"          TEXT         NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_notes_authorId_fkey"      FOREIGN KEY ("authorId")      REFERENCES "users"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "application_notes_applicationId_idx" ON "application_notes"("applicationId");

-- ─── approval_conditions ──────────────────────────────────────────────────────

CREATE TABLE "approval_conditions" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId" TEXT         NOT NULL,
  "body"          TEXT         NOT NULL,
  "cleared"       BOOLEAN      NOT NULL DEFAULT false,
  "clearedById"   TEXT,
  "clearedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_conditions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_conditions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "approval_conditions_clearedById_fkey"   FOREIGN KEY ("clearedById")   REFERENCES "users"("id")        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "approval_conditions_applicationId_idx" ON "approval_conditions"("applicationId");

-- ─── status_history ───────────────────────────────────────────────────────────

CREATE TABLE "status_history" (
  "id"            TEXT                 NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "applicationId" TEXT                 NOT NULL,
  "fromStatus"    "ApplicationStatus",
  "toStatus"      "ApplicationStatus"  NOT NULL,
  "changedById"   TEXT                 NOT NULL,
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "status_history_changedById_fkey"   FOREIGN KEY ("changedById")   REFERENCES "users"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "status_history_applicationId_idx" ON "status_history"("applicationId");
