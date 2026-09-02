alter table public.journal_entries drop constraint if exists journal_entries_source_type_check;
alter table public.journal_entries add constraint journal_entries_source_type_check check (
  source_type in (
    'MANUAL','JOURNAL','INVOICE','BILL','PAYMENT','COLLECTION','DEPRECIATION','TRANSFER',
    'PURCHASE_ORDER','PAYROLL','CREDIT_MEMO','DEBIT_MEMO','GR_IR','ACCRUAL',
    'REVERSAL','APPLICATION','VOID','DEPOSIT','INVENTORY','AP_RECLASSIFICATION'
  )
);

create table if not exists public.ap_reclassifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  reclassification_number text not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PENDING_APPROVAL','POSTED','CANCELLED','REVERSED')),
  payable_id uuid not null references public.payables(id),
  vendor_id uuid references public.vendors(id),
  reclassification_date date not null,
  original_account_id uuid not null references public.chart_of_accounts(id),
  target_account_id uuid not null references public.chart_of_accounts(id),
  amount numeric(15,2) not null check (amount > 0),
  reason text not null,
  reference text,
  department_code text,
  cost_center_code text,
  project_code text,
  branch_code text,
  journal_entry_id uuid references public.journal_entries(id),
  reversal_journal_id uuid references public.journal_entries(id),
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
  unique (org_id, reclassification_number),
  check (original_account_id <> target_account_id)
);

create index if not exists idx_ap_reclassifications_org_date
  on public.ap_reclassifications (org_id, reclassification_date desc, created_at desc)
  where is_deleted = false;
create index if not exists idx_ap_reclassifications_bill
  on public.ap_reclassifications (payable_id, original_account_id, status)
  where is_deleted = false;
create unique index if not exists uq_ap_reclassification_posting_journal
  on public.journal_entries (source_type, source_ref)
  where source_type='AP_RECLASSIFICATION' and source_ref is not null;

alter table public.ap_reclassifications enable row level security;
revoke all on public.ap_reclassifications from anon, authenticated;
grant select, insert, update on public.ap_reclassifications to service_role;

create or replace function public.ap_reclassification_actor_allowed(p_actor_id uuid, p_org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u
    where u.id=p_actor_id and coalesce(u.is_active,true)
      and (u.org_id=p_org_id or upper(u.role::text)='SYSTEM_ADMIN')
      and upper(u.role::text) in (
        'SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT',
        'AP_SPECIALIST','AP_SUPERVISOR','AP_CLERK'
      )
  );
$$;

create or replace function public.next_ap_reclassification_number(
  p_org_id uuid, p_date date, p_actor_id uuid
) returns text language plpgsql security definer set search_path=public as $$
declare v_year text; v_next bigint;
begin
  if not public.ap_reclassification_actor_allowed(p_actor_id,p_org_id) then
    raise exception 'Not authorized for this organization.';
  end if;
  v_year:=extract(year from p_date)::int::text;
  perform pg_advisory_xact_lock(hashtextextended('ap-reclass:'||p_org_id::text||':'||v_year,0));
  select coalesce(max(substring(reclassification_number from '[0-9]+$')::bigint),0)+1 into v_next
  from public.ap_reclassifications
  where org_id=p_org_id and reclassification_number like 'APR-'||v_year||'-%';
  return 'APR-'||v_year||'-'||lpad(v_next::text,5,'0');
end;
$$;

