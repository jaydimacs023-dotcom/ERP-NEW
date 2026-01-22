-- ============================================================================
-- BANK RECONCILIATION TABLE MIGRATION
-- ============================================================================
-- This script creates the bank_reconciliations table for storing
-- reconciliation records and audit history.

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL,
  statement_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  book_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  cleared_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  difference NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'IN_PROGRESS',
  reconciliation_details TEXT,
  reconcilied_by UUID REFERENCES users(id),
  reconcilied_at TIMESTAMP,
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_org_id ON bank_reconciliations(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_bank_account_id ON bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_as_of_date ON bank_reconciliations(as_of_date);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_status ON bank_reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_created_at ON bank_reconciliations(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see reconciliations for their organization
CREATE POLICY "Users can view reconciliations for their org" 
ON bank_reconciliations FOR SELECT 
USING (org_id IN (
  SELECT org_id FROM users WHERE id = auth.uid()
));

-- RLS Policy: Users can create reconciliations for their organization
CREATE POLICY "Users can create reconciliations for their org" 
ON bank_reconciliations FOR INSERT 
WITH CHECK (org_id IN (
  SELECT org_id FROM users WHERE id = auth.uid()
));

-- RLS Policy: Users can update reconciliations for their organization
CREATE POLICY "Users can update reconciliations for their org" 
ON bank_reconciliations FOR UPDATE 
USING (org_id IN (
  SELECT org_id FROM users WHERE id = auth.uid()
));

-- RLS Policy: Users can delete reconciliations for their organization
CREATE POLICY "Users can delete reconciliations for their org" 
ON bank_reconciliations FOR DELETE 
USING (org_id IN (
  SELECT org_id FROM users WHERE id = auth.uid()
));

-- Create an audit trigger to log changes
CREATE OR REPLACE FUNCTION log_bank_reconciliation_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
  VALUES (
    NEW.org_id,
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      WHEN TG_OP = 'DELETE' THEN 'DELETE'
    END,
    'BANK_RECONCILIATION',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'as_of_date', COALESCE(NEW.as_of_date, OLD.as_of_date),
      'status', COALESCE(NEW.status, OLD.status),
      'difference', COALESCE(NEW.difference, OLD.difference)
    ),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_reconciliation_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON bank_reconciliations
FOR EACH ROW
EXECUTE FUNCTION log_bank_reconciliation_changes();
