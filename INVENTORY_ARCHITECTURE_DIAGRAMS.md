# Inventory System - Visual Architecture & Data Flow

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         BROWSER / APP                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │               React Component Layer                          │ │
│  │  (Phase 2 - To be built)                                    │ │
│  │                                                              │ │
│  │  StockItemsView    InventoryView    AdjustmentsView        │ │
│  │  ReorderView       TransactionsView WarehouseLocationsView  │ │
│  └───────────────────────────┬──────────────────────────────────┘ │
│                              ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │            App.tsx (State Management)                       │ │
│  │  (Phase 3 - To be integrated)                              │ │
│  │                                                              │ │
│  │  State:                                                      │ │
│  │  - warehouseLocations[]                                     │ │
│  │  - stockItems[]                                             │ │
│  │  - inventoryLevels[]                                        │ │
│  │  - inventoryTransactions[]                                  │ │
│  │  - stockAdjustments[]                                       │ │
│  │  - reorderPoints[]                                          │ │
│  │                                                              │ │
│  │  Callbacks: onCreate, onUpdate, onDelete for each entity    │ │
│  └───────────────────────────┬──────────────────────────────────┘ │
│                              ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │           Service Layer (Phase 1 - COMPLETE ✓)             │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ Data Service Factory (Selects implementation)        │  │ │
│  │  └───────┬──────────────────────┬──────────────────────┘  │ │
│  │          ↓                       ↓                         │ │
│  │  ┌──────────────────┐  ┌─────────────────────────────┐  │ │
│  │  │  MockDataService │  │ SupabaseDataService         │  │ │
│  │  │  (Dev Mode)      │  │ (Production Mode)           │  │ │
│  │  │                  │  │                             │  │ │
│  │  │ - 36 methods     │  │ - 28 REST API methods       │  │ │
│  │  │ - Memory storage │  │ - Case conversion           │  │ │
│  │  │ - No Supabase    │  │ - Error handling            │  │ │
│  │  │ - Test data      │  │ - Org filtering             │  │ │
│  │  └──────────────────┘  └────────┬────────────────────┘  │ │
│  │                                 ↓                         │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ InventoryService (Utility Functions)                │  │ │
│  │  │                                                      │  │ │
│  │  │ - Stock calculations (getAvailableQuantity)         │  │ │
│  │  │ - Valuation (FIFO, LIFO, WAC, Standard)             │  │ │
│  │  │ - Reference generation (generateTransactionRef)     │  │ │
│  │  │ - Validation (validateStockMovement)                │  │ │
│  │  │ - COGS calculations (calculateCOGS)                 │  │ │
│  │  │ - Status helpers (getStockStatusBadge)              │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  IDataService Interface (28 method signatures)              │ │
│  │  ├─ Warehouse Locations (5 methods)                         │ │
│  │  ├─ Stock Items (6 methods)                                 │ │
│  │  ├─ Inventory Levels (6 methods)                            │ │
│  │  ├─ Inventory Transactions (6 methods)                      │ │
│  │  ├─ Stock Adjustments (6 methods)                           │ │
│  │  └─ Reorder Points (6 methods)                              │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│                             ↓                                    │
│          ┌──────────────────────────────────────┐               │
│          │  Case Conversion (camelToSnake)      │               │
│          │  Automatic data transformation       │               │
│          └──────────────────┬───────────────────┘               │
│                             ↓                                    │
│          ┌──────────────────────────────────────┐               │
│          │  REST API Calls /rest/v1/...         │               │
│          │  Supabase HTTP Endpoints             │               │
│          │  Headers: apikey, Authorization      │               │
│          └──────────────────┬───────────────────┘               │
│                             ↓                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                        NETWORK BOUNDARY
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                             ↓                                    │
│          ┌──────────────────────────────────────┐               │
│          │   SUPABASE CLOUD                     │               │
│          │   (PostgreSQL Database)              │               │
│          └──────────────────┬───────────────────┘               │
│                             ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              DATABASE LAYER                             │  │
│  │                                                          │  │
│  │  TABLES (6 total):                                       │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐ │  │
│  │  │warehouse_locations  │  │ stock_items             │ │  │
│  │  │ id, org_id, code,   │  │ id, org_id, code,       │ │  │
│  │  │ name, is_active     │  │ name, cost_price,       │ │  │
│  │  │ RLS Enabled ✓       │  │ valuation_method        │ │  │
│  │  │ Indexes: 2          │  │ RLS Enabled ✓           │ │  │
│  │  └─────────────────────┘  │ Indexes: 3              │ │  │
│  │  ┌──────────────────────┐  │ Foreign keys: 4         │ │  │
│  │  │ inventory_levels     │  └──────────────────────────┘ │  │
│  │  │ org_id, item_id,     │                               │  │
│  │  │ location_id,         │  ┌──────────────────────────┐ │  │
│  │  │ quantity_on_hand,    │  │inventory_transactions   │ │  │
│  │  │ quantity_reserved,   │  │ org_id, reference_no,   │ │  │
│  │  │ quantity_available   │  │ stock_item_id,          │ │  │
│  │  │ RLS Enabled ✓        │  │ transaction_type,       │ │  │
│  │  │ Indexes: 2           │  │ quantity, unit_cost     │ │  │
│  │  └──────────────────────┘  │ RLS Enabled ✓           │ │  │
│  │  ┌──────────────────────┐  │ Indexes: 4              │ │  │
│  │  │ stock_adjustments    │  └──────────────────────────┘ │  │
│  │  │ org_id, adjustment_, │                               │  │
│  │  │ number, item_id,     │  ┌──────────────────────────┐ │  │
│  │  │ quantity_change,     │  │ reorder_points          │ │  │
│  │  │ reason, approval     │  │ org_id, stock_item_id,  │ │  │
│  │  │ RLS Enabled ✓        │  │ min_level, max_level,   │ │  │
│  │  │ Indexes: 3           │  │ lead_time_days          │ │  │
│  │  └──────────────────────┘  │ RLS Enabled ✓           │ │  │
│  │                            │ Indexes: 2              │ │  │
│  │  VIEWS (2 total):          └──────────────────────────┘ │  │
│  │  ├─ v_inventory_status (Dashboard view)                 │  │
│  │  └─ v_inventory_transactions_summary (History view)     │  │
│  │                                                          │  │
│  │  SECURITY:                                              │  │
│  │  ├─ RLS Enabled on all 6 tables                        │  │
│  │  ├─ 12 Policies (2 per table)                          │  │
│  │  ├─ Organization isolation enforced                     │  │
│  │  └─ Zero cross-tenant data leakage                      │  │
│  │                                                          │  │
│  │  PERFORMANCE:                                           │  │
│  │  ├─ 15+ indexes optimized                              │  │
│  │  ├─ Unique constraints on codes/references             │  │
│  │  ├─ Partial indexes on low stock                       │  │
│  │  └─ Foreign key relationships                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Purchase to Inventory Update

