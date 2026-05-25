create unique index if not exists invoices_org_invoice_no_active_idx
  on public.invoices (org_id, invoice_no)
  where coalesce(is_deleted, false) = false;

create or replace function public.get_next_invoice_no(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(current_date, 'YYYY');
  v_next_seq integer;
begin
  if p_org_id is null then
    raise exception 'Organization ID is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_no:' || p_org_id::text));

  select coalesce(max(nullif(substring(invoice_no from '^INV-' || v_year || '-([0-9]+)$'), '')::integer), 0) + 1
    into v_next_seq
  from public.invoices
  where org_id = p_org_id
    and coalesce(is_deleted, false) = false
    and invoice_no ~ ('^INV-' || v_year || '-[0-9]+$');

  return 'INV-' || v_year || '-' || lpad(v_next_seq::text, 5, '0');
end;
$$;

grant execute on function public.get_next_invoice_no(uuid) to authenticated, anon;
