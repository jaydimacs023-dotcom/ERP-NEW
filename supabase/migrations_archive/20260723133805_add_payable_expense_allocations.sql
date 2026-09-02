alter table public.payables
  add column if not exists expense_allocations jsonb;

alter table public.payables
  add constraint payables_expense_allocations_is_array
  check (
    expense_allocations is null
    or jsonb_typeof(expense_allocations) = 'array'
  );
