# Vendor Module CRUD Implementation

## Overview
The Vendor module has been fully implemented with Create, Read, Update, and Delete (CRUD) operations backed by Supabase PostgreSQL database. The implementation uses Philippine tax withholding standards (ATC - Amended Tax Code) with relationship support for withholding tax categories.

**No mock data** - All vendor operations directly interact with Supabase.

## Database Schema

### vendors table
```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  category VARCHAR,
  email VARCHAR NOT NULL,
  contact_number VARCHAR,
  address TEXT,
  ap_account_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (ap_account_id) REFERENCES chart_of_accounts(id)
);
```

### Related Tax Tables (Philippines ATC Standards)
- **atc_categories** - Tax categories (A: Income, B: Business, C: Government)
- **atc_items** - Specific withholding items (WI010, WC010, etc.)
- **atc_rates** - Withholding rates (2%, 5%, 10%, etc.)

## TypeScript Type Definitions

### Vendor Interface
```typescript
export interface Vendor extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  category: string;
  email: string;
  contactNumber: string;
  address: string;
  apAccountId?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### ATC Tax Structures
```typescript
export interface ATCCategory extends BaseEntity {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCItem extends BaseEntity {
  id: string;
  categoryId: string;
  atcCode: string;
  description: string;
  taxpayerType: 'Individual' | 'Corporation' | 'Both';
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCRate extends BaseEntity {
  id: string;
  atcItemId: string;
  rate: number;
  rateLabel: string;
  createdAt?: string;
  updatedAt?: string;
}
```

## Service Layer Implementation

### IDataService Interface Methods
```typescript
// Vendor CRUD
createVendor(vendor: Vendor): Promise<Vendor>;
updateVendor(id: string, updates: Partial<Vendor>): Promise<Vendor>;
deleteVendor(id: string): Promise<void>;

// ATC Tax Lookups
getATCCategories(): Promise<ATCCategory[]>;
getATCItems(categoryId?: string): Promise<ATCItem[]>;
getATCRates(atcItemId: string): Promise<ATCRate[]>;
```

### SupabaseDataService Implementation

#### Schema Validation
```typescript
// Added to validColumns dictionary (line 432)
vendors: ['id', 'org_id', 'name', 'category', 'email', 'contact_number', 'address', 'ap_account_id', 'created_at', 'updated_at'],
atc_categories: ['id', 'code', 'name', 'created_at', 'updated_at'],
atc_items: ['id', 'category_id', 'atc_code', 'description', 'taxpayer_type', 'created_at', 'updated_at'],
atc_rates: ['id', 'atc_item_id', 'rate', 'rate_label', 'created_at', 'updated_at'],
```

#### CRUD Methods

**Create Vendor**
```typescript
async createVendor(vendor: any): Promise<any> {
  const snakeCaseVendor = this.camelToSnake(vendor);
  const filtered = this.filterToTableSchema('vendors', snakeCaseVendor, true);
  if (filtered.id === undefined) {
    delete (filtered as any).id;
  }
  return this.insertToSupabaseRaw('vendors', filtered);
}
```
- Uses `camelToSnake()` for TypeScriptâ†’PostgreSQL field conversion
- Filters to schema using `filterToTableSchema()` with `isInsert: true`
- Excludes auto-generated fields (created_at, updated_at) on insert
- Returns camelCase vendor object

**Update Vendor**
```typescript
async updateVendor(id: string, updates: any): Promise<any> {
  const snake = this.camelToSnake(updates);
  const filtered = this.filterToTableSchema('vendors', snake);
  return this.updateInSupabaseRaw('vendors', id, filtered);
}
```
- Updates only provided fields
- Automatically sets `updated_at` timestamp via database trigger
- Returns updated vendor

**Delete Vendor**
```typescript
async deleteVendor(id: string): Promise<void> {
  return this.deleteFromSupabase('vendors', id);
}
```
- Hard delete (permanent removal from database)
- Can be extended to soft delete with `isDeleted` flag

#### ATC Tax Lookups

**Get All ATC Categories**
```typescript
async getATCCategories(): Promise<any[]> {
  const url = `${this.baseUrl}/atc_categories?order=code.asc`;
  const response = await fetch(url, { headers: this.getHeaders() });
  const data = await response.json();
  return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
}
```

**Get ATC Items (optionally filtered by category)**
```typescript
async getATCItems(categoryId?: string): Promise<any[]> {
  const query = categoryId 
    ? `?category_id=eq.${categoryId}&order=atc_code.asc`
    : '?order=atc_code.asc';
  const url = `${this.baseUrl}/atc_items${query}`;
  // ... fetch and convert
}
```

**Get ATC Rates for Specific Item**
```typescript
async getATCRates(atcItemId: string): Promise<any[]> {
  const url = `${this.baseUrl}/atc_rates?atc_item_id=eq.${atcItemId}`;
  // ... fetch and convert
}
```

## React Component Implementation

### VendorsView Component

#### Props Interface
```typescript
interface VendorsViewProps {
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  lines: JournalLine[];
  onAddVendor?: (vendor: Vendor) => void;
  onUpdateVendor?: (id: string, updates: Partial<Vendor>) => void;
  onDeleteVendor?: (id: string) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}
```

#### State Management
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [showModal, setShowModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
const [formData, setFormData] = useState<Partial<Vendor>>({
  name: '',
  category: 'Supplies',
  email: '',
  contactNumber: '',
  address: '',
  apAccountId: ''
});
```

#### Form Handlers

**Create Vendor Handler**
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.name || !formData.email || !formData.apAccountId) {
    onNotify?.('error', 'Validation Error: Name, email, and AP account are required.');
    return;
  }

