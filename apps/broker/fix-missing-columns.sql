-- Add missing fee tracking columns to spot_pairs table
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE IF EXISTS spot_pairs
  ADD COLUMN IF NOT EXISTS "totalSwapFeesUsd" double precision NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS spot_pairs
  ADD COLUMN IF NOT EXISTS "daySwapFeesUsd" double precision NOT NULL DEFAULT 0;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'spot_pairs'
  AND column_name IN ('totalSwapFeesUsd', 'daySwapFeesUsd')
ORDER BY column_name;
