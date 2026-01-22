# Inventory System Deployment Guide

## Overview
Complete hybrid inventory system implementation with Supabase backend integration. Production-ready code with organization-aware multi-tenancy, valuation methods, and full CRUD operations.

**Status**: ✅ Phase 1 Complete - Ready for Supabase Deployment

---

## What Was Built

### Backend Infrastructure (Complete ✅)
- **6 Database Tables** with RLS policies for organization isolation
- **28 Service Methods** for all inventory CRUD operations
- **20+ Utility Functions** for stock calculations and validations
- **2 Database Views** for reporting and stock status
- **15+ Indexes** for optimal query performance
- **Full Type Safety** with TypeScript interfaces for all entities

### Implementation Approach
1. **Separated Concerns**: NonStockItem (services) + StockItem (physical goods)
2. **Multi-Warehouse**: Support for multiple locations per organization
3. **Valuation Methods**: FIFO, LIFO, WEIGHTED_AVERAGE, STANDARD_COST
4. **Transaction-Based**: Complete audit trail of all movements
5. **Organization-Aware**: RLS policies ensure data isolation per tenant
6. **Production-Ready**: Error handling, logging, and case conversion

---

## Pre-Deployment Checklist

### Environment Setup
- [ ] Supabase account created
- [ ] Supabase project initialized
- [ ] Database credentials obtained (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
- [ ] `.env.local` file updated with credentials
- [ ] Verified existing tables working (chart_of_accounts, journal_entries, etc.)

### Code Verification
- [ ] All TypeScript files compile without errors (✅ Verified)
- [ ] `types.ts` includes 6 new inventory interfaces
- [ ] `IDataService.ts` has 28 inventory method signatures
- [ ] `SupabaseDataService.ts` has all 28 implementations
- [ ] `MockDataService.ts` includes inventory stubs
- [ ] `InventoryService.ts` has 20+ utility functions
- [ ] `INVENTORY_TABLES.sql` migration file ready

---

## Deployment Steps

### Step 1: Verify Existing Supabase Setup
```bash
# In Supabase Dashboard:
1. Go to SQL Editor
2. Run a test query: SELECT * FROM organizations LIMIT 1
3. Verify at least one organization exists
4. Note: RLS should be ENABLED on existing tables
```

### Step 2: Deploy Inventory Schema
```sql
-- Copy entire content of INVENTORY_TABLES.sql
-- Paste in Supabase SQL Editor
-- Execute the migration

-- This creates:
-- ✓ warehouse_locations table
-- ✓ stock_items table
-- ✓ inventory_levels table
-- ✓ inventory_transactions table
-- ✓ stock_adjustments table
-- ✓ reorder_points table
-- ✓ v_inventory_status view
-- ✓ v_inventory_transactions_summary view
-- ✓ RLS policies on all 6 tables
-- ✓ 15+ indexes for performance
-- ✓ Sample default warehouse location
```

### Step 3: Verify Supabase Tables
```sql
-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%inventory%' OR table_name LIKE '%warehouse%' OR table_name LIKE '%reorder%'
OR table_name LIKE '%stock_%';

-- Should return: 6 tables + 2 views
-- warehouse_locations
-- stock_items
-- inventory_levels
-- inventory_transactions
-- stock_adjustments
-- reorder_points
-- v_inventory_status
-- v_inventory_transactions_summary
```

### Step 4: Test RLS Policies
```sql
-- Verify RLS is enabled and working
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('warehouse_locations', 'stock_items', 'inventory_levels', 
                  'inventory_transactions', 'stock_adjustments', 'reorder_points');

-- Check policies exist
SELECT * FROM pg_policies 
WHERE tablename IN ('warehouse_locations', 'stock_items', 'inventory_levels', 
                    'inventory_transactions', 'stock_adjustments', 'reorder_points');

-- Should return 12 policies (2 per table: SELECT + INSERT/UPDATE/DELETE)
```

### Step 5: Configure Environment Variables
```bash
# .env.local (create if doesn't exist)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6: Restart Development Server
```bash
# Terminal
npm run dev

# Verify no TypeScript errors
# Look for console messages:
# [Supabase] ☁️ Fetching data from Supabase...
# [Supabase] ✅ Data loaded from Supabase
```

### Step 7: Verify Integration
```typescript
// In browser console, test a fetch:
fetch('https://your-project.supabase.co/rest/v1/warehouse_locations', {
  headers: {
    apikey: 'your-anon-key',
    Authorization: 'Bearer your-anon-key'
  }
})
.then(r => r.json())
.then(data => console.log('Warehouse locations:', data))
```

---

## Deployment Configuration

### Supabase Settings Required

#### 1. Enable RLS on All Tables
```sql
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_points ENABLE ROW LEVEL SECURITY;

-- INVENTORY_TABLES.sql handles this automatically
```

#### 2. Verify User-Organization Link
```sql
-- Check users table has org_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'org_id';

-- RLS policies depend on:
-- SELECT org_id FROM users WHERE id = auth.uid()
-- 
-- This requires users.org_id to exist and be populated
-- If missing, add:
-- ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id);
```

#### 3. Anon Key Permissions
```sql
-- Anon key needs these permissions:
-- SELECT on all inventory tables
-- INSERT on all inventory tables
-- UPDATE on all inventory tables
-- DELETE on all inventory tables (soft delete via is_deleted)

