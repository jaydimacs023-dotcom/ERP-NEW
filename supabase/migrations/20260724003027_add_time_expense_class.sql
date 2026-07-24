alter table public.time_expenses
  add column if not exists qualification_id uuid references public.qualifications(id);

create index if not exists idx_time_expenses_qualification_id
  on public.time_expenses(qualification_id);

create or replace function public.enforce_time_expense_class_org_match()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.qualification_id is not null and not exists (
    select 1
    from public.qualifications q
    where q.id = new.qualification_id
      and q.org_id = new.org_id
  ) then
    raise exception 'Class must be active and belong to the same organization';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_time_expense_class_org on public.time_expenses;
create trigger enforce_time_expense_class_org
before insert or update of qualification_id, org_id on public.time_expenses
for each row execute function public.enforce_time_expense_class_org_match();

revoke all on function public.enforce_time_expense_class_org_match() from public, anon, authenticated;
