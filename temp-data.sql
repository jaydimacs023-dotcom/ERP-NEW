-- Quick Start Data for AT-ERP
-- Run this in Supabase SQL Editor to populate initial data

-- Create default organization
INSERT INTO organizations (id, name, currency, is_vat_registered, subscription_status, plan_type, primary_color, created_at)
VALUES (
    uuid_generate_v4(),
    'AccounTech Platform Host',
    'PHP',
    true,
    'ACTIVE',
    'PROFESSIONAL',
    '#4f46e5',
    NOW()
);

-- Create system admin user
INSERT INTO users (id, org_id, name, email, password_hash, salt, role, is_active, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    o.id,
    'System Administrator',
    'admin@accountech.io',
    crypt('admin123', gen_salt('crypt')),
    gen_salt('crypt'),
    'SYSTEM_ADMIN',
    true,
    NOW(),
    NOW()
FROM organizations o
WHERE o.name = 'AccounTech Platform Host'
LIMIT 1;

-- Create accounting period
INSERT INTO accounting_periods (id, org_id, name, start_date, end_date, is_current, created_at)
SELECT 
    uuid_generate_v4(),
    o.id,
    'Current Period',
    DATE_TRUNC('year', CURRENT_DATE),
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day',
    true,
    NOW()
FROM organizations o
WHERE o.name = 'AccounTech Platform Host'
LIMIT 1;

-- Create basic Chart of Accounts
INSERT INTO chart_of_accounts (id, org_id, code, name, class, is_header, is_active, created_at)
SELECT 
    uuid_generate_v4(),
    o.id,
    unnest(ARRAY['1000', '1100', '1101', '1200', '2000', '2100', '3000', '3100', '3200', '4000', '4100', '5000', '5100']),
    unnest(ARRAY['ASSETS', 'BDO Checking Account', 'Petty Cash', 'Accounts Receivable', 'LIABILITIES', 'Accounts Payable', 'EQUITY', 'Retained Earnings', "Owner's Capital", 'REVENUE', 'Training Revenue', 'EXPENSES', 'Depreciation Expense']),
    unnest(ARRAY['ASSET', 'ASSET', 'ASSET', 'ASSET', 'LIABILITY', 'LIABILITY', 'EQUITY', 'EQUITY', 'EQUITY', 'REVENUE', 'REVENUE', 'EXPENSE', 'EXPENSE']),
    unnest(ARRAY[true, false, false, false, true, false, true, false, false, true, false, true, false]),
    unnest(ARRAY[true, true, true, true, true, true, true, true, true, true, true, true, true]),
    NOW()
FROM organizations o
WHERE o.name = 'AccounTech Platform Host';

-- Update parent relationships
UPDATE chart_of_accounts 
SET parent_id = (
    SELECT id FROM chart_of_accounts coa2 
    WHERE coa2.org_id = chart_of_accounts.org_id 
    AND coa2.code = CASE 
        WHEN chart_of_accounts.code IN ('1100', '1101', '1200') THEN '1000'
        WHEN chart_of_accounts.code = '2100' THEN '2000'
        WHEN chart_of_accounts.code IN ('3100', '3200') THEN '3000'
        WHEN chart_of_accounts.code = '4100' THEN '4000'
        WHEN chart_of_accounts.code = '5100' THEN '5000'
        ELSE NULL
    END
)
WHERE org_id = (SELECT id FROM organizations WHERE name = 'AccounTech Platform Host')
AND code IN ('1100', '1101', '1200', '2100', '3100', '3200', '4100', '5100');

-- Create sample qualifications
INSERT INTO qualifications (id, org_id, code, name, duration_days, sector, created_at)
SELECT 
    uuid_generate_v4(),
    o.id,
    unnest(ARRAY['CSS-NCII', 'BKK-NCIII', 'VGD-NCIII']),
    unnest(ARRAY['Computer Systems Servicing NC II', 'Bookkeeping NC III', 'Visual Graphic Design NC III']),
    unnest(ARRAY[35, 37, 45]),
    unnest(ARRAY['ICT', 'Business', 'ICT']),
    NOW()
FROM organizations o
WHERE o.name = 'AccounTech Platform Host';

-- Create sample trainer
INSERT INTO trainers (id, org_id, first_name, last_name, email, contact_number, specialization, created_at)
SELECT 
    uuid_generate_v4(),
    o.id,
    'Juan',
    'Dela Cruz',
    'juan.delacruz@accountech.io',
    '+63 917 123 4567',
    'ICT & Business Management',
    NOW()
FROM organizations o
WHERE o.name = 'AccounTech Platform Host';

COMMIT;
