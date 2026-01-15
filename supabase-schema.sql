-- AT-ERP Supabase Database Schema
-- Execute this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    is_vat_registered BOOLEAN DEFAULT false,
    subscription_status VARCHAR(50) DEFAULT 'TRIAL',
    plan_type VARCHAR(50) DEFAULT 'BASIC',
    license_expiry DATE,
    primary_color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chart of Accounts
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES chart_of_accounts(id),
    is_header BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, code)
);

-- Journal Entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    period_id VARCHAR(50) NOT NULL DEFAULT 'CURRENT',
    date DATE NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_type VARCHAR(20) DEFAULT 'MANUAL',
    CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    CHECK (source_type IN ('MANUAL', 'INVOICE', 'BILL', 'PAYMENT', 'COLLECTION', 'DEPRECIATION', 'TRANSFER', 'PURCHASE_ORDER'))
);

-- Journal Entry Lines
CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit > 0 OR credit > 0)
);

-- Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    uli VARCHAR(50) UNIQUE NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    extension VARCHAR(10),
    sex VARCHAR(10) NOT NULL,
    date_of_birth DATE NOT NULL,
    age INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM AGE(NOW(), date_of_birth))) STORED,
    birth_region VARCHAR(100) NOT NULL,
    birth_province VARCHAR(100) NOT NULL,
    birth_city VARCHAR(100) NOT NULL,
    civil_status VARCHAR(50) NOT NULL,
    educational_attainment VARCHAR(100) NOT NULL,
    nationality VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    contact_number VARCHAR(50),
    street VARCHAR(255) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(50),
    province VARCHAR(100) NOT NULL,
    guardian VARCHAR(255),
    documents TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trainers
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    contact_number VARCHAR(50),
    specialization VARCHAR(100) NOT NULL,
    qualification_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Qualifications
CREATE TABLE qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    duration_days INTEGER NOT NULL,
    sector VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, code)
);

-- Sponsors
CREATE TABLE sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(50),
    ar_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trainer Schedules
CREATE TABLE trainer_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    slots JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batches
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    qualification_id UUID REFERENCES qualifications(id) ON DELETE RESTRICT,
    trainer_id UUID REFERENCES trainers(id) ON DELETE RESTRICT,
    sponsor_id UUID REFERENCES sponsors(id),
    schedule_id UUID REFERENCES trainer_schedules(id),
    location_id UUID REFERENCES locations(id),
    student_ids UUID[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'DRAFT',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_date > start_date),
    CHECK (status IN ('DRAFT', 'OPEN_FOR_ENROLLMENT', 'ON_GOING', 'COMPLETED'))
);

-- Vendors
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    email VARCHAR(255),
    contact_number VARCHAR(50),
    address TEXT,
    ap_account_id UUID REFERENCES chart_of_accounts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    gl_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fixed Assets
CREATE TABLE fixed_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    purchase_date DATE,
    purchase_cost DECIMAL(15,2),
    accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
    useful_life_years INTEGER,
    location_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, code)
);

-- Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own organization's data
CREATE POLICY "Users can view own org data" ON organizations
    FOR SELECT USING (id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

CREATE POLICY "Users can update own org" ON organizations
    FOR UPDATE USING (id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Users policy
CREATE POLICY "Users can view own org users" ON users
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Chart of Accounts policy
CREATE POLICY "Users can view own org COA" ON chart_of_accounts
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Journal Entries policy
CREATE POLICY "Users can view own org entries" ON journal_entries
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Students policy
CREATE POLICY "Users can view own org students" ON students
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Trainers policy
CREATE POLICY "Users can view own org trainers" ON trainers
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Qualifications policy
CREATE POLICY "Users can view own org qualifications" ON qualifications
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Batches policy
CREATE POLICY "Users can view own org batches" ON batches
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE email = auth.email()
    ));

-- Indexes for performance
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_coa_org_id ON chart_of_accounts(org_id);
CREATE INDEX idx_coa_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX idx_journal_entries_org_id ON journal_entries(org_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_lines_journal_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX idx_students_org_id ON students(org_id);
CREATE INDEX idx_students_uli ON students(uli);
CREATE INDEX idx_trainers_org_id ON trainers(org_id);
CREATE INDEX idx_qualifications_org_id ON qualifications(org_id);
CREATE INDEX idx_batches_org_id ON batches(org_id);
CREATE INDEX idx_batches_qualification_id ON batches(qualification_id);
CREATE INDEX idx_batches_trainer_id ON batches(trainer_id);
