alter table public.time_expenses
  add column if not exists employee_id uuid references public.users(id);

alter table public.payables
  add column if not exists employee_id uuid references public.users(id);

update public.time_expenses te
set employee_id = u.id
from public.users u
where te.employee_id is null
  and u.org_id = te.org_id
  and u.role <> 'SYSTEM_ADMIN'
  and lower(btrim(u.name)) = lower(btrim(te.claimed_by));

update public.payables p
set employee_id = u.id
from public.users u
where p.employee_id is null
  and u.org_id = p.org_id
  and u.role <> 'SYSTEM_ADMIN'
  and lower(btrim(u.name)) = lower(btrim(p.claimed_by));

create index if not exists idx_time_expenses_employee_id on public.time_expenses(employee_id);
create index if not exists idx_payables_employee_id on public.payables(employee_id);

create or replace function public.enforce_employee_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.employee_id is not null and not exists (
    select 1
    from public.users u
    where u.id = new.employee_id
      and u.org_id = new.org_id
      and u.role <> 'SYSTEM_ADMIN'
      and coalesce(u.is_active, true)
  ) then
    raise exception 'Employee must be an active user in the same organization';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_time_expense_employee_org on public.time_expenses;
create trigger enforce_time_expense_employee_org
before insert or update of employee_id, org_id on public.time_expenses
for each row execute function public.enforce_employee_org_match();

drop trigger if exists enforce_payable_employee_org on public.payables;
create trigger enforce_payable_employee_org
before insert or update of employee_id, org_id on public.payables
for each row execute function public.enforce_employee_org_match();

revoke all on function public.enforce_employee_org_match() from public, anon, authenticated;
