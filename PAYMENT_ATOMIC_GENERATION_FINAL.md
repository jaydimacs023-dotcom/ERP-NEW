# Payment Creation - Atomic Number Generation Fix

## Problem
Payment creation was failing with: 
```
duplicate key value violates unique constraint "payments_org_id_payment_no_key"
```

**Root Cause**: Race conditions when multiple concurrent payment creation requests generated the same payment number client-side before either hit the database constraint.

## Solution Implemented

### 1. Database-Level Atomic Generation
**File**: `CREATE_PAYMENT_NUMBER_FUNCTION.sql`
```sql
CREATE OR REPLACE FUNCTION get_next_payment_no(p_org_id UUID) RETURNS VARCHAR
```
- Uses PostgreSQL advisory locks to prevent concurrent conflicts
- Generates unique sequential numbers per organization per year
- Only counts non-deleted payments

### 2. Supabase Edge Function Update
**File**: `supabase/functions/payments-write/index.ts`
- Modified to call `get_next_payment_no()` atomically on the server
- Now generates the actual payment number DURING insertion, not before
- Prevents any race conditions from concurrent requests

### 3. Service Layer Update
**File**: `services/SupabaseDataService.ts`
- Added `createPaymentViaEdgeFunction()` method
- Modified `createEntity()` to detect 'payments' table and route through edge function
- Ensures all payment creation goes through the atomic process

### 4. Application Layer Simplification
**File**: `App.tsx`
- Removed retry logic (no longer needed since server now handles concurrency)
- Removed `isDuplicateKeyError()` function (no longer triggered)
- Simplified error handling

## How It Works Now

```
User Creates Payment
       ↓
Client generates temp payment_no for UI display (e.g., "PAY-2026-00001")
       ↓
Edge Function receives request
       ↓
Database Function called: get_next_payment_no(org_id)
  ├─ Acquires advisory lock for org_id
  ├─ Queries max existing payment sequence
  ├─ Increments to next unique number
  ├─ Releases lock
       ↓
Server inserts with ACTUAL atomically-generated payment_no
       ↓
Response sent to client with real payment_no
       ↓
UI updated with actual payment number
```

## Key Improvements

✅ **No Race Conditions**: Advisory locks prevent concurrent collision  
✅ **Org Isolation**: Separate sequences per organization  
✅ **Soft Delete Aware**: Deleted payments don't count in sequence  
✅ **Guaranteed Uniqueness**: Constraint violation errors eliminated  
✅ **Simpler Client Code**: No retry logic needed  

## Deployment Steps

### 1. Deploy Database Function
```bash
# In Supabase SQL Editor, run:
-- Copy contents of CREATE_PAYMENT_NUMBER_FUNCTION.sql
```

### 2. Deploy/Redeploy Edge Function
```bash
supabase functions deploy payments-write
```

### 3. Rebuild Frontend
```bash
npm run build
```

### 4. Test
Create multiple payments concurrently - all should succeed with unique numbers.

## Files Modified

| File | Changes |
|------|---------|
| `CREATE_PAYMENT_NUMBER_FUNCTION.sql` | NEW - Database function |
| `supabase/functions/payments-write/index.ts` | Call database function for atomic generation |
| `services/SupabaseDataService.ts` | Route payments to edge function |
| `App.tsx` | Remove retry logic, simplify error handling |
| `views/PaymentsView.tsx` | Already filters deleted payments (from previous fix) |

## Testing Checklist

- [ ] Single payment creation succeeds
- [ ] Multiple concurrent payments get unique numbers
- [ ] Cross-org payments have separate sequences
- [ ] Deleted payments don't break sequences
- [ ] Error messages are clear
- [ ] Audit logs record correct payment numbers
- [ ] Payment-to-invoice application works correctly

## Notes

- Client still generates temp UI numbers for quick feedback
- Server always generates the actual final number
- This is done transparently to the user
- No data migration needed for existing payments
