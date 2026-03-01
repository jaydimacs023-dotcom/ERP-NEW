-- ============================================================================
-- FIX_PAYMENT_APPLICATION_TRIGGER_STATUS.sql
-- Purpose:
--   Fix payment_applications insert failure:
--   "column status is of type invoice_status but expression is of type text"
--
-- Root cause:
--   Trigger function update_invoice_balance_on_application() writes text into
--   invoices.status (enum invoice_status) and/or uses a status value not in enum.
--
-- This patch:
--   1) Replaces trigger function with enum-safe logic
--   2) Uses OPEN/CLOSED status values (matches current app workflow)
--   3) Explicitly casts to invoice_status
-- ============================================================================

CREATE OR REPLACE FUNCTION update_invoice_balance_on_application()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
    v_amount_paid NUMERIC(15,2);
    v_net_amount_due NUMERIC(15,2);
    v_new_status invoice_status;
BEGIN
    -- Recalculate applied amount from non-reversed applications
    SELECT COALESCE(SUM(amount_applied), 0)
    INTO v_amount_paid
    FROM payment_applications
    WHERE invoice_id = v_invoice_id
      AND is_reversed = FALSE;

    -- Fetch invoice net amount due (fallback to grand_total if needed)
    SELECT COALESCE(net_amount_due, grand_total, 0)
    INTO v_net_amount_due
    FROM invoices
    WHERE id = v_invoice_id;

    -- Determine new status using enum-safe values
    IF (v_net_amount_due - v_amount_paid) <= 0 THEN
        v_new_status := 'CLOSED'::invoice_status;
    ELSE
        v_new_status := 'OPEN'::invoice_status;
    END IF;

    -- Apply invoice updates
    UPDATE invoices
    SET
        amount_paid = v_amount_paid,
        balance_due = GREATEST(v_net_amount_due - v_amount_paid, 0),
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and points to the updated function
DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON payment_applications;
CREATE TRIGGER trigger_update_invoice_balance
AFTER INSERT OR UPDATE OR DELETE ON payment_applications
FOR EACH ROW EXECUTE FUNCTION update_invoice_balance_on_application();

-- Optional verification:
-- SELECT tgname, tgfoid::regprocedure
-- FROM pg_trigger
-- WHERE tgname = 'trigger_update_invoice_balance';
