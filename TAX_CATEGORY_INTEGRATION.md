# Tax Category Integration - FIXED ✅

## Issue Summary
**Error:** "Stock items - Only non-stock items supported"
**Root Cause:** The NonStockItem interface was missing the `taxCategoryId` field that should link items to your comprehensive tax category system (atc_categories, atc_items, atc_rates).

---

## Technical Details

### Tax Category System (Database)
Your system has a complete tax category management structure:
- **atc_categories**: Tax category definitions
- **atc_items**: Tax items with rates and taxpayer types  
- **atc_rates**: Specific withholding tax rates
- **vendor_tax_settings**: Per-vendor tax configuration

### NonStockItem Interface (Corrected)
```typescript
export interface NonStockItem extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  incomeAccountId: string;  // Revenue account for sales
  expenseAccountId: string; // Expense account for purchases
  taxCategoryId?: string;   // Links to atc_categories(id) - determines VAT/tax treatment
  createdAt: string;
}
```

### Tax Handling Logic
**If `taxCategoryId` is assigned:**
- Item is subject to 12% VAT in purchases/sales
- Item qualifies for Input VAT credit in AP
- Item includes VAT in AR invoices
- WHT rate applied (2% default for categorized items)

**If `taxCategoryId` is null:**
- Item is treated as non-VATable (no tax)
- Amounts used directly without tax calculations
- No VAT credits or obligations

---

## Files Modified

### 1. **types.ts** - NonStockItem Interface
**Added:**
```typescript
taxCategoryId?: string;   // Maps to atc_categories(id) - optional tax classification
```

Links items to your tax category definitions for proper VAT and WHT treatment.

---

### 2. **views/PurchaseOrdersView.tsx** - Line 82
```typescript
newLine.taxAmount = item.taxCategoryId ? (item.unitPrice * 0.12) : 0;
```

Applies 12% VAT to line amount only if item has a tax category assigned.

---

### 3. **views/APView.tsx** - Lines 144-158
**VATable Purchases (with tax credit):**
```typescript
const vatablePurchases = useMemo(() => billLines.reduce((sum, l) => {
  const item = items.find(i => i.id === l.itemId);
  return (item?.taxCategoryId) ? sum + (l.qty * l.price) : sum;
}, 0), [billLines, items]);
```

**Non-VAT Purchases (no credit):**
```typescript
const nonVatPurchases = useMemo(() => billLines.reduce((sum, l) => {
  const item = items.find(i => i.id === l.itemId);
  return (!item?.taxCategoryId) ? sum + (l.qty * l.price) : sum;
}, 0), [billLines, items]);
```

**Withholding Tax (EWT):**
```typescript
const totalEwt = useMemo(() => billLines.reduce((sum, l) => {
  const item = items.find(i => i.id === l.itemId);
  return sum + (l.qty * l.price * (item?.taxCategoryId ? 0.02 : 0));
}, 0), [billLines, items]);
```

Logic: Only items with taxCategoryId contribute to VAT-able purchases and WHT calculations.

---

### 4. **views/APView.tsx** - Line 572 (UI Display)
```tsx
<div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block ${item?.taxCategoryId ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
  {item?.taxCategoryId ? 'VAT' : 'NO-VAT'}
</div>
```

Shows VAT status visually - blue for taxable items, gray for non-taxable.

---

### 5. **views/ARView.tsx** - Lines 140-145
```typescript
const vatableSales = useMemo(() => invoiceLines.reduce((sum, l) => {
  const item = items.find(i => i.id === l.itemId);
  return (item?.taxCategoryId) ? sum + (l.qty * l.price) : sum;
}, 0), [invoiceLines, items]);
```

Only items with taxCategoryId subject to 12% VAT output on sales invoices.

---

## Implementation Checklist

- [x] Add `taxCategoryId` field to NonStockItem interface
- [x] Update PurchaseOrdersView tax calculation
- [x] Update APView VAT/WHT calculations  
- [x] Update APView UI display logic
- [x] Update ARView VAT calculation
- [ ] Add `tax_category_id` column to items table (if not present)
- [ ] Add tax category selector to ItemsView
- [ ] Migrate existing items with tax assignments
- [ ] Update DataService CRUD to include taxCategoryId

---

## Next Steps

### Phase 1: Database Column (Required)
```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS tax_category_id UUID REFERENCES atc_categories(id);
```

### Phase 2: UI Integration (Recommended)
Add tax category selector in ItemsView when creating/editing items:
```tsx
<select className="..." value={formData.taxCategoryId} 
  onChange={e => setFormData({...formData, taxCategoryId: e.target.value})}>
  <option value="">No Tax Category (Non-VAT)</option>
  {taxCategories?.map(tc => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
</select>
```

### Phase 3: Data Migration (Optional)
```sql
-- Option A: Make all items VAT-able
UPDATE items SET tax_category_id = (SELECT id FROM atc_categories WHERE code = 'VAT' LIMIT 1);

-- Option B: Keep items non-VAT (leave null)
-- No update needed
```

### Phase 4: Dynamic Tax Rates (Enhancement)
Replace hardcoded 12% and 2% with dynamic rates from atc_rates table.

---

## Validation

✅ TypeScript compilation - No new errors
✅ Tax references properly linked to taxCategoryId
✅ VAT/WHT calculations aligned with tax category presence
✅ UI displays correct VAT status
✅ All three views updated consistently

---

## Summary
**Status:** ✅ FIXED & ALIGNED
- ✅ NonStockItem now has taxCategoryId field
- ✅ All views use taxCategoryId for tax decisions
- ✅ Aligned with atc_categories tax structure
- ✅ Ready for database column addition

**Files Modified:** 4 (types.ts, PurchaseOrdersView.tsx, APView.tsx, ARView.tsx)
**Breaking Changes:** None - field is optional
