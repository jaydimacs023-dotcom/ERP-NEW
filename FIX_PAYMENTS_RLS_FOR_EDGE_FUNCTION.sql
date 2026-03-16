-- ============================================================================
-- FIX_PAYMENTS_RLS_FOR_EDGE_FUNCTION.sql
-- Purpose:
--   Allow the payments-write edge function (using service role) to insert/update
--   payments while maintaining org-scoped isolation for regular authenticated users.
--
-- The issue:
--   - After FIX_PAYMENTS_RLS_SECURE.sql, RLS policies are TIGHT (authenticated only)
--   - Edge functions using service role key can bypass RLS, BUT if the policy
--     checks auth.jwt() claims and service_role doesn't carry org claims, it fails
--   - Solution: Add explicit policies that allow service_role full access
-- ============================================================================

-- 1) Allow service_role to insert/update/delete payments (bypasses org check)
--    This is safe because the edge function itself validates org_id server-side
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "payments_insert_service_role" ON payments;
DROP POLICY IF EXISTS "payments_update_service_role" ON payments;
DROP POLICY IF EXISTS "payments_delete_service_role" ON payments;

-- Create service_role bypass policies
-- Note: Service role is trusted; org isolation is enforced in edge function code
CREATE POLICY "payments_insert_service_role"
ON payments
FOR INSERT
TO service_role
WITH CHECK (true);  -- Service role bypasses org check; edge function validates

CREATE POLICY "payments_update_service_role"
ON payments
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "payments_delete_service_role"
ON payments
FOR DELETE
TO service_role
USING (true);

-- 2) Ensure payment_applications also allows service_role writes
ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_applications_insert_service_role" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_update_service_role" ON payment_applications;
DROP POLICY IF EXISTS "payment_applications_delete_service_role" ON payment_applications;

CREATE POLICY "payment_applications_insert_service_role"
ON payment_applications
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "payment_applications_update_service_role"
ON payment_applications
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "payment_applications_delete_service_role"
ON payment_applications
FOR DELETE
TO service_role
USING (true);

-- 3) Verify grants for service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_applications TO service_role;

-- 4) Optional: Add a trusting policy that allows reads via service_role
--    (if the edge function needs to fetch payment records)
DROP POLICY IF EXISTS "payments_select_service_role" ON payments;
CREATE POLICY "payments_select_service_role"
ON payments
FOR SELECT
TO service_role
USING (true);

DROP POLICY IF EXISTS "payment_applications_select_service_role" ON payment_applications;
CREATE POLICY "payment_applications_select_service_role"
ON payment_applications
FOR SELECT
TO service_role
USING (true);

-- ============================================================================
-- Summary:
--   Existing authenticated policies stay in place for app users.
--   New service_role policies allow edge function full access (org validated in code).
-- ============================================================================