```
┌────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                                │
│              (Fill in purchase form)                               │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│                VALIDATION (InventoryService)                       │
│  validateStockMovement(qty, available, 'PURCHASE')                │
│  ✓ Check qty >= 0                                                 │
│  ✓ Check item exists                                              │
│  ✓ Check location exists                                          │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│           REFERENCE GENERATION (InventoryService)                  │
│  referenceNo = generateTransactionReference('PURCHASE')           │
│  Format: "INV-2026-01-0001" or "PUR-2026-01-0002"                 │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│         CREATE INVENTORY TRANSACTION (Service)                      │
│  dataService.createInventoryTransaction({                         │
│    orgId: 'org-123',                                              │
│    referenceNumber: 'INV-2026-01-0001',                           │
│    stockItemId: 'item-456',                                       │
│    transactionType: 'PURCHASE',                                   │
│    toLocationId: 'loc-main',                                      │
│    quantity: 100,                                                 │
│    unitCost: 15.00,                                               │
│    totalCost: 1500.00                                             │
│  })                                                               │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│        SUPABASE REST API: POST /rest/v1/inventory_transactions    │
│  Headers: { apikey, Authorization, Content-Type }                │
│  Body: { org_id, reference_number, stock_item_id, ... }          │
│  (camelToSnake conversion happens here)                           │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│         SUPABASE DATABASE: INSERT into inventory_transactions     │
│  ✓ RLS CHECK: org_id IN (SELECT org_id FROM users WHERE id=...)  │
│  ✓ UNIQUE CHECK: org_id + reference_number                        │
│  ✓ FOREIGN KEY CHECK: stock_item_id exists                        │
│  ✓ FOREIGN KEY CHECK: to_location_id exists                       │
│  ✓ Insert successful, returns record with id                      │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│    RESPONSE: SupabaseDataService (snakeToCamel conversion)        │
│  Returns: {                                                       │
│    id: 'uuid...',                                                │
│    orgId: 'org-123',                                             │
│    referenceNumber: 'INV-2026-01-0001',                          │
│    ... (all snake_case → camelCase)                              │
│  }                                                                │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│          UPDATE INVENTORY LEVEL (Automatic or Manual)              │
│  dataService.updateInventoryLevel(levelId, {                     │
│    quantityOnHand: 100 + currentQty,                             │
│    quantityAvailable: (100 + currentQty) - quantityReserved      │
│  })                                                               │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│              UPDATE UI STATE (App.tsx)                             │
│  setInventoryTransactions([...prev, newTransaction])             │
│  setInventoryLevels([...prev.map(updateLevel)])                  │
└────────────┬───────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────────┐
│              RE-RENDER UI COMPONENTS                               │
│  ✓ InventoryView updated with new stock quantity                 │
│  ✓ TransactionsView shows new purchase                           │
│  ✓ ReorderView recalculates reorder needs                        │
│  ✓ Dashboard shows new stock status                              │
└────────────────────────────────────────────────────────────────────┘
```

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────┐
│      organizations                   │
│  (From existing system)               │
│  id, name, currency, ...             │
└──────────┬───────────────────────────┘
           │
           │ 1:N (org_id)
           │
           ├──────────────────────────────────────────────────┐
           │                                                  │
           ↓                                                  ↓
  ┌───────────────────┐              ┌────────────────────┐
  │warehouse_locations│              │ stock_items        │
  │ id (PK)           │              │ id (PK)            │
  │ org_id (FK)       │              │ org_id (FK)        │
  │ code              │              │ code               │
  │ name              │              │ warehouse_location_│
  │ address           │              │ _id (FK)           │
  │ is_active         │              │ cost_price         │
  │                   │              │ unit_price         │
  │ UNIQUE(org,code)  │              │ income_account_id  │
  │ RLS Enabled       │              │ cogs_account_id    │
  │ Indexes: 2        │              │ expense_account_id │
  │                   │              │ tax_category_id    │
  └──────┬────────────┘              │ valuation_method   │
         │                           │ min_stock_level    │
         │                           │ max_stock_level    │
         │ 1:N (warehouse_location)  │ reorder_quantity   │
         │                           │                    │
         │ UNIQUE(org,code)          │ UNIQUE(org,code)   │
         │ RLS Enabled               │ RLS Enabled        │
         │ Indexes: 3                │
         │                           └────┬─────────────────┘
         │                                │
         │                   1:N (stock_item_id)
         │                                │
         │              ┌─────────────────┴──────────────┐
         │              │                                │
         ↓              ↓                                ↓
    ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐
    │inventory_    │  │stock_          │  │reorder_points        │
    │levels        │  │adjustments     │  │ id (PK)              │
    │ id (PK)      │  │ id (PK)        │  │ org_id (FK)          │
    │ org_id (FK)  │  │ org_id (FK)    │  │ stock_item_id (FK)   │
    │ stock_item_  │  │ adjustment_num │  │ min_level            │
    │ _id (FK)     │  │ stock_item_id  │  │ max_level            │
    │ warehouse_   │  │ (FK)           │  │ reorder_quantity     │
    │ location_id  │  │ warehouse_     │  │ lead_time_days       │
    │ (FK)         │  │ location_id    │  │ last_reorder_date    │
    │ quantity_on_ │  │ (FK)           │  │                      │
    │ hand         │  │ quantity_change│  │ UNIQUE(org,item)     │
    │ quantity_    │  │ reason         │  │ RLS Enabled          │
    │ reserved     │  │ approved_by    │  │ Indexes: 2           │
    │ quantity_    │  │ approval_date  │  │                      │
    │ available    │  │ journal_entry_ │  └──────────────────────┘
    │ last_counted │  │ _id            │
    │              │  │ created_by     │
    │ UNIQUE(org,  │  │                │
    │ item,        │  │ RLS Enabled    │
    │ location)    │  │ Indexes: 3     │
    │ RLS Enabled  │  └────────────────┘
    │ Indexes: 2   │
    └──────┬───────┘
           │
           │ 1:N (stock_item_id)
           │
           └──────────────────────────────┐
                                          │
                                          ↓
                            ┌──────────────────────────────┐
                            │inventory_transactions        │
                            │ id (PK)                      │
                            │ org_id (FK)                  │
                            │ reference_number             │
                            │ stock_item_id (FK)           │
                            │ transaction_type             │
                            │ from_location_id (FK)        │
                            │ to_location_id (FK)          │
                            │ quantity                     │
                            │ unit_cost                    │
                            │ total_cost                   │
                            │ journal_entry_id (FK)        │
                            │ created_by (FK)              │
                            │                              │
                            │ UNIQUE(org,reference_number) │
                            │ RLS Enabled                  │
                            │ Indexes: 4                   │
                            └──────────────────────────────┘
