# Phase 3 Integration Guide - App.tsx Wiring

**Objective**: Wire the 6 inventory views into App.tsx  
**Estimated Time**: 1-2 hours  
**Complexity**: Medium  
**Prerequisite**: Phase 2 complete (all 6 views built)

---

## Overview

This guide shows exactly how to integrate the inventory views into App.tsx with:
- State management for 6 inventory entities
- CRUD callbacks (36 total - 6 per entity)
- Navigation sidebar items
- View routing logic

---

## Step 1: Add Imports

Add these imports to the top of App.tsx:

```typescript
// Import inventory views
import { WarehouseLocationsView } from './views/WarehouseLocationsView';
import { StockItemsView } from './views/StockItemsView';
import { InventoryView } from './views/InventoryView';
import { StockAdjustmentsView } from './views/StockAdjustmentsView';
import { ReorderView } from './views/ReorderView';
import { InventoryTransactionsView } from './views/InventoryTransactionsView';

// Import types (already imported in types.ts)
import {
  WarehouseLocation,
  StockItem,
  InventoryLevel,
  InventoryTransaction,
  StockAdjustment,
  ReorderPoint,
} from './types';
```

---

## Step 2: Add State Variables

Add these state variables in the App component (with other master data states):

```typescript
// Inventory Management
const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
const [stockItems, setStockItems] = useState<StockItem[]>([]);
const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
const [reorderPoints, setReorderPoints] = useState<ReorderPoint[]>([]);
```

---

## Step 3: Load Initial Data

Update useEffect to load inventory data from dataService:

```typescript
useEffect(() => {
  const loadData = async () => {
    if (!dataService) return;

    const initialData = await dataService.getInitialData();
    
    // Set all existing data...
    setAccounts(initialData.accounts || []);
    setJournalEntries(initialData.journalEntries || []);
    // ... other data ...

    // SET NEW INVENTORY DATA
    setWarehouseLocations(initialData.warehouseLocations || []);
    setStockItems(initialData.stockItems || []);
    setInventoryLevels(initialData.inventoryLevels || []);
    setInventoryTransactions(initialData.inventoryTransactions || []);
    setStockAdjustments(initialData.stockAdjustments || []);
    setReorderPoints(initialData.reorderPoints || []);
  };

  loadData();
}, [dataService, currentOrgId]);
```

---

## Step 4: Add CRUD Callbacks

Add these callback functions for inventory operations:

### Warehouse Locations (5 callbacks)
```typescript
// Warehouse Locations
const handleAddWarehouseLocation = async (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newLocation = await dataService.createWarehouseLocation({ ...location, orgId: currentOrgId });
  setWarehouseLocations([...warehouseLocations, newLocation]);
};

const handleUpdateWarehouseLocation = async (id: string, updates: Partial<WarehouseLocation>) => {
  const updated = await dataService.updateWarehouseLocation(id, updates);
  setWarehouseLocations(warehouseLocations.map((loc) => (loc.id === id ? updated : loc)));
};

const handleDeleteWarehouseLocation = async (id: string) => {
  await dataService.deleteWarehouseLocation(id);
  setWarehouseLocations(warehouseLocations.map((loc) => (loc.id === id ? { ...loc, isDeleted: true } : loc)));
};
```

### Stock Items (6 callbacks)
```typescript
// Stock Items
const handleAddStockItem = async (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newItem = await dataService.createStockItem({ ...item, orgId: currentOrgId });
  setStockItems([...stockItems, newItem]);
};

const handleUpdateStockItem = async (id: string, updates: Partial<StockItem>) => {
  const updated = await dataService.updateStockItem(id, updates);
  setStockItems(stockItems.map((item) => (item.id === id ? updated : item)));
};

const handleDeleteStockItem = async (id: string) => {
  await dataService.deleteStockItem(id);
  setStockItems(stockItems.map((item) => (item.id === id ? { ...item, isDeleted: true } : item)));
};

const handleGetStockItemsByLocation = async (locationId: string) => {
  return await dataService.getStockItemsByLocation(locationId);
};
```

### Inventory Levels (6 callbacks)
```typescript
// Inventory Levels
const handleAddInventoryLevel = async (level: Omit<InventoryLevel, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newLevel = await dataService.createInventoryLevel({ ...level, orgId: currentOrgId });
  setInventoryLevels([...inventoryLevels, newLevel]);
};

const handleUpdateInventoryLevel = async (id: string, updates: Partial<InventoryLevel>) => {
  const updated = await dataService.updateInventoryLevel(id, updates);
  setInventoryLevels(inventoryLevels.map((level) => (level.id === id ? updated : level)));
};

const handleDeleteInventoryLevel = async (id: string) => {
  await dataService.deleteInventoryLevel(id);
  setInventoryLevels(inventoryLevels.map((level) => (level.id === id ? { ...level, isDeleted: true } : level)));
};

const handleGetStockStatusView = async () => {
  return await dataService.getStockStatusView();
};
```

