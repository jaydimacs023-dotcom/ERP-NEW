-- Wrap payable posting so authenticated callers cannot spoof the acting user.
alter function public.post_payable_bill(uuid, uuid) rename to post_payable_bill_internal;

revoke all on function public.post_payable_bill_internal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.post_payable_bill_internal(uuid, uuid) to service_role;

create function public.post_payable_bill(p_payable_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := nullif(auth.jwt() ->> 'sub', '')::uuid;
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
