alter table public.time_expenses
  add column if not exists expense_account_id uuid
  references public.chart_of_accounts(id) on delete restrict;

create index if not exists time_expenses_expense_account_idx
  on public.time_expenses(expense_account_id);
