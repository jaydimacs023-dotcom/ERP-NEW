alter table public.payables
  add column if not exists expense_account_id uuid
  references public.chart_of_accounts(id) on delete restrict;

create index if not exists idx_payables_expense_account_id
  on public.payables (expense_account_id)
  where expense_account_id is not null;

comment on column public.payables.expense_account_id is
  'Expense GL account selected when the payable bill is created.';
