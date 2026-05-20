-- Migration: add_ai_dual_persona_models
-- Extends the initial schema with:
--   - UserRole.BROKER
--   - ApplicationStatus.READY_TO_SUBMIT, SUBMITTED
--   - Application.createdById, lenderTarget
--   - 6 new models: DocumentClassification, DownPaymentEntry, FraudSignal,
--                   CreditMemo, AiAuditEntry, SubmissionNote

-- ─── Enum additions ───────────────────────────────────────────────────────────

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BROKER';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SUBMIT';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- ─── Application: new columns ────────────────────────────────────────────────

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "createdById"  TEXT,
  ADD COLUMN IF NOT EXISTS "lenderTarget" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_createdById_fkey'
  ) THEN
    ALTER TABLE "applications"
      ADD CONSTRAINT "applications_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "applications_createdById_idx" ON "applications"("createdById");

-- ─── DocumentClassification ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "document_classifications" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "documentId"      TEXT NOT NULL,
  "classifiedType"  TEXT NOT NULL,
  "confidence"      DOUBLE PRECISION NOT NULL,
  "extractedFields" JSONB NOT NULL,
  "rawOcrText"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_classifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_classifications_documentId_key" UNIQUE ("documentId"),
  CONSTRAINT "document_classifications_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "document_classifications_tenantId_idx"
  ON "document_classifications"("tenantId");

-- ─── DownPaymentEntry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "down_payment_entries" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "applicationId"   TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "description"     TEXT NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "runningBalance"  DECIMAL(12,2),
  "category"        TEXT NOT NULL,
  "isFlagged"       BOOLEAN NOT NULL DEFAULT false,
  "flagReason"      TEXT,
  "loeRequired"     BOOLEAN NOT NULL DEFAULT false,
  "loeDraftText"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "down_payment_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "down_payment_entries_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "down_payment_entries_tenantId_idx"
  ON "down_payment_entries"("tenantId");
CREATE INDEX IF NOT EXISTS "down_payment_entries_applicationId_idx"
  ON "down_payment_entries"("applicationId");

-- ─── FraudSignal ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "fraud_signals" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "documentId"        TEXT NOT NULL,
  "signalType"        TEXT NOT NULL,
  "severity"          TEXT NOT NULL,
  "evidence"          TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "aiExplanation"     TEXT,
  "acknowledgedAt"    TIMESTAMP(3),
  "acknowledgedById"  TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fraud_signals_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "fraud_signals_tenantId_idx" ON "fraud_signals"("tenantId");
CREATE INDEX IF NOT EXISTS "fraud_signals_documentId_idx" ON "fraud_signals"("documentId");

-- ─── CreditMemo ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "credit_memos" (
  "id"                   TEXT NOT NULL,
  "tenantId"             TEXT NOT NULL,
  "applicationId"        TEXT NOT NULL,
  "generatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gds"                  DECIMAL(5,2) NOT NULL,
  "tds"                  DECIMAL(5,2) NOT NULL,
  "qualifyingRate"       DECIMAL(5,3) NOT NULL,
  "downPaymentTotal"     DECIMAL(12,2) NOT NULL,
  "downPaymentSourced"   BOOLEAN NOT NULL DEFAULT false,
  "flagCount"            INTEGER NOT NULL DEFAULT 0,
  "fraudSignalCount"     INTEGER NOT NULL DEFAULT 0,
  "narrative"            TEXT,
  "underwriterNotes"     TEXT,
  "recommendedConditions" JSONB,
  "pdfS3Key"             TEXT,
  "aiModel"              TEXT,
  "promptVersion"        TEXT,

  CONSTRAINT "credit_memos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_memos_applicationId_key" UNIQUE ("applicationId"),
  CONSTRAINT "credit_memos_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "credit_memos_tenantId_idx" ON "credit_memos"("tenantId");

-- ─── AiAuditEntry ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_audit_entries" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "applicationId" TEXT,
  "documentId"    TEXT,
  "action"        TEXT NOT NULL,
  "aiModel"       TEXT NOT NULL,
  "promptHash"    TEXT NOT NULL,
  "responseHash"  TEXT NOT NULL,
  "inputTokens"   INTEGER,
  "outputTokens"  INTEGER,
  "userId"        TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_audit_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_audit_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_audit_entries_tenantId_idx" ON "ai_audit_entries"("tenantId");
CREATE INDEX IF NOT EXISTS "ai_audit_entries_applicationId_idx" ON "ai_audit_entries"("applicationId");
CREATE INDEX IF NOT EXISTS "ai_audit_entries_userId_idx" ON "ai_audit_entries"("userId");

-- ─── SubmissionNote ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "submission_notes" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "applicationId"         TEXT NOT NULL,
  "draftText"             TEXT NOT NULL,
  "lenderTarget"          TEXT,
  "anticipatedConditions" JSONB,
  "isFinalized"           BOOLEAN NOT NULL DEFAULT false,
  "finalizedAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "submission_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submission_notes_applicationId_key" UNIQUE ("applicationId"),
  CONSTRAINT "submission_notes_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "submission_notes_tenantId_idx" ON "submission_notes"("tenantId");