```

---

## Service Method Organization

```
IDataService Interface
│
├─ Warehouse Location Methods (5)
│  ├─ createWarehouseLocation(location)
│  ├─ updateWarehouseLocation(id, updates)
│  ├─ deleteWarehouseLocation(id)
│  ├─ getWarehouseLocationsByOrg(orgId)
│  └─ getWarehouseLocationById(id)
│
├─ Stock Item Methods (6)
│  ├─ createStockItem(item)
│  ├─ updateStockItem(id, updates)
│  ├─ deleteStockItem(id)
│  ├─ getStockItemsByOrg(orgId)
│  ├─ getStockItemById(id)
│  └─ getStockItemsByLocation(orgId, locationId)
│
├─ Inventory Level Methods (6)
│  ├─ createInventoryLevel(level)
│  ├─ updateInventoryLevel(id, updates)
│  ├─ deleteInventoryLevel(id)
│  ├─ getInventoryLevelsByOrg(orgId)
│  ├─ getInventoryLevelByItemAndLocation(orgId, itemId, locationId)
│  └─ getStockStatusView(orgId)  ← Returns v_inventory_status
│
├─ Inventory Transaction Methods (6)
│  ├─ createInventoryTransaction(transaction)
│  ├─ updateInventoryTransaction(id, updates)
│  ├─ deleteInventoryTransaction(id)
│  ├─ getInventoryTransactionsByOrg(orgId)
│  ├─ getInventoryTransactionById(id)
│  └─ getInventoryTransactionsByItem(orgId, itemId)
│
├─ Stock Adjustment Methods (6)
│  ├─ createStockAdjustment(adjustment)
│  ├─ updateStockAdjustment(id, updates)
│  ├─ deleteStockAdjustment(id)
│  ├─ getStockAdjustmentsByOrg(orgId)
│  ├─ getStockAdjustmentById(id)
│  └─ getStockAdjustmentsByItem(orgId, itemId)
│
└─ Reorder Point Methods (6)
   ├─ createReorderPoint(reorder)
   ├─ updateReorderPoint(id, updates)
   ├─ deleteReorderPoint(id)
   ├─ getReorderPointsByOrg(orgId)
   ├─ getReorderPointByItem(orgId, itemId)
   └─ getItemsNeedingReorder(orgId)
