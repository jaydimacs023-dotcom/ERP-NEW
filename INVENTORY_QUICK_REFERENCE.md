# Inventory System - Quick Reference Guide

## System Status: ✅ PHASE 1 COMPLETE

### Files Modified/Created
```
✅ types.ts - 6 new inventory entities + 2 enums
✅ INVENTORY_TABLES.sql - 6 tables, RLS, views, indexes (272 lines)
✅ services/IDataService.ts - 28 inventory method signatures
✅ services/InventoryService.ts - 20+ utility functions (350+ lines)
✅ services/MockDataService.ts - 36 inventory CRUD methods
✅ services/SupabaseDataService.ts - 28 REST API implementations
```

---

## Key Entities

### 1. WarehouseLocation
```typescript
{
  id: string (UUID)
  orgId: string
  code: string (unique per org)
  name: string
  address: string
  isActive: boolean
}
```

### 2. StockItem
```typescript
{
  id: string
  orgId: string
  code: string (unique per org)
  name: string
  unitPrice: number
  costPrice: number
  warehouseLocationId: string
  incomeAccountId: string (GL)
  cogsAccountId: string (GL)
  expenseAccountId: string (GL)
  taxCategoryId: string
  valuationMethod: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE' | 'STANDARD_COST'
  minStockLevel: number
  maxStockLevel: number
  reorderQuantity: number
}
```

### 3. InventoryLevel
```typescript
{
  id: string
  orgId: string
  stockItemId: string
  warehouseLocationId: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number (calculated)
  lastCounted: Date
}
```

### 4. InventoryTransaction
```typescript
{
  id: string
  orgId: string
  referenceNumber: string (auto-generated)
  stockItemId: string
  transactionType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'DAMAGE' | 'WRITEOFF'
  fromLocationId: string
  toLocationId: string
  quantity: number
  unitCost: number
  totalCost: number
  journalEntryId: string
}
```

### 5. StockAdjustment
```typescript
{
  id: string
  orgId: string
  adjustmentNumber: string (auto-generated)
  stockItemId: string
  warehouseLocationId: string
  quantityChange: number (positive or negative)
  reason: string
  approvedBy: string
  approvalDate: Date
  journalEntryId: string
}
```

### 6. ReorderPoint
```typescript
{
  id: string
  orgId: string
  stockItemId: string
  minLevel: number
  maxLevel: number
  reorderQuantity: number
  leadTimeDays: number
  lastReorderDate: Date
}
```

---

## Service Methods (28 Total)

### WarehouseLocation CRUD (5)
```typescript
createWarehouseLocation(location: WarehouseLocation): Promise<WarehouseLocation>
updateWarehouseLocation(id: string, updates: Partial<WarehouseLocation>): Promise<WarehouseLocation>
deleteWarehouseLocation(id: string): Promise<void>
getWarehouseLocationsByOrg(orgId: string): Promise<WarehouseLocation[]>
getWarehouseLocationById(id: string): Promise<WarehouseLocation | null>
```

### StockItem CRUD (6)
```typescript
createStockItem(item: StockItem): Promise<StockItem>
updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem>
deleteStockItem(id: string): Promise<void>
getStockItemsByOrg(orgId: string): Promise<StockItem[]>
getStockItemById(id: string): Promise<StockItem | null>
getStockItemsByLocation(orgId: string, locationId: string): Promise<StockItem[]>
```

### InventoryLevel CRUD (6)
```typescript
createInventoryLevel(level: InventoryLevel): Promise<InventoryLevel>
updateInventoryLevel(id: string, updates: Partial<InventoryLevel>): Promise<InventoryLevel>
deleteInventoryLevel(id: string): Promise<void>
getInventoryLevelsByOrg(orgId: string): Promise<InventoryLevel[]>
getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<InventoryLevel | null>
getStockStatusView(orgId: string): Promise<any[]>
```

### InventoryTransaction CRUD (6)
```typescript
createInventoryTransaction(transaction: InventoryTransaction): Promise<InventoryTransaction>
updateInventoryTransaction(id: string, updates: Partial<InventoryTransaction>): Promise<InventoryTransaction>
deleteInventoryTransaction(id: string): Promise<void>
getInventoryTransactionsByOrg(orgId: string): Promise<InventoryTransaction[]>
getInventoryTransactionById(id: string): Promise<InventoryTransaction | null>
getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<InventoryTransaction[]>
```

### StockAdjustment CRUD (6)
```typescript
createStockAdjustment(adjustment: StockAdjustment): Promise<StockAdjustment>
updateStockAdjustment(id: string, updates: Partial<StockAdjustment>): Promise<StockAdjustment>
deleteStockAdjustment(id: string): Promise<void>
getStockAdjustmentsByOrg(orgId: string): Promise<StockAdjustment[]>
getStockAdjustmentById(id: string): Promise<StockAdjustment | null>
getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<StockAdjustment[]>
```

