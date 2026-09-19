-- Resolve ERP authorization from the server-maintained users table. Do not use
-- user-editable JWT metadata for organization or role decisions.
create or replace function private.erp_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_uid = (select auth.uid())
    and coalesce(u.is_active, true)
    and (u.locked_until is null or u.locked_until <= now())
  limit 1;
$$;

create or replace function private.erp_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.org_id
  from public.users u
  where u.auth_uid = (select auth.uid())
    and coalesce(u.is_active, true)
    and (u.locked_until is null or u.locked_until <= now())
  limit 1;
$$;

create or replace function private.erp_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select upper(u.role::text)
  from public.users u
  where u.auth_uid = (select auth.uid())
    and coalesce(u.is_active, true)
    and (u.locked_until is null or u.locked_until <= now())
  limit 1;
$$;

revoke all on function private.erp_current_user_id() from public, anon;
revoke all on function private.erp_org_id() from public, anon;
revoke all on function private.erp_app_role() from public, anon;
grant execute on function private.erp_current_user_id() to authenticated;
grant execute on function private.erp_org_id() to authenticated;
grant execute on function private.erp_app_role() to authenticated;

drop policy if exists users_select_all on public.users;
drop policy if exists users_self_view on public.users;
revoke all on table public.users from anon;
revoke insert, update, delete on table public.users from authenticated;
grant select on table public.users to authenticated;

create policy users_tenant_select
on public.users for select to authenticated
using (
  auth_uid = (select auth.uid())
  or private.erp_is_system_admin()
  or org_id = private.erp_org_id()
);

-- The public wrapper accepts the legacy ERP user id for compatibility, but
-- verifies it against the ERP profile linked to the authenticated auth.uid().
create or replace function public.post_payable_bill(p_payable_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := private.erp_current_user_id();
begin
  if v_actor_id is null or v_actor_id <> p_actor_id then
    raise exception 'Posting actor does not match the authenticated user';
  end if;

  if not private.erp_has_role(
    'SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SUPERVISOR'
  ) then
    raise exception 'Insufficient permission to post payable bill';
  end if;

  return public.post_payable_bill_internal(p_payable_id, v_actor_id);
end;
$$;

revoke all on function public.post_payable_bill(uuid, uuid) from public, anon;
grant execute on function public.post_payable_bill(uuid, uuid) to authenticated;
