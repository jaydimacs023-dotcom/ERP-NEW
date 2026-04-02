-- ============================================================================
-- FIX_PAYMENTS_STATUS_CONSTRAINT.sql
-- Purpose:
--   Update the payments status check constraint so payment approval can store
--   OPEN, which is the current application status used in App.tsx.
--
-- Notes:
--   - Keeps POSTED and VOIDED allowed for existing workflows.
--   - Keeps CLOSED allowed because the app already reads that state.
--   - Safe to run multiple times in Supabase SQL editor.
-- ============================================================================

ALTER TABLE IF EXISTS payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE IF EXISTS payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('DRAFT', 'OPEN', 'POSTED', 'CLOSED', 'VOIDED'));