### ReorderPoint CRUD (6)
```typescript
createReorderPoint(reorder: ReorderPoint): Promise<ReorderPoint>
updateReorderPoint(id: string, updates: Partial<ReorderPoint>): Promise<ReorderPoint>
deleteReorderPoint(id: string): Promise<void>
getReorderPointsByOrg(orgId: string): Promise<ReorderPoint[]>
getReorderPointByItem(orgId: string, stockItemId: string): Promise<ReorderPoint | null>
getItemsNeedingReorder(orgId: string): Promise<StockItem[]>
```

---

## InventoryService Utility Methods

### Calculations
```typescript
// Available quantity
getAvailableQuantity(level: InventoryLevel): number
// Returns: on_hand - reserved

// Weighted average cost
calculateWeightedAverageCost(transactions: InventoryTransaction[]): number
// Returns: Total value / Total quantity

// Stock value
calculateStockValue(qty, unitCost, method): number
// Returns: qty * cost adjusted by valuation method

// COGS breakdown
calculateCOGS(qty, salePrice, unitCost): { cogsAmount, revenueAmount, profitAmount }

// EOQ formula
calculateEOQ(demand, orderCost, holdingCost): number
// Returns: Optimal order quantity

// Holding cost
calculateHoldingCost(quantity, unitCost, annualRate): number
```

### Stock Status
```typescript
isLowStock(level, item): boolean
isOverstocked(level, item): boolean
calculateReorderQuantity(current, max, min): number
getStockStatusBadge(available, min, max): { status, color, icon }
```

### Validation
```typescript
validateStockMovement(qty, available, type): { isValid, error? }
validateAdjustment(adjustment, currentLevel): { isValid, errors[] }
```

### Reference Numbers
```typescript
generateTransactionReference(type): string
// Format: "INV-2026-01-0001"

generateAdjustmentReference(): string
// Format: "ADJ-2026-01-0001"
```

---

## Database Tables

| Table | Purpose | Rows | Keys |
|-------|---------|------|------|
| warehouse_locations | Physical locations | 20 | org_id, code |
| stock_items | Item master | 25 | org_id, code |
| inventory_levels | Current quantities | 17 | org_id, item_id, location_id |
| inventory_transactions | Movement history | 20 | org_id, ref_number |
| stock_adjustments | Variances | 19 | org_id, adjustment_number |
| reorder_points | Min/max levels | 16 | org_id, stock_item_id |

---

## Database Views

### v_inventory_status
```sql
SELECT
  code, name, location, quantity_on_hand, quantity_available,
  min_stock_level, max_stock_level,
  stock_status ('URGENT_REORDER' | 'LOW_STOCK' | 'NORMAL' | 'OVERSTOCKED'),
  last_counted
FROM inventory_levels
```

### v_inventory_transactions_summary
```sql
SELECT
  reference_number, transaction_type, total_quantity, total_value, created_at
FROM inventory_transactions
GROUP BY reference_number, transaction_type
```

---

## Usage Examples

### Create Stock Item
```typescript
const stockItem = await dataService.createStockItem({
  orgId: 'org-123',
  code: 'WIDGET-001',
  name: 'Blue Widget',
  unitPrice: 25.00,
  costPrice: 15.00,
  warehouseLocationId: 'loc-main',
  valuationMethod: 'FIFO',
  minStockLevel: 50,
  maxStockLevel: 200,
  reorderQuantity: 100
});
```

### Record Purchase
```typescript
const transaction = await dataService.createInventoryTransaction({
  orgId: 'org-123',
  referenceNumber: InventoryService.generateTransactionReference('PURCHASE'),
  stockItemId: 'item-123',
  transactionType: 'PURCHASE',
  toLocationId: 'loc-main',
  quantity: 100,
  unitCost: 15.00,
  totalCost: 1500.00
});
```

### Get Low Stock Items
```typescript
const status = await dataService.getStockStatusView('org-123');
const lowStock = status.filter(s => s.stock_status === 'URGENT_REORDER');
```

### Check Availability
```typescript
const level = await dataService.getInventoryLevelByItemAndLocation(
  'org-123', 'item-123', 'loc-main'
);
const available = InventoryService.getAvailableQuantity(level);
```

---

## Valuation Methods

### FIFO (First In, First Out)
- Oldest purchase costs used first
- Rising inflation → Higher COGS → Lower profits (conservative)
- Best for: Perishables, trending costs

### LIFO (Last In, First Out)
- Newest purchase costs used first
- Rising inflation → Lower COGS → Higher profits (aggressive)
- Tax advantage in inflation
- Illegal in many countries (IFRS)

### WEIGHTED_AVERAGE
- Average cost per unit across all purchases
- Smooths out price volatility
- Easier to calculate
- Best for: Standard accounting

### STANDARD_COST
- Predefined cost per unit
- Used for variance analysis
- Manufacturing standard costs
- Best for: Budget control

---

## Transaction Types

