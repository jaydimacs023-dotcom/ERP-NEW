-- =====================================================
-- CREATE INVOICES TABLE
-- AR Invoices with EWT tracking for sponsors/students
-- =====================================================

-- Create invoice_status enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'VOIDED');
    END IF;
END
$$;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_no VARCHAR(50) NOT NULL,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    
    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_ewt_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- EWT Configuration
    ewt_rate DECIMAL(5,4),
    is_subject_to_ewt BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Reference fields
    reference VARCHAR(100),
    terms VARCHAR(100),
    notes TEXT,
    journal_entry_id UUID,
    
    -- Audit fields for posting/voiding
    posted_by UUID,
    posted_at TIMESTAMPTZ,
    voided_by UUID,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    
    -- Soft delete fields
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Standard audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT invoice_no_per_org UNIQUE (org_id, invoice_no),
    CONSTRAINT check_sponsor_or_student CHECK (sponsor_id IS NOT NULL OR student_id IS NOT NULL)
);

-- Create invoice_lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    course_fee_id UUID REFERENCES course_fees(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_category_id UUID,
    vat_amount DECIMAL(15,2) DEFAULT 0,
    gl_account_id UUID,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_line_per_invoice UNIQUE (invoice_id, line_number)
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sponsor_id ON invoices(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student_id ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_batch_id ON invoices(batch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted ON invoices(org_id) WHERE is_deleted = FALSE;

-- Create indexes for invoice_lines
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_course_fee_id ON invoice_lines(course_fee_id);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see invoices from their organization
CREATE POLICY invoices_org_isolation ON invoices
    FOR ALL
    USING (org_id IN (
        SELECT u.org_id FROM users u WHERE u.id = auth.uid()
    ));

-- RLS Policy for invoice_lines (via invoice's org_id)
CREATE POLICY invoice_lines_org_isolation ON invoice_lines
    FOR ALL
    USING (invoice_id IN (
        SELECT i.id FROM invoices i 
        WHERE i.org_id IN (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    ));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_lines TO authenticated;

-- Create trigger for invoices updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

-- Create trigger for invoice_lines updated_at
CREATE OR REPLACE FUNCTION update_invoice_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_lines_updated_at ON invoice_lines;
CREATE TRIGGER trigger_invoice_lines_updated_at
    BEFORE UPDATE ON invoice_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_lines_updated_at();

-- =====================================================
-- USAGE NOTES:
-- 1. Run this script in your Supabase SQL Editor
-- 2. Make sure course_fees table exists first (CREATE_COURSE_FEES_TABLE.sql)
-- 3. Make sure enrollments table exists first (CREATE_ENROLLMENTS_TABLE.sql)
-- 4. Invoice statuses: DRAFT, OPEN, CLOSED, VOIDED
-- 5. EWT (Expanded Withholding Tax) auto-calculated based on sponsor's rate
-- =====================================================

-- Example insert:
-- INSERT INTO invoices (org_id, invoice_no, sponsor_id, invoice_date, due_date, subtotal, grand_total, net_amount_due, balance_due)
-- VALUES ('org-uuid', 'INV-2025-00001', 'sponsor-uuid', '2025-02-16', '2025-03-16', 15000.00, 15000.00, 15000.00, 15000.00);

-- Query open invoices with balance:
-- SELECT i.*, s.name as sponsor_name
-- FROM invoices i
-- LEFT JOIN sponsors s ON i.sponsor_id = s.id
-- WHERE i.status = 'OPEN' AND i.balance_due > 0 AND i.is_deleted = FALSE
-- ORDER BY i.due_date;

-- Query EWT summary for a period:
-- SELECT sponsor_id, SUM(total_ewt_amount) as total_ewt
-- FROM invoices
-- WHERE status IN ('OPEN', 'CLOSED') AND is_deleted = FALSE
--   AND invoice_date BETWEEN '2025-01-01' AND '2025-12-31'
-- GROUP BY sponsor_id;
