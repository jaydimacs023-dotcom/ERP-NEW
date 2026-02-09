-- ============================================================================
-- FIX: Journal Entries & Lines - Create Tables and RLS Policies
-- 
-- Purpose: Fix the bug where invoice amounts show as zero after page refresh.
-- Root Cause: Tables may not exist, or RLS is enabled without policies.
--
-- Run this in Supabase SQL Editor to fix the issue.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create journal_entries table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  period_id TEXT,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')) DEFAULT 'DRAFT',
  source_type TEXT CHECK (source_type IN ('MANUAL', 'INVOICE', 'BILL', 'PAYMENT', 'COLLECTION', 'DEPRECIATION', 'TRANSFER', 'PURCHASE_ORDER', 'PAYROLL')) DEFAULT 'MANUAL',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================================
-- STEP 2: Create journal_lines table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC(15, 2) DEFAULT 0,
  credit NUMERIC(15, 2) DEFAULT 0,
  memo TEXT,
  contact_id UUID,
  contact_type TEXT CHECK (contact_type IN ('STUDENT', 'TRAINER', 'SPONSOR', 'VENDOR', 'OTHER', 'EMPLOYEE')),
  batch_id UUID,
  item_id UUID,
  asset_id UUID,
  is_cleared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_debit_credit CHECK ((debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0))
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_id ON journal_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_type ON journal_entries(source_type);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_contact_id ON journal_lines(contact_id);

-- ============================================================================
-- STEP 4: Disable RLS temporarily to reset policies
-- ============================================================================

ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop any existing policies (in case of partial setup)
-- ============================================================================

DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_update" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_all" ON journal_entries;

DROP POLICY IF EXISTS "journal_lines_select" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_insert" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_update" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_delete" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_all" ON journal_lines;

-- ============================================================================
-- STEP 3: Re-enable RLS with permissive policies
-- ============================================================================

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create permissive policies for journal_entries
-- ============================================================================

-- Allow SELECT for anon and authenticated users
CREATE POLICY "journal_entries_select"
ON journal_entries
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow INSERT for anon and authenticated users
CREATE POLICY "journal_entries_insert"
ON journal_entries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow UPDATE for anon and authenticated users
CREATE POLICY "journal_entries_update"
ON journal_entries
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow DELETE for anon and authenticated users
CREATE POLICY "journal_entries_delete"
ON journal_entries
FOR DELETE
TO anon, authenticated
USING (true);

-- ============================================================================
-- STEP 5: Create permissive policies for journal_lines
-- ============================================================================

-- Allow SELECT for anon and authenticated users
CREATE POLICY "journal_lines_select"
ON journal_lines
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow INSERT for anon and authenticated users
CREATE POLICY "journal_lines_insert"
ON journal_lines
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow UPDATE for anon and authenticated users
CREATE POLICY "journal_lines_update"
ON journal_lines
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow DELETE for anon and authenticated users
CREATE POLICY "journal_lines_delete"
ON journal_lines
FOR DELETE
TO anon, authenticated
USING (true);

-- ============================================================================
-- STEP 6: Grant table permissions
-- ============================================================================

GRANT ALL ON journal_entries TO anon;
GRANT ALL ON journal_entries TO authenticated;
GRANT ALL ON journal_lines TO anon;
GRANT ALL ON journal_lines TO authenticated;

-- ============================================================================
-- VERIFICATION: Test that journal_lines can be read
-- ============================================================================
-- After running the above, run this query to verify:
-- SELECT * FROM journal_lines LIMIT 5;
--
-- If you see data (or empty if no records exist yet), the fix worked.
-- If you get a permission error, something went wrong.
-- ============================================================================

-- ============================================================================
-- ALTERNATIVE: If you want org-level isolation (more secure), use these instead:
-- ============================================================================
/*
-- Drop permissive policies first
DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_update" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete" ON journal_entries;

DROP POLICY IF EXISTS "journal_lines_select" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_insert" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_update" ON journal_lines;
DROP POLICY IF EXISTS "journal_lines_delete" ON journal_lines;

-- Create org-isolated policies for journal_entries
CREATE POLICY "journal_entries_org_isolation"
ON journal_entries
FOR ALL
TO anon, authenticated
USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Create policies for journal_lines (linked through journal_entries)
CREATE POLICY "journal_lines_org_isolation"
ON journal_lines
FOR ALL
TO anon, authenticated
USING (journal_entry_id IN (
  SELECT id FROM journal_entries 
  WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
))
WITH CHECK (journal_entry_id IN (
  SELECT id FROM journal_entries 
  WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
));
*/
