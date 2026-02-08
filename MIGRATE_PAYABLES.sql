-- ============================================================================
-- MIGRATE PAYABLES TABLE TO SUPABASE COMPATIBLE FORMAT
-- For databases that already have the old payables table structure
-- ============================================================================

-- Step 1: Create new payables table with full structure
CREATE TABLE IF NOT EXISTS payables_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  payable_number TEXT NOT NULL,
  category TEXT CHECK (category IN ('utilities', 'supplies', 'training_materials', 'contractor_services', 'assessments', 'insurance', 'government_obligations', 'scholarship_advances', 'employee_reimbursements', 'other')) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  currency TEXT DEFAULT 'PHP',
  status TEXT CHECK (status IN ('for_approval', 'approved', 'paid', 'partially_paid', 'cancelled')) DEFAULT 'for_approval',
  reference_document TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  withholding_type TEXT CHECK (withholding_type IN ('EXPANDED', 'FINAL')),
  atc_item_id UUID REFERENCES atc_items(id),
  atc_rate_id UUID REFERENCES atc_rates(id),
  applied_rate_percent NUMERIC(5, 2) DEFAULT 0,
  withholding_amount NUMERIC(15, 2) DEFAULT 0,
  net_payable NUMERIC(15, 2),
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  paid_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, payable_number)
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_payables_new_org_id ON payables_new(org_id);
CREATE INDEX IF NOT EXISTS idx_payables_new_vendor_id ON payables_new(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payables_new_status ON payables_new(org_id, status);
CREATE INDEX IF NOT EXISTS idx_payables_new_payable_number ON payables_new(org_id, payable_number);
CREATE INDEX IF NOT EXISTS idx_payables_new_due_date ON payables_new(org_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payables_new_category ON payables_new(org_id, category);
CREATE INDEX IF NOT EXISTS idx_payables_new_created_by ON payables_new(created_by);
CREATE INDEX IF NOT EXISTS idx_payables_new_approved_by ON payables_new(approved_by);

-- Step 3: Enable RLS
ALTER TABLE payables_new ENABLE ROW LEVEL SECURITY;

-- Step 4: If you want to migrate data from old payables table (if it exists):
-- Uncomment and adjust the INSERT statement below based on your data structure
/*
INSERT INTO payables_new (
  org_id, vendor_id, payable_number, category, description, amount,
  bill_date, due_date, payment_date, currency, status, reference_document,
  journal_entry_id, gl_account_id, notes, created_by, created_at, updated_at
)
SELECT
  org_id, vendor_id, ref_no, 'supplies', description, amount,
  bill_date, due_date, payment_date, currency, status, reference_document,
  journal_entry_id, gl_account_id::UUID, notes, created_by::UUID, created_at, updated_at
FROM payables
WHERE is_deleted = FALSE;
*/

-- Step 5: After migration, drop the old table and rename the new one:
/*
DROP TABLE IF EXISTS payables CASCADE;
ALTER TABLE payables_new RENAME TO payables;
*/

-- ============================================================================
-- PAYABLES TABLE STRUCTURE EXPLANATION
-- ============================================================================
/*
Core Fields:
  - id: UUID primary key (auto-generated)
  - org_id: Organization (multi-tenant)
  - vendor_id: Vendor reference
  - payable_number: Unique bill number per organization

Financial Details:
  - category: Type of payable (utilities, supplies, etc.)
  - description: Detailed description
  - amount: Gross payable amount
  - currency: ISO 4217 code (default: PHP)
  - net_payable: Amount after withholding (if applicable)

Dates:
  - bill_date: When the bill was issued
  - due_date: When payment is due
  - payment_date: When payment was made

Withholding (Philippine ATC):
  - withholding_type: EXPANDED or FINAL
  - atc_item_id: Reference to tax item
  - atc_rate_id: Reference to tax rate
  - applied_rate_percent: Applied withholding percentage
  - withholding_amount: Calculated withholding amount

Accounting:
  - journal_entry_id: Link to journal entry (audit trail)
  - gl_account_id: GL account for payable posting
  - reference_document: Supporting document reference

Status & Approval:
  - status: for_approval, approved, paid, partially_paid, cancelled
  - created_by: User who created the record
  - approved_by: User who approved
  - paid_by: User who marked as paid
  - approved_at: Approval timestamp
  - paid_at: Payment timestamp

Soft Delete:
  - is_deleted: Soft delete flag
  - deleted_at: Deletion timestamp
  - deleted_by: User who deleted

Audit:
  - created_at: Creation timestamp
  - updated_at: Last update timestamp
*/

-- ============================================================================
-- SAMPLE PAYABLES DATA
-- ============================================================================
-- Insert sample payables after organizations, vendors, users, and chart_of_accounts exist

INSERT INTO payables_new (
  org_id, vendor_id, payable_number, category, description, amount,
  bill_date, due_date, currency, status, created_by, notes
) SELECT
  o.id, v.id, 'PAY-' || DATE_PART('YYYY', NOW())::TEXT || '-001',
  'utilities', 'Monthly electricity and water utilities', 15000.00,
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '25 days',
  'PHP', 'for_approval', u.id,
  'Regular monthly utility bill'
FROM organizations o
JOIN vendors v ON v.org_id = o.id AND v.name = 'Metro Electric Services'
JOIN users u ON u.org_id = o.id AND u.role = 'AP_SPECIALIST'
WHERE o.name = 'Sample Training Center'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================================================
/*
-- Count payables by status
SELECT status, COUNT(*) as count
FROM payables_new
WHERE is_deleted = FALSE
GROUP BY status;

-- Count payables by category
SELECT category, COUNT(*) as count
FROM payables_new
WHERE is_deleted = FALSE
GROUP BY category;

-- Total outstanding payables by vendor
SELECT v.name, SUM(p.amount - COALESCE(p.withholding_amount, 0)) as outstanding
FROM payables_new p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.is_deleted = FALSE AND p.status IN ('for_approval', 'approved')
GROUP BY v.name;

-- Payables due within 7 days
SELECT payable_number, vendor_id, due_date, amount
FROM payables_new
WHERE is_deleted = FALSE
  AND status IN ('for_approval', 'approved')
  AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY due_date;

-- Overdue payables
SELECT payable_number, vendor_id, due_date, amount
FROM payables_new
WHERE is_deleted = FALSE
  AND status IN ('for_approval', 'approved')
  AND due_date < CURRENT_DATE
ORDER BY due_date;
*/

-- ============================================================================
