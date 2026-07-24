alter table public.payables
  add column if not exists memo_adjustment_total numeric(15,2) not null default 0;

alter table public.journal_entries drop constraint if exists journal_entries_source_type_check;
alter table public.journal_entries add constraint journal_entries_source_type_check check (
  source_type in (
    'MANUAL','INVOICE','BILL','PAYMENT','COLLECTION','DEPRECIATION','TRANSFER',
    'PURCHASE_ORDER','PAYROLL','CREDIT_MEMO','DEBIT_MEMO','GR_IR','ACCRUAL',
    'REVERSAL','APPLICATION','VOID','DEPOSIT','INVENTORY'
  )
);

create table if not exists public.ap_memos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  memo_number text not null,
  memo_type text not null check (memo_type in ('CREDIT','DEBIT')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PENDING_APPROVAL','POSTED','CANCELLED','REVERSED')),
  payable_id uuid not null references public.payables(id),
  vendor_id uuid not null references public.vendors(id),
  memo_date date not null,
  amount numeric(15,2) not null check (amount > 0),
  reason text not null,
  reference text,
  adjustment_account_id uuid not null references public.chart_of_accounts(id),
  journal_entry_id uuid references public.journal_entries(id),
  reversal_journal_id uuid references public.journal_entries(id),
  legacy_payable_id uuid unique references public.payables(id),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  submitted_by uuid references public.users(id),
  submitted_at timestamptz,
  posted_by uuid references public.users(id),
  posted_at timestamptz,
  cancelled_by uuid references public.users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  reversed_by uuid references public.users(id),
  reversed_at timestamptz,
  reversal_reason text,
  is_deleted boolean not null default false,
  deleted_by uuid references public.users(id),
  deleted_at timestamptz,
  unique (org_id, memo_number)
);

create index if not exists idx_ap_memos_org_date
  on public.ap_memos (org_id, memo_date desc, created_at desc)
  where is_deleted = false;
create index if not exists idx_ap_memos_payable_status
  on public.ap_memos (payable_id, status)
  where is_deleted = false;
create index if not exists idx_ap_memos_vendor
  on public.ap_memos (vendor_id, memo_date desc)
  where is_deleted = false;
create unique index if not exists uq_ap_memo_posting_journal
  on public.journal_entries (source_type, source_ref)
  where source_type in ('CREDIT_MEMO','DEBIT_MEMO') and source_ref is not null;

alter table public.ap_memos enable row level security;
drop policy if exists ap_memos_org_select on public.ap_memos;
create policy ap_memos_org_select on public.ap_memos for select to anon, authenticated
using (exists (
  select 1 from public.users u
  where (u.id = auth.uid() or u.auth_uid = auth.uid())
    and u.org_id = ap_memos.org_id and coalesce(u.is_active,true)
));
drop policy if exists ap_memos_org_insert on public.ap_memos;
create policy ap_memos_org_insert on public.ap_memos for insert to anon, authenticated
with check (exists (
  select 1 from public.users u
  where (u.id = auth.uid() or u.auth_uid = auth.uid())
    and u.org_id = ap_memos.org_id and coalesce(u.is_active,true)
    and upper(u.role::text) not in ('STUDENT','TRAINER')
));
drop policy if exists ap_memos_org_update on public.ap_memos;
create policy ap_memos_org_update on public.ap_memos for update to anon, authenticated
using (exists (
  select 1 from public.users u
  where (u.id = auth.uid() or u.auth_uid = auth.uid())
    and u.org_id = ap_memos.org_id and coalesce(u.is_active,true)
))
with check (exists (
  select 1 from public.users u
  where (u.id = auth.uid() or u.auth_uid = auth.uid())
    and u.org_id = ap_memos.org_id and coalesce(u.is_active,true)
));
revoke all on public.ap_memos from anon, authenticated;
grant select, insert, update on public.ap_memos to service_role;

create or replace function public.ap_memo_actor_allowed(p_actor_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.users u
    where u.id=p_actor_id and coalesce(u.is_active,true)
      and (u.org_id=p_org_id or upper(u.role::text)='SYSTEM_ADMIN')
      and upper(u.role::text) not in ('STUDENT','TRAINER')
  );