```

---

## Valuation Methods Flowchart

```
                      Purchase Item
                           ↓
        ┌─────────────────────────────────┐
        │ Select Valuation Method          │
        │ (Set on StockItem creation)      │
        └─────────────────────────────────┘
                           ↓
        ┌──────────────┬──────────────┬────────────────┬─────────┐
        ↓              ↓              ↓                ↓         ↓
     FIFO          LIFO          WEIGHTED_AVERAGE  STANDARD   Custom
                                                    _COST
        │              │              │                │
        │              │              │                │
        ↓              ↓              ↓                ↓
    Oldest       Newest        Average Cost      Predefined
    Cost First   Cost First     per Unit          Cost per Unit
        │              │              │                │
        ↓              ↓              ↓                ↓
    sum(oldest × ×sum(newest× ×sum(qty×         ×qty×
    qty first)    qty first)  avg_cost)        std_cost)
        │              │              │                │
        ↓              ↓              ↓                ↓
    Total Cost    Total Cost    Total Cost        Total Cost
        │              │              │                │
        ├──────────────┼──────────────┼────────────────┤
        │              │              │                │
        └──────────────┬──────────────┬────────────────┘
                       ↓
        ┌─────────────────────────────────┐
        │ Store in InventoryTransaction   │
        │ .unit_cost = calculated cost    │
        │ .total_cost = qty × unit_cost   │
        └─────────────────────────────────┘
                       ↓
        ┌─────────────────────────────────┐
        │ On Sale (Reverse the flow)      │
        │ Calculate COGS using same method│
        │ Create GL journal entry         │
        │ Update revenue/COGS accounts    │
        └─────────────────────────────────┘
