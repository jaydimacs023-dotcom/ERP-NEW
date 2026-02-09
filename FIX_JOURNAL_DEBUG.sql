-- ============================================================================
-- DEBUG: Journal Tables Diagnostic Script
-- 
-- Run this FIRST to diagnose the AR invoice zero amount issue.
-- Check the output of each query to understand what's happening.
-- ============================================================================

-- ============================================================================
-- DIAGNOSTIC 1: Check if tables exist
-- ============================================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('journal_entries', 'journal_lines', 'organizations', 'users', 'chart_of_accounts');

-- ============================================================================
-- DIAGNOSTIC 2: Check journal_entries data
-- ============================================================================
SELECT 
  id, 
  org_id, 
  date, 
  reference, 
  source_type, 
  status,
  created_at
FROM journal_entries 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================
-- DIAGNOSTIC 3: Check journal_lines data (the key table)
-- ============================================================================
SELECT 
  id,
  journal_entry_id,
  account_id,
  debit,
  credit,
  contact_type,
  created_at
FROM journal_lines 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================
-- DIAGNOSTIC 4: Check INVOICE entries specifically
-- ============================================================================
SELECT 
  je.id as entry_id,
  je.reference,
  je.source_type,
  je.status,
  jl.id as line_id,
  jl.debit,
  jl.credit,
  jl.account_id
FROM journal_entries je
LEFT JOIN journal_lines jl ON je.id = jl.journal_entry_id
WHERE je.source_type = 'INVOICE'
ORDER BY je.created_at DESC
LIMIT 20;

-- ============================================================================
-- DIAGNOSTIC 5: Check RLS status on tables
-- ============================================================================
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('journal_entries', 'journal_lines');

-- ============================================================================
-- DIAGNOSTIC 6: Check existing policies
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('journal_entries', 'journal_lines');

-- ============================================================================
-- DIAGNOSTIC 7: Check constraints on journal_lines
-- ============================================================================
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'journal_lines'::regclass;

-- ============================================================================
-- IF CONSTRAINT IS THE PROBLEM: Drop and recreate with more lenient rules
-- ============================================================================
-- Uncomment the lines below if you see the valid_debit_credit constraint
-- and want to remove it to test:
/*
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS valid_debit_credit;

-- Optional: Re-add a more lenient constraint
ALTER TABLE journal_lines ADD CONSTRAINT valid_debit_credit 
  CHECK (debit >= 0 AND credit >= 0);
*/

-- ============================================================================
-- QUICK FIX: If RLS is blocking, disable it temporarily
-- ============================================================================
-- ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE journal_lines DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANT PERMISSIONS (run this if you get permission errors)
-- ============================================================================
-- GRANT ALL ON journal_entries TO anon;
-- GRANT ALL ON journal_entries TO authenticated;
-- GRANT ALL ON journal_lines TO anon;
-- GRANT ALL ON journal_lines TO authenticated;