-- Verify RLS policies allow for org isolation
-- Default policies created by INVENTORY_TABLES.sql include:
-- - Org isolation on SELECT
-- - Org isolation on INSERT/UPDATE/DELETE
```

---

## File Deployments

### Files to Upload to Production

#### 1. **types.ts**
- 6 new inventory interfaces
- 2 new enums
- Location: `src/types.ts`
- No breaking changes to existing types

#### 2. **services/InventoryService.ts** (NEW)
- 20+ static utility methods
- Business logic for calculations
- Location: `src/services/InventoryService.ts`
- Size: ~350 lines

#### 3. **services/IDataService.ts**
- 28 new inventory method signatures
- Updated InitialData interface
- Location: `src/services/IDataService.ts`
- No breaking changes

#### 4. **services/MockDataService.ts**
- 36 inventory method stubs
- Location: `src/services/MockDataService.ts`
- No breaking changes

#### 5. **services/SupabaseDataService.ts**
- 28 inventory REST API implementations
- Updated getInitialData() to fetch inventory tables
- Location: `src/services/SupabaseDataService.ts`
- No breaking changes

#### 6. **INVENTORY_TABLES.sql**
- Database schema migration
- Run once in Supabase
- Not committed to app repo (SQL only)

---

## Testing After Deployment

### 1. Schema Verification
```typescript
// In browser console:
const tables = ['warehouse_locations', 'stock_items', 'inventory_levels', 
                'inventory_transactions', 'stock_adjustments', 'reorder_points'];

for (const table of tables) {
  const url = `https://your-project.supabase.co/rest/v1/${table}?limit=1`;
  fetch(url, { 
    headers: { apikey: 'your-key', Authorization: 'Bearer your-key' }
  })
  .then(r => r.json())
  .then(data => console.log(`${table}: ${Array.isArray(data) ? 'OK' : 'ERROR'}`))
}
```

### 2. Data Service Integration
```typescript
// In App.tsx or component:
import { dataService } from './services/DataServiceFactory';

// Test getting warehouse locations
const locations = await dataService.getWarehouseLocationsByOrg('your-org-id');
console.log('Warehouse locations:', locations);

// Should return empty array initially (no data yet)
```

### 3. Create Sample Data
```typescript
// Test create warehouse location
const newLocation = await dataService.createWarehouseLocation({
  orgId: 'your-org-id',
  code: 'TEST-WH',
  name: 'Test Warehouse',
  address: '123 Test St',
  isActive: true
});
console.log('Created:', newLocation.id);

