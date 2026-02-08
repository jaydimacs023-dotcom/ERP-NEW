-- ============================================================================
-- AT-ERP SEED DATA - INITIAL SETUP
-- Sample data for development and testing
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATION
-- ============================================================================
INSERT INTO organizations (
  name, currency, tax_id, is_vat_registered, 
  subscription_status, plan_type, primary_color, logo_url
) VALUES (
  'Sample Training Center', 'PHP', '123-456-789-001', TRUE,
  'ACTIVE', 'PROFESSIONAL', '#4f46e5', 'https://example.com/logo.png'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CHART OF chart_of_accounts (Philippine GAAP Chart of chart_of_accounts)
-- ============================================================================

-- ASSET chart_of_accounts
INSERT INTO chart_of_accounts (org_id, code, name, class, is_header, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), '1000', 'ASSETS', 'ASSET', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1010', 'Cash - Peso', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1020', 'Petty Cash', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1050', 'chart_of_accounts Receivable - Students', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1051', 'chart_of_accounts Receivable - Sponsors', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1100', 'CURRENT ASSETS - NON-FINANCIAL', 'ASSET', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1110', 'Prepaid Expenses', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1120', 'Supplies Inventory', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1200', 'INPUT VAT', 'ASSET', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1210', 'Input VAT - Goods & Services', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1211', 'Input VAT - Capital Equipment', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1500', 'FIXED ASSETS', 'ASSET', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1510', 'Land', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1520', 'Building & Improvements', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1530', 'Furniture & Fixtures', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1540', 'Office Equipment', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1550', 'IT Equipment & Computers', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1560', 'Vehicles', 'ASSET', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '1599', 'Accumulated Depreciation', 'ASSET', FALSE, TRUE);

-- LIABILITY chart_of_accounts
INSERT INTO chart_of_accounts (org_id, code, name, class, is_header, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), '2000', 'LIABILITIES', 'LIABILITY', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2100', 'chart_of_accounts Payable - Vendors', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2200', 'Accrued Expenses', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2210', 'Salaries & Wages Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2220', 'Utilities Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2300', 'WITHHOLDING TAXES PAYABLE', 'LIABILITY', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2310', 'EWT on Purchases Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2311', 'EWT on Services Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2312', 'EWT on Rental Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2320', 'Output VAT Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2400', 'STATUTORY PAYABLES', 'LIABILITY', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2410', 'SSS Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2420', 'PhilHealth Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2430', 'Pag-IBIG Payable', 'LIABILITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '2440', 'Income Tax Withholding Payable', 'LIABILITY', FALSE, TRUE);

-- EQUITY chart_of_accounts
INSERT INTO chart_of_accounts (org_id, code, name, class, is_header, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), '3000', 'EQUITY', 'EQUITY', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '3100', 'Capital Stock', 'EQUITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '3110', 'Additional Paid-In Capital', 'EQUITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '3200', 'Retained Earnings', 'EQUITY', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '3210', 'Dividends', 'EQUITY', FALSE, TRUE);

-- REVENUE chart_of_accounts
INSERT INTO chart_of_accounts (org_id, code, name, class, is_header, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), '4000', 'REVENUE', 'REVENUE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4010', 'Training Fees - Tuition', 'REVENUE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4020', 'Training Fees - Registration', 'REVENUE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4030', 'Certification Fees', 'REVENUE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4040', 'Miscellaneous Fees', 'REVENUE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4050', 'Other Income', 'REVENUE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '4100', 'Government Grants & Subsidies', 'REVENUE', FALSE, TRUE);

