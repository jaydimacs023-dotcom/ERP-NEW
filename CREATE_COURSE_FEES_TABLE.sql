-- Migration: Create Course Fees Table
-- Run this in Supabase SQL Editor
-- Date: 2026-02-16

-- Create course_fees table
CREATE TABLE IF NOT EXISTS course_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  fee_code TEXT NOT NULL,                              -- Unique fee identifier
  qualification_id UUID NOT NULL REFERENCES qualifications(id), -- Links to course
  fee_name TEXT NOT NULL,                              -- Fee name/description
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,            -- Fee amount
  gl_account_id UUID NOT NULL REFERENCES chart_of_accounts(id), -- G/L Revenue Account
  tax_category_id UUID REFERENCES atc_categories(id),  -- Optional tax category
  is_subject_to_ewt BOOLEAN NOT NULL DEFAULT FALSE,    -- Subject to EWT flag
  ewt_rate NUMERIC(5, 4),                              -- EWT rate (e.g., 0.02 = 2%)
  category TEXT CHECK (category IN ('TUITION', 'REGISTRATION', 'CERTIFICATION', 'ASSESSMENT', 'MATERIALS', 'MISCELLANEOUS')),
  description TEXT,                                    -- Optional description
  is_active BOOLEAN NOT NULL DEFAULT TRUE,             -- Active status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, fee_code)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_course_fees_org_id ON course_fees(org_id);
CREATE INDEX IF NOT EXISTS idx_course_fees_qualification_id ON course_fees(qualification_id);
CREATE INDEX IF NOT EXISTS idx_course_fees_fee_code ON course_fees(fee_code);
CREATE INDEX IF NOT EXISTS idx_course_fees_gl_account_id ON course_fees(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_course_fees_is_active ON course_fees(is_active) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE course_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view course fees in their organization"
  ON course_fees FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert course fees in their organization"
  ON course_fees FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update course fees in their organization"
  ON course_fees FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete course fees in their organization"
  ON course_fees FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Add comments
COMMENT ON TABLE course_fees IS 'Course fee structures linked to qualifications/courses';
COMMENT ON COLUMN course_fees.fee_code IS 'Unique identifier code for the fee (e.g., NC2-FEE-001)';
COMMENT ON COLUMN course_fees.qualification_id IS 'Links to the qualification/course this fee belongs to';
COMMENT ON COLUMN course_fees.fee_name IS 'Descriptive name of the fee';
COMMENT ON COLUMN course_fees.amount IS 'Fee amount in base currency';
COMMENT ON COLUMN course_fees.gl_account_id IS 'G/L revenue account for income recognition';
COMMENT ON COLUMN course_fees.tax_category_id IS 'Optional link to ATC tax category';
COMMENT ON COLUMN course_fees.is_subject_to_ewt IS 'Whether Expanded Withholding Tax applies to this fee';
COMMENT ON COLUMN course_fees.ewt_rate IS 'EWT rate as decimal (e.g., 0.02 = 2%)';
COMMENT ON COLUMN course_fees.category IS 'Fee category: TUITION, REGISTRATION, CERTIFICATION, ASSESSMENT, MATERIALS, MISCELLANEOUS';
COMMENT ON COLUMN course_fees.is_active IS 'Whether this fee is currently available for billing';

-- Verify table creation
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'course_fees'
ORDER BY ordinal_position;

-- Sample data (optional - uncomment to insert test data)
/*
INSERT INTO course_fees (org_id, fee_code, qualification_id, fee_name, amount, gl_account_id, is_subject_to_ewt, ewt_rate, category, is_active)
SELECT 
  o.id as org_id,
  'NC2-FEE-001' as fee_code,
  q.id as qualification_id,
  'Tuition Fee - First Semester' as fee_name,
  15000.00 as amount,
  a.id as gl_account_id,
  FALSE as is_subject_to_ewt,
  NULL as ewt_rate,
  'TUITION' as category,
  TRUE as is_active
FROM organizations o
CROSS JOIN (SELECT id FROM qualifications LIMIT 1) q
CROSS JOIN (SELECT id FROM chart_of_accounts WHERE code = '4010' LIMIT 1) a
LIMIT 1;
*/
