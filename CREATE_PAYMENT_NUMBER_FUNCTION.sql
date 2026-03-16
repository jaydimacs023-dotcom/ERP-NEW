-- =====================================================
-- CREATE PAYMENT NUMBER GENERATION FUNCTION
-- Atomically generates unique payment numbers per organization
-- =====================================================

-- Function to get the next payment number for an organization
-- This uses a sequence-like approach with row-level locking to prevent duplicates
CREATE OR REPLACE FUNCTION get_next_payment_no(
  p_org_id UUID
) RETURNS VARCHAR AS $$
DECLARE
  v_max_seq INT;
  v_year INT;
  v_next_no VARCHAR;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  
  -- Use an advisory lock to prevent race conditions
  -- Lock is keyed on org_id to allow concurrent operations across orgs
  PERFORM pg_advisory_lock(
    ('x' || SUBSTR(MD5(p_org_id::text), 1, 16))::BIT(64)::BIGINT
  );
  
  BEGIN
    -- Find the maximum sequence number for this org and year
    -- Only consider non-deleted payments
    SELECT MAX(
      (regexp_matches(payment_no, '-(\d+)$'))[1]::INT
    ) INTO v_max_seq
    FROM payments
    WHERE org_id = p_org_id
      AND payment_no LIKE 'PAY-' || v_year || '-%'
      AND is_deleted = FALSE;
    
    -- If no previous payment found, start at 1
    v_max_seq := COALESCE(v_max_seq, 0) + 1;
    
    -- Generate the payment number
    v_next_no := 'PAY-' || v_year || '-' || LPAD(v_max_seq::TEXT, 5, '0');
    
    RETURN v_next_no;
  FINALLY
    -- Release the advisory lock
    PERFORM pg_advisory_unlock(
      ('x' || SUBSTR(MD5(p_org_id::text), 1, 16))::BIT(64)::BIGINT
    );
  END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_payment_no(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_payment_no(UUID) TO anon;

-- Test the function (optional - remove in production)
-- SELECT get_next_payment_no('12345678-1234-1234-1234-123456789012');