```

---

## Organization Isolation (RLS) Diagram

```
Database Layer
│
├─ User: alice@org1.com (org_id = 'ORG-001')
│  │
│  └─ Query: SELECT * FROM stock_items
│     │
│     RLS Policy Check:
│     org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
│     │
│     ├─ Result: User can see records where org_id = 'ORG-001'
│     ├─ User sees: Stock items from ORG-001 only
│     └─ User blocked: Stock items from ORG-002, ORG-003, etc.
│
├─ User: bob@org2.com (org_id = 'ORG-002')
│  │
│  └─ Query: SELECT * FROM stock_items
│     │
│     RLS Policy Check:
│     org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
│     │
│     ├─ Result: User can see records where org_id = 'ORG-002'
│     ├─ User sees: Stock items from ORG-002 only
│     └─ User blocked: Stock items from ORG-001, ORG-003, etc.
│
└─ Malicious Query: SELECT * FROM stock_items WHERE org_id = 'ORG-001'
   │
   (Even with org filter in WHERE clause, RLS still applies)
   │
   RLS Policy Check:
   org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
   │
   ├─ If user is bob@org2.com (org_id = 'ORG-002')
   └─ Result: 0 rows returned (RLS prevents cross-tenant access)
```

---

## Stock Status Badge States

```
Quantity Available vs Stock Levels
│
├─ available <= min_level
│  │
│  ├─ Status: URGENT_REORDER
│  ├─ Badge: 🔴 RED
│  ├─ Action: Immediate reorder needed
│  └─ Trigger: Alert email to purchasing
│
├─ min_level < available <= (min_level × 1.5)
│  │
│  ├─ Status: LOW_STOCK
│  ├─ Badge: 🟡 YELLOW
│  ├─ Action: Schedule reorder
│  └─ Trigger: Dashboard warning
│
├─ (min_level × 1.5) < available <= max_level
│  │
│  ├─ Status: NORMAL
│  ├─ Badge: 🟢 GREEN
│  ├─ Action: Normal operations
│  └─ Trigger: No action needed
│
└─ available > max_level
   │
   ├─ Status: OVERSTOCKED
   ├─ Badge: 🔵 BLUE
   ├─ Action: Review for slow-moving items
   └─ Trigger: Reduce purchase orders
```

---

## Case Conversion Example

```
App Layer (TypeScript - camelCase)
│
│ Object:
│ {
│   stockItemId: 'item-123',
│   transactionType: 'PURCHASE',
│   quantityOnHand: 100,
│   quantityReserved: 20,
│   isActive: true
│ }
│
├─ camelToSnake() conversion
│
↓
│
│ SQL INSERT statement:
│ {
│   stock_item_id: 'item-123',
│   transaction_type: 'PURCHASE',
│   quantity_on_hand: 100,
│   quantity_reserved: 20,
│   is_active: true
│ }
│
├─ POST to /rest/v1/stock_items
│
↓
│
│ Supabase PostgreSQL
│ INSERT INTO stock_items (stock_item_id, transaction_type, ...)
│
├─ SELECT response (snake_case)
│
↓
│
│ snakeToCamel() conversion
│
↓
│
│ Response to App:
│ {
│   stockItemId: 'item-123',
│   transactionType: 'PURCHASE',
│   quantityOnHand: 100,
│   quantityReserved: 20,
│   isActive: true,
│   id: 'uuid-123'  ← Added by database
│ }
│
└─ Ready for React component rendering
```

---

## Implementation Timeline

```
PHASE 1: BACKEND INFRASTRUCTURE (✓ COMPLETE)
├─ Day 1: Design & Schema
│  ├─ Create types.ts (6 entities + 2 enums)
│  ├─ Design INVENTORY_TABLES.sql
│  ├─ Extend IDataService interface
│  └─ Create InventoryService utility
│
├─ Day 2: Service Implementations
│  ├─ Implement MockDataService (36 methods)
│  ├─ Implement SupabaseDataService (28 REST methods)
│  └─ Update getInitialData() for inventory
│
└─ Status: ✅ COMPLETE (5 of 8 tasks)

PHASE 2: UI DEVELOPMENT (→ NEXT)
├─ Create React Components
│  ├─ WarehouseLocationsView
│  ├─ StockItemsView
│  ├─ InventoryView (Dashboard)
│  ├─ StockAdjustmentsView
│  ├─ ReorderView
│  └─ InventoryTransactionsView
│
└─ Estimated: 4-6 hours

PHASE 3: APP INTEGRATION (→ AFTER PHASE 2)
├─ State Management
│  ├─ Add inventory state arrays to App.tsx
│  ├─ Create CRUD callbacks
│  ├─ Wire data loading
│  └─ Connect navigation
│
└─ Estimated: 2-3 hours

PHASE 4: OPTIONAL ENHANCEMENTS (→ FUTURE)
├─ GL Integration (auto journal entries)
├─ Barcode Support
├─ Import/Export Features
├─ Advanced Reporting
└─ Real-time Updates (WebSocket)
```

---

**Generated**: January 22, 2026  
**Status**: Phase 1 Complete ✅  
**Diagrams Version**: 1.0
