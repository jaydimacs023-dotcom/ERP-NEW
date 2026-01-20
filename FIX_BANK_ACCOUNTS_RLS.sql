-- ============================================================================
-- QUICK FIX: Bank Accounts RLS Policy
-- Run this in Supabase SQL Editor to fix the 401/42501 error
-- ============================================================================

-- OPTION A: Disable RLS entirely (simplest for development)
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to anon and authenticated roles
GRANT ALL ON bank_accounts TO anon;
GRANT ALL ON bank_accounts TO authenticated;

-- ============================================================================
-- VERIFY: Test that it works
-- ============================================================================
-- After running above, try inserting a test row:
-- INSERT INTO bank_accounts (org_id, bank_name, account_number, type, currency, balance)
-- VALUES ('your-org-uuid-here', 'Test Bank', '123456', 'CHECKING', 'PHP', 0);

-- ============================================================================
-- OPTION B: If you want RLS enabled with permissive policies, run this instead:
-- ============================================================================
/*
-- First disable to reset
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations" ON bank_accounts;

-- Re-enable RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create a single permissive policy for all operations
CREATE POLICY "Allow all operations"
ON bank_accounts
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON bank_accounts TO anon;
GRANT ALL ON bank_accounts TO authenticated;
*/