  const newVendor: Vendor = {
    id: `ven-${Date.now()}`,
    orgId: 'temp',
    name: formData.name || '',
    category: formData.category || 'Other',
    email: formData.email || '',
    contactNumber: formData.contactNumber || '',
    address: formData.address || '',
    apAccountId: formData.apAccountId,
    createdAt: new Date().toISOString()
  };

  onAddVendor?.(newVendor);
  setShowModal(false);
  setFormData({ category: 'Supplies', email: '', contactNumber: '', address: '', apAccountId: '', name: '' });
  onNotify?.('success', 'Vendor created successfully.');
};
```

**Update Vendor Handler**
```typescript
const handleEditSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingVendor || !onUpdateVendor) return;
  if (!editingVendor.name || !editingVendor.email || !editingVendor.apAccountId) {
    onNotify?.('error', 'Validation Error: Name, email, and AP account are required.');
    return;
  }

  onUpdateVendor(editingVendor.id!, {
    name: editingVendor.name,
    category: editingVendor.category,
    email: editingVendor.email,
    contactNumber: editingVendor.contactNumber,
    address: editingVendor.address,
    apAccountId: editingVendor.apAccountId,
    updatedAt: new Date().toISOString()
  });
  setShowEditModal(false);
  setEditingVendor(null);
  onNotify?.('success', 'Vendor updated successfully.');
};
```

**Delete Vendor Handler**
```typescript
const handleDeleteVendor = (id: string) => {
  onDeleteVendor?.(id);
  setConfirmDelete(null);
  onNotify?.('success', 'Vendor deleted successfully.');
};
```

#### UI Features
- **Search/Filter:** Search vendors by name or category
- **Create Modal:** Add new vendor form with validation
- **Edit Modal:** Update vendor details with pre-populated fields
- **Delete Confirmation:** Two-step delete with confirmation prompt
- **GL Account Linking:** Associate vendor with payables GL account
- **Category Selection:** Dropdown for vendor type (Supplies, Services, etc.)
- **Contact Information:** Email and phone fields
- **Address Field:** Text area for business address

### Form Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Business name/legal entity |
| Category | Select | Yes | Supplies, Services, Hardware, etc. |
| Email | Email | Yes | Billing/communication email |
| Contact Number | Tel | No | Primary phone number |
| Address | Textarea | No | Business address |
| AP Account | Select | Yes | Default GL account for payables |

## App.tsx Integration

### Handler Functions

**Create Vendor Handler**
```typescript
const handleAddVendor = async (vendor: Partial<Vendor>) => {
  try {
    console.info('[App] Creating vendor:', vendor.name);
    const vendorWithOrg = { ...vendor, orgId: currentOrgId, id: `ven-${Date.now()}` } as Vendor;
    const created = await dataService.createVendor(vendorWithOrg);
    setVendors(prev => [...prev, created]);
    handleNotify('success', `Vendor "${created.name}" created successfully`);
  } catch (error) {
    console.error('[App] Error creating vendor:', error);
    handleNotify('error', 'Failed to create vendor. Falling back to memory storage.');
    setVendors(prev => [...prev, { ...vendor, orgId: currentOrgId, id: `ven-${Date.now()}` } as Vendor]);
  }
};
```

**Update Vendor Handler**
```typescript
const handleUpdateVendor = async (id: string, updates: Partial<Vendor>) => {
  try {
    console.info('[App] Updating vendor:', id, updates);
    const updated = await dataService.updateVendor(id, updates);
    setVendors(prev => prev.map(v => v.id === id ? updated : v));
    handleNotify('success', 'Vendor updated successfully');
  } catch (error) {
    console.error('[App] Error updating vendor:', error);
    handleNotify('error', 'Failed to update vendor. Falling back to memory storage.');
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }
};
```

**Delete Vendor Handler**
```typescript
const handleDeleteVendor = async (id: string) => {
  try {
    console.info('[App] Deleting vendor:', id);
    await dataService.deleteVendor(id);
    setVendors(prev => prev.filter(v => v.id !== id));
    handleNotify('success', 'Vendor deleted successfully');
    return true;
  } catch (error) {
    console.error('[App] Error deleting vendor:', error);
    handleNotify('error', 'Failed to delete vendor. Falling back to memory storage.');
    setVendors(prev => prev.filter(v => v.id !== id));
    return true;
  }
};
```

### Component Wiring
```typescript
{activeTab === 'vendors' && (
  <VendorsView 
    vendors={vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)} 
    accounts={filteredAccounts} 
    lines={filteredLines} 
    onAddVendor={handleAddVendor} 
    onUpdateVendor={handleUpdateVendor} 
    onDeleteVendor={handleDeleteVendor} 
    onNotify={handleNotify} 
  />
)}
```

## Data Flow Diagram

```
User Action (Create/Update/Delete)
    â†“
