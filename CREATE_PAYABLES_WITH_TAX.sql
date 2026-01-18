-- CREATE_PAYABLES_WITH_TAX.sql
-- Multi-tenant vendor tax configuration + payables with withholding fields
-- Safe to run multiple times (IF NOT EXISTS guards); adjust as needed per environment

BEGIN;

-- 1) Extend global ATC rates to include withholding type and effective period
ALTER TABLE atc_rates
  ADD COLUMN IF NOT EXISTS withholding_type VARCHAR(20) NOT NULL
    CHECK (withholding_type IN ('EXPANDED','FINAL'));
ALTER TABLE atc_rates
  ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE atc_rates
  ADD COLUMN IF NOT EXISTS expiry_date DATE;
-- Ensure uniqueness by item/type/effective start date
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_atc_rate_period'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_atc_rate_period ON atc_rates (atc_item_id, withholding_type, effective_date)';
  END IF;
END $$;

-- 2) Tenant-owned vendors: add taxpayer fields if missing
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS taxpayer_type VARCHAR(20)
    CHECK (taxpayer_type IN ('INDIVIDUAL','CORPORATE'));
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional helpful indexes
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(org_id, is_deleted);

-- 3) Tenant-owned vendor tax settings (one active per vendor per org)
CREATE TABLE IF NOT EXISTS vendor_tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  atc_item_id UUID REFERENCES atc_items(id),
  atc_rate_id UUID REFERENCES atc_rates(id),
  withholding_type VARCHAR(20) CHECK (withholding_type IN ('EXPANDED','FINAL')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- One active tax setting per vendor per org (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_tax_active
  ON vendor_tax_settings(org_id, vendor_id)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_vendor_tax_by_item
  ON vendor_tax_settings(atc_item_id, withholding_type);

-- 4) Tenant-owned payables/bills with withholding storage
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  ref_no VARCHAR(50),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency VARCHAR(10),
  gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Withholding snapshot fields (persisted at posting time)
  withholding_type VARCHAR(20) CHECK (withholding_type IN ('EXPANDED','FINAL')),
  atc_item_id UUID REFERENCES atc_items(id),
  atc_rate_id UUID REFERENCES atc_rates(id),
  applied_rate_percent NUMERIC(7,4) CHECK (applied_rate_percent >= 0),
  withholding_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_payables_org ON payables(org_id);
CREATE INDEX IF NOT EXISTS idx_payables_vendor ON payables(org_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_payables_withholding ON payables(org_id, withholding_type, atc_item_id);

-- 5) Reporting view: monthly withholding summary per org + ATC
CREATE OR REPLACE VIEW withholding_summary AS
SELECT
  p.org_id,
  p.withholding_type,
  p.atc_item_id,
  DATE_TRUNC('month', p.bill_date) AS period_month,
  COUNT(*) AS tx_count,
  SUM(p.gross_amount) AS gross_total,
  SUM(p.withholding_amount) AS withheld_total
FROM payables p
WHERE p.is_deleted = FALSE
GROUP BY p.org_id, p.withholding_type, p.atc_item_id, DATE_TRUNC('month', p.bill_date);

COMMIT;

-- 6) Sample data (adjust UUIDs/codes to match your global ATC tables)
-- Assume org_id exists and atc_items have codes like 'WI010' (Expanded) and 'WF100' (Final)
-- Replace the SELECTs with concrete UUIDs if preferred.

-- Sample vendors
-- INSERT INTO vendors (org_id, code, name, taxpayer_type, is_taxable)
-- VALUES
--   ('00000000-0000-0000-0000-000000000123', 'V-0001', 'ABC Training Services', 'CORPORATE', TRUE),
--   ('00000000-0000-0000-0000-000000000123', 'V-0002', 'Community Sponsor Foundation', 'CORPORATE', FALSE);

-- Map vendor to Expanded 2307 on WI010 @ 10%
-- INSERT INTO vendor_tax_settings (org_id, vendor_id, atc_item_id, atc_rate_id, withholding_type, is_active, notes)
-- SELECT
--   '00000000-0000-0000-0000-000000000123' AS org_id,
--   v.id AS vendor_id,
--   i.id AS atc_item_id,
--   r.id AS atc_rate_id,
--   'EXPANDED' AS withholding_type,
--   TRUE AS is_active,
--   'Corporate vendor subject to 2307 on professional fees' AS notes
-- FROM vendors v
-- JOIN atc_items i ON i.code = 'WI010'
-- JOIN atc_rates r ON r.atc_item_id = i.id AND r.withholding_type = 'EXPANDED'
-- WHERE v.code = 'V-0001';

-- Sample payable insert (after computing withholding in application)
-- INSERT INTO payables (
--   org_id, vendor_id, ref_no, bill_date, gross_amount,
--   withholding_type, atc_item_id, atc_rate_id,
--   applied_rate_percent, withholding_amount, net_payable
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000123',
--   (SELECT id FROM vendors WHERE code='V-0001'),
--   'BILL-2026-00001', '2026-01-18', 10000.00,
--   'EXPANDED',
--   (SELECT id FROM atc_items WHERE code='WI010'),
--   (SELECT r.id FROM atc_rates r JOIN atc_items i ON r.atc_item_id=i.id AND i.code='WI010' AND r.withholding_type='EXPANDED' ORDER BY r.effective_date DESC LIMIT 1),
--   0.10, 1000.00, 9000.00
-- );
