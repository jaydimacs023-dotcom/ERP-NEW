-- Create accounting_periods table
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  period_type VARCHAR(50) NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
  fiscal_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SOFT_CLOSE', 'HARD_CLOSE', 'LOCKED')),
  
  -- Closing workflow
  ap_closed BOOLEAN DEFAULT FALSE,
  ap_closed_by UUID,
  ap_closed_at TIMESTAMP WITH TIME ZONE,
  ar_closed BOOLEAN DEFAULT FALSE,
  ar_closed_by UUID,
  ar_closed_at TIMESTAMP WITH TIME ZONE,
  gl_closed BOOLEAN DEFAULT FALSE,
  gl_closed_by UUID,
  gl_closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Lock controls
  locked_by UUID,
  locked_at TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (ap_closed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ar_closed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (gl_closed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  UNIQUE (org_id, fiscal_year, period_number, period_type)
);

-- Create indexes
CREATE INDEX idx_accounting_periods_org_id ON accounting_periods(org_id);
CREATE INDEX idx_accounting_periods_org_fiscal_year ON accounting_periods(org_id, fiscal_year);
CREATE INDEX idx_accounting_periods_status ON accounting_periods(status);
CREATE INDEX idx_accounting_periods_is_deleted ON accounting_periods(is_deleted);

-- Enable RLS
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org's accounting periods"
  ON accounting_periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert accounting periods for their org"
  ON accounting_periods FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update accounting periods for their org"
  ON accounting_periods FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete accounting periods for their org"
  ON accounting_periods FOR DELETE
  USING (auth.uid() IS NOT NULL);