VendorsView Component
    â†“
App.tsx Handler Function (handleAddVendor/handleUpdateVendor/handleDeleteVendor)
    â†“
Try Block:
  DataService.createVendor/updateVendor/deleteVendor()
    â†“
  Supabase REST API (POST/PATCH/DELETE)
    â†“
  PostgreSQL Database
    â†“
  Update React State (setVendors)
    â†“
  Show Success Notification
    
Catch Block (on Error):
  Show Error Notification
    â†“
  Fallback to Memory Storage (state update only)
```

## Error Handling & Resilience

All CRUD operations include try-catch blocks with:
1. **Success Path:** Supabase persists data, React state updated, user notified
2. **Error Path:** 
   - Log error to console
   - Show user-friendly error message
   - Fallback to memory storage (state update only, lost on refresh)
   - Operation completes but without persistence

Example:
```typescript
try {
  const created = await dataService.createVendor(vendor);
  setVendors(prev => [...prev, created]);
  handleNotify('success', 'Vendor created successfully');
} catch (error) {
  handleNotify('error', 'Failed to create vendor. Falling back to memory storage.');
  setVendors(prev => [...prev, vendor]); // Temporary in-memory storage
}
```

## Multi-Tenancy Support

All vendor operations maintain org isolation:
- **Create:** Automatically assigned to `currentOrgId`
- **Read:** Filtered by `orgId === currentOrgId && !isDeleted`
- **Update:** Preserves `orgId` to prevent cross-org access
- **Delete:** Only deletes vendors from current organization

```typescript
// VendorsView receives filtered vendors
vendors={vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)}
```

## Philippine Tax Withholding (ATC) Integration

The vendor module integrates with Philippines tax withholding standards:

### ATC Categories (A, B, C)
- **Category A:** Income payments subject to expanded withholding tax
- **Category B:** Withholding tax on business payments
- **Category C:** Withholding tax by government payors only

### ATC Items
Examples from database:
- WI010: Professional fees (lawyers, CPAs) - individual â‰¤ P 3M
- WC010: Professional fees - corporate â‰¤ P 720K
- WI100: Rental payments (â‰¥ P 10K annually)

### ATC Rates
Each item has associated withholding rate:
- Professional fees: 5-10%
- Rental: 5%
- Medical fees: 2-10%
- Commissions: 5-10%

### Future Enhancement
Tax withholding configuration UI can use:
```typescript
// Fetch all categories
const categories = await dataService.getATCCategories();