### Inventory Transactions (6 callbacks)
```typescript
// Inventory Transactions
const handleAddInventoryTransaction = async (transaction: Omit<InventoryTransaction, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newTransaction = await dataService.createInventoryTransaction({ ...transaction, orgId: currentOrgId });
  setInventoryTransactions([...inventoryTransactions, newTransaction]);
};

const handleUpdateInventoryTransaction = async (id: string, updates: Partial<InventoryTransaction>) => {
  const updated = await dataService.updateInventoryTransaction(id, updates);
  setInventoryTransactions(inventoryTransactions.map((t) => (t.id === id ? updated : t)));
};

const handleDeleteInventoryTransaction = async (id: string) => {
  await dataService.deleteInventoryTransaction(id);
  setInventoryTransactions(inventoryTransactions.map((t) => (t.id === id ? { ...t, isDeleted: true } : t)));
};

const handleGetTransactionsByItem = async (itemId: string) => {
  return await dataService.getInventoryTransactionsByItem(itemId);
};
```

### Stock Adjustments (6 callbacks)
```typescript
// Stock Adjustments
const handleAddStockAdjustment = async (adjustment: Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newAdjustment = await dataService.createStockAdjustment({ ...adjustment, orgId: currentOrgId });
  setStockAdjustments([...stockAdjustments, newAdjustment]);
};

const handleUpdateStockAdjustment = async (id: string, updates: Partial<StockAdjustment>) => {
  const updated = await dataService.updateStockAdjustment(id, updates);
  setStockAdjustments(stockAdjustments.map((adj) => (adj.id === id ? updated : adj)));
};

const handleDeleteStockAdjustment = async (id: string) => {
  await dataService.deleteStockAdjustment(id);
  setStockAdjustments(stockAdjustments.map((adj) => (adj.id === id ? { ...adj, isDeleted: true } : adj)));
};

const handleGetAdjustmentsByItem = async (itemId: string) => {
  return await dataService.getStockAdjustmentsByItem(itemId);
};
```

### Reorder Points (6 callbacks)
```typescript
// Reorder Points
const handleAddReorderPoint = async (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => {
  const newPoint = await dataService.createReorderPoint({ ...point, orgId: currentOrgId });
  setReorderPoints([...reorderPoints, newPoint]);
};

const handleUpdateReorderPoint = async (id: string, updates: Partial<ReorderPoint>) => {
  const updated = await dataService.updateReorderPoint(id, updates);
  setReorderPoints(reorderPoints.map((point) => (point.id === id ? updated : point)));
};

const handleDeleteReorderPoint = async (id: string) => {
  await dataService.deleteReorderPoint(id);
  setReorderPoints(reorderPoints.map((point) => (point.id === id ? { ...point, isDeleted: true } : point)));
};

const handleGetItemsNeedingReorder = async () => {
  return await dataService.getItemsNeedingReorder();
};
```

---

## Step 5: Add Sidebar Navigation

Add inventory menu items to the sidebar. Find the section where other master data menus are and add:

```typescript
{
  label: 'Inventory Management',
  icon: Package,
  items: [
    { label: 'Dashboard', value: 'inventory' },
    { label: 'Warehouse Locations', value: 'warehouse-locations' },
    { label: 'Stock Items', value: 'stock-items' },
    { label: 'Stock Levels', value: 'stock-levels' },
    { label: 'Stock Adjustments', value: 'stock-adjustments' },
    { label: 'Reorder Points', value: 'reorder-points' },
    { label: 'Transactions', value: 'inventory-transactions' },
  ],
}
```

*Note: You'll need to import the Package icon from lucide-react*

---

## Step 6: Add View Routing

In the main view rendering section, add cases for inventory views:

