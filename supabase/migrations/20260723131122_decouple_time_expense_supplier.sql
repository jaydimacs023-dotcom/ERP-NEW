alter table public.time_expenses
  add column if not exists supplier_name text;

update public.time_expenses expense
set supplier_name = vendor.name
from public.vendors vendor
where expense.supplier_id = vendor.id
  and nullif(btrim(expense.supplier_name), '') is null;

update public.time_expenses
set supplier_name = 'Unknown supplier'
where nullif(btrim(supplier_name), '') is null;

alter table public.time_expenses
  alter column supplier_name set not null,
  alter column supplier_id drop not null;

alter table public.time_expenses
  add constraint time_expenses_supplier_name_not_blank
  check (btrim(supplier_name) <> ''),
  add constraint time_expenses_claimed_by_not_blank
  check (btrim(claimed_by) <> '');

create or replace function public.enforce_time_expense_user_org()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  creator_org_id uuid;
  creator_role text;
begin
  if new.created_by is null then
    raise exception 'A creator is required for every time expense.' using errcode = '23514';
  end if;

  select u.org_id, u.role
    into creator_org_id, creator_role
  from public.users u
  where u.id = new.created_by
    and coalesce(u.is_active, true);

  if not found then
    raise exception 'The time expense creator is unavailable or inactive.' using errcode = '23514';
  end if;

  if upper(coalesce(creator_role, '')) <> 'SYSTEM_ADMIN' then
    if creator_org_id is null then
      raise exception 'The time expense creator has no organization.' using errcode = '23514';
    end if;
    new.org_id := creator_org_id;
  elsif new.org_id is null then
    raise exception 'System administrators must select an organization.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_time_expense_user_org_trigger on public.time_expenses;
create trigger enforce_time_expense_user_org_trigger
  before insert or update of org_id, created_by
  on public.time_expenses
  for each row
  execute function public.enforce_time_expense_user_org();

revoke all on function public.enforce_time_expense_user_org() from public, anon, authenticated;
