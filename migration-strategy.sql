-- =====================================================
-- AT-ERP MIGRATION STRATEGY
-- From In-Memory to Supabase Production Database
-- =====================================================
-- EXECUTION ORDER: Follow steps 1-8 exactly

-- =====================================================
-- STEP 1: BACKUP CURRENT DATA
-- =====================================================

-- First, export all existing data from your current system
-- Run this in your current environment to get data export

-- Export existing organizations (if any)
SELECT json_build_object(
    'id', id,
    'name', name,
    'currency', COALESCE(currency, 'PHP'),
    'isVatRegistered', COALESCE(is_vat_registered, true),
    'subscriptionStatus', COALESCE(subscription_status, 'TRIAL'),
    'planType', COALESCE(plan_type, 'BASIC'),
    'licenseExpiry', license_expiry,
    'primaryColor', COALESCE(primary_color, '#4f46e5'),
    'createdAt', COALESCE(created_at, NOW())
) as org_data
FROM organizations;

-- =====================================================
-- STEP 2: CREATE MIGRATION TABLES
-- =====================================================

-- Temporary tables for migration data staging
CREATE TABLE IF NOT EXISTS migration_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_id VARCHAR(100), -- Original student ID for reference
    org_id UUID,
    uli VARCHAR(50),
    last_name VARCHAR(255),
    first_name VARCHAR(255),
    middle_name VARCHAR(255),
    extension VARCHAR(10),
    sex VARCHAR(10),
    date_of_birth DATE,
    birth_region VARCHAR(100),
    birth_province VARCHAR(100),
    birth_city VARCHAR(100),
    civil_status VARCHAR(50),
    educational_attainment VARCHAR(100),
    nationality VARCHAR(100),
    email VARCHAR(255),
    contact_number VARCHAR(50),
    street VARCHAR(255),
    barangay VARCHAR(100),
    city VARCHAR(100),
    district VARCHAR(50),
    province VARCHAR(100),
    guardian VARCHAR(255),
    documents JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_id VARCHAR(100),
    org_id UUID,
    period_id UUID,
    date DATE,
    description TEXT,
    reference VARCHAR(100),
    status VARCHAR(20),
    created_by UUID,
    source_type VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_id VARCHAR(100),
    journal_entry_id UUID,
    account_id UUID,
    debit DECIMAL(15,2),
    credit DECIMAL(15,2),
    memo TEXT,
    contact_id UUID,
    contact_type VARCHAR(20),
    batch_id UUID,
    item_id UUID,
    asset_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 3: MIGRATE CORE ENTITIES FIRST
-- =====================================================

-- 3.1: Create default organization if none exists
INSERT INTO organizations (id, name, currency, is_vat_registered, subscription_status, plan_type, created_at, primary_color)
SELECT 
    uuid_generate_v4(),
    'Default Organization',
    'PHP',
    true,
    'ACTIVE',
    'PROFESSIONAL',
    NOW(),
    '#4f46e5'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- 3.2: Get default org ID for use in migrations
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM organizations LIMIT 1;
    
    -- 3.3: Create default accounting period
    INSERT INTO accounting_periods (id, org_id, name, start_date, end_date, is_current)
    SELECT 
        uuid_generate_v4(),
        default_org_id,
        'Current Period',
        DATE_TRUNC('year', CURRENT_DATE),
        DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day',
        true
    WHERE NOT EXISTS (
        SELECT 1 FROM accounting_periods 
        WHERE org_id = default_org_id AND is_current = true
    );
    
    -- 3.4: Create system admin user
    INSERT INTO users (id, org_id, name, email, password_hash, salt, role, created_at)
    SELECT 
        uuid_generate_v4(),
        default_org_id,
        'System Administrator',
        'admin@' || (SELECT name FROM organizations LIMIT 1),
        crypt('admin123', gen_salt('crypt')), -- Change password in production
        gen_salt('crypt'),
        'SYSTEM_ADMIN',
        NOW();
END $$;

-- =====================================================
-- STEP 4: MIGRATE STUDENT DATA
-- =====================================================

