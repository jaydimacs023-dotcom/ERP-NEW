-- ============================================================================
-- ADD BILLS TABLE TO EXISTING SUPABASE DATABASE
-- Run this if you already have the schema created but need to add Bills table
-- ============================================================================

-- Create Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  reference TEXT NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE,
  currency TEXT DEFAULT 'PHP',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {itemId, description, qty, price, total}
  vat_purchases NUMERIC(15, 2) DEFAULT 0,
  input_vat NUMERIC(15, 2) DEFAULT 0,
  non_vat_purchases NUMERIC(15, 2) DEFAULT 0,
  total_ewt NUMERIC(15, 2) DEFAULT 0,
  gross_amount NUMERIC(15, 2) NOT NULL,
  net_payable NUMERIC(15, 2) NOT NULL,
  status TEXT CHECK (status IN ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED')) DEFAULT 'DRAFT',
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- Create indexes for bills table
CREATE INDEX IF NOT EXISTS idx_bills_org_id ON bills(org_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(org_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_reference ON bills(org_id, reference);

-- Enable Row Level Security
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- To verify the table was created, run:
-- SELECT * FROM bills;
-- 
-- The query should return 0 rows (table is empty)
-- If it returns an error, the table already exists or there's a connection issue
-- ============================================================================
