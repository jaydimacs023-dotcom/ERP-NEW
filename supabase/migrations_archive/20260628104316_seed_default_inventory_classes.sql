-- Seed conservative inventory posting classes from each tenant's existing COA.
-- These rows map accounts only; they do not create or duplicate GL accounts.
with account_map as (
  select
    org_id,
    (max(id::text) filter (where code = '1160'))::uuid as training_inventory_id,
    (max(id::text) filter (where code = '1161'))::uuid as office_inventory_id,
    (max(id::text) filter (where code = '5104'))::uuid as training_expense_id,
    (max(id::text) filter (where code = '5216'))::uuid as office_expense_id,
    (max(id::text) filter (where code = '3201'))::uuid as opening_equity_id
  from public.chart_of_accounts
  group by org_id
)
insert into public.inventory_classes (
  org_id,
  code,
  name,
  inventory_asset_account_id,
  cogs_account_id,
  adjustment_account_id,
  purchase_price_variance_account_id,
  write_off_account_id,
  opening_balance_equity_account_id,
  valuation_method,
  is_active
)
select
  org_id,
  'TRAINING_MATERIALS',
  'Training Materials',
  training_inventory_id,
  training_expense_id,
  training_expense_id,
  training_expense_id,
  training_expense_id,
  opening_equity_id,
  'WEIGHTED_AVERAGE',
  true
from account_map
where training_inventory_id is not null
  and training_expense_id is not null
  and opening_equity_id is not null
on conflict (org_id, code) do nothing;

with account_map as (
  select
    org_id,
    (max(id::text) filter (where code = '1161'))::uuid as office_inventory_id,
    (max(id::text) filter (where code = '5216'))::uuid as office_expense_id,
    (max(id::text) filter (where code = '3201'))::uuid as opening_equity_id
  from public.chart_of_accounts
  group by org_id
)
insert into public.inventory_classes (
  org_id,
  code,
  name,
  inventory_asset_account_id,
  cogs_account_id,
  adjustment_account_id,
  purchase_price_variance_account_id,
  write_off_account_id,
  opening_balance_equity_account_id,
  valuation_method,
  is_active
)
select
  org_id,
  'OFFICE_SUPPLIES',
  'Office Supplies',
  office_inventory_id,
  office_expense_id,
  office_expense_id,
  office_expense_id,
  office_expense_id,
  opening_equity_id,
  'WEIGHTED_AVERAGE',
  true
from account_map
where office_inventory_id is not null
  and office_expense_id is not null
  and opening_equity_id is not null
on conflict (org_id, code) do nothing;
