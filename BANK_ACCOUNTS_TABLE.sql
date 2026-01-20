-- ============================================================================
-- BANK ACCOUNTS TABLE - Supabase SQL
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop existing table if needed (comment out if you have data to preserve)
-- DROP TABLE IF EXISTS bank_accounts CASCADE;

-- Create the bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('SAVINGS', 'CHECKING', 'CREDIT', 'CASH')),
  gl_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'PHP',
  balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  
  -- Soft delete fields (BaseEntity)
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster org-based queries
CREATE INDEX IF NOT EXISTS idx_bank_accounts_org_id ON bank_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl_account ON bank_accounts(gl_account_id);

-- Enable Row Level Security
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view bank accounts in their organization
CREATE POLICY "Users can view bank accounts in their org"
ON bank_accounts FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can insert bank accounts in their organization
CREATE POLICY "Users can insert bank accounts in their org"
ON bank_accounts FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can update bank accounts in their organization
CREATE POLICY "Users can update bank accounts in their org"
ON bank_accounts FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can delete bank accounts in their organization
CREATE POLICY "Users can delete bank accounts in their org"
ON bank_accounts FOR DELETE
USING (
  org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

-- ============================================================================
-- GRANT PERMISSIONS (for anon/authenticated roles)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO authenticated;
GRANT SELECT ON bank_accounts TO anon;

-- ============================================================================
-- SAMPLE DATA (Optional - uncomment to seed test data)
-- Replace 'YOUR-ORG-ID' with your actual organization UUID
-- ============================================================================
/*
INSERT INTO bank_accounts (org_id, bank_name, account_number, type, currency, balance) VALUES
  ('YOUR-ORG-ID', 'BDO Unibank', '001234567890', 'CHECKING', 'PHP', 150000.00),
  ('YOUR-ORG-ID', 'BPI', '9876543210', 'SAVINGS', 'PHP', 500000.00),
  ('YOUR-ORG-ID', 'Petty Cash', 'CASH-001', 'CASH', 'PHP', 5000.00),
  ('YOUR-ORG-ID', 'BDO Credit Line', 'CC-1234-5678', 'CREDIT', 'PHP', 0.00);
*/

-- ============================================================================
-- VERIFICATION QUERY
-- Run this after creating the table to verify structure
-- ============================================================================
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'bank_accounts' 
-- ORDER BY ordinal_position;
