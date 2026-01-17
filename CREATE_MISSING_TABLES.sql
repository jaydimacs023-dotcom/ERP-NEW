-- ============================================================================
-- CREATE MISSING TABLES FOR AT-ERP
-- Tables: schedules, employees, payroll_runs, payroll_lines, payment_histories
-- ============================================================================

-- 1. TRAINER SCHEDULES TABLE
-- Stores trainer availability/schedule with daily time slots
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  trainer_id uuid NOT NULL REFERENCES trainers(id),
  location_id uuid,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Array of {dayIndex, startTime, endTime}
  description text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_trainer_id CHECK (trainer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_schedules_org_id ON schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_schedules_trainer_id ON schedules(trainer_id);
CREATE INDEX IF NOT EXISTS idx_schedules_location_id ON schedules(location_id);
CREATE INDEX IF NOT EXISTS idx_schedules_created_at ON schedules(created_at);

COMMENT ON TABLE schedules IS 'Trainer schedules with daily time slots for availability';
COMMENT ON COLUMN schedules.slots IS 'JSON array: [{"dayIndex": 0-6, "startTime": "HH:MM", "endTime": "HH:MM"}]';

-- ============================================================================

-- 2. EMPLOYEES TABLE
-- Stores employee/staff information including payroll details
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  designation varchar(100),
  tin varchar(50),
  sss varchar(50),
  philhealth varchar(50),
  pagibig varchar(50),
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  bank_name varchar(100),
  bank_account varchar(50),
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_salary CHECK (basic_salary >= 0)
);

CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at);

COMMENT ON TABLE employees IS 'Employee/Staff records with payroll information';
COMMENT ON COLUMN employees.tin IS 'Tax Identification Number';
COMMENT ON COLUMN employees.sss IS 'Social Security System number';
COMMENT ON COLUMN employees.philhealth IS 'PhilHealth number';
COMMENT ON COLUMN employees.pagibig IS 'Pag-IBIG number';

-- ============================================================================

