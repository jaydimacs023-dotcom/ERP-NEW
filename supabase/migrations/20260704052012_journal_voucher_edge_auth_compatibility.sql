-- Voucher requests are authenticated by the journal-vouchers Edge Function
-- using AT_ERP_JWT_SECRET, then executed with the service role. Permit that
-- trusted boundary to call the atomic posting routine.
create or replace function public.post_journal_voucher(p_voucher_id uuid, p_posted_by uuid)
returns public.journal_vouchers
language plpgsql security definer set search_path = ''
as $$
declare
  v public.journal_vouchers;
  v_journal_id uuid;
  v_entry_id uuid;
  v_gl text;
  v_sequence bigint;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_now timestamptz := now();
  v_service_call boolean :=
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  select * into v from public.journal_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Journal voucher not found.'; end if;
  if not v_service_call and (
    (select auth.uid()) is null or not exists (
      select 1 from public.users u
      where u.id = p_posted_by and u.auth_uid = (select auth.uid()) and u.org_id = v.org_id
    )
  ) then raise exception 'You are not authorized to post this journal voucher.'; end if;
  if not exists (select 1 from public.users u where u.id = p_posted_by and u.org_id = v.org_id) then
    raise exception 'Posting user does not belong to this organization.';
  end if;
  if v.status <> 'ON_HOLD' then raise exception 'Journal voucher has already been posted.'; end if;
  if v.description is null or btrim(v.description) = '' or v.accounting_period_id is null then
    raise exception 'Journal date, accounting period, and description are required.';
  end if;
  if not exists (
    select 1 from public.accounting_periods p where p.id = v.accounting_period_id
      and p.org_id = v.org_id and p.status = 'OPEN'
      and v.journal_date between p.start_date and p.end_date
  ) then raise exception 'The selected accounting period is not open for this journal date.'; end if;
  if exists (
    select 1 from public.journal_voucher_lines l
    left join public.chart_of_accounts a on a.id = l.coa_id and a.org_id = v.org_id
    where l.journal_voucher_id = v.id
      and (a.id is null or coalesce(a.is_active, true) = false or coalesce(a.is_header, false))
  ) then raise exception 'All voucher lines must use active posting accounts from this company.'; end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_debit, v_credit
    from public.journal_voucher_lines where journal_voucher_id = v.id;
  if v_debit <= 0 or v_credit <= 0 or v_debit <> v_credit then
    raise exception 'Debits and credits must be equal and greater than zero.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v.org_id::text || ':GL:' || extract(year from v.journal_date)::text, 0));
  select coalesce(max((regexp_match(gl_reference, '([0-9]+)$'))[1]::bigint), 0) + 1
    into v_sequence from public.general_journals
    where org_id = v.org_id and extract(year from journal_date) = extract(year from v.journal_date);
  v_gl := 'GL-' || extract(year from v.journal_date)::int || '-' || lpad(v_sequence::text, 6, '0');

  insert into public.journal_entries (
    org_id, period_id, date, description, reference, gl_entry_number, status,
    created_by, source_type, source_ref, posted_by, posted_at, created_at, updated_at
  ) values (
    v.org_id, v.accounting_period_id, v.journal_date, v.description, v_gl, v_gl, 'POSTED',
    v.prepared_by, 'MANUAL', v.id, p_posted_by, v_now, v.created_at, v_now
  ) returning id into v_entry_id;

  insert into public.journal_lines (org_id, journal_entry_id, account_id, debit, credit, memo, description)
  select v.org_id, v_entry_id, coa_id, debit, credit, line_description, line_description
  from public.journal_voucher_lines where journal_voucher_id = v.id;

  insert into public.general_journals (org_id, gl_reference, journal_date, source, source_id, posted_by, posted_at)
  values (v.org_id, v_gl, v.journal_date, 'JOURNAL_VOUCHER', v.id, p_posted_by, v_now)
  returning id into v_journal_id;

  insert into public.general_ledger (
    org_id, general_journal_id, gl_reference, journal_date, account_id, debit, credit,
    running_balance, description, source_document, source_id
  )
  select v.org_id, v_journal_id, v_gl, v.journal_date, l.coa_id, l.debit, l.credit,
    coalesce((select sum(g.debit - g.credit) from public.general_ledger g
      where g.org_id = v.org_id and g.account_id = l.coa_id), 0) + l.debit - l.credit,
    coalesce(l.line_description, v.description), 'JOURNAL_VOUCHER', v.id
  from public.journal_voucher_lines l where l.journal_voucher_id = v.id;

  update public.journal_vouchers set status = 'POSTED', gl_reference = v_gl,
    posted_by = p_posted_by, posted_at = v_now, updated_at = v_now where id = v.id;
  insert into public.audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
  values (v.org_id, p_posted_by, 'POSTED', 'JOURNAL_VOUCHER', v.id,
    'Posted ' || v.jv_number || ' as ' || v_gl, v_now);
  select * into v from public.journal_vouchers where id = v.id;
  return v;
end $$;

revoke all on function public.post_journal_voucher(uuid, uuid) from public, anon;
grant execute on function public.post_journal_voucher(uuid, uuid) to authenticated, service_role;
