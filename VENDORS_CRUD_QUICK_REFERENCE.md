# Vendor CRUD Quick Reference

## CRUD Operations Summary

| Operation | Endpoint | Method | Response |
|-----------|----------|--------|----------|
| Create | `/vendors` | POST | `{ id, org_id, name, category, ... }` |
| Read (List) | `/vendors?org_id=eq.ORG_ID` | GET | `[ { vendor }, ... ]` |
| Read (One) | `/vendors?id=eq.ID` | GET | `[ { vendor } ]` |
| Update | `/vendors?id=eq.ID` | PATCH | `{ updated vendor }` |
| Delete | `/vendors?id=eq.ID` | DELETE | `void` |

## Database Operations

### Insert Vendor
```typescript
const vendor: Vendor = {
  id: 'ven-1234567890',
  orgId: 'org-abc123',
  name: 'Acme Office Supplies',
  category: 'Supplies',
  email: 'billing@acme.com',
  contactNumber: '555-1234',
  address: '123 Business Ave',
  apAccountId: 'acc-xyz789'
};

const created = await dataService.createVendor(vendor);
```

### Update Vendor
```typescript
const updates: Partial<Vendor> = {
  name: 'Acme Office Supplies Inc.',
  email: 'newemail@acme.com',
  updatedAt: new Date().toISOString()
};

const updated = await dataService.updateVendor(vendorId, updates);
```

### Delete Vendor
```typescript
await dataService.deleteVendor(vendorId);
```

## Component Integration

### Props
```typescript
interface VendorsViewProps {
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  lines: JournalEntryLine[];
  onAddVendor?: (vendor: Vendor) => void;
  onUpdateVendor?: (id: string, updates: Partial<Vendor>) => void;
  onDeleteVendor?: (id: string) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}
```

### Usage in App.tsx
```typescript
<VendorsView 
  vendors={vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)} 
  accounts={filteredAccounts} 
  lines={filteredLines} 
  onAddVendor={handleAddVendor} 
  onUpdateVendor={handleUpdateVendor} 
  onDeleteVendor={handleDeleteVendor} 
  onNotify={handleNotify} 
/>
```

## App.tsx Handler Pattern

### Create Handler
```typescript
const handleAddVendor = async (vendor: Partial<Vendor>) => {
  try {
    const vendorWithOrg = { ...vendor, orgId: currentOrgId, id: `ven-${Date.now()}` } as Vendor;
    const created = await dataService.createVendor(vendorWithOrg);
    setVendors(prev => [...prev, created]);
    handleNotify('success', `Vendor "${created.name}" created successfully`);
  } catch (error) {
    handleNotify('error', 'Failed to create vendor. Falling back to memory storage.');
    setVendors(prev => [...prev, vendor as Vendor]);
  }
};
```

### Update Handler
```typescript
const handleUpdateVendor = async (id: string, updates: Partial<Vendor>) => {
  try {
    const updated = await dataService.updateVendor(id, updates);
    setVendors(prev => prev.map(v => v.id === id ? updated : v));
    handleNotify('success', 'Vendor updated successfully');
  } catch (error) {
    handleNotify('error', 'Failed to update vendor. Falling back to memory storage.');
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }
};
```

### Delete Handler
```typescript
const handleDeleteVendor = async (id: string) => {
  try {
    await dataService.deleteVendor(id);
    setVendors(prev => prev.filter(v => v.id !== id));
    handleNotify('success', 'Vendor deleted successfully');
  } catch (error) {
    handleNotify('error', 'Failed to delete vendor.');
    setVendors(prev => prev.filter(v => v.id !== id));
  }
};
```

## State Management

### Create Vendor Flow
1. User fills form in create modal
2. `handleSubmit()` validates inputs
3. `onAddVendor()` called → App handler
4. Handler calls `dataService.createVendor()`
5. Success: Update React state `setVendors(prev => [...prev, created])`
6. Show notification: `handleNotify('success', ...)`
7. Modal closes, form resets