-- 4.1: Migrate students with data transformation
INSERT INTO migration_students (
    legacy_id, org_id, uli, last_name, first_name, middle_name, extension,
    sex, date_of_birth, birth_region, birth_province, birth_city,
    civil_status, educational_attainment, nationality, email, contact_number,
    street, barangay, city, district, province, guardian, documents
)
SELECT 
    s.id as legacy_id,
    (SELECT id FROM organizations LIMIT 1) as org_id,
    s.uli,
    s.last_name,
    s.first_name,
    s.middle_name,
    s.extension,
    s.sex,
    s.date_of_birth,
    s.birth_region,
    s.birth_province,
    s.birth_city,
    s.civil_status,
    s.educational_attainment,
    s.nationality,
    s.email,
    s.contact_number,
    s.street,
    s.barangay,
    s.city,
    s.district,
    s.province,
    s.guardian,
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id,
                'name', d.name,
                'status', d.status,
                'fileData', d.fileData
            )
        ),
        '[]'::jsonb
    ) as documents
FROM students s
LEFT JOIN student_documents d ON s.id = d.student_id
GROUP BY s.id;

-- 4.2: Move migrated students to production table
INSERT INTO students (
    id, org_id, uli, last_name, first_name, middle_name, extension,
    sex, date_of_birth, birth_region, birth_province, birth_city,
    civil_status, educational_attainment, nationality, email, contact_number,
    street, barangay, city, district, province, guardian, created_at
)
SELECT 
    uuid_generate_v4(),
    org_id, uli, last_name, first_name, middle_name, extension,
    sex, date_of_birth, birth_region, birth_province, birth_city,
    civil_status, educational_attainment, nationality, email, contact_number,
    street, barangay, city, district, province, guardian, created_at
FROM migration_students;

-- =====================================================
-- STEP 5: MIGRATE CHART OF ACCOUNTS
-- =====================================================

-- 5.1: Create standard COA template for new org
INSERT INTO chart_of_accounts (
    id, org_id, code, name, class, parent_id, is_header, is_active, created_at
)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations LIMIT 1),
    code,
    name,
    class,
    CASE 
        WHEN parent_code IS NOT NULL THEN (
            SELECT id FROM chart_of_accounts 
            WHERE org_id = (SELECT id FROM organizations LIMIT 1) 
            AND code = parent_code
        )
        ELSE NULL
    END,
    is_header,
    is_active,
    NOW()
FROM (
    SELECT 
        '1000' as code, 'ASSETS' as name, 'ASSET' as class, NULL as parent_code, true as is_header, true as is_active UNION ALL
        SELECT '1100' as code, 'BDO Checking Account' as name, 'ASSET' as class, '1000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '1101' as code, 'Petty Cash' as name, 'ASSET' as class, '1000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '1200' as code, 'Accounts Receivable' as name, 'ASSET' as class, '1000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '2000' as code, 'LIABILITIES' as name, 'LIABILITY' as class, NULL as parent_code, true as is_header, true as is_active UNION ALL
        SELECT '2100' as code, 'Accounts Payable' as name, 'LIABILITY' as class, '2000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '3000' as code, 'EQUITY' as name, 'EQUITY' as class, NULL as parent_code, true as is_header, true as is_active UNION ALL
        SELECT '3100' as code, 'Retained Earnings' as name, 'EQUITY' as class, '3000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '3200' as code, "Owner's Capital" as name, 'EQUITY' as class, '3000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '4000' as code, 'REVENUE' as name, 'REVENUE' as class, NULL as parent_code, true as is_header, true as is_active UNION ALL
        SELECT '4100' as code, 'Training Revenue' as name, 'REVENUE' as class, '4000' as parent_code, false as is_header, true as is_active UNION ALL
        SELECT '5000' as code, 'EXPENSES' as name, 'EXPENSE' as class, NULL as parent_code, true as is_header, true as is_active UNION ALL
        SELECT '5100' as code, 'Depreciation Expense' as name, 'EXPENSE' as class, '5000' as parent_code, false as is_header, true as is_active
) coa_template;

-- =====================================================
-- STEP 6: MIGRATE JOURNAL ENTRIES
-- =====================================================

