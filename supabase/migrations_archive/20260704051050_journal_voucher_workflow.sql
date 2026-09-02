-- Manual accounting source documents. System-generated transactions continue
-- to write journal_entries directly; manual transactions must originate here.
create table if not exists public.journal_vouchers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  company_id uuid references public.organizations(id),
  branch_id uuid,
  jv_number text not null,
  journal_date date not null,
  accounting_period_id uuid not null references public.accounting_periods(id),
  description text not null,
  reference_no text,
  status text not null default 'ON_HOLD' check (status in ('ON_HOLD', 'POSTED')),
  gl_reference text,
  prepared_by uuid not null references public.users(id),
  posted_by uuid references public.users(id),
  posted_at timestamptz,
  remarks text,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, jv_number),
  unique (org_id, gl_reference)
);

alter table public.chart_of_accounts
  add column if not exists is_active boolean not null default true;

create table if not exists public.journal_voucher_lines (
  id uuid primary key default gen_random_uuid(),
  journal_voucher_id uuid not null references public.journal_vouchers(id) on delete cascade,
  coa_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  line_description text,
  cost_center_id uuid,
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table if not exists public.general_journals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  gl_reference text not null,
  journal_date date not null,
  source text not null check (source = 'JOURNAL_VOUCHER'),
  source_id uuid not null references public.journal_vouchers(id),
  posted_by uuid not null references public.users(id),
  posted_at timestamptz not null default now(),
  unique (org_id, gl_reference),
  unique (source, source_id)
);

create table if not exists public.general_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  general_journal_id uuid not null references public.general_journals(id),
  gl_reference text not null,
  journal_date date not null,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  running_balance numeric(18,2) not null,
  description text,
  source_document text not null check (source_document = 'JOURNAL_VOUCHER'),
  source_id uuid not null references public.journal_vouchers(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_vouchers_org_date on public.journal_vouchers(org_id, journal_date desc);
create index if not exists idx_journal_voucher_lines_voucher on public.journal_voucher_lines(journal_voucher_id);
create index if not exists idx_general_ledger_account_date on public.general_ledger(org_id, account_id, journal_date, created_at);

alter table public.journal_vouchers enable row level security;
alter table public.journal_voucher_lines enable row level security;
alter table public.general_journals enable row level security;
alter table public.general_ledger enable row level security;

grant select, insert, update, delete on public.journal_vouchers to authenticated;
grant select, insert, update, delete on public.journal_voucher_lines to authenticated;
grant select on public.general_journals, public.general_ledger to authenticated;

create policy "journal vouchers tenant access" on public.journal_vouchers
  for all to authenticated
  using (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1))
  with check (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1));

create policy "journal voucher lines tenant access" on public.journal_voucher_lines
  for all to authenticated
  using (exists (
    select 1 from public.journal_vouchers v join public.users u on u.org_id = v.org_id
    where v.id = journal_voucher_id and u.auth_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.journal_vouchers v join public.users u on u.org_id = v.org_id
    where v.id = journal_voucher_id and u.auth_uid = (select auth.uid())
  ));

create policy "general journals tenant read" on public.general_journals
  for select to authenticated
  using (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1));

create policy "general ledger tenant read" on public.general_ledger
  for select to authenticated
  using (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1));

create or replace function public.prepare_journal_voucher()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare next_no bigint;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.org_id::text || ':JV', 0));
    select coalesce(max((regexp_match(jv_number, '([0-9]+)$'))[1]::bigint), 0) + 1
      into next_no from public.journal_vouchers where org_id = new.org_id;
    new.jv_number := 'JV-' || lpad(next_no::text, 6, '0');
    new.status := 'ON_HOLD';
    new.company_id := coalesce(new.company_id, new.org_id);
  else
    if old.status = 'POSTED' then raise exception 'Posted journal vouchers are immutable.'; end if;
    new.id := old.id; new.org_id := old.org_id; new.jv_number := old.jv_number;
    if new.status = 'POSTED' and exists (
      select 1 from public.general_journals g
      where g.source = 'JOURNAL_VOUCHER' and g.source_id = old.id
        and g.gl_reference = new.gl_reference
    ) then
      if new.gl_reference is null or new.posted_by is null or new.posted_at is null then
        raise exception 'Posted voucher metadata is incomplete.';
      end if;
    else
      new.status := old.status; new.gl_reference := old.gl_reference;
      new.posted_by := old.posted_by; new.posted_at := old.posted_at;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_prepare_journal_voucher on public.journal_vouchers;
