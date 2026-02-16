-- =====================================================
-- CREATE ENROLLMENTS TABLE
-- Stores student enrollment records with billing tracking
-- =====================================================

-- Create billing_status enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_status') THEN
        CREATE TYPE billing_status AS ENUM ('UNBILLED', 'BILLED', 'PARTIALLY_BILLED');
    END IF;
END
$$;

-- Create enrollment_status enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'DROPPED', 'COMPLETED', 'ON_HOLD');
    END IF;
END
$$;

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enrollment_code VARCHAR(50) NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    billing_status billing_status NOT NULL DEFAULT 'UNBILLED',
    enrollment_status enrollment_status NOT NULL DEFAULT 'ACTIVE',
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
    billed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    
    -- Soft delete fields
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT unique_student_batch UNIQUE (org_id, student_id, batch_id),
    CONSTRAINT enrollment_code_per_org UNIQUE (org_id, enrollment_code),
    CONSTRAINT valid_billed_amount CHECK (billed_amount >= 0 AND billed_amount <= total_fees)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_enrollments_org_id ON enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch_id ON enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_sponsor_id ON enrollments(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_billing_status ON enrollments(billing_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrollment_status ON enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrollment_date ON enrollments(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_not_deleted ON enrollments(org_id) WHERE is_deleted = FALSE;

-- Enable Row Level Security
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see enrollments from their organization
-- Using users table directly (assumes users.org_id exists)
CREATE POLICY enrollments_org_isolation ON enrollments
    FOR ALL
    USING (org_id IN (
        SELECT u.org_id FROM users u WHERE u.id = auth.uid()
    ));

-- Alternative: If you don't have org_id on users table, use this simpler policy instead:
-- DROP POLICY IF EXISTS enrollments_org_isolation ON enrollments;
-- CREATE POLICY enrollments_authenticated_access ON enrollments
--     FOR ALL
--     TO authenticated
--     USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON enrollments TO authenticated;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enrollments_updated_at ON enrollments;
CREATE TRIGGER trigger_enrollments_updated_at
    BEFORE UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_enrollments_updated_at();

-- =====================================================
-- USAGE NOTES:
-- 1. Run this script in your Supabase SQL Editor
-- 2. The table enforces unique student-batch combinations per org
-- 3. Billing status tracks: UNBILLED, BILLED, PARTIALLY_BILLED
-- 4. Enrollment status tracks: ACTIVE, DROPPED, COMPLETED, ON_HOLD
-- 5. Soft delete is supported via is_deleted flag
-- =====================================================

-- Example insert:
-- INSERT INTO enrollments (org_id, enrollment_code, student_id, batch_id, sponsor_id, total_fees)
-- VALUES ('org-uuid', 'ENR-2025-00001', 'student-uuid', 'batch-uuid', 'sponsor-uuid', 15000.00);

-- Query unbilled enrollments:
-- SELECT e.*, s.name as student_name, b.batchCode as batch_code
-- FROM enrollments e
-- JOIN students s ON e.student_id = s.id
-- JOIN batches b ON e.batch_id = b.id
-- WHERE e.billing_status = 'UNBILLED' AND e.is_deleted = FALSE;
