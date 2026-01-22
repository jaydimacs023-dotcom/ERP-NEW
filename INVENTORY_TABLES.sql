-- INVENTORY_TABLES.sql
-- Hybrid inventory system: NonStockItems (services) + StockItems (physical inventory)
-- Organization-aware for multi-tenancy
-- Supports warehouse tracking, valuation methods, adjustments, and reorder points

-- ============================================================================
-- WAREHOUSE & LOCATION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_org ON warehouse_locations(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_code ON warehouse_locations(org_id, code);

-- ============================================================================
-- STOCK ITEMS (Physical Inventory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit_price NUMERIC(15, 2) DEFAULT 0,
  cost_price NUMERIC(15, 2) DEFAULT 0,
  warehouse_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  income_account_id UUID REFERENCES chart_of_accounts(id),
  cogs_account_id UUID REFERENCES chart_of_accounts(id),
  expense_account_id UUID REFERENCES chart_of_accounts(id),
  tax_category_id UUID REFERENCES atc_categories(id),
  valuation_method VARCHAR(20) DEFAULT 'FIFO' CHECK (valuation_method IN ('FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'STANDARD_COST')),
  min_stock_level NUMERIC(15, 2) DEFAULT 0,
  max_stock_level NUMERIC(15, 2) DEFAULT 0,
  reorder_quantity NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stock_items_org ON stock_items(org_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items(org_id, code);
CREATE INDEX IF NOT EXISTS idx_stock_items_location ON stock_items(org_id, warehouse_location_id);

-- ============================================================================
-- INVENTORY LEVELS (Current Stock Quantities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  warehouse_location_id UUID NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC(15, 4) DEFAULT 0,
  quantity_reserved NUMERIC(15, 4) DEFAULT 0,
  quantity_available NUMERIC(15, 4) DEFAULT 0,  -- on_hand - reserved
  last_counted TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  UNIQUE(org_id, stock_item_id, warehouse_location_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_org ON inventory_levels(org_id, stock_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON inventory_levels(org_id, warehouse_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_low_stock ON inventory_levels(org_id) WHERE quantity_on_hand < 100;

-- ============================================================================
-- INVENTORY TRANSACTIONS (Stock Movements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference_number VARCHAR(100) NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'DAMAGE', 'WRITEOFF')),
  from_location_id UUID REFERENCES warehouse_locations(id),
  to_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  quantity NUMERIC(15, 4) NOT NULL,
  unit_cost NUMERIC(15, 2) NOT NULL,
  total_cost NUMERIC(15, 2) NOT NULL,
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, reference_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_org ON inventory_transactions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(org_id, stock_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(org_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(org_id, to_location_id);

-- ============================================================================
-- STOCK ADJUSTMENTS (Variances, Damage, Corrections)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(100) NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  warehouse_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  quantity_change NUMERIC(15, 4) NOT NULL,  -- Positive or negative
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approval_date TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_org ON stock_adjustments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item ON stock_adjustments(org_id, stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason ON stock_adjustments(org_id, reason);

-- ============================================================================
-- REORDER POINTS (Min/Max Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reorder_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  min_level NUMERIC(15, 4) NOT NULL,
  max_level NUMERIC(15, 4) NOT NULL,
  reorder_quantity NUMERIC(15, 4) NOT NULL,
  lead_time_days INTEGER DEFAULT 7,
  last_reorder_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(org_id, stock_item_id)
);

CREATE INDEX IF NOT EXISTS idx_reorder_points_org ON reorder_points(org_id);
CREATE INDEX IF NOT EXISTS idx_reorder_points_needs_reorder ON reorder_points(org_id) WHERE last_reorder_date IS NULL;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Current stock levels with low stock alerts
CREATE OR REPLACE VIEW v_inventory_status AS
SELECT
  il.org_id,
  si.code,
  si.name,
  wl.name AS location,
  il.quantity_on_hand,
  il.quantity_reserved,
  il.quantity_available,
  si.min_stock_level,
  si.max_stock_level,
  CASE
    WHEN il.quantity_available <= si.min_stock_level THEN 'URGENT_REORDER'
    WHEN il.quantity_available <= (si.min_stock_level * 1.5) THEN 'LOW_STOCK'
    WHEN il.quantity_available > si.max_stock_level THEN 'OVERSTOCKED'
    ELSE 'NORMAL'
  END AS stock_status,
  il.last_counted
FROM inventory_levels il
JOIN stock_items si ON il.stock_item_id = si.id
JOIN warehouse_locations wl ON il.warehouse_location_id = wl.id
WHERE il.is_deleted = FALSE AND si.is_deleted = FALSE;

-- Stock movement history
CREATE OR REPLACE VIEW v_inventory_transactions_summary AS
SELECT
  org_id,
  reference_number,
  transaction_type,
  SUM(quantity) as total_quantity,
  SUM(total_cost) as total_value,
  created_at
FROM inventory_transactions
WHERE is_deleted = FALSE
GROUP BY org_id, reference_number, transaction_type, created_at;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_points ENABLE ROW LEVEL SECURITY;

-- Warehouse Locations RLS
CREATE POLICY warehouse_locations_org_isolation ON warehouse_locations
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY warehouse_locations_update_org ON warehouse_locations
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Stock Items RLS
CREATE POLICY stock_items_org_isolation ON stock_items
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_items_update_org ON stock_items
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Inventory Levels RLS
CREATE POLICY inventory_levels_org_isolation ON inventory_levels
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY inventory_levels_update_org ON inventory_levels
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Inventory Transactions RLS
CREATE POLICY inventory_transactions_org_isolation ON inventory_transactions
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY inventory_transactions_update_org ON inventory_transactions
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Stock Adjustments RLS
CREATE POLICY stock_adjustments_org_isolation ON stock_adjustments
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_adjustments_update_org ON stock_adjustments
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Reorder Points RLS
CREATE POLICY reorder_points_org_isolation ON reorder_points
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY reorder_points_update_org ON reorder_points
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert default warehouse location for seed organizations
INSERT INTO warehouse_locations (org_id, code, name, description, is_active)
SELECT id, 'WH-001', 'Main Warehouse', 'Primary storage location', TRUE
FROM organizations
ON CONFLICT (org_id, code) DO NOTHING;

-- Note: Stock items will be created through the application UI
-- to ensure proper accounting setup and validation
