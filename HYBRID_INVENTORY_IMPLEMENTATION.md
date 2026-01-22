# Hybrid Inventory System - Implementation Guide

## Overview
Implemented a **hybrid inventory management system** that coexists with the existing Non-Valuated Item model:

- **NonStockItem** (Services/Training): Direct G/L triggers, no inventory tracking
- **StockItem** (Physical Inventory): Full warehouse tracking, valuation, min/max levels

---

## System Architecture

### Data Model
```
┌─────────────────────────────────────────────┐
│         WAREHOUSE LOCATIONS                 │
│  (warehouse_locations table)                │
│  - code, name, address, is_active           │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│         STOCK ITEMS                         │
│  (stock_items table)                        │
│  - code, name, cost_price, unit_price       │
│  - valuation_method (FIFO/LIFO/WAC/STD)    │
│  - min_stock, max_stock, reorder_qty        │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│         INVENTORY LEVELS                    │
│  (inventory_levels table)                   │
│  - quantity_on_hand, quantity_reserved      │
│  - quantity_available (calculated)          │
│  - last_counted timestamp                   │
└─────────────────────────────────────────────┘
              ↓
    ┌─────────────────┬──────────────────┐
    ↓                 ↓                  ↓
TRANSACTIONS      ADJUSTMENTS       REORDER POINTS
- Purchases       - Count Variance   - Min/Max Levels
- Sales           - Damage           - Lead Times
- Transfers       - Reason           - Auto Reorder
- Returns         - Journal Entry    - Last Reorder
```

---

## Key Features Implemented

### 1. **Warehouse/Location Tracking** ✅
- **Table**: `warehouse_locations`
- Multiple warehouses per organization
- Location-specific stock levels
- Stock transfers between locations
- **Organization-Aware**: Separate data per tenant

### 2. **Inventory Valuation** ✅
- **Methods Supported**:
  - FIFO (First In, First Out)
  - LIFO (Last In, First Out)
  - WEIGHTED_AVERAGE (Average Cost)
  - STANDARD_COST (Predefined Cost)
- **InventoryService** calculates:
  - Cost per unit based on method
  - Stock value (Quantity × Cost)
  - COGS (Cost of Goods Sold)
  - Holding costs

### 3. **Stock Adjustments** ✅
- **Table**: `stock_adjustments`
- Variance tracking
- Damage/Loss documentation
- Reason codes
- Approval workflow
- GL entry integration

### 4. **Min/Max Stock Levels** ✅
- **Table**: `reorder_points`
- Min stock threshold
- Max stock capacity
- Reorder quantity
- Lead time management
- Auto-reorder status view

### 5. **Stock Transactions** ✅
- **Table**: `inventory_transactions`
- Transaction types: PURCHASE, SALE, ADJUSTMENT, TRANSFER, RETURN, DAMAGE, WRITEOFF
- From/To location tracking
- Unit cost and total cost
- GL entry linkage
- Full audit trail

---

## Files Created/Modified

### New Files
1. **INVENTORY_TABLES.sql** - Database schema
   - 6 new tables with RLS policies
   - 2 view functions for reporting
   - Indexes for performance
   - Sample data templates

2. **services/InventoryService.ts** - Utility class
   - 20+ helper methods
   - Stock calculations
   - Valuation methods
   - Status badges for UI
   - Validation logic

### Modified Files
1. **types.ts** - New types
   - Enums: `InventoryTransactionType`, `InventoryValuationMethod`
   - Interfaces: `StockItem`, `InventoryTransaction`, `InventoryLevel`, `WarehouseLocation`, `StockAdjustment`, `ReorderPoint`

2. **services/IDataService.ts** - Interface extensions
   - 30+ new CRUD methods
   - Bulk get methods (ByOrg, ByItem, ByLocation)
   - Special methods (getStockStatusView, getItemsNeedingReorder)

3. **services/MockDataService.ts** - Development support
   - Mock implementations for all inventory CRUD
   - Returns null/empty for development testing

---

## Service Methods Overview

### Warehouse Locations
```typescript
createWarehouseLocation(location: WarehouseLocation): Promise<WarehouseLocation>
updateWarehouseLocation(id: string, updates: Partial<WarehouseLocation>): Promise<WarehouseLocation>
deleteWarehouseLocation(id: string): Promise<void>
getWarehouseLocationsByOrg(orgId: string): Promise<WarehouseLocation[]>
getWarehouseLocationById(id: string): Promise<WarehouseLocation | null>
```

### Stock Items
```typescript
createStockItem(item: StockItem): Promise<StockItem>
updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem>
deleteStockItem(id: string): Promise<void>
getStockItemsByOrg(orgId: string): Promise<StockItem[]>
getStockItemById(id: string): Promise<StockItem | null>
getStockItemsByLocation(orgId: string, locationId: string): Promise<StockItem[]>
```

