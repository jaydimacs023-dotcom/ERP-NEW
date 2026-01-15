-- Test database connection and check if data exists
-- Run this in Supabase SQL Editor to debug

-- Check if organizations exist
SELECT 'organizations' as table_name, COUNT(*) as record_count FROM organizations
UNION ALL
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'chart_of_accounts' as table_name, COUNT(*) as record_count FROM chart_of_accounts
UNION ALL
SELECT 'accounting_periods' as table_name, COUNT(*) as record_count FROM accounting_periods;

-- Check if the specific organization exists
SELECT * FROM organizations WHERE name = 'AccounTech Platform Host';

-- Check if the admin user exists
SELECT * FROM users WHERE email = 'admin@accountech.io';
