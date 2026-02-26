-- =====================================================
-- ADD GL ENTRY NUMBER TO INVOICES
-- This migration adds a dedicated column to hold the sequential
-- GL reference that may be provided by the user on the invoice
-- before it is posted.  When invoices already point to journal
-- entries we copy the value from the corresponding journal entry
-- so invoices and GL remain in sync.
-- =====================================================

-- Add column if it doesn't already exist to support incremental upgrades
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gl_entry_number VARCHAR(100);

-- Backfill existing invoices from linked journal entries
UPDATE invoices i
SET gl_entry_number = je.gl_entry_number
FROM journal_entries je
WHERE i.journal_entry_id = je.id
  AND (i.gl_entry_number IS NULL OR i.gl_entry_number = '');

-- Create index to help searches
CREATE INDEX IF NOT EXISTS idx_invoices_gl_entry_number ON invoices(gl_entry_number);

-- =====================================================
-- USAGE NOTES:
-- Run this migration after invoices table has been created.
-- Existing invoiced records will receive the same GL ref as
-- their journal entry.  New invoices will retain whatever value
-- is supplied by the user or the system when posting.
-- =====================================================