create trigger trg_prepare_journal_voucher before insert or update on public.journal_vouchers
for each row execute function public.prepare_journal_voucher();

create or replace function public.audit_journal_voucher_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
    values (new.org_id, new.prepared_by, 'CREATED', 'JOURNAL_VOUCHER', new.id,
      'Created ' || new.jv_number || ' On Hold', now());
  elsif tg_op = 'UPDATE' and new.status = 'ON_HOLD' then
    insert into public.audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
    values (new.org_id, new.prepared_by, 'MODIFIED', 'JOURNAL_VOUCHER', new.id,
      'Modified ' || new.jv_number, now());
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
    values (old.org_id, old.prepared_by, 'DELETED', 'JOURNAL_VOUCHER', old.id,
      'Deleted ' || old.jv_number, now());
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_journal_voucher_change on public.journal_vouchers;
create trigger trg_audit_journal_voucher_change after insert or update or delete on public.journal_vouchers
for each row execute function public.audit_journal_voucher_change();

create or replace function public.guard_journal_voucher_line()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare voucher_status text;
begin
  select status into voucher_status from public.journal_vouchers
  where id = coalesce(new.journal_voucher_id, old.journal_voucher_id);
  if voucher_status = 'POSTED' then raise exception 'Posted journal voucher lines are immutable.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_guard_journal_voucher_line on public.journal_voucher_lines;
create trigger trg_guard_journal_voucher_line before insert or update or delete on public.journal_voucher_lines
for each row execute function public.guard_journal_voucher_line();

create or replace function public.replace_journal_voucher_lines(p_voucher_id uuid, p_lines jsonb)
returns setof public.journal_voucher_lines
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.journal_vouchers where id = p_voucher_id and status = 'ON_HOLD') then
    raise exception 'Only On Hold vouchers may be edited.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal voucher requires at least two lines.';
  end if;
  delete from public.journal_voucher_lines where journal_voucher_id = p_voucher_id;
  insert into public.journal_voucher_lines (
    journal_voucher_id, coa_id, debit, credit, line_description, cost_center_id, project_id
  )
  select p_voucher_id, (x->>'coa_id')::uuid,
    coalesce((x->>'debit')::numeric, 0), coalesce((x->>'credit')::numeric, 0),
    nullif(x->>'line_description', ''), nullif(x->>'cost_center_id', '')::uuid,
    nullif(x->>'project_id', '')::uuid
  from jsonb_array_elements(p_lines) x;
  return query select * from public.journal_voucher_lines where journal_voucher_id = p_voucher_id order by created_at;
end $$;

create or replace function public.post_journal_voucher(p_voucher_id uuid, p_posted_by uuid)
returns public.journal_vouchers
language plpgsql security invoker set search_path = ''
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
begin
  select * into v from public.journal_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Journal voucher not found.'; end if;
  if (select auth.uid()) is null or not exists (
    select 1 from public.users u
    where u.id = p_posted_by and u.auth_uid = (select auth.uid()) and u.org_id = v.org_id
  ) then raise exception 'You are not authorized to post this journal voucher.'; end if;
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
    where l.journal_voucher_id = v.id and (a.id is null or coalesce(a.is_active, true) = false or coalesce(a.is_header, false))
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

grant execute on function public.replace_journal_voucher_lines(uuid, jsonb) to authenticated;
revoke all on function public.post_journal_voucher(uuid, uuid) from public, anon;
grant execute on function public.post_journal_voucher(uuid, uuid) to authenticated;

comment on table public.journal_vouchers is 'Source document for all manually recorded journal transactions.';
comment on table public.general_journals is 'Official journal headers created only when a source document posts.';
comment on table public.general_ledger is 'Immutable ledger detail generated atomically from posted source documents.';