-- 3. PAYROLL RUNS TABLE
-- Stores payroll processing batches for a given period
CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'DRAFT',  -- DRAFT, POSTED
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_dates CHECK (period_start <= period_end),
  CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'POSTED')),
  CONSTRAINT valid_totals CHECK (total_gross >= 0 AND total_deductions >= 0 AND total_net >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_id ON payroll_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period_start ON payroll_runs(period_start);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_created_at ON payroll_runs(created_at);

COMMENT ON TABLE payroll_runs IS 'Payroll processing batches for a given period';
COMMENT ON COLUMN payroll_runs.status IS 'Draft: Under preparation, Posted: Finalized and recorded';

-- ============================================================================

-- 4. PAYROLL LINES TABLE
-- Individual payroll entries for employees in a payroll run
CREATE TABLE IF NOT EXISTS payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  gross_pay numeric(12,2) NOT NULL DEFAULT 0,
  deductions_tax numeric(12,2) NOT NULL DEFAULT 0,
  deductions_sss numeric(12,2) NOT NULL DEFAULT 0,
  deductions_philhealth numeric(12,2) NOT NULL DEFAULT 0,
  deductions_pagibig numeric(12,2) NOT NULL DEFAULT 0,
  deductions_other numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_ids CHECK (payroll_run_id IS NOT NULL AND employee_id IS NOT NULL),
  CONSTRAINT valid_amounts CHECK (gross_pay >= 0 AND net_pay >= 0),
  CONSTRAINT valid_calculation CHECK (net_pay = gross_pay - (deductions_tax + deductions_sss + deductions_philhealth + deductions_pagibig + deductions_other))
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_org_id ON payroll_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_payroll_run_id ON payroll_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_employee_id ON payroll_lines(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_created_at ON payroll_lines(created_at);

COMMENT ON TABLE payroll_lines IS 'Individual payroll entries (one per employee per payroll run)';
COMMENT ON COLUMN payroll_lines.deductions_tax IS 'Income tax deduction';
COMMENT ON COLUMN payroll_lines.deductions_sss IS 'Social Security System deduction';
COMMENT ON COLUMN payroll_lines.deductions_philhealth IS 'PhilHealth insurance deduction';
COMMENT ON COLUMN payroll_lines.deductions_pagibig IS 'Pag-IBIG housing fund deduction';
COMMENT ON COLUMN payroll_lines.deductions_other IS 'Other deductions (loans, etc)';

-- ============================================================================

-- 5. PAYMENT HISTORIES TABLE
-- Tracks subscription/service payment history for organizations
CREATE TABLE IF NOT EXISTS payment_histories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  amount numeric(12,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  due_date date NOT NULL,
  paid_date date,
  status varchar(50) NOT NULL DEFAULT 'PENDING',  -- PAID, PENDING, OVERDUE, CANCELLED
  plan_type varchar(50),  -- TRIAL, PROFESSIONAL, ENTERPRISE
  description text,
  invoice_number varchar(100),
  payment_method varchar(50),  -- CARD, BANK_TRANSFER, CHECK
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_status CHECK (status IN ('PAID', 'PENDING', 'OVERDUE', 'CANCELLED')),
  CONSTRAINT valid_dates CHECK (paid_date IS NULL OR paid_date >= due_date)
);

CREATE INDEX IF NOT EXISTS idx_payment_histories_org_id ON payment_histories(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_histories_status ON payment_histories(status);
CREATE INDEX IF NOT EXISTS idx_payment_histories_due_date ON payment_histories(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_histories_paid_date ON payment_histories(paid_date);
CREATE INDEX IF NOT EXISTS idx_payment_histories_created_at ON payment_histories(created_at);

COMMENT ON TABLE payment_histories IS 'Subscription/service payment tracking for organizations';
COMMENT ON COLUMN payment_histories.status IS 'PAID: Received, PENDING: Not yet due, OVERDUE: Past due, CANCELLED: Not collected';
COMMENT ON COLUMN payment_histories.plan_type IS 'Subscription tier: TRIAL, PROFESSIONAL, ENTERPRISE';

-- ============================================================================
-- 5. STUDENTS TABLE
-- Stores comprehensive student/learner information with document compliance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  uli varchar(50) NOT NULL,                    -- Unique Learner ID
  last_name varchar(100) NOT NULL,
  first_name varchar(100) NOT NULL,
  middle_name varchar(100),
  extension varchar(20),
  sex varchar(20),                             -- 'Male' or 'Female'
  date_of_birth date,
  birth_region varchar(100),
  birth_province varchar(100),
  birth_city varchar(100),
  civil_status varchar(50),
  educational_attainment varchar(100),
  nationality varchar(100),
  email varchar(100),
  contact_number varchar(20),
  street varchar(255),
  barangay varchar(100),
  city varchar(100),
  district varchar(100),
  province varchar(100),
  guardian varchar(200),
  location_id uuid REFERENCES locations(id),
  sponsor_id uuid REFERENCES sponsors(id),
  is_enrollment_overridden boolean DEFAULT false,
  overridden_by uuid,
  compliance_notes text,
  documents jsonb DEFAULT '[]'::jsonb,        -- Array of {id, name, status, fileData, verifiedAt, verifiedBy, remarks}
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_uli CHECK (uli IS NOT NULL AND uli != ''),
  CONSTRAINT valid_names CHECK (first_name IS NOT NULL AND last_name IS NOT NULL),
  UNIQUE(org_id, uli)                         -- Unique ULI per organization
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_students_org_id ON students(org_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_uli ON students(uli) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_contact ON students(contact_number) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students(is_deleted);

COMMENT ON TABLE students IS 'Comprehensive student/learner registry with compliance document tracking';
COMMENT ON COLUMN students.uli IS 'Unique Learner ID - identifies student uniquely within organization';
COMMENT ON COLUMN students.documents IS 'JSON array: [{"id": uuid, "name": string, "status": "PENDING|UPLOADED|VERIFIED|REJECTED", "fileData": base64?, "verifiedAt": ISO8601?, "verifiedBy": uuid?, "remarks": string?}]';
COMMENT ON COLUMN students.is_enrollment_overridden IS 'When true, student can enroll without completing all compliance requirements';

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at_trigger
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION update_students_updated_at();

-- ============================================================================
-- 6. STUDENT_DOCUMENTS TABLE (Normalized version for easier querying)
-- Optional: For cases where document tracking via JSON becomes unwieldy
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,                 -- e.g., "TOR (Transcript of Records)"
  status varchar(50) DEFAULT 'PENDING',       -- PENDING, UPLOADED, VERIFIED, REJECTED
  file_data text,                             -- Base64 encoded file content
  verified_at timestamp with time zone,
  verified_by uuid,
  remarks text,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT valid_student_id CHECK (student_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_student_documents_org_id ON student_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id ON student_documents(student_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_student_documents_status ON student_documents(status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_student_documents_created_at ON student_documents(created_at);

COMMENT ON TABLE student_documents IS 'Denormalized student compliance documents for easier document management and queries';

-- Trigger for student_documents updated_at
CREATE OR REPLACE FUNCTION update_student_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_documents_updated_at_trigger
BEFORE UPDATE ON student_documents
FOR EACH ROW
EXECUTE FUNCTION update_student_documents_updated_at();

-- ============================================================================
-- BATCH_STUDENTS TABLE (linking students to batches for referential integrity)
-- This table should already exist, but ensuring it has proper structure
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_status varchar(50) DEFAULT 'ACTIVE',  -- ACTIVE, DROPPED, COMPLETED
  enrollment_date timestamp with time zone DEFAULT now(),
  completion_date timestamp with time zone,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_org_id CHECK (org_id IS NOT NULL),
  CONSTRAINT unique_enrollment UNIQUE(batch_id, student_id)  -- Prevent duplicate enrollments
);

CREATE INDEX IF NOT EXISTS idx_batch_students_org_id ON batch_students(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student_id ON batch_students(student_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_batch_students_batch_id ON batch_students(batch_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_batch_students_enrollment_status ON batch_students(enrollment_status);

COMMENT ON TABLE batch_students IS 'Junction table linking students to training batches with enrollment tracking';

-- ============================================================================