| Type | From | To | Purpose |
|------|------|----|---------| 
| PURCHASE | Vendor | Warehouse | Receiving goods |
| SALE | Warehouse | Customer | Selling goods |
| TRANSFER | Warehouse A | Warehouse B | Moving stock |
| ADJUSTMENT | Manual | Location | Count variance |
| RETURN | Warehouse | Vendor | Returning goods |
| DAMAGE | Warehouse | Loss | Damaged/spoiled |
| WRITEOFF | Warehouse | Loss | Obsolete items |

---

## RLS Security

All 6 inventory tables have RLS policies:

```sql
-- SELECT: User can only see their org's data
org_id IN (SELECT org_id FROM users WHERE id = auth.uid())

-- INSERT/UPDATE/DELETE: Same validation
org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
```

---

## Performance Indexes

```sql
-- Warehouse Locations
idx_warehouse_locations_org(org_id, is_active)
idx_warehouse_locations_code(org_id, code)

-- Stock Items
idx_stock_items_org(org_id, is_deleted)
idx_stock_items_code(org_id, code)
idx_stock_items_location(org_id, warehouse_location_id)

-- Inventory Levels
idx_inventory_levels_org(org_id, stock_item_id)
idx_inventory_levels_location(org_id, warehouse_location_id)
idx_inventory_levels_low_stock(org_id) WHERE quantity_on_hand < 100

-- Transactions
idx_inventory_transactions_org(org_id, created_at DESC)
idx_inventory_transactions_item(org_id, stock_item_id)
idx_inventory_transactions_type(org_id, transaction_type)
idx_inventory_transactions_location(org_id, to_location_id)

-- Adjustments
idx_stock_adjustments_org(org_id, created_at DESC)
idx_stock_adjustments_item(org_id, stock_item_id)
idx_stock_adjustments_reason(org_id, reason)

-- Reorder Points
idx_reorder_points_org(org_id)
idx_reorder_points_needs_reorder(org_id) WHERE last_reorder_date IS NULL
```

---

## Next Steps

### Phase 2: UI Views
1. Create `views/WarehouseLocationsView.tsx`
2. Create `views/StockItemsView.tsx`
3. Create `views/InventoryView.tsx` (Dashboard)
4. Create `views/StockAdjustmentsView.tsx`
5. Create `views/ReorderView.tsx`

### Phase 3: App Integration
1. Add state management for inventory
2. Create CRUD callbacks
3. Wire navigation
4. Connect service calls

### Phase 4: Optional
- GL integration
- Barcode support
- Batch import
- Advanced reports

---

## Troubleshooting

### "Table not found" error
- Check SQL migration ran on Supabase
- Verify table name snake_case
- Check RLS policy allows access

### Case conversion issues
- Check `camelToSnake()` conversion
- Log payload before POST
- Verify column names in schema

### Low stock not showing
- Check min_stock_level on item
- Verify v_inventory_status query
- Compare quantity_on_hand vs min level

### Org isolation not working
- Verify RLS policies enabled
- Check user has org_id in users table
- Test with SQL directly: `SELECT * FROM stock_items WHERE org_id = auth.user_id()`

---

## Key Differences: NonStockItem vs StockItem

| Aspect | NonStockItem (Service) | StockItem (Physical) |
|--------|------------------------|----------------------|
| **Purpose** | Services, Training | Physical Goods |
| **Inventory Tracking** | None | Full tracking |
| **Locations** | N/A | Multiple locations |
| **Valuation** | N/A | FIFO/LIFO/WAC/STD |
| **Min/Max Levels** | N/A | Yes |
| **GL Accounts** | Income only | Income + COGS + Expense |
| **Transactions** | None | PURCHASE, SALE, etc. |
| **Reorder Management** | N/A | Min/Max automation |

---

## System Architecture

```
React UI Component
       ↓
App.tsx State Management
       ↓
Service Layer (IDataService)
       ↓
    ┌──────────┬────────────┬──────────────┐
    ↓          ↓            ↓              ↓
MockService Supabase   InventoryService  (Others)
            Service    (Utilities)
    ↓          ↓            
  Memory   REST API    
           /rest/v1/
           
           ↓
    Supabase PostgreSQL
    (6 Tables + RLS + Views)
```

---

## Database Migration Command

To deploy the inventory schema:

```bash
# 1. Copy INVENTORY_TABLES.sql content
# 2. In Supabase Dashboard → SQL Editor
# 3. Paste and run the entire file
# 4. Verify all 6 tables created
# 5. Check RLS policies enabled
# 6. Test sample data inserted
```

---

## Verification Checklist

- [ ] All 6 table structures match schema
- [ ] RLS policies enabled on all tables
- [ ] 15+ indexes created
- [ ] Sample warehouse location exists
- [ ] No TypeScript compilation errors
- [ ] SupabaseDataService methods return data
- [ ] Case conversion working (camelCase ↔ snake_case)
- [ ] Mock service stubs functional
- [ ] InventoryService calculations correct
- [ ] Organization isolation working (RLS)

---

**Status**: ✅ Core system complete, ready for UI development
