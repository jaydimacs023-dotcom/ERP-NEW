-- Simple Quick Start Data - Execute this step by step
-- Run each section separately in Supabase SQL Editor

-- Step 1: Create organization
INSERT INTO organizations (id, name, currency, is_vat_registered, subscription_status, plan_type, primary_color, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'AccounTech Platform Host', 'PHP', true, 'ACTIVE', 'PROFESSIONAL', '#4f46e5', NOW());

-- Step 2: Create admin user
INSERT INTO users (id, org_id, name, email, password_hash, salt, role, is_active, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'System Administrator', 'admin@accountech.io', crypt('admin123', 'salt'), 'salt', 'SYSTEM_ADMIN', true, NOW(), NOW());

-- Step 3: Create accounting period
INSERT INTO accounting_periods (id, org_id, name, start_date, end_date, is_current, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Current Period', DATE_TRUNC('year', CURRENT_DATE), DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day', true, NOW());

-- Step 4: Create Chart of Accounts (Header accounts)
INSERT INTO chart_of_accounts (id, org_id, code, name, class, is_header, is_active, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655440000', '1000', 'ASSETS', 'ASSET', true, true, NOW()),
('550e8400-e29b-41d4-a716-446655440200', '550e8400-e29b-41d4-a716-446655440000', '2000', 'LIABILITIES', 'LIABILITY', true, true, NOW()),
('550e8400-e29b-41d4-a716-446655440300', '550e8400-e29b-41d4-a716-446655440000', '3000', 'EQUITY', 'EQUITY', true, true, NOW()),
('550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440000', '4000', 'REVENUE', 'REVENUE', true, true, NOW()),
('550e8400-e29b-41d4-a716-446655440500', '550e8400-e29b-41d4-a716-446655440000', '5000', 'EXPENSES', 'EXPENSE', true, true, NOW());

-- Step 5: Create Chart of Accounts (Detail accounts)
INSERT INTO chart_of_accounts (id, org_id, code, name, class, parent_id, is_header, is_active, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440000', '1100', 'BDO Checking Account', 'ASSET', '550e8400-e29b-41d4-a716-446655440100', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440000', '1101', 'Petty Cash', 'ASSET', '550e8400-e29b-41d4-a716-446655440100', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440000', '1200', 'Accounts Receivable', 'ASSET', '550e8400-e29b-41d4-a716-446655440100', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440000', '2100', 'Accounts Payable', 'LIABILITY', '550e8400-e29b-41d4-a716-446655440200', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440000', '3100', 'Retained Earnings', 'EQUITY', '550e8400-e29b-41d4-a716-446655440300', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440302', '550e8400-e29b-41d4-a716-446655440000', '3200', 'Owners Capital', 'EQUITY', '550e8400-e29b-41d4-a716-446655440300', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440000', '4100', 'Training Revenue', 'REVENUE', '550e8400-e29b-41d4-a716-446655440400', false, true, NOW()),
('550e8400-e29b-41d4-a716-446655440501', '550e8400-e29b-41d4-a716-446655440000', '5100', 'Depreciation Expense', 'EXPENSE', '550e8400-e29b-41d4-a716-446655440500', false, true, NOW());

-- Step 6: Create sample qualification
INSERT INTO qualifications (id, org_id, code, name, duration_days, sector, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440600', '550e8400-e29b-41d4-a716-446655440000', 'CSS-NCII', 'Computer Systems Servicing NC II', 35, 'ICT', NOW());

-- Step 7: Create sample trainer
INSERT INTO trainers (id, org_id, first_name, last_name, email, contact_number, specialization, created_at)
VALUES ('550e8400-e29b-41d4-a716-446655440700', '550e8400-e29b-41d4-a716-446655440000', 'Juan', 'Dela Cruz', 'juan.delacruz@accountech.io', '+63 917 123 4567', 'ICT & Business Management', NOW());
