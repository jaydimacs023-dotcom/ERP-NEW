-- Migration: Add Tax Fields to Sponsors Table
-- Run this in Supabase SQL Editor to add missing tax-related fields
-- Date: 2026-02-16

-- Add sponsor_code column for unique sponsor identifier
ALTER TABLE sponsors 
ADD COLUMN IF NOT EXISTS sponsor_code TEXT;

-- Add TIN (Tax Identification Number) column
ALTER TABLE sponsors 
ADD COLUMN IF NOT EXISTS tin TEXT;

-- Add tax_type column (VAT, NON_VAT, ZERO_RATED)
-- Using TEXT with CHECK constraint for flexibility
ALTER TABLE sponsors 
ADD COLUMN IF NOT EXISTS tax_type TEXT CHECK (tax_type IN ('VAT', 'NON_VAT', 'ZERO_RATED'));

-- Add EWT Rate column (stored as decimal, e.g., 0.02 for 2%)
ALTER TABLE sponsors 
ADD COLUMN IF NOT EXISTS ewt_rate NUMERIC(5, 4);

-- Optional: Add unique constraint on sponsor_code per organization
-- Uncomment if you want to enforce unique sponsor codes
-- ALTER TABLE sponsors ADD CONSTRAINT sponsors_org_code_unique UNIQUE (org_id, sponsor_code);

-- Create index on sponsor_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_sponsors_sponsor_code ON sponsors(sponsor_code);

-- Create index on tin for faster lookups
CREATE INDEX IF NOT EXISTS idx_sponsors_tin ON sponsors(tin);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sponsors'
ORDER BY ordinal_position;

-- Sample: Update existing sponsors with default values (optional)
-- UPDATE sponsors SET tax_type = 'VAT', ewt_rate = 0.02 WHERE tax_type IS NULL;

COMMENT ON COLUMN sponsors.sponsor_code IS 'Unique identifier code for the sponsor (e.g., SP-001)';
COMMENT ON COLUMN sponsors.tin IS 'Tax Identification Number for the sponsor';
COMMENT ON COLUMN sponsors.tax_type IS 'Tax classification: VAT, NON_VAT, or ZERO_RATED';
COMMENT ON COLUMN sponsors.ewt_rate IS 'Expanded Withholding Tax rate as decimal (e.g., 0.02 = 2%)';
