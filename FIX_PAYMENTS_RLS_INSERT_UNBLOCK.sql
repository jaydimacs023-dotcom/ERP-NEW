-- ============================================================================
-- FIX_PAYMENTS_RLS_INSERT_UNBLOCK.sql
-- Purpose:
--   Unblock INSERT into payments/payment_applications for current client flow
--   that uses anon bearer token at the browser.
--
-- WARNING:
--   This is less secure for multi-tenant production than authenticated JWT +
--   org-bound policies. Use only as temporary compatibility fix.
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_applications NO FORCE ROW LEVEL SECURITY;

-- Reset policies to avoid hidden restrictive conflicts
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', r.policyname);
  END LOOP;

  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_applications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_applications', r.policyname);
  END LOOP;
END $$;

-- Schema/table privileges (required before RLS is evaluated)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_applications TO anon, authenticated;

-- If you query invoices/payments in RLS checks, anon needs select on invoices too
GRANT SELECT ON public.invoices TO anon, authenticated;

-- Allow anon INSERT to payments when org_id is present.
-- This unblocks Save Draft / Post Payment create path.
CREATE POLICY "payments_insert_anon_unblock"
ON payments
FOR INSERT
TO anon
WITH CHECK (
  org_id IS NOT NULL
);

-- Optional select/update for current browser anon flow
CREATE POLICY "payments_select_anon_unblock"
ON payments
FOR SELECT
TO anon
USING (true);

CREATE POLICY "payments_update_anon_unblock"
ON payments
FOR UPDATE
TO anon
USING (true)
WITH CHECK (org_id IS NOT NULL);

CREATE POLICY "payments_delete_anon_unblock"
ON payments
FOR DELETE
TO anon
USING (true);

-- Allow anon INSERT to payment_applications only if related payment+invoice exist
-- and belong to the same org.
CREATE POLICY "payment_applications_insert_anon_unblock"
ON payment_applications
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM payments p
    JOIN invoices i ON i.id = payment_applications.invoice_id
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = i.org_id
      AND COALESCE(p.is_deleted, false) = false
      AND COALESCE(i.is_deleted, false) = false
  )
);

CREATE POLICY "payment_applications_select_anon_unblock"
ON payment_applications
FOR SELECT
TO anon
USING (true);

CREATE POLICY "payment_applications_update_anon_unblock"
ON payment_applications
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "payment_applications_delete_anon_unblock"
ON payment_applications
FOR DELETE
TO anon
USING (true);

-- Optional verification
-- SELECT policyname, tablename, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('payments', 'payment_applications')
-- ORDER BY tablename, policyname;
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('payments', 'payment_applications')
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY table_name, grantee, privilege_type;