-- EXPENSE chart_of_accounts
INSERT INTO chart_of_accounts (org_id, code, name, class, is_header, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), '5000', 'EXPENSES', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5100', 'PERSONNEL COSTS', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5110', 'Trainer Salaries & Wages', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5120', 'Admin Staff Salaries', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5130', 'Payroll Taxes & Benefits', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5140', 'SSS & PhilHealth (Employer Share)', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5200', 'MATERIALS & SUPPLIES', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5210', 'Training Materials', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5220', 'Office Supplies', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5230', 'Facility Supplies', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5300', 'FACILITY COSTS', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5310', 'Rent - Training Rooms', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5320', 'Utilities - Electricity', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5330', 'Utilities - Water & Gas', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5340', 'Maintenance & Repairs', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5350', 'Depreciation - Equipment', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5400', 'ADMINISTRATIVE COSTS', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5410', 'Professional Fees', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5420', 'Audit & Accounting Fees', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5430', 'Insurance Premiums', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5440', 'Telecommunications', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5450', 'Office Equipment', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5460', 'Travel & Transportation', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5470', 'Printing & Postage', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5500', 'DEPRECIATION', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5510', 'Depreciation - Building', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5520', 'Depreciation - Furniture & Fixtures', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5530', 'Depreciation - Vehicles', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5600', 'OTHER EXPENSES', 'EXPENSE', TRUE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5610', 'Donations & Contributions', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5620', 'Interest Expense', 'EXPENSE', FALSE, TRUE),
  ((SELECT id FROM organizations LIMIT 1), '5630', 'Bank Charges & Fees', 'EXPENSE', FALSE, TRUE);

-- ============================================================================
-- 3. MASTER DATA - LOCATIONS
-- ============================================================================
INSERT INTO locations (org_id, name, address, capacity) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Main Campus', '123 Training Street, Manila, Philippines', 100),
  ((SELECT id FROM organizations LIMIT 1), 'Satellite Office', '456 Extension Avenue, Makati, Philippines', 50)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. QUALIFICATIONS
-- ============================================================================
INSERT INTO qualifications (org_id, code, name, duration_days, sector) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'NC2-ELC', 'NC II - Electrical Installation & Maintenance', 160, 'Technical Vocational'),
  ((SELECT id FROM organizations LIMIT 1), 'NC2-BLD', 'NC II - Carpentry', 160, 'Technical Vocational'),
  ((SELECT id FROM organizations LIMIT 1), 'OFFICE', 'Office Administration', 120, 'Office Support'),
  ((SELECT id FROM organizations LIMIT 1), 'KAREHS', 'KAREHS - Kalusugan Responsable Employees', 40, 'Health & Safety')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. VENDORS (FOR chart_of_accounts PAYABLE)
-- ============================================================================
INSERT INTO vendors (org_id, name, category, email, contact_number, address, ap_account_id) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'ABC Supplies Inc.', 'Office Supplies', 'sales@abcsupplies.com', '555-0001', 'Quezon City', (SELECT id FROM chart_of_accounts WHERE code = '2100' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'XYZ Training Materials Co.', 'Training Materials', 'contact@xyztraining.com', '555-0002', 'Makati', (SELECT id FROM chart_of_accounts WHERE code = '2100' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Metro Electric Services', 'Utilities & Maintenance', 'billing@metroelectric.com', '555-0003', 'Manila', (SELECT id FROM chart_of_accounts WHERE code = '2100' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. PHILIPPINE ATC TAX WITHHOLDING RATES
-- ============================================================================
INSERT INTO atc_categories (code, name) VALUES
  ('A', 'Goods & Services'),
  ('B', 'Lease'),
  ('C', 'Professional Fees & Other Income')
ON CONFLICT DO NOTHING;

INSERT INTO atc_items (category_id, atc_code, description, taxpayer_type) VALUES
  ((SELECT id FROM atc_categories WHERE code = 'A' LIMIT 1), 'WI010', 'Purchases of Materials/Supplies - 1% Rate', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'A' LIMIT 1), 'WI020', 'Purchases of Materials/Supplies - 2% Rate', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'A' LIMIT 1), 'WI030', 'Purchases of Capital Equipment', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'B' LIMIT 1), 'WI040', 'Lease/Rental of Properties - 5% Rate', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'C' LIMIT 1), 'WI050', 'Professional Services - 10% Rate', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'C' LIMIT 1), 'WI060', 'Talent Fees - 10% Rate', 'Both'),
  ((SELECT id FROM atc_categories WHERE code = 'C' LIMIT 1), 'WI070', 'Management Fees - 10% Rate', 'Both')
ON CONFLICT DO NOTHING;

