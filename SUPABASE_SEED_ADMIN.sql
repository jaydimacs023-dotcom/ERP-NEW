-- AT-ERP: Setup SYSTEM_ADMIN with Supabase Auth
-- Use this approach to securely manage passwords via Supabase Authentication

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" 
-- 3. Enter: Email: admin@system.local, Password: Vhelasawako1!
-- 4. Click "Create User"
-- 5. Copy the generated Auth User ID and run the UPDATE below:

-- Replace 'AUTH_USER_ID_HERE' with the ID from step 4
UPDATE users 
SET auth_id = '48346e5a-1645-4eff-bdcc-62eba02e5588'
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- Verify the link was created
SELECT id, email, role, auth_id FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440002';

