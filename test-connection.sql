-- Test connection and data access
-- Run this in Supabase SQL Editor

-- Test if we can read the data
SELECT 'ORGANIZATIONS' as table_name, COUNT(*) as count FROM organizations;
SELECT 'USERS' as table_name, COUNT(*) as count FROM users;
SELECT 'CHART_OF_ACCOUNTS' as table_name, COUNT(*) as count FROM chart_of_accounts;

-- Test the specific data your app needs
SELECT id, name, created_at FROM organizations LIMIT 1;
SELECT id, name, email, role FROM users WHERE email = 'admin@accountech.io';
