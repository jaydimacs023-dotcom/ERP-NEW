-- Add missing 'ar_account_id' column to sponsors table
-- Run this in Supabase SQL Editor

-- Add the ar_account_id column (nullable FK to chart_of_accounts)
ALTER TABLE sponsors 
ADD COLUMN IF NOT EXISTS ar_account_id UUID REFERENCES chart_of_accounts(id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sponsors'
ORDER BY ordinal_position;
