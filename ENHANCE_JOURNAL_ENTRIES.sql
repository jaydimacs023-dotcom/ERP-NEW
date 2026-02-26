-- =====================================================
-- ENHANCE JOURNAL_ENTRIES TABLE
-- Add missing source types and unified sourceRef field
-- =====================================================

-- Add sourceRef column for unified source document reference
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS source_ref UUID;

-- Add depositId column for bank deposit linkage
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS deposit_id UUID REFERENCES bank_deposits(id) ON DELETE SET NULL;

-- Add gl_entry_number column for sequential GL reference and backfill
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS gl_entry_number TEXT;

-- copy existing GL-style references into the new column so we can
-- continue sequencing correctly after migration
UPDATE journal_entries
  SET gl_entry_number = reference
  WHERE gl_entry_number IS NULL AND reference ~ '^GL\\d+$';

-- unique index scoped by org
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_gl_entry_number
  ON journal_entries(org_id, gl_entry_number);

-- Update source_type check constraint to include new values
-- First drop the old constraint if it exists
ALTER TABLE journal_entries 
DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;

-- Add updated constraint with all source types
ALTER TABLE journal_entries 
ADD CONSTRAINT journal_entries_source_type_check 
CHECK (source_type IN (
    'MANUAL', 
    'INVOICE', 
    'BILL', 
    'PAYMENT', 
    'COLLECTION', 
    'DEPRECIATION', 
    'TRANSFER', 
    'PURCHASE_ORDER', 
    'PAYROLL', 
    'CREDIT_MEMO', 
    'GR_IR', 
    'ACCRUAL', 
    'REVERSAL',
    'APPLICATION',  -- Payment-to-invoice application entries
    'VOID',         -- Voiding transactions
    'DEPOSIT'       -- Bank deposit entries
));

-- Create index on source_ref for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_ref ON journal_entries(source_ref);
CREATE INDEX IF NOT EXISTS idx_journal_entries_deposit_id ON journal_entries(deposit_id);

-- Add comment for documentation
COMMENT ON COLUMN journal_entries.source_ref IS 'Unified reference to source document ID (Invoice ID, Payment ID, Deposit ID, etc.)';
COMMENT ON COLUMN journal_entries.deposit_id IS 'FK to bank_deposits table for deposit-type entries';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journal_entries';
