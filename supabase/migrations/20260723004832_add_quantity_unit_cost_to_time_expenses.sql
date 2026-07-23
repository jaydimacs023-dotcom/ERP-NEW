alter table public.time_expenses
  add column if not exists quantity numeric(15,2),
  add column if not exists unit_cost numeric(15,2);

update public.time_expenses
set quantity = 1,
    unit_cost = amount
where quantity is null
   or unit_cost is null;

alter table public.time_expenses
  alter column quantity set not null,
  alter column unit_cost set not null,
  add constraint time_expenses_quantity_positive check (quantity > 0),
  add constraint time_expenses_unit_cost_positive check (unit_cost > 0),
  add constraint time_expenses_amount_matches_cost check (amount = round(quantity * unit_cost, 2));
