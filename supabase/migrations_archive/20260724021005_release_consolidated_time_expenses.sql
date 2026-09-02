alter table public.time_expenses
  drop constraint if exists time_expenses_status_check;

alter table public.time_expenses
  add constraint time_expenses_status_check
  check (status in ('open', 'released', 'billed'));
