-- This legacy trigger derives identity from auth.uid(). Edge Function writes use
-- the service role after validating the AT-ERP token, so auth.uid() is null and
-- the trigger overwrites valid tenant values. Tenant enforcement is handled by
-- enforce_time_expense_user_org_trigger instead.
drop trigger if exists time_expenses_set_created_by_trg on public.time_expenses;
drop function if exists public.time_expenses_set_created_by();
