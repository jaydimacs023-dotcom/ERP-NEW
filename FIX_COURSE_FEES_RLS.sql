-- ============================================================================
-- FIX: Course Fees - RLS Policies
-- 
-- Purpose: Fix the 401/42501 "new row violates row-level security policy" error.
-- Root Cause: RLS is enabled but no policies are defined for 'course_fees'.
--
-- Run this in Supabase SQL Editor to fix the issue.
-- ============================================================================

-- First disable RLS to reset policies
ALTER TABLE course_fees DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies for this table
DROP POLICY IF EXISTS "course_fees_select" ON course_fees;
DROP POLICY IF EXISTS "course_fees_insert" ON course_fees;
DROP POLICY IF EXISTS "course_fees_update" ON course_fees;
DROP POLICY IF EXISTS "course_fees_delete" ON course_fees;

-- Re-enable RLS
ALTER TABLE course_fees ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for anon and authenticated roles
CREATE POLICY "course_fees_select"
ON course_fees
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow INSERT for anon and authenticated roles
CREATE POLICY "course_fees_insert"
ON course_fees
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow UPDATE for anon and authenticated roles
CREATE POLICY "course_fees_update"
ON course_fees
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow DELETE for anon and authenticated roles
CREATE POLICY "course_fees_delete"
ON course_fees
FOR DELETE
TO anon, authenticated
USING (true);

-- Grant full table permissions
GRANT ALL ON course_fees TO anon;
GRANT ALL ON course_fees TO authenticated;

-- Verification:
-- SELECT table_name, row_level_security FROM information_schema.tables WHERE table_name = 'course_fees';