// Test get back
const retrieved = await dataService.getWarehouseLocationById(newLocation.id);
console.log('Retrieved:', retrieved);
```

### 4. Test Organization Isolation
```typescript
// Create in org-1
const location1 = await dataService.createWarehouseLocation({
  orgId: 'org-1',
  code: 'ORG1-WH',
  name: 'Org 1 Warehouse',
  isActive: true
});

// Get as org-2 (should be empty due to RLS)
const locations = await dataService.getWarehouseLocationsByOrg('org-2');
// locations array should NOT include location1 (RLS working)
```

### 5. Test Utility Functions
```typescript
import { InventoryService } from './services/InventoryService';

// Test reference generation
const ref = InventoryService.generateTransactionReference('PURCHASE');
console.log('Reference:', ref); // Format: "INV-2026-01-0001"

// Test available quantity
const level = { quantityOnHand: 100, quantityReserved: 20 };
const available = InventoryService.getAvailableQuantity(level);
console.log('Available:', available); // 80

// Test low stock detection
const item = { minStockLevel: 50, maxStockLevel: 200 };
const isLow = InventoryService.isLowStock(level, item);
console.log('Low stock:', isLow); // false (80 >= 50)
```

---

## Common Issues & Solutions

### Issue 1: "RLS violation" or "Unauthorized"
**Cause**: RLS policy not matching user org
**Solution**: 
```sql
-- Check user has org_id
SELECT id, org_id FROM users WHERE id = auth.uid();

-- Verify RLS policy exists
SELECT * FROM pg_policies WHERE tablename = 'warehouse_locations';
```

### Issue 2: "Table not found" (404)
**Cause**: Migration didn't run or table name mismatch
**Solution**:
```sql
-- Re-run INVENTORY_TABLES.sql in SQL Editor
-- Or check table exists:
SELECT * FROM warehouse_locations LIMIT 1;
```

### Issue 3: Case conversion errors
**Cause**: Column names snake_case but app sends camelCase
**Solution**: 
```typescript
// Already handled in SupabaseDataService
// camelToSnake() converts app objects
// snakeToCamel() converts responses
// Should work automatically
```

### Issue 4: Empty data returned
**Cause**: Tables empty (no data created yet)
**Solution**:
```typescript
// Create test data through UI or API
const location = await dataService.createWarehouseLocation({
  orgId: 'your-org-id',
  code: 'TEST',
  name: 'Test Warehouse',
  isActive: true
});

// Now queries will return data
```

### Issue 5: "Missing VITE_SUPABASE_URL"
**Cause**: Environment variables not set
**Solution**:
```bash
# Update .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Restart dev server: npm run dev
```

---

## Performance Recommendations

### Database Optimization
```sql
-- All indexes created by INVENTORY_TABLES.sql
-- No additional indexes needed

-- Query optimization tips:
-- 1. Always include org_id in WHERE clause
-- 2. Use limit for large result sets
-- 3. Order by indexed columns (org_id, created_at)
-- 4. Use v_inventory_status for dashboard data
```

### Application Caching
```typescript
// Recommended: Cache these (rarely change)
const warehouseLocations = await dataService.getWarehouseLocationsByOrg(orgId);
// Cache for 1 hour

const stockItems = await dataService.getStockItemsByOrg(orgId);
// Cache for 30 minutes

// Don't cache (changes frequently):
const inventoryLevels = await dataService.getInventoryLevelsByOrg(orgId);
// Fetch fresh on component mount
```

### Query Performance
```typescript
// Fast queries (use these):
// - getStockStatusView() - Uses optimized view
// - getItemsNeedingReorder() - Pre-filtered in DB
// - getInventoryLevelByItemAndLocation() - Unique index

// Slower queries (batch if needed):
// - getInventoryTransactionsByOrg() - Full table scan
// - getStockAdjustmentsByOrg() - Full table scan
```

---

## Monitoring & Maintenance

### Daily Checks
```sql
-- Check for any RLS errors
SELECT * FROM pg_stat_statements WHERE query LIKE '%inventory%' LIMIT 10;

