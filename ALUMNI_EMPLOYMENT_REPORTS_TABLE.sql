-- ============================================================================
-- CREATE TABLE: alumni_employment_reports
-- Stores graduate employment tracking data for Tracer Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS alumni_employment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  employment_status varchar(100),
  employment_type varchar(100),
  employer_name text,
  position text,
  date_hired date,
  salary_range varchar(100),
  is_related_to_course boolean DEFAULT true,
  employer_address text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alumni_reports_org_id ON alumni_employment_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_alumni_reports_student_id ON alumni_employment_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_alumni_reports_status ON alumni_employment_reports(employment_status);

-- Enable RLS
ALTER TABLE alumni_employment_reports ENABLE ROW LEVEL SECURITY;

-- Permissive Policies (matching other tables)
DROP POLICY IF EXISTS "alumni_reports_select" ON alumni_employment_reports;
CREATE POLICY "alumni_reports_select" ON alumni_employment_reports FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "alumni_reports_insert" ON alumni_employment_reports;
CREATE POLICY "alumni_reports_insert" ON alumni_employment_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "alumni_reports_update" ON alumni_employment_reports;
CREATE POLICY "alumni_reports_update" ON alumni_employment_reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alumni_reports_delete" ON alumni_employment_reports;
CREATE POLICY "alumni_reports_delete" ON alumni_employment_reports FOR DELETE TO anon, authenticated USING (true);

-- Permissions
GRANT ALL ON alumni_employment_reports TO anon;
GRANT ALL ON alumni_employment_reports TO authenticated;

COMMENT ON TABLE alumni_employment_reports IS 'Graduate career tracking data for Tracer Reports';
