create or replace function public.enforce_employee_org_match()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.employee_id is not null and not exists (
    select 1
    from public.users u
    where u.id = new.employee_id
      and u.org_id = new.org_id
      and upper(coalesce(u.role, '')) <> 'SYSTEM_ADMIN'
      and coalesce(u.is_active, true)
  ) then
    raise exception 'Employee must be an active non-system user in the same organization';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_employee_org_match() from public, anon, authenticated;
