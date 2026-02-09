-- Add gl_entry_number column to journal_entries table
-- Run this in Supabase SQL Editor

-- Add the gl_entry_number column (generated when entry is POSTED)
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS gl_entry_number VARCHAR(50);

-- Add an index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_gl_entry_number 
ON journal_entries(gl_entry_number) 
WHERE gl_entry_number IS NOT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN journal_entries.gl_entry_number IS 'Sequential GL entry number generated when entry is posted (e.g., GL-2026-00001)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'journal_entries'
ORDER BY ordinal_position;
