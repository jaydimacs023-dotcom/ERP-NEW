-- ============================================================================
-- FIX_PAYMENTS_RLS_SECURE.sql
-- Purpose:
--   Secure multi-tenant RLS for payments + payment_applications.
--   Intended for Supabase Auth JWTs (role=authenticated) carrying org claim.
--
-- IMPORTANT:
--   This is secure only if client requests use a valid Supabase JWT.
--   If your app uses custom JWT (non-Supabase signed), use the Edge Function
--   pattern in supabase/functions/payments-write/index.ts for writes.
-- ============================================================================

-- 1) Ensure tables have RLS enabled
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_applications ENABLE ROW LEVEL SECURITY;

-- 2) Remove old/loose policies
DROP POLICY IF EXISTS "Users can view payments in their organization" ON payments;
DROP POLICY IF EXISTS "Users can insert payments in their organization" ON payments;
DROP POLICY IF EXISTS "Users can update payments in their organization" ON payments;
DROP POLICY IF EXISTS "Users can delete payments in their organization" ON payments;
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_update" ON payments;
DROP POLICY IF EXISTS "payments_delete" ON payments;
DROP POLICY IF EXISTS "payments_all" ON payments;

DROP POLICY IF EXISTS "Users can view payment applications for their payments" ON payment_applications;
DROP POLICY IF EXISTS "Users can insert payment applications for their payments" ON payment_applications;
DROP POLICY IF EXISTS "Users can update payment applications for their payments" ON payment_applications;
DROP POLICY IF EXISTS "Users can delete payment applications for their payments" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_select" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_insert" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_update" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_delete" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_all" ON payment_applications;

-- 3) Utility function: resolve current org from JWT claims
-- Supports both org_id and orgId claim keys.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'org_id', '')::uuid,
    NULLIF(auth.jwt() ->> 'orgId', '')::uuid
  )
$$;

-- 4) Tight grants: no anon writes
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON payment_applications FROM anon;

GRANT SELECT ON payments TO authenticated;
GRANT SELECT ON payment_applications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON payments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON payment_applications TO authenticated;

-- 5) Payments policies (authenticated only, strict org match)
CREATE POLICY "payments_select_org"
ON payments
FOR SELECT
TO authenticated
USING (
  org_id = public.current_org_id()
  AND is_deleted = false
);

CREATE POLICY "payments_insert_org"
ON payments
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = public.current_org_id()
);

CREATE POLICY "payments_update_org"
ON payments
FOR UPDATE
TO authenticated
USING (
  org_id = public.current_org_id()
)
WITH CHECK (
  org_id = public.current_org_id()
);

CREATE POLICY "payments_delete_org"
ON payments
FOR DELETE
TO authenticated
USING (
  org_id = public.current_org_id()
);

-- 6) Payment applications policies
-- Valid only when both payment and invoice belong to caller org.
CREATE POLICY "payment_applications_select_org"
ON payment_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = public.current_org_id()
      AND p.is_deleted = false
  )
);

CREATE POLICY "payment_applications_insert_org"
ON payment_applications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM payments p
    JOIN invoices i ON i.id = payment_applications.invoice_id
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = public.current_org_id()
      AND i.org_id = public.current_org_id()
      AND p.is_deleted = false
      AND COALESCE(i.is_deleted, false) = false
  )
);

CREATE POLICY "payment_applications_update_org"
ON payment_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = public.current_org_id()
      AND p.is_deleted = false
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM payments p
    JOIN invoices i ON i.id = payment_applications.invoice_id
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = public.current_org_id()
      AND i.org_id = public.current_org_id()
      AND p.is_deleted = false
      AND COALESCE(i.is_deleted, false) = false
  )
);

CREATE POLICY "payment_applications_delete_org"
ON payment_applications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.id = payment_applications.payment_id
      AND p.org_id = public.current_org_id()
      AND p.is_deleted = false
  )
);

-- 7) Quick verification
-- SELECT policyname, tablename, roles, cmd FROM pg_policies
-- WHERE tablename IN ('payments', 'payment_applications')
-- ORDER BY tablename, policyname;