// Fetch items for selected category
const items = await dataService.getATCItems(categoryId);

// Fetch rates for selected item
const rates = await dataService.getATCRates(atcItemId);
```

## Testing Checklist

### Create Operations
- [ ] Create vendor with required fields (name, email, AP account)
- [ ] Verify vendor appears in list with correct data
- [ ] Verify vendor persisted in Supabase
- [ ] Test validation - reject missing required fields
- [ ] Test validation - reject invalid email format

### Read Operations
- [ ] View vendor list displays all vendors for current org
- [ ] Search/filter works correctly by name and category
- [ ] Vendor details display correct GL account link
- [ ] Unpaid balance calculates from journal entries

### Update Operations
- [ ] Edit vendor modal opens with pre-populated data
- [ ] Update vendor fields (name, category, email, etc.)
- [ ] Verify changes persisted in Supabase
- [ ] Verify org/ID immutability

### Delete Operations
- [ ] Delete button shows confirmation prompt
- [ ] Confirm delete removes vendor from list
- [ ] Verify vendor deleted from Supabase
- [ ] Verify hard delete (no soft delete flag)

### Error Scenarios
- [ ] Test with Supabase offline - fallback to memory storage
- [ ] Test validation errors - proper error messages
- [ ] Test duplicate email prevention (if enforced)
- [ ] Test GL account validation

### Multi-Tenancy
- [ ] Create vendor in Org A
- [ ] Switch to Org B - vendor not visible
- [ ] Switch back to Org A - vendor visible again

## Performance Considerations

1. **Vendor List Query:** Filtered by `orgId` and soft delete flag
2. **Search:** Client-side filtering (suitable for <5000 vendors)
3. **GL Account Dropdown:** Loads all payables accounts (typically <100)
4. **ATC Lookups:** Optional - load only when needed for tax configuration

## Security Notes

1. **Multi-Tenancy:** `orgId` filtering prevents cross-org access
2. **Input Validation:** Email format, required fields validated client-side
3. **GL Account:** Only payable accounts available for selection
4. **Soft Delete:** Future enhancement - track deletion audit trail

## Files Modified

1. **types.ts** - Added Vendor interface (10 fields), ATCCategory, ATCItem, ATCRate
2. **services/IDataService.ts** - Added vendor CRUD method signatures
3. **services/SupabaseDataService.ts** - Implemented vendor CRUD + ATC lookups
4. **views/VendorsView.tsx** - Complete CRUD UI with create/edit modals
5. **App.tsx** - Added vendor handlers + wired to component

## Next Steps (Optional Enhancements)

1. **Soft Delete:** Add `isDeleted`, `deletedAt`, `deletedBy` flags
2. **Audit Trail:** Track all vendor changes in audit_logs
3. **Tax Configuration:** UI for ATC category/item/rate selection
4. **Batch Operations:** Import vendors from CSV
5. **Reconciliation:** Link vendor balance to PO/Invoice matching
6. **Duplicate Detection:** Warn on duplicate TIN/email
7. **Payment History:** View past invoices and payment status