```typescript
case 'inventory':
  return (
    <InventoryView
      items={stockItems}
      levels={inventoryLevels}
      reorderPoints={reorderPoints}
      currency={currentOrganization?.currency || 'USD'}
      onSelectItem={(itemId) => {
        setCurrentTab('stock-items');
        // Optionally: scroll to or select the item
      }}
    />
  );

case 'warehouse-locations':
  return (
    <WarehouseLocationsView
      locations={warehouseLocations}
      onAdd={handleAddWarehouseLocation}
      onUpdate={handleUpdateWarehouseLocation}
      onDelete={handleDeleteWarehouseLocation}
      currency={currentOrganization?.currency || 'USD'}
      isLoading={isLoading}
    />
  );

case 'stock-items':
  return (
    <StockItemsView
      items={stockItems}
      accounts={accounts}
      onAdd={handleAddStockItem}
      onUpdate={handleUpdateStockItem}
      onDelete={handleDeleteStockItem}
      currency={currentOrganization?.currency || 'USD'}
      isLoading={isLoading}
    />
  );

case 'stock-levels':
  return (
    <InventoryView
      items={stockItems}
      levels={inventoryLevels}
      reorderPoints={reorderPoints}
      currency={currentOrganization?.currency || 'USD'}
    />
  );

case 'stock-adjustments':
  return (
    <StockAdjustmentsView
      adjustments={stockAdjustments}
      items={stockItems}
      levels={inventoryLevels}
      locations={warehouseLocations}
      onAdd={handleAddStockAdjustment}
      onUpdate={handleUpdateStockAdjustment}
      onDelete={handleDeleteStockAdjustment}
      currency={currentOrganization?.currency || 'USD'}
      isLoading={isLoading}
    />
  );

case 'reorder-points':
  return (
    <ReorderView
      reorderPoints={reorderPoints}
      items={stockItems}
      levels={inventoryLevels}
      onAdd={handleAddReorderPoint}
      onUpdate={handleUpdateReorderPoint}
      onDelete={handleDeleteReorderPoint}
      currency={currentOrganization?.currency || 'USD'}
      isLoading={isLoading}
    />
  );

case 'inventory-transactions':
  return (
    <InventoryTransactionsView
      transactions={inventoryTransactions}
      items={stockItems}
      locations={warehouseLocations}
      currency={currentOrganization?.currency || 'USD'}
      isLoading={isLoading}
    />
  );
```

---

## Step 7: Error Handling

Wrap callbacks with try/catch:

```typescript
const handleAddWarehouseLocation = async (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const newLocation = await dataService.createWarehouseLocation({ ...location, orgId: currentOrgId });
    setWarehouseLocations([...warehouseLocations, newLocation]);
  } catch (error) {
    console.error('Error adding warehouse location:', error);
    // Optionally: Show error notification to user
  }
};
```

---

## Step 8: Verification Checklist

- [ ] All 6 imports added
- [ ] All 6 state variables added
- [ ] Data loading in useEffect updated
- [ ] All 36 callback functions implemented
- [ ] Sidebar menu items added
- [ ] All 6 view routing cases added
- [ ] Error handling added
- [ ] App compiles without errors
- [ ] Each view can be navigated to
- [ ] CRUD operations work (add/edit/delete)

---

## Testing Workflow

1. **Navigate to Inventory > Dashboard**
   - Should show stock status cards
   - Filters should work

2. **Navigate to Warehouse Locations**
   - Add new location (should trigger handleAddWarehouseLocation)
   - Edit location (should trigger handleUpdateWarehouseLocation)
   - Delete location (should trigger handleDeleteWarehouseLocation)

3. **Navigate to Stock Items**
   - Add item (should work)
   - Edit item (should work)
   - Delete item (should work)
   - Search should filter items

4. **Navigate to Stock Adjustments**
   - Create adjustment
   - Select item and location
   - Submit should call handleAddStockAdjustment

5. **Navigate to Reorder Points**
   - Set up reorder levels
   - Check alert when qty below min

6. **Navigate to Transactions**
   - View transaction history
   - Filter by type/item
   - Export to CSV

---

## Common Issues & Solutions

### Issue: "Cannot find module" error
**Solution**: Check imports are correct and files exist in src/views/

### Issue: "Property does not exist on type" error
**Solution**: Check state variable names match exactly (camelCase)

### Issue: Callbacks not firing
**Solution**: Verify callbacks are properly passed as props to view components

### Issue: Data not persisting
**Solution**: Ensure orgId is included in all new records

### Issue: Service layer errors
**Solution**: Check dataService is initialized before calling methods

---

## Performance Optimization

To prevent unnecessary re-renders:

```typescript
// Use useCallback for callbacks
const handleAddWarehouseLocation = useCallback(async (...) => { ... }, [warehouseLocations, currentOrgId]);

// Use useMemo for filtered data (already done in views)
const filteredItems = useMemo(() => items.filter(...), [items]);
```

---

## What Happens After Phase 3?

Once integrated:
1. Users can navigate to inventory views from sidebar
2. All CRUD operations work with real or mock data
3. Service layer switches between MockDataService and SupabaseDataService automatically
4. Data persists based on service layer implementation
5. Ready for production deployment

---

## Quick Reference: Tab Values

Use these strings in setCurrentTab() and navigation:
- `'inventory'` - Dashboard
- `'warehouse-locations'` - Warehouse management
- `'stock-items'` - Item catalog
- `'stock-levels'` - Stock status
- `'stock-adjustments'` - Variance tracking
- `'reorder-points'` - Reorder management
- `'inventory-transactions'` - Transaction history

---

## Next: Deployment

After Phase 3 is complete:

1. **Deploy Schema**: Run INVENTORY_TABLES.sql in Supabase
2. **Set Environment**: Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
3. **Test Supabase**: Switch to cloud data source
4. **Verify Data**: Ensure data persists to Supabase
5. **Go Live**: System ready for production

---

**Estimated Time**: 1-2 hours  
**Difficulty**: Medium  
**Prerequisites**: Phase 2 complete  
**Next Phase**: Production Deployment & Testing