create or replace function public.create_ap_reclassification(
  p_org_id uuid, p_payable_id uuid, p_vendor_id uuid, p_date date,
  p_original_account_id uuid, p_target_account_id uuid, p_amount numeric,
  p_reason text, p_reference text, p_department_code text, p_cost_center_code text,
  p_project_code text, p_branch_code text, p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_bill public.payables%rowtype; v_record public.ap_reclassifications%rowtype; v_available numeric(15,2);
begin
  if not public.ap_reclassification_actor_allowed(p_actor_id,p_org_id) then raise exception 'Not authorized for this organization.'; end if;
  if p_amount<=0 or nullif(btrim(p_reason),'') is null then raise exception 'Amount and reason are required.'; end if;
  select * into v_bill from public.payables where id=p_payable_id and org_id=p_org_id and not coalesce(is_deleted,false);
  if not found or v_bill.vendor_id is distinct from p_vendor_id or v_bill.status not in ('approved','partially_paid','paid') or v_bill.journal_entry_id is null then
    raise exception 'Select an approved and posted supplier bill.';
  end if;
  if p_original_account_id=p_target_account_id then raise exception 'Original and target accounts must be different.'; end if;
  if not exists (select 1 from public.chart_of_accounts a where a.id=p_original_account_id and a.org_id=p_org_id and not a.is_header and a.class in ('EXPENSE','ASSET')) then
    raise exception 'The original bill account must be an Expense or Asset account.';
  end if;
  if not exists (select 1 from public.chart_of_accounts a where a.id=p_target_account_id and a.org_id=p_org_id and not a.is_header and a.class in ('EXPENSE','ASSET')) then
    raise exception 'The target account must be an Expense or Asset account.';
  end if;
  select round(coalesce(sum(greatest(l.debit-l.credit,0)),0)-coalesce((
    select sum(r.amount) from public.ap_reclassifications r
    where r.payable_id=p_payable_id and r.original_account_id=p_original_account_id
      and r.status='POSTED' and not r.is_deleted
  ),0),2) into v_available
  from public.journal_lines l where l.journal_entry_id=v_bill.journal_entry_id and l.account_id=p_original_account_id;
  if p_amount>v_available+0.005 then raise exception 'Amount exceeds the available original classification balance of %.',v_available; end if;
  insert into public.ap_reclassifications (
    org_id,reclassification_number,status,payable_id,vendor_id,reclassification_date,
    original_account_id,target_account_id,amount,reason,reference,department_code,
    cost_center_code,project_code,branch_code,created_by
  ) values (
    p_org_id,public.next_ap_reclassification_number(p_org_id,p_date,p_actor_id),'DRAFT',
    p_payable_id,p_vendor_id,p_date,p_original_account_id,p_target_account_id,round(p_amount,2),
    btrim(p_reason),nullif(btrim(p_reference),''),nullif(btrim(p_department_code),''),
    nullif(btrim(p_cost_center_code),''),nullif(btrim(p_project_code),''),
    nullif(btrim(p_branch_code),''),p_actor_id
  ) returning * into v_record;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(p_org_id,p_actor_id,'CREATE','PAYABLE',v_record.id,'Created draft AP reclassification '||v_record.reclassification_number||' for bill '||p_payable_id||'.',now());
  return to_jsonb(v_record);
end;
$$;

create or replace function public.submit_ap_reclassification(p_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_record public.ap_reclassifications%rowtype;
begin
  select * into v_record from public.ap_reclassifications where id=p_id and not is_deleted for update;
  if not found then raise exception 'AP reclassification not found.'; end if;
  if not public.ap_reclassification_actor_allowed(p_actor_id,v_record.org_id) then raise exception 'Not authorized.'; end if;
  if v_record.status='PENDING_APPROVAL' then return jsonb_build_object('id',v_record.id,'status',v_record.status,'idempotent',true); end if;
  if v_record.status<>'DRAFT' then raise exception 'Only a draft reclassification can be submitted.'; end if;
  update public.ap_reclassifications set status='PENDING_APPROVAL',submitted_by=p_actor_id,submitted_at=now(),updated_by=p_actor_id,updated_at=now() where id=p_id;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(v_record.org_id,p_actor_id,'APPROVE','PAYABLE',p_id,'Submitted AP reclassification '||v_record.reclassification_number||' for approval.',now());
  return jsonb_build_object('id',v_record.id,'status','PENDING_APPROVAL','idempotent',false);
end;
$$;

create or replace function public.post_ap_reclassification(p_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_record public.ap_reclassifications%rowtype; v_bill public.payables%rowtype;
  v_entry_id uuid; v_period_id uuid; v_available numeric(15,2); v_classification text;
begin
  select * into v_record from public.ap_reclassifications where id=p_id and not is_deleted for update;
  if not found then raise exception 'AP reclassification not found.'; end if;
  if not public.ap_reclassification_actor_allowed(p_actor_id,v_record.org_id) then raise exception 'Not authorized.'; end if;
  if v_record.status='POSTED' and v_record.journal_entry_id is not null then
    return jsonb_build_object('id',v_record.id,'journalEntryId',v_record.journal_entry_id,'status','POSTED','idempotent',true);
  end if;
  if v_record.status<>'PENDING_APPROVAL' then raise exception 'Only a pending reclassification can be posted.'; end if;
  select * into v_bill from public.payables where id=v_record.payable_id and org_id=v_record.org_id and not coalesce(is_deleted,false);
  if not found or v_bill.journal_entry_id is null then raise exception 'The original bill is unavailable.'; end if;
  if not exists (select 1 from public.chart_of_accounts a where a.id=v_record.original_account_id and a.org_id=v_record.org_id and not a.is_header and a.class in ('EXPENSE','ASSET'))
    or not exists (select 1 from public.chart_of_accounts a where a.id=v_record.target_account_id and a.org_id=v_record.org_id and not a.is_header and a.class in ('EXPENSE','ASSET')) then
    raise exception 'Reclassification accounts must be active Expense or Asset accounts.';
  end if;
  select round(coalesce(sum(greatest(l.debit-l.credit,0)),0)-coalesce((
    select sum(r.amount) from public.ap_reclassifications r
    where r.payable_id=v_record.payable_id and r.original_account_id=v_record.original_account_id
      and r.status='POSTED' and not r.is_deleted and r.id<>v_record.id
  ),0),2) into v_available
  from public.journal_lines l where l.journal_entry_id=v_bill.journal_entry_id and l.account_id=v_record.original_account_id;
  if v_record.amount>v_available+0.005 then raise exception 'Amount exceeds the remaining classification balance of %.',v_available; end if;
  select p.id into v_period_id from public.accounting_periods p where p.org_id=v_record.org_id
    and p.status='OPEN' and v_record.reclassification_date between p.start_date and p.end_date
    and not coalesce(p.is_deleted,false) order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the reclassification date.'; end if;
  v_classification:=concat_ws(' | ',
    case when v_record.department_code is not null then 'Department: '||v_record.department_code end,
    case when v_record.cost_center_code is not null then 'Cost Center: '||v_record.cost_center_code end,
    case when v_record.project_code is not null then 'Project: '||v_record.project_code end,
    case when v_record.branch_code is not null then 'Branch: '||v_record.branch_code end
  );
  v_entry_id:=gen_random_uuid();
  insert into public.journal_entries(
    id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,
    approved_by,approved_at,gl_entry_number,created_at,updated_at
  ) values (
    v_entry_id,v_record.org_id,v_period_id,v_record.reclassification_date,
    'AP Reclassification: '||v_record.reason,v_record.reclassification_number,'POSTED',
    p_actor_id,'AP_RECLASSIFICATION',v_record.id,p_actor_id,now(),
    public.ap_next_gl_number(v_record.org_id),now(),now()
  );
  insert into public.journal_lines(id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type,classification_code)
  values
    (gen_random_uuid(),v_entry_id,v_record.target_account_id,v_record.amount,0,v_record.reclassification_number||' - target classification',
      coalesce(v_record.vendor_id,v_bill.employee_id),case when v_record.vendor_id is not null then 'VENDOR' else 'EMPLOYEE' end,nullif(v_classification,'')),
    (gen_random_uuid(),v_entry_id,v_record.original_account_id,0,v_record.amount,v_record.reclassification_number||' - reverse original classification',
      coalesce(v_record.vendor_id,v_bill.employee_id),case when v_record.vendor_id is not null then 'VENDOR' else 'EMPLOYEE' end,null);
  update public.ap_reclassifications set status='POSTED',journal_entry_id=v_entry_id,posted_by=p_actor_id,posted_at=now(),updated_by=p_actor_id,updated_at=now() where id=p_id;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(v_record.org_id,p_actor_id,'POST','PAYABLE',p_id,'Posted AP reclassification '||v_record.reclassification_number||' linked to bill '||v_record.payable_id||' and journal '||v_entry_id||'.',now());
  return jsonb_build_object('id',v_record.id,'journalEntryId',v_entry_id,'status','POSTED','idempotent',false);
end;
$$;

create or replace function public.reverse_ap_reclassification(p_id uuid,p_actor_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_record public.ap_reclassifications%rowtype; v_original public.journal_entries%rowtype; v_reversal_id uuid; v_period_id uuid;
begin
  select * into v_record from public.ap_reclassifications where id=p_id and not is_deleted for update;
  if not found then raise exception 'AP reclassification not found.'; end if;
  if not public.ap_reclassification_actor_allowed(p_actor_id,v_record.org_id) then raise exception 'Not authorized.'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reversal reason is required.'; end if;
  if v_record.status='REVERSED' then return jsonb_build_object('id',v_record.id,'journalEntryId',v_record.reversal_journal_id,'status','REVERSED','idempotent',true); end if;
  if v_record.status<>'POSTED' or v_record.journal_entry_id is null then raise exception 'Only a posted reclassification can be reversed.'; end if;
  select * into v_original from public.journal_entries where id=v_record.journal_entry_id for update;
  select p.id into v_period_id from public.accounting_periods p where p.org_id=v_record.org_id and p.status='OPEN'
    and current_date between p.start_date and p.end_date and not coalesce(p.is_deleted,false)
    order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the reversal date.'; end if;
  v_reversal_id:=gen_random_uuid();
  insert into public.journal_entries(
    id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,
    approved_by,approved_at,gl_entry_number,original_entry_id,reversal_reason,created_at,updated_at
  ) values (
    v_reversal_id,v_record.org_id,v_period_id,current_date,'Reversal: '||v_original.description,
    'REV-'||v_record.reclassification_number,'POSTED',p_actor_id,'REVERSAL',v_record.id,
    p_actor_id,now(),public.ap_next_gl_number(v_record.org_id),v_original.id,btrim(p_reason),now(),now()
  );
  insert into public.journal_lines(id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type,classification_code,tax_category_id)
  select gen_random_uuid(),v_reversal_id,account_id,credit,debit,'Reversal: '||coalesce(description,memo,''),
    contact_id,contact_type,classification_code,tax_category_id
  from public.journal_lines where journal_entry_id=v_original.id;
  update public.journal_entries set status='REVERSED',reversed_by=p_actor_id,reversed_at=now(),reversal_reason=btrim(p_reason),updated_at=now() where id=v_original.id;
  update public.ap_reclassifications set status='REVERSED',reversal_journal_id=v_reversal_id,reversed_by=p_actor_id,reversed_at=now(),
    reversal_reason=btrim(p_reason),updated_by=p_actor_id,updated_at=now() where id=p_id;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(v_record.org_id,p_actor_id,'REVERSE','PAYABLE',p_id,'Reversed AP reclassification '||v_record.reclassification_number||': '||btrim(p_reason),now());
  return jsonb_build_object('id',v_record.id,'journalEntryId',v_reversal_id,'status','REVERSED','idempotent',false);
end;
$$;

create or replace function public.cancel_ap_reclassification(p_id uuid,p_actor_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_record public.ap_reclassifications%rowtype;
begin
  select * into v_record from public.ap_reclassifications where id=p_id and not is_deleted for update;
  if not found then raise exception 'AP reclassification not found.'; end if;
  if not public.ap_reclassification_actor_allowed(p_actor_id,v_record.org_id) then raise exception 'Not authorized.'; end if;
  if v_record.status='CANCELLED' then return jsonb_build_object('id',v_record.id,'status','CANCELLED','idempotent',true); end if;
  if v_record.status not in ('DRAFT','PENDING_APPROVAL') then raise exception 'Posted reclassifications must be reversed, not cancelled.'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A cancellation reason is required.'; end if;
  update public.ap_reclassifications set status='CANCELLED',cancelled_by=p_actor_id,cancelled_at=now(),
    cancellation_reason=btrim(p_reason),updated_by=p_actor_id,updated_at=now() where id=p_id;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(v_record.org_id,p_actor_id,'VOID','PAYABLE',p_id,'Cancelled AP reclassification '||v_record.reclassification_number||': '||btrim(p_reason),now());
  return jsonb_build_object('id',v_record.id,'status','CANCELLED','idempotent',false);
end;
$$;

revoke all on function public.ap_reclassification_actor_allowed(uuid,uuid) from public,anon,authenticated;
revoke all on function public.next_ap_reclassification_number(uuid,date,uuid) from public,anon,authenticated;
revoke all on function public.create_ap_reclassification(uuid,uuid,uuid,date,uuid,uuid,numeric,text,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_ap_reclassification(uuid,uuid) from public,anon,authenticated;
revoke all on function public.post_ap_reclassification(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reverse_ap_reclassification(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_ap_reclassification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.next_ap_reclassification_number(uuid,date,uuid) to service_role;
grant execute on function public.create_ap_reclassification(uuid,uuid,uuid,date,uuid,uuid,numeric,text,text,text,text,text,text,uuid) to service_role;
grant execute on function public.submit_ap_reclassification(uuid,uuid) to service_role;
grant execute on function public.post_ap_reclassification(uuid,uuid) to service_role;
grant execute on function public.reverse_ap_reclassification(uuid,uuid,text) to service_role;
grant execute on function public.cancel_ap_reclassification(uuid,uuid,text) to service_role;