-- 6.1: Migrate journal entries
INSERT INTO migration_journal_entries (
    legacy_id, org_id, period_id, date, description, reference, 
    status, created_by, source_type, created_at
)
SELECT 
    je.id as legacy_id,
    (SELECT id FROM organizations LIMIT 1) as org_id,
    (SELECT id FROM accounting_periods WHERE org_id = (SELECT id FROM organizations LIMIT 1) AND is_current = true) as period_id,
    je.date,
    je.description,
    je.reference,
    je.status,
    (SELECT id FROM users WHERE email = 'dev@accountech.io' LIMIT 1) as created_by,
    je.source_type,
    je.created_at
FROM journal_entries je;

-- 6.2: Migrate journal lines
INSERT INTO migration_journal_lines (
    legacy_id, journal_entry_id, account_id, debit, credit, memo, 
    contact_id, contact_type, batch_id, item_id, asset_id, created_at
)
SELECT 
    jl.id as legacy_id,
    mje.id as journal_entry_id,
    (SELECT id FROM chart_of_accounts WHERE org_id = (SELECT id FROM organizations LIMIT 1) AND code = jl.account_code LIMIT 1) as account_id,
    jl.debit,
    jl.credit,
    jl.description as memo,
    NULL as contact_id, -- To be updated later
    NULL as contact_type,
    NULL as batch_id,
    NULL as item_id,
    NULL as asset_id,
    NOW()
FROM journal_lines jl
JOIN migration_journal_entries mje ON jl.journal_entry_id = jl.legacy_id;

-- 6.3: Move to production tables
INSERT INTO journal_entries (
    id, org_id, period_id, date, description, reference, status, created_by, source_type, created_at
)
SELECT 
    uuid_generate_v4(),
    org_id, period_id, date, description, reference, status, created_by, source_type, created_at
FROM migration_journal_entries;

INSERT INTO journal_entry_lines (
    id, journal_entry_id, account_id, debit, credit, memo, contact_id, contact_type, batch_id, item_id, asset_id, created_at
)
SELECT 
    uuid_generate_v4(),
    journal_entry_id, account_id, debit, credit, memo, contact_id, contact_type, batch_id, item_id, asset_id, created_at
FROM migration_journal_lines;

-- =====================================================
-- STEP 7: CREATE INITIAL QUALIFICATIONS & TRAINERS
-- =====================================================

-- 7.1: Create default qualifications
INSERT INTO qualifications (id, org_id, code, name, duration_days, sector, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations LIMIT 1),
    code,
    name,
    duration_days,
    sector,
    NOW()
FROM (SELECT 
    'CSS-NCII' as code, 'Computer Systems Servicing NC II' as name, 35 as duration_days, 'ICT' as sector UNION ALL
    SELECT 'BKK-NCIII' as code, 'Bookkeeping NC III' as name, 37 as duration_days, 'Business' as sector UNION ALL
    SELECT 'VGD-NCIII' as code, 'Visual Graphic Design NC III' as name, 45 as duration_days, 'ICT' as sector
) default_quals;

-- 7.2: Create sample trainer
INSERT INTO trainers (id, org_id, first_name, last_name, middle_name, email, contact_number, specialization, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations LIMIT 1),
    'Juan',
    'Dela Cruz',
    'Protacio',
    'juan.delacruz@' || (SELECT name FROM organizations LIMIT 1),
    '+63 917 123 4567',
    'ICT',
    NOW();

-- 7.3: Link trainer to qualifications
INSERT INTO trainer_qualifications (trainer_id, qualification_id, certified_date, created_at)
SELECT 
    t.id as trainer_id,
    q.id as qualification_id,
    CURRENT_DATE as certified_date,
    NOW()
FROM trainers t
CROSS JOIN qualifications q ON t.org_id = q.org_id
LIMIT 3;

-- =====================================================
-- STEP 8: CLEANUP AND VERIFICATION
-- =====================================================

-- 8.1: Create migration summary report
SELECT 
    'Migration Summary' as report_type,
    NOW() as generated_at,
    json_build_object(
        'organizations_migrated', (SELECT COUNT(*) FROM organizations),
        'students_migrated', (SELECT COUNT(*) FROM students),
        'chart_of_accounts_created', (SELECT COUNT(*) FROM chart_of_accounts),
        'journal_entries_migrated', (SELECT COUNT(*) FROM journal_entries),
        'journal_lines_migrated', (SELECT COUNT(*) FROM journal_entry_lines),
        'qualifications_created', (SELECT COUNT(*) FROM qualifications),
        'trainers_created', (SELECT COUNT(*) FROM trainers)
    ) as migration_stats
) as migration_report;

