-- Run this in the Supabase SQL Editor for project smprskljqkeogqwfiztq
-- Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS funded_deals (
  id          BIGSERIAL PRIMARY KEY,
  year        INTEGER        NOT NULL,
  borrower    TEXT           NOT NULL,
  type        TEXT,
  source      TEXT,
  lender      TEXT,
  closing     DATE,
  amt         NUMERIC(15, 2) NOT NULL,
  term        INTEGER,
  rate_type   TEXT,
  rate        NUMERIC(7, 4),
  bps         INTEGER,
  split       NUMERIC(5, 4),
  gross_comm  NUMERIC(15, 2),
  your_comm   NUMERIC(15, 2),
  notes       TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Allow the anon key (used by the webhook server) to insert rows.
-- RLS is disabled so the service doesn't need a service-role key.
ALTER TABLE funded_deals DISABLE ROW LEVEL SECURITY;

-- Optional: speed up date-range queries
CREATE INDEX IF NOT EXISTS funded_deals_year_idx ON funded_deals (year);
CREATE INDEX IF NOT EXISTS funded_deals_closing_idx ON funded_deals (closing);
