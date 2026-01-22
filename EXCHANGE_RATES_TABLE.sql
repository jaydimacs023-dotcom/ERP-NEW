-- ============================================================================
-- EXCHANGE RATES TABLE & FOREIGN CURRENCY SUPPORT
-- ============================================================================
-- This migration creates the exchange_rates table to support multi-currency
-- transactions and conversion. Tracks historical rates for revaluation and
-- provides currency conversion utilities for financial reporting.
-- ============================================================================

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Currency pair (e.g., USD to PHP, EUR to PHP)
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  
  -- Exchange rate and effective date
  rate DECIMAL(18, 8) NOT NULL,
  effective_date DATE NOT NULL,
  
  -- Rate source and manually edited flag
  source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  is_manual BOOLEAN DEFAULT true,
  
  -- Optional notes
  notes TEXT,
  
  -- Base fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_currencies CHECK (from_currency != to_currency),
  CONSTRAINT valid_rate CHECK (rate > 0),
  UNIQUE (org_id, from_currency, to_currency, effective_date)
);

-- Create indexes for performance
CREATE INDEX idx_exchange_rates_org_id ON exchange_rates(org_id);
CREATE INDEX idx_exchange_rates_currency_pair ON exchange_rates(org_id, from_currency, to_currency);
CREATE INDEX idx_exchange_rates_effective_date ON exchange_rates(org_id, effective_date DESC);
CREATE INDEX idx_exchange_rates_created_at ON exchange_rates(created_at DESC);

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view exchange rates from their organization
CREATE POLICY exchange_rates_view_org
  ON exchange_rates FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can insert exchange rates in their organization
CREATE POLICY exchange_rates_insert_org
  ON exchange_rates FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can update exchange rates in their organization
CREATE POLICY exchange_rates_update_org
  ON exchange_rates FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can delete exchange rates in their organization
CREATE POLICY exchange_rates_delete_org
  ON exchange_rates FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_exchange_rates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_rates_updated_at_trigger
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_rates_timestamp();

-- Create trigger to log to audit_logs when created
CREATE OR REPLACE FUNCTION log_exchange_rate_creation()
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
    'EXCHANGE_RATE',
    NEW.id,
    NEW.from_currency || ' to ' || NEW.to_currency,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_rate_created_trigger
  AFTER INSERT ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION log_exchange_rate_creation();

-- Create trigger to log to audit_logs when updated
CREATE OR REPLACE FUNCTION log_exchange_rate_update()
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
    'EXCHANGE_RATE',
    NEW.id,
    NEW.from_currency || ' to ' || NEW.to_currency,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_rate_updated_trigger
  AFTER UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION log_exchange_rate_update();

-- Create trigger to log to audit_logs when soft deleted
CREATE OR REPLACE FUNCTION log_exchange_rate_delete()
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
      'EXCHANGE_RATE',
      NEW.id,
      NEW.from_currency || ' to ' || NEW.to_currency,
      CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_rate_deleted_trigger
  AFTER UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION log_exchange_rate_delete();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_rates TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