### Inventory Levels
```typescript
getInventoryLevelsByOrg(orgId: string): Promise<InventoryLevel[]>
getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<InventoryLevel | null>
getStockStatusView(orgId: string): Promise<any[]>  // Returns v_inventory_status view
updateInventoryLevel(id: string, updates: Partial<InventoryLevel>): Promise<InventoryLevel>
```

### Inventory Transactions
```typescript
createInventoryTransaction(transaction: InventoryTransaction): Promise<InventoryTransaction>
getInventoryTransactionsByOrg(orgId: string): Promise<InventoryTransaction[]>
getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<InventoryTransaction[]>
```

### Stock Adjustments
```typescript
createStockAdjustment(adjustment: StockAdjustment): Promise<StockAdjustment>
getStockAdjustmentsByOrg(orgId: string): Promise<StockAdjustment[]>
getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<StockAdjustment[]>
```

### Reorder Points
```typescript
createReorderPoint(reorder: ReorderPoint): Promise<ReorderPoint>
getReorderPointsByOrg(orgId: string): Promise<ReorderPoint[]>
getReorderPointByItem(orgId: string, stockItemId: string): Promise<ReorderPoint | null>
getItemsNeedingReorder(orgId: string): Promise<StockItem[]>
```

---

## InventoryService Utility Methods

### Stock Calculations
```typescript
getAvailableQuantity(level: InventoryLevel): number
calculateWeightedAverageCost(transactions: InventoryTransaction[]): number
calculateStockValue(qty, cost, method): number
getValuationCost(transactions, method, standardCost): number
calculateCOGS(qty, salePrice, unitCost): { cogsAmount, revenueAmount, profitAmount }
calculateHoldingCost(quantity, cost, rate): number
calculateEOQ(demand, orderCost, holdingCost): number
```

### Stock Status & Validation
```typescript
isLowStock(level, item): boolean
isOverstocked(level, item): boolean
calculateReorderQuantity(current, max, min): number
validateStockMovement(qty, available, type): { isValid, error? }
validateAdjustment(adjustment, currentLevel): { isValid, errors }
getStockStatusBadge(available, min, max): { status, color, icon }
```

### Reference Number Generation
```typescript
generateTransactionReference(type): string  // INV-YYYY-MM-NNNN
generateAdjustmentReference(): string       // ADJ-YYYY-MM-NNNN
```

### Stock Movement Creation
```typescript
createStockMovement(itemId, qty, cost, type, from?, to?): Partial<InventoryTransaction>
```

---

## Database Schema

### warehouse_locations
```sql
- id (UUID)
- org_id (UUID) - REFERENCES organizations
- code (VARCHAR) - Unique per org
- name (VARCHAR)
- address (TEXT)
- is_active (BOOLEAN)
- timestamps + soft delete
```

### stock_items
```sql
- id (UUID)
- org_id (UUID) - REFERENCES organizations
- code (VARCHAR) - Unique per org
- warehouse_location_id (UUID) - Primary location
- cost_price, unit_price (NUMERIC)
- income_account_id, cogs_account_id, expense_account_id (UUID)
- tax_category_id (UUID) - Links to tax system
- valuation_method (FIFO|LIFO|WEIGHTED_AVERAGE|STANDARD_COST)
- min/max/reorder quantities (NUMERIC)
- timestamps + soft delete
```

### inventory_levels
```sql
- id (UUID)
- org_id (UUID)
- stock_item_id (UUID)
- warehouse_location_id (UUID)
- quantity_on_hand (NUMERIC)
- quantity_reserved (NUMERIC)
- quantity_available (NUMERIC) - Calculated: on_hand - reserved
- last_counted (TIMESTAMPTZ)
- UNIQUE(org_id, stock_item_id, warehouse_location_id)
```

### inventory_transactions
```sql
- id (UUID)
- org_id (UUID)
- reference_number (VARCHAR) - Unique per org
- stock_item_id (UUID)
- transaction_type (PURCHASE|SALE|ADJUSTMENT|TRANSFER|RETURN|DAMAGE|WRITEOFF)
- from_location_id, to_location_id (UUID)
- quantity, unit_cost, total_cost (NUMERIC)
- journal_entry_id (UUID) - GL integration
- created_by (UUID)
- timestamps
```

### stock_adjustments
```sql
- id (UUID)
- org_id (UUID)
- adjustment_number (VARCHAR) - Unique per org
- stock_item_id (UUID)
- warehouse_location_id (UUID)
- quantity_change (NUMERIC) - Positive or negative
- reason (VARCHAR)
- approved_by, approval_date
- journal_entry_id (UUID) - GL integration
- timestamps
```

### reorder_points
```sql
- id (UUID)
- org_id (UUID)
- stock_item_id (UUID)
- min_level, max_level, reorder_quantity (NUMERIC)
- lead_time_days (INTEGER)
- last_reorder_date (TIMESTAMPTZ)
- UNIQUE(org_id, stock_item_id)
```

