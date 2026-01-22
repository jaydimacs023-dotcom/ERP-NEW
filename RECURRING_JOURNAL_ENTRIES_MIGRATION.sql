-- ============================================================================
-- RECURRING JOURNAL ENTRIES TABLE & RLS POLICIES
-- ============================================================================
-- This migration creates the recurring_journal_entries table to support
-- automated journal entry scheduling and execution. Includes RLS policies
-- for organization isolation.
-- ============================================================================

-- Create recurring_journal_entries table
CREATE TABLE IF NOT EXISTS recurring_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  max_runs INTEGER,
  times_run INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  auto_post BOOLEAN DEFAULT true,
  last_generated_entry_id UUID,
  
  -- Template entry data (JSON)
  template_entry JSONB NOT NULL,
  
  -- Base fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM')),
  CONSTRAINT status_check CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'INACTIVE'))
);

-- Create indexes for performance
CREATE INDEX idx_recurring_journal_entries_org_id ON recurring_journal_entries(org_id);
CREATE INDEX idx_recurring_journal_entries_status ON recurring_journal_entries(status);
CREATE INDEX idx_recurring_journal_entries_next_run_date ON recurring_journal_entries(next_run_date);
CREATE INDEX idx_recurring_journal_entries_created_at ON recurring_journal_entries(created_at);

-- Enable RLS
ALTER TABLE recurring_journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view recurring entries from their organization
CREATE POLICY recurring_entries_view_org
  ON recurring_journal_entries FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can only insert recurring entries in their organization
CREATE POLICY recurring_entries_insert_org
  ON recurring_journal_entries FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can only update recurring entries in their organization
CREATE POLICY recurring_entries_update_org
  ON recurring_journal_entries FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can only delete recurring entries in their organization
CREATE POLICY recurring_entries_delete_org
  ON recurring_journal_entries FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_recurring_entries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_entries_updated_at_trigger
  BEFORE UPDATE ON recurring_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_entries_timestamp();

-- Create trigger to log to audit_logs when created
CREATE OR REPLACE FUNCTION log_recurring_entry_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'CREATE',
    'RECURRING_JOURNAL_ENTRY',
    NEW.id,
    NEW.name,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_entry_created_trigger
  AFTER INSERT ON recurring_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_recurring_entry_creation();

-- Create trigger to log to audit_logs when updated
CREATE OR REPLACE FUNCTION log_recurring_entry_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'UPDATE',
    'RECURRING_JOURNAL_ENTRY',
    NEW.id,
    NEW.name,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_entry_updated_trigger
  AFTER UPDATE ON recurring_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_recurring_entry_update();

-- Create trigger to log to audit_logs when soft deleted
CREATE OR REPLACE FUNCTION log_recurring_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted AND OLD.is_deleted IS FALSE THEN
    INSERT INTO audit_logs (
      org_id, user_id, user_name, action, entity_type, entity_id, 
      entity_name, timestamp
    ) VALUES (
      NEW.org_id,
      auth.uid(),
      (SELECT name FROM users WHERE id = auth.uid()),
      'DELETE',
      'RECURRING_JOURNAL_ENTRY',
      NEW.id,
      NEW.name,
      CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_entry_deleted_trigger
  AFTER UPDATE ON recurring_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_recurring_entry_delete();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_journal_entries TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