### Edit Vendor Flow
1. User clicks Edit button on vendor row
2. `openEditModal()` clones vendor data into state
3. Edit modal opens with pre-populated fields
4. User modifies fields
5. `handleEditSubmit()` validates inputs
6. `onUpdateVendor()` called → App handler
7. Handler calls `dataService.updateVendor()`
8. Success: Update React state `setVendors(prev => prev.map(...))`
9. Show notification: `handleNotify('success', ...)`
10. Modal closes

### Delete Vendor Flow
1. User clicks Delete button
2. Confirmation prompt appears
3. User confirms → `handleDeleteVendor()` called
4. `onDeleteVendor()` called → App handler
5. Handler calls `dataService.deleteVendor()`
6. Success: Update React state `setVendors(prev => prev.filter(...))`
7. Show notification: `handleNotify('success', ...)`

## Field Validation

### Required Fields
- **name:** Business name (non-empty string)
- **email:** Valid email format
- **apAccountId:** GL account selected from dropdown

### Optional Fields
- **category:** Defaults to 'Supplies'
- **contactNumber:** Any phone format
- **address:** Multi-line text

## Philippine Tax Withholding (ATC) Integration

### Fetch ATC Categories
```typescript
const categories = await dataService.getATCCategories();
// Returns: [{ id, code, name, ... }, ...]
// Example: { code: 'A', name: 'Income Payments...' }
```

### Fetch ATC Items by Category
```typescript
const items = await dataService.getATCItems(categoryId);
// Returns: [{ id, categoryId, atcCode, description, taxpayerType }, ...]
// Example: { atcCode: 'WI010', description: 'Professional fees...', taxpayerType: 'Individual' }
```

### Fetch ATC Rates for Item
```typescript
const rates = await dataService.getATCRates(atcItemId);
// Returns: [{ id, atcItemId, rate, rateLabel }, ...]
// Example: { rate: 5, rateLabel: '5%' }
```

## Error Handling

All CRUD operations include automatic fallback:

```
Supabase Attempt
    ↓
Success? 
    ├─ YES → Persist to DB + Update State + Show Success
    └─ NO  → Show Error + Update State Only (Memory Storage)
```

## Multi-Tenancy Context

All vendor queries automatically filtered:
```typescript
vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)
```

On Create: `orgId` automatically set to `currentOrgId`

On Update: `orgId` preserved (immutable)

On Delete: Vendor removed from current org only

## UI Components

### Create Button
Located in toolbar - opens create modal

### Edit Button
Located in each vendor row - opens edit modal with pre-populated data

### Delete Button
Located in each vendor row - shows confirmation before deletion

### Search/Filter
Text input - searches by name and category (client-side)

## API Integration Points

| Component | Calls | Data Flow |
|-----------|-------|-----------|
| VendorsView | onAddVendor, onUpdateVendor, onDeleteVendor | Display → App → DataService → Supabase |
| App.tsx | handleAddVendor, handleUpdateVendor, handleDeleteVendor | Handlers → DataService → Supabase + State Update |
| DataService | createVendor, updateVendor, deleteVendor | Service → REST API → PostgreSQL |

## Fields in Database

```
┌─ ID (UUID) - Unique identifier
├─ ORG_ID (UUID) - Organization tenant
├─ NAME (VARCHAR) - Business name
├─ CATEGORY (VARCHAR) - Type (Supplies, Services, etc.)
├─ EMAIL (VARCHAR) - Billing email
├─ CONTACT_NUMBER (VARCHAR) - Phone
├─ ADDRESS (TEXT) - Business address
├─ AP_ACCOUNT_ID (UUID) - GL account link
├─ CREATED_AT (TIMESTAMP) - Auto-set on insert
└─ UPDATED_AT (TIMESTAMP) - Auto-updated on modify
```

## Future Enhancement Hooks

### Soft Delete
```typescript
// Add to schema validation
vendors: [..., 'is_deleted', 'deleted_at', 'deleted_by']

// Filter in queries
vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)
```

### Audit Trail
```typescript
// Log all changes
createAuditLog({
  action: 'CREATE_VENDOR',
  entityId: vendor.id,
  entityType: 'Vendor',
  userId: currentUser.id,
  changes: vendor
});
```

### Tax Withholding Configuration
```typescript
// Create vendor_tax_settings table linking vendor to ATC category/item/rate
// UI to select from getATCCategories() → getATCItems() → getATCRates()
```