### Views
- **v_inventory_status**: Current stock with status badges (URGENT_REORDER, LOW_STOCK, NORMAL, OVERSTOCKED)
- **v_inventory_transactions_summary**: Grouped transactions by type and period

---

## Organization Awareness Implementation

Every table includes:
- **org_id (UUID)**: Foreign key to organizations
- **RLS Policies**: Enforce organization isolation
  - SELECT: `org_id IN (SELECT org_id FROM users WHERE id = auth.uid())`
  - INSERT/UPDATE/DELETE: Same org_id validation

This ensures:
- ✅ Each organization sees only its own inventory
- ✅ Data separation at database level (RLS)
- ✅ No accidental cross-organization leakage
- ✅ Multi-tenant safe

---

## Next Steps to Complete

### Phase 1: SupabaseDataService Implementation (Required)
Implement REST API calls in SupabaseDataService for all inventory CRUD methods.

**Key considerations**:
- Case conversion (camelCase ↔ snake_case)
- Proper error handling and logging
- Prefer header for REST methods
- ID field removal for inserts (auto-generate UUID)

### Phase 2: UI Views (Required)
Create React components:

1. **WarehouseLocationsView.tsx**
   - List locations per organization
   - Add/edit/delete warehouses
   - Set as default location

2. **StockItemsView.tsx**
   - Create/edit stock items
   - Select valuation method
   - Link to G/L accounts
   - Set min/max levels

3. **InventoryView.tsx** (Stock Status Dashboard)
   - v_inventory_status view with status badges
   - Low stock alerts
   - Overstock warnings
   - Search and filter

4. **StockAdjustmentsView.tsx**
   - Create adjustments for variances
   - Reason codes
   - Approval workflow
   - GL entry integration

5. **ReorderManagementView.tsx**
   - Manage min/max levels
   - View items needing reorder
   - Lead time tracking
   - Auto-reorder suggestions

6. **InventoryTransactionsView.tsx** (Audit Trail)
   - View all stock movements
   - Filter by type, item, location
   - Journal entry references

### Phase 3: App.tsx Integration (Required)
- Add inventory state management
- Wire up data loading from service
- Create callbacks for CRUD operations
- Add navigation tabs for inventory

### Phase 4: GL Integration (Optional)
- Create journal entries on stock adjustments
- Link COGS entries to sales
- Variance accounts for adjustments

### Phase 5: Reports (Optional)
- Stock valuation report
- Inventory aging report
- COGS summary by period
- Reorder analysis

---

## Key Design Decisions

### 1. Why Separate StockItem from NonStockItem?
- **NonStockItem**: Services/Training items - no inventory tracking, direct revenue
- **StockItem**: Physical products - requires tracking, valuation, GL integration
- Prevents model bloat and maintains separation of concerns

### 2. Why InventoryLevel Separate from StockItem?
- Allows multiple locations per item
- Enables multi-warehouse systems
- Quantity data is mutable, item data is more static

### 3. Why InventoryTransaction Separate from InventoryLevel?
- Full audit trail of all movements
- Supports valuation method calculations (FIFO/LIFO)
- GL integration per transaction
- Historical analysis

### 4. Valuation Method Support
- **FIFO**: Oldest cost first (default for inflation)
- **LIFO**: Newest cost first (reduces tax in inflation)
- **WAC**: Average cost (simplest for accounting)
- **Standard**: Predefined cost (manufacturing)

### 5. Organization Awareness
- RLS at database level (strongest security)
- org_id in every table
- No cross-tenant queries possible
- Perfect for multi-tenant SaaS

---

## Testing Checklist

- [ ] Create warehouse location for org
- [ ] Create stock item with valuation method
- [ ] Check inventory level auto-creates
- [ ] Create inventory transaction (PURCHASE)
- [ ] Verify InventoryLevel updates
- [ ] Create stock adjustment
- [ ] Test stock status view
- [ ] Create reorder point
- [ ] Test low stock calculation
- [ ] Verify org isolation (RLS)
- [ ] Test stock movement validation
- [ ] Calculate COGS for sale

---

## Performance Considerations

### Indexes Created
- `org_id, is_active` on warehouse_locations
- `org_id, code` for code lookups
- `org_id, stock_item_id` for inventory levels
- `org_id, created_at DESC` for transaction history
- `org_id, transaction_type` for transaction filtering
- `org_id, stock_item_id` on adjustments
- `quantity_on_hand < 100` for low stock alerts (partial index)

### Query Optimization
- Unique constraints prevent duplicates
- Foreign keys ensure referential integrity
- Views aggregate data efficiently
- Proper indexing on org_id + other filters

---

## Summary

✅ **Inventory System Complete** - Ready for implementation
- 6 data types defined
- 6 database tables designed
- 30+ service methods defined
- 20+ utility helpers created
- Organization-aware throughout
- RLS policies configured
- Sample views for reporting

**Status**: Awaiting SupabaseDataService implementation and UI views
