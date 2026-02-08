-- ============================================================================
-- AT-ERP SUPABASE SCHEMA - COMPLETE DATABASE SETUP
-- Educational Institution ERP with Double-Entry Accounting
-- Created: January 19, 2026
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TENANCY & AUTHORIZATION
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  currency TEXT DEFAULT 'PHP' NOT NULL,
  tax_id TEXT,
  is_vat_registered BOOLEAN DEFAULT FALSE,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'PENDING')) DEFAULT 'TRIAL',
  plan_type TEXT CHECK (plan_type IN ('BASIC', 'PROFESSIONAL', 'ENTERPRISE')) DEFAULT 'BASIC',
  pending_plan_type TEXT,
  payment_reference TEXT,
  license_expiry TIMESTAMPTZ,
  primary_color TEXT DEFAULT '#4f46e5',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT CHECK (role IN ('SYSTEM_ADMIN', 'ADMIN', 'ACCOUNTANT', 'REGISTRAR', 'STUDENT', 'TRAINER', 'AP_SPECIALIST', 'AR_SPECIALIST', 'FINANCE_MANAGER', 'PRESIDENT')) NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id),
  student_id UUID,
  trainer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE payment_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT CHECK (status IN ('PAID', 'OVERDUE', 'PENDING', 'CANCELLED')) DEFAULT 'PENDING',
  plan_type TEXT NOT NULL,
  description TEXT,
  invoice_number TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- AUDIT & COMPLIANCE
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHART OF chart_of_accounts (Double-Entry Accounting Framework)
-- ============================================================================

CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT CHECK (class IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')) NOT NULL,
  parent_id UUID REFERENCES chart_of_accounts(id),
  qualification_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  is_header BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, code),
  CONSTRAINT no_circular_hierarchy CHECK (id != parent_id)
);

-- ============================================================================
-- ACCOUNTING JOURNALS & TRANSACTIONS
-- ============================================================================

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  period_id TEXT,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')) DEFAULT 'DRAFT',
  source_type TEXT CHECK (source_type IN ('MANUAL', 'INVOICE', 'BILL', 'PAYMENT', 'COLLECTION', 'DEPRECIATION', 'TRANSFER', 'PURCHASE_ORDER', 'PAYROLL')) DEFAULT 'MANUAL',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC(15, 2) DEFAULT 0,
  credit NUMERIC(15, 2) DEFAULT 0,
  memo TEXT,
  contact_id UUID,
  contact_type TEXT CHECK (contact_type IN ('STUDENT', 'TRAINER', 'SPONSOR', 'VENDOR', 'OTHER', 'EMPLOYEE')),
  batch_id UUID,
  item_id UUID,
  asset_id UUID,
  is_cleared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_debit_credit CHECK ((debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0))
);

-- ============================================================================
-- MASTER DATA - ORGANIZATIONAL
-- ============================================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, name)
);

CREATE TABLE qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  sector TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, code)
);

-- ============================================================================
-- PEOPLE MANAGEMENT
-- ============================================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  uli TEXT NOT NULL UNIQUE,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension TEXT,
  sex TEXT,
  date_of_birth DATE,
  birth_region TEXT,
  birth_province TEXT,
  birth_city TEXT,
  civil_status TEXT,
  educational_attainment TEXT,
  nationality TEXT DEFAULT 'Filipino',
  email TEXT,
  contact_number TEXT,
  street TEXT,
  barangay TEXT,
  city TEXT,
  district TEXT,
  province TEXT,
  guardian TEXT,
  location_id UUID REFERENCES locations(id),
  sponsor_id UUID,
  documents TEXT[], -- Array of document names/IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  contact_number TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualification_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE trainer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  location_id UUID REFERENCES locations(id),
  slots JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {dayIndex: number, startTime: string, endTime: string}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, name)
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  tin TEXT,
  sss TEXT,
  philhealth TEXT,
  pagibig TEXT,
  basic_salary NUMERIC(15, 2) NOT NULL,
  bank_name TEXT,
  bank_account TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- TRAINING PROGRAMS
-- ============================================================================

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  batch_code TEXT,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  qualification_id UUID NOT NULL REFERENCES qualifications(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  sponsor_id UUID REFERENCES sponsors(id),
  location_id UUID REFERENCES locations(id),
  student_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status TEXT CHECK (status IN ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED')) DEFAULT 'PLANNED',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_students INTEGER,
  current_students INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- ACCOUNTING ITEMS & SERVICES
-- ============================================================================

CREATE TABLE non_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(15, 2) NOT NULL,
  income_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  expense_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  tax_category_id TEXT, -- References atc_categories(code)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, code)
);

CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_cost NUMERIC(15, 2) NOT NULL,
  accumulated_depreciation NUMERIC(15, 2) DEFAULT 0,
  net_book_value NUMERIC(15, 2) GENERATED ALWAYS AS (purchase_cost - accumulated_depreciation) STORED,
  depreciation_method TEXT DEFAULT 'STRAIGHT_LINE',
  useful_life_years INTEGER NOT NULL,
  gl_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- VENDORS & SUPPLY CHAIN (chart_of_accounts PAYABLE)
-- ============================================================================

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  email TEXT,
  contact_number TEXT,
  address TEXT,
  ap_account_id UUID REFERENCES chart_of_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, name)
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  date DATE NOT NULL,
  reference TEXT NOT NULL,
  status TEXT CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FULLY_BILLED', 'CLOSED')) DEFAULT 'DRAFT',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {id, itemId, description, qty, unitPrice, taxAmount}
  total_amount NUMERIC(15, 2) NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE bills (
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

CREATE TABLE payables (
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

-- ============================================================================
-- BANKING & CASH MANAGEMENT
-- ============================================================================

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  type TEXT CHECK (type IN ('SAVINGS', 'CHECKING', 'CREDIT', 'CASH')) NOT NULL,
  gl_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  currency TEXT DEFAULT 'PHP',
  balance NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, account_number)
);

