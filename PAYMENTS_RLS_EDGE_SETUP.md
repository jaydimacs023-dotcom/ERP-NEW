# Payments RLS + Edge Setup

This fixes your `401 / 42501` on `payments` while keeping multi-tenant isolation.

## Why You Got The Error

- Your app currently sends Supabase requests with `anon` bearer token.
- `payments` has RLS that allows only org-scoped authenticated inserts.
- Result: insert blocked (`new row violates row-level security policy`).

## Option A (Recommended): Keep strict RLS + use Supabase Auth JWT

1. Run SQL: [FIX_PAYMENTS_RLS_SECURE.sql](/e:/laragon/www/AT-ERP/FIX_PAYMENTS_RLS_SECURE.sql)
2. Ensure client writes use a valid Supabase `authenticated` JWT.
3. JWT must contain org claim (`org_id` or `orgId`).

If you do not use Supabase Auth yet, use Option B first.

## Option B: Keep custom JWT + Edge Function for writes

Use server-mediated writes with service role:

- Function file: [supabase/functions/payments-write/index.ts](/e:/laragon/www/AT-ERP/supabase/functions/payments-write/index.ts)

### Deploy

1. Set function secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AT_ERP_JWT_SECRET` (must match your app JWT signing secret)
2. Deploy:
```bash
supabase functions deploy payments-write
```

### Call pattern from frontend

```ts
await fetch(`${SUPABASE_URL}/functions/v1/payments-write`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${yourCustomJwt}`
  },
  body: JSON.stringify({
    action: "create_payment",
    payment: { ...paymentPayload, orgId: currentOrgId }
  })
});
```

Apply flow:
```ts
await fetch(`${SUPABASE_URL}/functions/v1/payments-write`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${yourCustomJwt}`
  },
  body: JSON.stringify({
    action: "apply_payment",
    orgId: currentOrgId,
    paymentId,
    invoiceId,
    amountApplied
  })
});
```

## Security Notes

- Do not use permissive `WITH CHECK (true)` policies in production multi-tenant.
- Keep `service_role` key only in Edge Function runtime, never in browser.
- Enforce `org_id` in function logic (already implemented).