-- 8.2: Drop migration tables (cleanup)
DROP TABLE IF EXISTS migration_students;
DROP TABLE IF EXISTS migration_journal_entries;
DROP TABLE IF EXISTS migration_journal_lines;

-- 8.3: Create post-migration validation checks
-- Validate data integrity
DO $$
DECLARE
    org_count INTEGER;
    student_count INTEGER;
    coa_count INTEGER;
    
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    SELECT COUNT(*) INTO student_count FROM students;
    SELECT COUNT(*) INTO coa_count FROM chart_of_accounts;
    
    -- Raise alert if critical data is missing
    IF org_count = 0 THEN
        RAISE EXCEPTION 'CRITICAL: No organizations found after migration';
    END IF;
    
    IF student_count = 0 THEN
        RAISE NOTICE 'WARNING: No students migrated';
    END IF;
    
    IF coa_count < 10 THEN
        RAISE NOTICE 'WARNING: Chart of accounts has fewer than 10 accounts';
    END IF;
    
    -- Create migration success marker
    INSERT INTO system_settings (org_id, key, value, description, created_at)
    SELECT 
        (SELECT id FROM organizations LIMIT 1),
        'migration_completed',
        NOW()::TEXT,
        'Initial migration from in-memory to Supabase completed',
        NOW();
END $$;

-- =====================================================
-- STEP 9: POST-MIGRATION SETUP
-- =====================================================

-- 9.1: Create initial bank account
INSERT INTO bank_accounts (id, org_id, bank_name, account_number, type, gl_account_id, currency, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations LIMIT 1),
    'BDO Unibank',
    '00123-4567-89',
    'CHECKING',
    (SELECT id FROM chart_of_accounts WHERE org_id = (SELECT id FROM organizations LIMIT 1) AND code = '1100' LIMIT 1),
    'PHP',
    NOW();

-- 9.2: Create default non-stock items
INSERT INTO non_stock_items (id, org_id, code, name, default_account_id, unit_price, type, tax_category, wht_rate, is_active, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations LIMIT 1),
    code,
    name,
    (SELECT id FROM chart_of_accounts WHERE org_id = (SELECT id FROM organizations LIMIT 1) AND code = '4100' LIMIT 1),
    unit_price,
    type,
    tax_category,
    wht_rate,
    is_active,
    NOW()
FROM (SELECT 
    'TUITION-NCII' as code, 'NCII Assessment & Tuition Fee' as name, 15000 as unit_price, 'FEE' as type UNION ALL
    SELECT 'BOOKS-MATERIALS' as code, 'Books & Materials Fee' as name, 5000 as unit_price, 'MATERIAL' as type
) default_items;

-- =====================================================
-- MIGRATION COMPLETION CHECKLIST
-- =====================================================

-- Verify all steps completed:
-- ✅ Step 1: Data backed up
-- ✅ Step 2: Migration tables created
-- ✅ Step 3: Core entities migrated
-- ✅ Step 4: Student data migrated
-- ✅ Step 5: Chart of accounts created
-- ✅ Step 6: Journal entries migrated
-- ✅ Step 7: Initial qualifications & trainers created
-- ✅ Step 8: Cleanup completed
-- ✅ Step 9: Post-migration setup completed

-- =====================================================
-- NEXT STEPS AFTER MIGRATION
-- =====================================================

-- 1. Update application code to use new database structure
-- 2. Test all CRUD operations
-- 3. Verify data integrity
-- 4. Update user authentication
-- 5. Test role-based access control
-- 6. Run performance tests
-- 7. Deploy to production

-- =====================================================
-- ROLLBACK PLAN (if needed)
-- =====================================================

-- If migration fails, use these commands to rollback:
-- DROP TABLE IF EXISTS students CASCADE;
-- DROP TABLE IF EXISTS journal_entries CASCADE;
-- DROP TABLE IF EXISTS chart_of_accounts CASCADE;
-- DROP TABLE IF EXISTS organizations CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- Then restore from backup