INSERT INTO atc_rates (atc_item_id, rate, rate_label) VALUES
  ((SELECT id FROM atc_items WHERE atc_code = 'WI010' LIMIT 1), 1.00, '1%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI020' LIMIT 1), 2.00, '2%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI030' LIMIT 1), 2.00, '2%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI040' LIMIT 1), 5.00, '5%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI050' LIMIT 1), 10.00, '10%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI060' LIMIT 1), 10.00, '10%'),
  ((SELECT id FROM atc_items WHERE atc_code = 'WI070' LIMIT 1), 10.00, '10%')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. NON-STOCK ITEMS (SERVICE & TRAINING ITEMS)
-- ============================================================================
INSERT INTO non_stock_items (org_id, code, name, description, unit_price, income_account_id, expense_account_id) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'TRN-001', 'NC II Electrical Installation Course', 'Full-time training program for NC II certification', 15000.00, (SELECT id FROM chart_of_accounts WHERE code = '4010' LIMIT 1), (SELECT id FROM chart_of_accounts WHERE code = '5110' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'TRN-002', 'Registration Fee', 'Student registration and processing', 500.00, (SELECT id FROM chart_of_accounts WHERE code = '4020' LIMIT 1), (SELECT id FROM chart_of_accounts WHERE code = '5450' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'TRN-003', 'Certification Exam', 'External certification examination', 1500.00, (SELECT id FROM chart_of_accounts WHERE code = '4030' LIMIT 1), (SELECT id FROM chart_of_accounts WHERE code = '5400' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'SUP-001', 'Training Materials Kit', 'Complete training materials for one student', 2500.00, (SELECT id FROM chart_of_accounts WHERE code = '4010' LIMIT 1), (SELECT id FROM chart_of_accounts WHERE code = '5210' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. BANK chart_of_accounts
-- ============================================================================
INSERT INTO bank_accounts (org_id, bank_name, account_number, type, gl_account_id, currency, balance) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'BDO Unibank - Checking', '1234567890', 'CHECKING', (SELECT id FROM chart_of_accounts WHERE code = '1010' LIMIT 1), 'PHP', 500000.00),
  ((SELECT id FROM organizations LIMIT 1), 'MetroBank - Savings', '0987654321', 'SAVINGS', (SELECT id FROM chart_of_accounts WHERE code = '1010' LIMIT 1), 'PHP', 1000000.00),
  ((SELECT id FROM organizations LIMIT 1), 'Petty Cash Box', 'CASH-001', 'CASH', (SELECT id FROM chart_of_accounts WHERE code = '1020' LIMIT 1), 'PHP', 10000.00)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. EMPLOYEES (FOR PAYROLL)
-- ============================================================================
INSERT INTO employees (org_id, first_name, last_name, designation, tin, sss, philhealth, pagibig, basic_salary, bank_name, bank_account, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'John', 'Dela Cruz', 'Training Manager', '123-456-789-000', '33-1234567-8', 'PM-111-111-111', '1234-1234-1234', 45000.00, 'BDO', '1111111111', TRUE),
  ((SELECT id FROM organizations LIMIT 1), 'Maria', 'Santos', 'Senior Trainer', '234-567-890-001', '33-2345678-9', 'PM-222-222-222', '2345-2345-2345', 38000.00, 'BDO', '2222222222', TRUE),
  ((SELECT id FROM organizations LIMIT 1), 'Jose', 'Garcia', 'Administrative Officer', '345-678-901-002', '33-3456789-0', 'PM-333-333-333', '3456-3456-3456', 25000.00, 'MetroBank', '3333333333', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. SPONSORS
-- ============================================================================
INSERT INTO sponsors (org_id, name, contact_person, email, phone, address) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Department of Labor & Employment', 'Mr. DOLE Officer', 'contact@dole.gov.ph', '555-0100', 'Manila'),
  ((SELECT id FROM organizations LIMIT 1), 'Skills Development Fund', 'Ms. SDF Manager', 'programs@sdf.org.ph', '555-0101', 'Makati'),
  ((SELECT id FROM organizations LIMIT 1), 'Philippine Heart Foundation', 'Dr. PHF Director', 'info@phf.org.ph', '555-0102', 'Quezon City')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ACCOUNTING NOTES:
-- ============================================================================
-- The Chart of chart_of_accounts follows Philippine GAAP and is structured as:
--
-- ASSETS (1000-1999):
--   - Current Assets: Cash, AR, Prepaids (1000-1199)
--   - Input VAT: Tax credits (1200-1299)
--   - Fixed Assets: PPE & Depreciation (1500-1699)
--
-- LIABILITIES (2000-2999):
--   - Current Liabilities: AP, Accruals (2000-2199)
--   - Tax Payables: EWT, Output VAT, SSS, Pag-IBIG (2200-2499)
--
-- EQUITY (3000-3999):
--   - Capital, Retained Earnings, Dividends
--
-- REVENUE (4000-4999):
--   - Training Fees: Tuition, Registration, Certification
--   - Other Income: Grants, Miscellaneous
--
-- EXPENSES (5000-5999):
--   - Personnel: Salaries, Taxes, Benefits
--   - Materials: Training, Supplies
--   - Facilities: Rent, Utilities, Maintenance
--   - Admin: Professional Fees, Insurance
--   - Depreciation: All Asset Classes
--
-- WITHHOLDING TAX STRUCTURE (Philippine ATC):
-- A1: Purchases - 1% on supplies
-- A2: Purchases - 2% on supplies  
-- A3: Capital Equipment - 2%
-- B:  Lease/Rental - 5%
-- C:  Professional Services - 10%
--
-- ============================================================================

-- ============================================================================
-- 11. SAMPLE PAYABLES DATA
-- ============================================================================
INSERT INTO payables (
  org_id, vendor_id, payable_number, category, description, amount,
  bill_date, due_date, currency, status, created_by, notes
) SELECT
  o.id, v.id, 'PAY-' || DATE_PART('YYYY', NOW())::TEXT || '-001',
  'utilities', 'Monthly electricity and water utilities - January 2026', 15000.00,
  '2026-01-15'::DATE, '2026-02-15'::DATE, 'PHP', 'approved',
  u.id, 'Regular monthly utility bill for main campus'
FROM organizations o
JOIN vendors v ON v.org_id = o.id AND v.name = 'Metro Electric Services'
JOIN users u ON u.org_id = o.id AND u.role = 'ACCOUNTANT'
WHERE o.name = 'Sample Training Center'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO payables (
  org_id, vendor_id, payable_number, category, description, amount,
  bill_date, due_date, currency, status, created_by, notes
) SELECT
  o.id, v.id, 'PAY-' || DATE_PART('YYYY', NOW())::TEXT || '-002',
  'supplies', 'Office and training supplies inventory', 8500.00,
  '2026-01-10'::DATE, '2026-02-10'::DATE, 'PHP', 'for_approval',
  u.id, 'Monthly supply purchase - invoice #ABC-2026-001'
FROM organizations o
JOIN vendors v ON v.org_id = o.id AND v.name = 'ABC Supplies Inc.'
JOIN users u ON u.org_id = o.id AND u.role = 'ACCOUNTANT'
WHERE o.name = 'Sample Training Center'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO payables (
  org_id, vendor_id, payable_number, category, description, amount,
  bill_date, due_date, currency, status, created_by, withholding_type, applied_rate_percent, withholding_amount, net_payable, notes
) SELECT
  o.id, v.id, 'PAY-' || DATE_PART('YYYY', NOW())::TEXT || '-003',
  'training_materials', 'Training materials and learning modules for NC II courses', 25000.00,
  '2026-01-12'::DATE, '2026-02-12'::DATE, 'PHP', 'approved',
  u.id, 'EXPANDED', 2.00, 500.00, 24500.00,
  'EWT applied - 2% for training materials (ATC Code: WI020)'
FROM organizations o
JOIN vendors v ON v.org_id = o.id AND v.name = 'XYZ Training Materials Co.'
JOIN users u ON u.org_id = o.id AND u.role = 'ACCOUNTANT'
WHERE o.name = 'Sample Training Center'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