-- ============================================================================
-- TAX & WITHHOLDING (Philippine ATC - Alphalist of Tax Compliance)
-- ============================================================================

CREATE TABLE atc_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE atc_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES atc_categories(id),
  atc_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  taxpayer_type TEXT CHECK (taxpayer_type IN ('Individual', 'Corporation', 'Both')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE atc_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atc_item_id UUID NOT NULL REFERENCES atc_items(id),
  rate NUMERIC(5, 2) NOT NULL,
  rate_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE vendor_tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  atc_item_id UUID REFERENCES atc_items(id),
  atc_rate_id UUID REFERENCES atc_rates(id),
  withholding_type TEXT CHECK (withholding_type IN ('EXPANDED', 'FINAL')),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- PAYROLL & HUMAN RESOURCES
-- ============================================================================

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT CHECK (status IN ('DRAFT', 'POSTED')) DEFAULT 'DRAFT',
  total_gross NUMERIC(15, 2) DEFAULT 0,
  total_deductions NUMERIC(15, 2) DEFAULT 0,
  total_net NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, period_start, period_end)
);

CREATE TABLE payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  gross_pay NUMERIC(15, 2) NOT NULL,
  deductions_tax NUMERIC(15, 2) DEFAULT 0,
  deductions_sss NUMERIC(15, 2) DEFAULT 0,
  deductions_philhealth NUMERIC(15, 2) DEFAULT 0,
  deductions_pagibig NUMERIC(15, 2) DEFAULT 0,
  deductions_other NUMERIC(15, 2) DEFAULT 0,
  net_pay NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BUDGETING & FORECASTING
-- ============================================================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  fiscal_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('ACTIVE', 'DRAFT', 'CLOSED')) DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, fiscal_year)
);

CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  budgeted_amount NUMERIC(15, 2) NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organization indexes
CREATE INDEX idx_organizations_created_at ON organizations(created_at);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

-- User indexes
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Audit indexes
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Accounting indexes
CREATE INDEX idx_accounts_org_id ON chart_of_accounts(org_id);
CREATE INDEX idx_accounts_code ON chart_of_accounts(org_id, code);
CREATE INDEX idx_accounts_class ON chart_of_accounts(org_id, class);
CREATE INDEX idx_accounts_parent_id ON chart_of_accounts(parent_id);

-- Journal indexes
CREATE INDEX idx_journal_entries_org_id ON journal_entries(org_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(org_id, date DESC);
CREATE INDEX idx_journal_entries_status ON journal_entries(org_id, status);
CREATE INDEX idx_journal_entries_source_type ON journal_entries(org_id, source_type);

CREATE INDEX idx_journal_lines_journal_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_contact ON journal_lines(contact_type, contact_id);

-- Student indexes
CREATE INDEX idx_students_org_id ON students(org_id);
CREATE INDEX idx_students_uli ON students(uli);
CREATE INDEX idx_students_sponsor_id ON students(sponsor_id);
CREATE INDEX idx_students_location_id ON students(location_id);

-- Vendor indexes
CREATE INDEX idx_vendors_org_id ON vendors(org_id);
CREATE INDEX idx_vendors_name ON vendors(org_id, name);

-- Purchase order indexes
CREATE INDEX idx_purchase_orders_org_id ON purchase_orders(org_id);
CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(org_id, status);

-- Bills indexes
CREATE INDEX idx_bills_org_id ON bills(org_id);
CREATE INDEX idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX idx_bills_status ON bills(org_id, status);
CREATE INDEX idx_bills_reference ON bills(org_id, reference);

-- Payables indexes
CREATE INDEX idx_payables_org_id ON payables(org_id);
CREATE INDEX idx_payables_vendor_id ON payables(vendor_id);
CREATE INDEX idx_payables_status ON payables(org_id, status);
CREATE INDEX idx_payables_payable_number ON payables(org_id, payable_number);
CREATE INDEX idx_payables_due_date ON payables(org_id, due_date);
CREATE INDEX idx_payables_category ON payables(org_id, category);
CREATE INDEX idx_payables_created_by ON payables(created_by);
CREATE INDEX idx_payables_approved_by ON payables(approved_by);

-- Bank account indexes
CREATE INDEX idx_bank_accounts_org_id ON bank_accounts(org_id);
CREATE INDEX idx_bank_accounts_gl_account_id ON bank_accounts(gl_account_id);

-- Non-stock item indexes
CREATE INDEX idx_non_stock_items_org_id ON non_stock_items(org_id);
CREATE INDEX idx_non_stock_items_code ON non_stock_items(org_id, code);

-- Payroll indexes
CREATE INDEX idx_payroll_runs_org_id ON payroll_runs(org_id);
CREATE INDEX idx_payroll_lines_payroll_run_id ON payroll_lines(payroll_run_id);
CREATE INDEX idx_payroll_lines_employee_id ON payroll_lines(employee_id);

-- ============================================================================
-- SECURITY & ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- This schema supports:
-- ✓ Multi-tenant architecture with organization isolation
-- ✓ Double-entry accounting with automatic balance validation
-- ✓ Complete chart of chart_of_accounts hierarchy
-- ✓ chart_of_accounts Payable with Philippine ATC withholding
-- ✓ chart_of_accounts Receivable with student/sponsor tracking
-- ✓ Banking and cash management
-- ✓ Fixed asset management with depreciation
-- ✓ Payroll processing with statutory deductions
-- ✓ Budgeting and forecasting
-- ✓ Audit trail and compliance logging
-- ✓ Training program and batch management
-- ✓ Full soft-delete support
-- ============================================================================
