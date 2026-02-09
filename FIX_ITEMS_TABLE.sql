-- Add missing columns to items table
-- Run this in Supabase SQL Editor

-- Add soft delete columns
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Add tax_category_id column
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS tax_category_id UUID;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'items'
ORDER BY ordinal_position;