$$;

create or replace function public.next_ap_memo_number(p_org_id uuid, p_memo_type text, p_memo_date date, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_prefix text;
  v_year text;
  v_next bigint;
begin
  if not public.ap_memo_actor_allowed(p_actor_id,p_org_id) then raise exception 'Not authorized for this organization.'; end if;
  v_prefix := case upper(p_memo_type) when 'CREDIT' then 'CM' when 'DEBIT' then 'DM'
    else null end;
  if v_prefix is null then raise exception 'Memo type must be CREDIT or DEBIT.'; end if;
  v_year := extract(year from p_memo_date)::int::text;
  perform pg_advisory_xact_lock(hashtextextended('ap-memo:'||p_org_id::text||':'||v_prefix||':'||v_year,0));
  select coalesce(max(substring(memo_number from '[0-9]+$')::bigint),0)+1 into v_next
  from public.ap_memos
  where org_id=p_org_id and memo_number like v_prefix||'-'||v_year||'-%';
  return v_prefix||'-'||v_year||'-'||lpad(v_next::text,5,'0');
end;
$$;

create or replace function public.create_ap_memo(
  p_org_id uuid, p_memo_type text, p_payable_id uuid, p_vendor_id uuid,
  p_memo_date date, p_amount numeric, p_reason text, p_reference text,
  p_adjustment_account_id uuid, p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_bill public.payables%rowtype;
  v_memo public.ap_memos%rowtype;
  v_balance numeric(15,2);
begin
  if not public.ap_memo_actor_allowed(p_actor_id,p_org_id) then raise exception 'Not authorized for this organization.'; end if;
  if upper(p_memo_type) not in ('CREDIT','DEBIT') or p_amount<=0 or nullif(btrim(p_reason),'') is null then
    raise exception 'Type, positive amount, and reason are required.';
  end if;
  select * into v_bill from public.payables where id=p_payable_id and org_id=p_org_id
    and vendor_id=p_vendor_id and not coalesce(is_deleted,false) for update;
  if not found or v_bill.status not in ('approved','partially_paid','paid') or v_bill.journal_entry_id is null then
    raise exception 'The referenced supplier bill must be approved and posted.';
  end if;
  v_balance:=round(coalesce(nullif(v_bill.net_payable,0),v_bill.amount)
    +coalesce(v_bill.memo_adjustment_total,0)-coalesce(v_bill.paid_amount,0),2);
  if p_amount>v_balance+0.005 then raise exception 'Memo amount exceeds the bill outstanding balance of %.',v_balance; end if;
  if not exists (select 1 from public.chart_of_accounts a where a.id=p_adjustment_account_id
    and a.org_id=p_org_id and a.class in ('EXPENSE','ASSET') and not a.is_header)
    then raise exception 'Select a valid Expense or Asset adjustment account.'; end if;
  insert into public.ap_memos (
    org_id,memo_number,memo_type,status,payable_id,vendor_id,memo_date,amount,reason,
    reference,adjustment_account_id,created_by
  ) values (
    p_org_id,public.next_ap_memo_number(p_org_id,upper(p_memo_type),p_memo_date,p_actor_id),
    upper(p_memo_type),'DRAFT',p_payable_id,p_vendor_id,p_memo_date,round(p_amount,2),
    btrim(p_reason),nullif(btrim(p_reference),''),p_adjustment_account_id,p_actor_id
  ) returning * into v_memo;
  return to_jsonb(v_memo);
end;
$$;

create or replace function public.submit_ap_memo(p_memo_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_memo public.ap_memos%rowtype;
begin
  select * into v_memo from public.ap_memos where id=p_memo_id and not is_deleted for update;
  if not found then raise exception 'AP memo not found.'; end if;
  if not public.ap_memo_actor_allowed(p_actor_id,v_memo.org_id) then raise exception 'Not authorized for this organization.'; end if;
  if v_memo.status='PENDING_APPROVAL' then return jsonb_build_object('memoId',v_memo.id,'status',v_memo.status,'idempotent',true); end if;
  if v_memo.status<>'DRAFT' then raise exception 'Only a draft memo can be submitted.'; end if;
  update public.ap_memos set status='PENDING_APPROVAL',submitted_by=p_actor_id,submitted_at=now(),
    updated_by=p_actor_id,updated_at=now() where id=v_memo.id;
  return jsonb_build_object('memoId',v_memo.id,'status','PENDING_APPROVAL','idempotent',false);
end;
$$;

create or replace function public.post_ap_memo(p_memo_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_memo public.ap_memos%rowtype;
  v_bill public.payables%rowtype;
  v_entry_id uuid;
  v_period_id uuid;
  v_current_balance numeric(15,2);
  v_delta numeric(15,2);
  v_debit numeric(15,2);
  v_credit numeric(15,2);
begin
  select * into v_memo from public.ap_memos where id=p_memo_id and not is_deleted for update;
  if not found then raise exception 'AP memo not found.'; end if;
  if not public.ap_memo_actor_allowed(p_actor_id,v_memo.org_id) then raise exception 'Not authorized for this organization.'; end if;
  if v_memo.journal_entry_id is not null and v_memo.status='POSTED' then
    return jsonb_build_object('memoId',v_memo.id,'journalEntryId',v_memo.journal_entry_id,'status','POSTED','idempotent',true);
  end if;
  if v_memo.status<>'PENDING_APPROVAL' then raise exception 'Only a pending memo can be posted.'; end if;

  select * into v_bill from public.payables where id=v_memo.payable_id and not coalesce(is_deleted,false) for update;
  if not found or v_bill.org_id<>v_memo.org_id or v_bill.vendor_id is distinct from v_memo.vendor_id then
    raise exception 'The referenced supplier bill is invalid.';
  end if;
  if v_bill.status not in ('approved','partially_paid','paid') or v_bill.journal_entry_id is null then
    raise exception 'The referenced supplier bill must be approved and posted.';
  end if;
  v_current_balance := round(coalesce(nullif(v_bill.net_payable,0),v_bill.amount)
    + coalesce(v_bill.memo_adjustment_total,0) - coalesce(v_bill.paid_amount,0),2);
  if v_current_balance<=0 or v_memo.amount>v_current_balance+0.005 then
    raise exception 'Memo amount exceeds the bill outstanding balance of %.',v_current_balance;
  end if;
  if not exists (
    select 1 from public.chart_of_accounts a where a.id=v_memo.adjustment_account_id
      and a.org_id=v_memo.org_id and a.class in ('EXPENSE','ASSET') and not a.is_header
  ) then raise exception 'Select a valid Expense or Asset adjustment account.'; end if;
  select p.id into v_period_id from public.accounting_periods p where p.org_id=v_memo.org_id
    and p.status='OPEN' and v_memo.memo_date between p.start_date and p.end_date
    and not coalesce(p.is_deleted,false) order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the memo date.'; end if;

  v_entry_id:=gen_random_uuid();
  insert into public.journal_entries (
    id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,
    approved_by,approved_at,gl_entry_number,created_at,updated_at
  ) values (
    v_entry_id,v_memo.org_id,v_period_id,v_memo.memo_date,
    case when v_memo.memo_type='CREDIT' then 'AP Credit Memo: ' else 'AP Debit Memo: ' end||v_memo.reason,
    v_memo.memo_number,'POSTED',p_actor_id,
    case when v_memo.memo_type='CREDIT' then 'CREDIT_MEMO' else 'DEBIT_MEMO' end,
    v_memo.id,p_actor_id,now(),public.ap_next_gl_number(v_memo.org_id),now(),now()
  );
  insert into public.journal_lines (id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type)
  values (
    gen_random_uuid(),v_entry_id,v_bill.gl_account_id,
    case when v_memo.memo_type='CREDIT' then v_memo.amount else 0 end,
    case when v_memo.memo_type='DEBIT' then v_memo.amount else 0 end,
    v_memo.memo_number||' - Accounts Payable',v_memo.vendor_id,'VENDOR'
  ),(
    gen_random_uuid(),v_entry_id,v_memo.adjustment_account_id,
    case when v_memo.memo_type='DEBIT' then v_memo.amount else 0 end,
    case when v_memo.memo_type='CREDIT' then v_memo.amount else 0 end,
    v_memo.memo_number||' - '||v_memo.reason,v_memo.vendor_id,'VENDOR'
  );
  select sum(debit),sum(credit) into v_debit,v_credit from public.journal_lines where journal_entry_id=v_entry_id;
  if abs(v_debit-v_credit)>0.005 then raise exception 'Memo journal is not balanced.'; end if;
  v_delta:=case when v_memo.memo_type='CREDIT' then -v_memo.amount else v_memo.amount end;
  update public.payables set memo_adjustment_total=round(coalesce(memo_adjustment_total,0)+v_delta,2),updated_at=now()
    where id=v_bill.id;
  update public.ap_memos set status='POSTED',journal_entry_id=v_entry_id,posted_by=p_actor_id,posted_at=now(),
    updated_by=p_actor_id,updated_at=now() where id=v_memo.id;
  return jsonb_build_object('memoId',v_memo.id,'journalEntryId',v_entry_id,'status','POSTED','idempotent',false);
end;
$$;

create or replace function public.reverse_ap_memo(p_memo_id uuid, p_actor_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_memo public.ap_memos%rowtype;
  v_original public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_period_id uuid;
  v_delta numeric(15,2);
begin
  select * into v_memo from public.ap_memos where id=p_memo_id and not is_deleted for update;
  if not found then raise exception 'AP memo not found.'; end if;
  if not public.ap_memo_actor_allowed(p_actor_id,v_memo.org_id) then raise exception 'Not authorized for this organization.'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reversal reason is required.'; end if;
  if v_memo.status='REVERSED' then return jsonb_build_object('memoId',v_memo.id,'journalEntryId',v_memo.reversal_journal_id,'status','REVERSED','idempotent',true); end if;
  if v_memo.status<>'POSTED' or v_memo.journal_entry_id is null then raise exception 'Only a posted memo can be reversed.'; end if;
  select * into v_original from public.journal_entries where id=v_memo.journal_entry_id for update;
  select p.id into v_period_id from public.accounting_periods p where p.org_id=v_memo.org_id
    and p.status='OPEN' and current_date between p.start_date and p.end_date
    and not coalesce(p.is_deleted,false) order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the reversal date.'; end if;
  v_reversal_id:=gen_random_uuid();
  insert into public.journal_entries (
    id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,
    approved_by,approved_at,gl_entry_number,original_entry_id,reversal_reason,created_at,updated_at
  ) values (
    v_reversal_id,v_memo.org_id,v_period_id,current_date,'Reversal: '||v_original.description,
    'REV-'||v_memo.memo_number,'POSTED',p_actor_id,'REVERSAL',v_memo.id,p_actor_id,now(),
    public.ap_next_gl_number(v_memo.org_id),v_original.id,p_reason,now(),now()
  );
  insert into public.journal_lines (
    id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type,classification_code,tax_category_id
  )
  select gen_random_uuid(),v_reversal_id,account_id,credit,debit,'Reversal: '||coalesce(description,memo,''),
    contact_id,contact_type,classification_code,tax_category_id
  from public.journal_lines where journal_entry_id=v_original.id;
  v_delta:=case when v_memo.memo_type='CREDIT' then -v_memo.amount else v_memo.amount end;
  update public.payables set memo_adjustment_total=round(coalesce(memo_adjustment_total,0)-v_delta,2),updated_at=now()
    where id=v_memo.payable_id;
  update public.journal_entries set status='REVERSED',reversed_by=p_actor_id,reversed_at=now(),
    reversal_reason=p_reason,updated_at=now() where id=v_original.id;
  update public.ap_memos set status='REVERSED',reversal_journal_id=v_reversal_id,reversed_by=p_actor_id,
    reversed_at=now(),reversal_reason=p_reason,updated_by=p_actor_id,updated_at=now() where id=v_memo.id;
  return jsonb_build_object('memoId',v_memo.id,'journalEntryId',v_reversal_id,'status','REVERSED','idempotent',false);
end;
$$;

create or replace function public.cancel_ap_memo(p_memo_id uuid, p_actor_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_memo public.ap_memos%rowtype;
begin
  select * into v_memo from public.ap_memos where id=p_memo_id and not is_deleted for update;
  if not found then raise exception 'AP memo not found.'; end if;
  if not public.ap_memo_actor_allowed(p_actor_id,v_memo.org_id) then raise exception 'Not authorized for this organization.'; end if;
  if v_memo.status='CANCELLED' then return jsonb_build_object('memoId',v_memo.id,'status','CANCELLED','idempotent',true); end if;
  if v_memo.status not in ('DRAFT','PENDING_APPROVAL') then raise exception 'Posted memos must be reversed, not cancelled.'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A cancellation reason is required.'; end if;
  update public.ap_memos set status='CANCELLED',cancelled_by=p_actor_id,cancelled_at=now(),
    cancellation_reason=p_reason,updated_by=p_actor_id,updated_at=now() where id=v_memo.id;
  return jsonb_build_object('memoId',v_memo.id,'status','CANCELLED','idempotent',false);
end;
$$;

-- Migrate only legacy bill-form memos whose reference unambiguously names an
-- approved supplier bill. Ambiguous records remain untouched for manual review.
with candidates as (
  select legacy.*, source.id as source_payable_id
  from public.payables legacy
  join public.payables source
    on source.org_id=legacy.org_id and source.vendor_id=legacy.vendor_id
   and source.payable_number=legacy.reference_document
   and source.invoice_type not in ('credit_memo','debit_memo')
   and source.status in ('approved','partially_paid','paid')
  where legacy.invoice_type in ('credit_memo','debit_memo')
    and not coalesce(legacy.is_deleted,false)
), migrated as (
  insert into public.ap_memos (
    org_id,memo_number,memo_type,status,payable_id,vendor_id,memo_date,amount,reason,reference,
    adjustment_account_id,journal_entry_id,legacy_payable_id,created_by,created_at,posted_by,posted_at
  )
  select org_id,payable_number,
    case invoice_type when 'credit_memo' then 'CREDIT' else 'DEBIT' end,
    case when journal_entry_id is not null then 'POSTED' else 'DRAFT' end,
    source_payable_id,vendor_id,bill_date,abs(amount),description,reference_document,
    expense_account_id,journal_entry_id,id,created_by,created_at,approved_by,approved_at
  from candidates
  where expense_account_id is not null
  on conflict (legacy_payable_id) do nothing
  returning *
)
update public.journal_entries j
set source_ref=m.id,
    source_type=case when m.memo_type='CREDIT' then 'CREDIT_MEMO' else 'DEBIT_MEMO' end,
    updated_at=now()
from migrated m where j.id=m.journal_entry_id;

update public.payables source
set memo_adjustment_total=coalesce((
  select sum(case when m.memo_type='CREDIT' then -m.amount else m.amount end)
  from public.ap_memos m where m.payable_id=source.id and m.status='POSTED' and not m.is_deleted
),0), updated_at=now()
where exists (select 1 from public.ap_memos m where m.payable_id=source.id);

update public.payables legacy
set is_deleted=true,deleted_at=now(),updated_at=now()
where exists (select 1 from public.ap_memos m where m.legacy_payable_id=legacy.id);

revoke all on function public.ap_memo_actor_allowed(uuid,uuid) from public,anon,authenticated;
revoke all on function public.next_ap_memo_number(uuid,text,date,uuid) from public,anon,authenticated;
revoke all on function public.create_ap_memo(uuid,text,uuid,uuid,date,numeric,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_ap_memo(uuid,uuid) from public,anon,authenticated;
revoke all on function public.post_ap_memo(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reverse_ap_memo(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_ap_memo(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.next_ap_memo_number(uuid,text,date,uuid) to service_role;
grant execute on function public.create_ap_memo(uuid,text,uuid,uuid,date,numeric,text,text,uuid,uuid) to service_role;
grant execute on function public.submit_ap_memo(uuid,uuid) to service_role;
grant execute on function public.post_ap_memo(uuid,uuid) to service_role;
grant execute on function public.reverse_ap_memo(uuid,uuid,text) to service_role;
grant execute on function public.cancel_ap_memo(uuid,uuid,text) to service_role;
