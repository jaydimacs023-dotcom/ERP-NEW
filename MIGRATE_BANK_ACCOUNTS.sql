-- ============================================================================
-- BANK chart_of_accounts TABLE - Migration Script
-- Run this to update your existing bank_accounts table
-- ============================================================================

-- Add soft delete columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'is_deleted') THEN
    ALTER TABLE bank_accounts ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'deleted_at') THEN
    ALTER TABLE bank_accounts ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'deleted_by') THEN
    ALTER TABLE bank_accounts ADD COLUMN deleted_by UUID REFERENCES users(id);
  END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_bank_accounts_org_id ON bank_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl_account ON bank_accounts(gl_account_id);

-- Enable RLS if not already enabled
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Users can view bank chart_of_accounts in their org" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert bank chart_of_accounts in their org" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update bank chart_of_accounts in their org" ON bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank chart_of_accounts in their org" ON bank_accounts;
DROP POLICY IF EXISTS "Service role bypass for bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anon can read bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anon can insert bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anon can update bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anon can delete bank_accounts" ON bank_accounts;

-- OPTION 1: Simple policies for development (allow all for authenticated/anon)
-- Use these for easier development, then tighten for production

CREATE POLICY "Anon can read bank_accounts"
ON bank_accounts FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anon can insert bank_accounts"
ON bank_accounts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anon can update bank_accounts"
ON bank_accounts FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Anon can delete bank_accounts"
ON bank_accounts FOR DELETE
TO anon, authenticated
USING (true);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO authenticated;
GRANT SELECT ON bank_accounts TO anon;

-- ============================================================================
-- VERIFICATION - Run this to check your table structure
-- ============================================================================
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'bank_accounts' 
ORDER BY ordinal_position;
