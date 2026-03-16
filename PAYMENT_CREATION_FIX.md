# Payment Creation - Duplicate Key Error Fix

## Problem
When creating a payment, users encountered error: `Failed to insert into payments: {"code":"23505","details":null,"hint":null,"message":"duplicate key value violates unique constraint \"payments_org_id_payment_no_key\""`

This error occurred because the payment_no (payment number) generation logic didn't properly account for:
1. Organization boundaries (payments from different orgs were being counted)
2. Soft-deleted payments (deleted payments were still being counted in the sequence)
3. Race conditions when multiple users try to create payments simultaneously

## Root Cause
- `generatePaymentNo()` in PaymentsView.tsx and `getNextPaymentNo()` in App.tsx were generating payment numbers without filtering by organization ID or checking for deleted status
- The Supabase database query was fetching ALL payments without filtering `is_deleted = FALSE`
- No atomic server-side function existed to generate unique payment numbers

## Solution Implemented

### 1. Database Function (NEW)
**File**: `CREATE_PAYMENT_NUMBER_FUNCTION.sql`
- Created `get_next_payment_no(p_org_id UUID)` function in PostgreSQL
- Uses advisory locking to prevent race conditions
- Generates unique sequential numbers per organization per year
- Format: `PAY-YYYY-#####` (e.g., `PAY-2026-00001`)
- Only counts non-deleted payments when determining the next sequence number

**To Deploy**:
```bash
# Run in Supabase SQL Editor
\i CREATE_PAYMENT_NUMBER_FUNCTION.sql
```

### 2. Client-Side Fixes

#### App.tsx - `getNextPaymentNo()`
- Added filter for `currentOrgId` - only considers payments from current organization
- Added filter for `!p.isDeleted` - excludes soft-deleted payments
- Ensures proper number generation before creation and on retry

#### PaymentsView.tsx - `generatePaymentNo()`
- Added filter for `!p.isDeleted` - excludes soft-deleted payments
- Added pattern matching to only count payments from current year
- Ensures temporary payment number doesn't conflict with existing ones

#### App.tsx - Initial Data Load
- Added filter when loading payments: `.filter(p => !p.isDeleted)`
- Ensures soft-deleted payments don't affect the UI or number generation

### 3. Future Improvements (Optional)
For production deployments, consider:
1. **Use database function**: Update the Supabase function call to use `get_next_payment_no()` instead of client-side generation
2. **Filter at query level**: Modify `fetchFromSupabase()` in SupabaseDataService to add `&is_deleted=eq.false` filter
3. **Implement idempotency**: Add request deduplication to prevent double-creation

## Testing Checklist
- [ ] Create a single payment - should succeed with unique payment_no
- [ ] Create multiple payments in same session - each should get unique sequential numbers
- [ ] Create payment from different organization - should have separate sequence
- [ ] Delete a payment (soft delete) - new payments should not reuse the deleted number
- [ ] Test concurrent payment creation - both should succeed with unique numbers

## Files Modified
1. `CREATE_PAYMENT_NUMBER_FUNCTION.sql` - NEW
2. `App.tsx` - lines ~3183-3200, ~471
3. `views/PaymentsView.tsx` - lines ~175-200

## Error Handling
The system now:
1. Generates payment numbers with org + deleted filtering
2. Has a retry mechanism if duplicate key is still detected
3. Provides clear error messages if payment creation fails

## Deployment Notes
1. Deploy the SQL function first
2. Rebuild the frontend to get the latest client-side fixes
3. No data migration needed - existing payments are unaffected
4. RLS policies on payments table ensure org isolation
