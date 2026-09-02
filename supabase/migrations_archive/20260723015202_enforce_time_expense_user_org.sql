create or replace function public.enforce_time_expense_user_org()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  creator_org_id uuid;
  creator_role text;
  supplier_org_id uuid;
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

  select v.org_id into supplier_org_id
  from public.vendors v
  where v.id = new.supplier_id;

  if supplier_org_id is null or supplier_org_id <> new.org_id then
    raise exception 'The selected supplier does not belong to the expense organization.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_time_expense_user_org_trigger on public.time_expenses;
create trigger enforce_time_expense_user_org_trigger
  before insert or update of org_id, created_by, supplier_id
  on public.time_expenses
  for each row
  execute function public.enforce_time_expense_user_org();

revoke all on function public.enforce_time_expense_user_org() from public, anon, authenticated;
