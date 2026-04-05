-- ADD PAYMENT APPLICATION NUMBERING AND ORG LINKAGE
-- =====================================================

ALTER TABLE payment_applications
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE payment_applications pa
SET org_id = p.org_id
FROM payments p
WHERE p.id = pa.payment_id
  AND pa.org_id IS NULL;

ALTER TABLE payment_applications
  ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE payment_applications
  ADD COLUMN IF NOT EXISTS application_no VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payment_applications_org_id
  ON payment_applications(org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_applications_org_application_no
  ON payment_applications(org_id, application_no)
  WHERE application_no IS NOT NULL;

CREATE OR REPLACE FUNCTION get_next_payment_application_no(
  p_org_id UUID
) RETURNS VARCHAR AS $$
DECLARE
  v_max_seq INT;
  v_year INT;
  v_next_no VARCHAR;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  PERFORM pg_advisory_lock(
    ('x' || SUBSTR(MD5('payapp:' || p_org_id::text), 1, 16))::BIT(64)::BIGINT
  );

  BEGIN
    SELECT MAX(
      (regexp_matches(application_no, '-(\d+)$'))[1]::INT
    ) INTO v_max_seq
    FROM payment_applications
    WHERE org_id = p_org_id
      AND application_no LIKE 'PAYAPP-' || v_year || '-%';

    v_max_seq := COALESCE(v_max_seq, 0) + 1;
    v_next_no := 'PAYAPP-' || v_year || '-' || LPAD(v_max_seq::TEXT, 5, '0');

    RETURN v_next_no;
  FINALLY
    PERFORM pg_advisory_unlock(
      ('x' || SUBSTR(MD5('payapp:' || p_org_id::text), 1, 16))::BIT(64)::BIGINT
    );
  END;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_next_payment_application_no(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_payment_application_no(UUID) TO anon;