-- Verify data integrity
SELECT COUNT(*) FROM stock_items WHERE org_id IS NULL;
-- Should return 0

-- Check disk usage
SELECT pg_size_pretty(pg_total_relation_size('stock_items'));
```

### Weekly Cleanup
```sql
-- Archive old transactions (after analysis)
SELECT COUNT(*) FROM inventory_transactions 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND is_deleted = TRUE;

-- Soft-deleted records
SELECT COUNT(*) FROM warehouse_locations WHERE is_deleted = TRUE;
```

### Monthly Maintenance
```sql
-- Analyze tables for query optimization
ANALYZE warehouse_locations;
ANALYZE stock_items;
ANALYZE inventory_levels;
ANALYZE inventory_transactions;
ANALYZE stock_adjustments;
ANALYZE reorder_points;

-- Reindex if needed
REINDEX TABLE stock_items;
```

---

## Rollback Plan

### If Deployment Fails
```sql
-- Drop all inventory tables (CAREFUL - DATA LOSS)
DROP TABLE IF EXISTS reorder_points CASCADE;
DROP TABLE IF EXISTS stock_adjustments CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_levels CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS warehouse_locations CASCADE;

-- Drop views
DROP VIEW IF EXISTS v_inventory_status CASCADE;
DROP VIEW IF EXISTS v_inventory_transactions_summary CASCADE;
```

### If Code Issues
```bash
# Revert code changes
git checkout HEAD -- src/types.ts
git checkout HEAD -- src/services/IDataService.ts
git checkout HEAD -- src/services/SupabaseDataService.ts
git checkout HEAD -- src/services/MockDataService.ts

# Remove new files
rm src/services/InventoryService.ts

# Restart app
npm run dev
```

---

## Success Criteria

✅ Deployment is successful if:
1. All 6 tables created in Supabase
2. All RLS policies enabled
3. Sample warehouse location exists
4. No TypeScript compilation errors
5. MockDataService works without Supabase
6. SupabaseDataService can fetch data
7. Case conversion working (snake_case ↔ camelCase)
8. Organization isolation enforced by RLS
9. All 28 service methods implemented
10. InventoryService utility functions available

---

## Next Steps After Deployment

### Phase 2: UI Development
1. Create React views for inventory management
2. Connect to SupabaseDataService
3. Build forms for CRUD operations
4. Add validation and error handling

### Phase 3: Integration
1. Add inventory state to App.tsx
2. Connect navigation tabs
3. Implement workflows
4. Add reporting

### Phase 4: Enhancements
1. GL integration (auto journal entries)
2. Barcode support
3. Import/export functionality
4. Advanced analytics

---

## Deployment Checklist (Final)

- [ ] Supabase project accessible
- [ ] Environment variables configured (.env.local)
- [ ] INVENTORY_TABLES.sql executed
- [ ] All 6 tables created and verified
- [ ] RLS policies enabled and tested
- [ ] Sample warehouse location inserted
- [ ] SupabaseDataService can connect
- [ ] No TypeScript errors
- [ ] MockDataService works offline
- [ ] Case conversion tested
- [ ] Organization isolation verified
- [ ] Ready for Phase 2 UI development

---

## Support & Documentation

- **Inventory Implementation Guide**: HYBRID_INVENTORY_IMPLEMENTATION.md
- **Completion Report**: INVENTORY_SYSTEM_COMPLETE.md
- **Quick Reference**: INVENTORY_QUICK_REFERENCE.md
- **Database Schema**: INVENTORY_TABLES.sql
- **Service Interface**: services/IDataService.ts
- **Service Implementation**: services/SupabaseDataService.ts
- **Types**: types.ts (InventoryTransaction, StockItem, etc.)

---

**Status**: ✅ Ready for Production Deployment
**Last Updated**: January 22, 2026
