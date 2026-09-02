alter table public.time_expenses
  add column if not exists tax_category_id uuid references public.tax_categories(id);

create index if not exists idx_time_expenses_tax_category_id
  on public.time_expenses(tax_category_id);

create or replace function public.enforce_time_expense_tax_category_org_match()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.tax_category_id is not null and not exists (
    select 1
    from public.tax_categories tc
    where tc.id = new.tax_category_id
      and tc.org_id = new.org_id
  ) then
    raise exception 'Tax category must belong to the same organization';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_time_expense_tax_category_org on public.time_expenses;
create trigger enforce_time_expense_tax_category_org
before insert or update of tax_category_id, org_id on public.time_expenses
for each row execute function public.enforce_time_expense_tax_category_org_match();

revoke all on function public.enforce_time_expense_tax_category_org_match() from public, anon, authenticated;
