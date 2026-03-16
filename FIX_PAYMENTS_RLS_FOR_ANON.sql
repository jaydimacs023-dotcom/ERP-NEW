-- ============================================================================
-- FIX_PAYMENTS_RLS_FOR_ANON.sql
-- Purpose:
--   Allow anon role to insert payments during development
--   (Since we can't use authentication tokens yet)
--
--   In production, you should:
--   - Use Supabase Auth JWTs from authenticated users
--   - Or use edge functions with service_role (which has bypass policies)
--   - NOT rely on anon inserts
-- ============================================================================

-- 1) Allow anon inserts to payments (development only)
DROP POLICY IF EXISTS "payments_insert_anon" ON payments;
CREATE POLICY "payments_insert_anon"
ON payments
FOR INSERT
TO anon
WITH CHECK (true);  -- For dev; in production validate org_id matches user

-- 2) Allow anon to read payments they create
DROP POLICY IF EXISTS "payments_select_anon" ON payments;
CREATE POLICY "payments_select_anon"
ON payments
FOR SELECT
TO anon
USING (true);  -- For dev; in production filter by org_id claim

-- 3) Allow anon to update payments
DROP POLICY IF EXISTS "payments_update_anon" ON payments;
CREATE POLICY "payments_update_anon"
ON payments
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 4) Same for payment_applications
DROP POLICY IF EXISTS "payment_applications_insert_anon" ON payment_applications;
CREATE POLICY "payment_applications_insert_anon"
ON payment_applications
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "payment_applications_select_anon" ON payment_applications;
CREATE POLICY "payment_applications_select_anon"
ON payment_applications
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "payment_applications_update_anon" ON payment_applications;
CREATE POLICY "payment_applications_update_anon"
ON payment_applications
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 5) Grant anon access
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_applications TO anon;

-- ============================================================================
-- After implementing proper authentication (Supabase Auth JWTs or custom JWT):
-- 1. Remove these anon policies
-- 2. Keep the authenticated/service_role policies that validate org claims
-- 3. Use edge functions or authenticated clients for all writes
-- ============================================================================
