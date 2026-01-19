# Fix: Record Bill "Post to Payables" Not Working

## Issue
The "Record Bill" feature in the Payables & Procurement (AP) view was not working when pressing "Post to Payables" button. Bills were not being created in the journal.

## Root Cause
The code was referencing a non-existent field `item.defaultAccountId` when it should have been using:
- `item.expenseAccountId` for bills/purchases (AP - debits)
- `item.incomeAccountId` for invoices/sales (AR - credits)

### NonStockItem Interface
```typescript
export interface NonStockItem extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  incomeAccountId: string;  // For revenue/sales
  expenseAccountId: string; // For expenses/purchases
  createdAt: string;
}
```

## Files Fixed

### 1. APView.tsx (Line 181)
**Before:**
```typescript
accountId: item.defaultAccountId,
```

**After:**
```typescript
accountId: item.expenseAccountId,
```

**Effect:** Bills now correctly debit the expense account configured for each item.

### 2. ARView.tsx (Line 163)
**Before:**
```typescript
accountId: item.defaultAccountId
```

**After:**
```typescript
accountId: item.incomeAccountId
```

**Effect:** Invoices now correctly credit the income/revenue account configured for each item.

### 3. JournalForm.tsx (Lines 74-75)
**Before:**
```typescript
newLine.accountId = item.defaultAccountId;
const acc = accounts.find(a => a.id === item.defaultAccountId);
```

**After:**
```typescript
// Use expenseAccountId for debits (expenses/purchases), incomeAccountId for credits (revenue)
newLine.accountId = newLine.debit > 0 ? item.expenseAccountId : item.incomeAccountId;
const acc = accounts.find(a => a.id === newLine.accountId);
```

**Effect:** Manual journal entries now use the correct account based on whether it's a debit (expense) or credit (revenue) transaction.

## How It Works Now

### Recording a Bill (AP)
1. User clicks "Record Bill" in Payables & Procurement view
2. Selects vendor and adds items with quantities and prices
3. System calculates:
   - Input VAT (12% of VATable purchases)
   - Expanded Withholding Tax (based on item WHT rates)
   - Net Payable to Vendor
4. When clicking "Post to Payables", system creates journal entry:
   - **Debit** expense accounts (from `item.expenseAccountId`)
   - **Debit** Input VAT account (1210)
   - **Credit** EWT Payable account (2300)
   - **Credit** Accounts Payable (vendor's AP account or 2100)

### Recording an Invoice (AR)
1. User clicks "Issue Invoice" in Receivables view
2. Selects customer and adds items
3. System creates journal entry:
   - **Debit** Accounts Receivable
   - **Credit** revenue accounts (from `item.incomeAccountId`)

## Verification Steps

To verify the fix works:

1. **Navigate to Payables & Procurement (AP tab)**
2. **Click "Record Bill"**
3. **Fill in bill details:**
   - Bill Date: Today
   - Vendor: Select any vendor
   - Add at least one item with quantity
4. **Click "Post to Payables"**
5. **Verify:**
   - Modal closes
   - Bill appears in bills list
   - Total Payables increases
   - Navigate to Ledger view
   - Confirm journal entry exists with correct accounts

## Impact
- ✅ Bills now post correctly to journal
- ✅ Expense accounts properly debited
- ✅ Vendor payables properly credited
- ✅ Input VAT and EWT calculated correctly
- ✅ Invoices continue to work with income accounts
- ✅ Manual journal entries handle both expense and income items

---

**Status:** ✅ Fixed  
**Date:** January 19, 2026  
**Files Changed:** 3 (APView.tsx, ARView.tsx, JournalForm.tsx)
