alter table public.payables
  add column if not exists invoice_type text not null default 'standard',
  add column if not exists input_vat_amount numeric(15,2) not null default 0,
  add column if not exists input_vat_account_id uuid references public.chart_of_accounts(id),
  add column if not exists payment_method text,
  add column if not exists payment_bank_account_id uuid references public.bank_accounts(id),
  add column if not exists check_number text,
  add column if not exists check_date date,
  add column if not exists reversal_journal_id uuid references public.journal_entries(id),
  add column if not exists memo_adjustment_total numeric(15,2) not null default 0;

create table if not exists public.payable_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  payment_event_id uuid not null,
  payable_id uuid not null references public.payables(id),
  journal_entry_id uuid not null references public.journal_entries(id),
  amount numeric(15,2) not null check (amount > 0),
  payment_date date not null,
  payment_method text not null,
  cash_account_id uuid not null references public.chart_of_accounts(id),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (payment_event_id, payable_id)
);

create index if not exists idx_payable_payment_allocations_payable
  on public.payable_payment_allocations (payable_id, created_at);
create index if not exists idx_payable_payment_allocations_journal
  on public.payable_payment_allocations (journal_entry_id);
create unique index if not exists uq_ap_bill_journal_per_payable
  on public.journal_entries (source_ref)
  where source_type in ('BILL', 'CREDIT_MEMO') and source_ref is not null;
create unique index if not exists uq_ap_payment_journal_per_event
  on public.journal_entries (source_ref)
  where source_type = 'PAYMENT' and source_ref is not null;
create unique index if not exists uq_ap_reversal_per_original
  on public.journal_entries (original_entry_id)
  where source_type = 'REVERSAL' and original_entry_id is not null;

alter table public.payable_payment_allocations enable row level security;
drop policy if exists payable_payment_allocations_select_org on public.payable_payment_allocations;
create policy payable_payment_allocations_select_org
  on public.payable_payment_allocations for select
  using (exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.org_id = org_id and coalesce(u.is_active, true)
  ));

create or replace function public.ap_next_gl_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ap-gl:' || p_org_id::text, 0));
  select coalesce(max((regexp_match(gl_entry_number, '^GL([0-9]+)$'))[1]::bigint), 0) + 1
    into v_next
  from public.journal_entries
  where org_id = p_org_id and gl_entry_number ~ '^GL[0-9]+$';
  return 'GL' || lpad(v_next::text, 8, '0');
end;
$$;

create or replace function public.post_payable_bill(p_payable_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.payables%rowtype;
  v_entry_id uuid;
  v_period_id uuid;
  v_gl_number text;
  v_alloc jsonb;
  v_account_id uuid;
  v_qualification_id uuid;
  v_amount numeric(15,2);
  v_alloc_total numeric(15,2) := 0;
  v_debits numeric(15,2) := 0;
  v_credits numeric(15,2) := 0;
  v_net numeric(15,2);
  v_is_credit boolean;
  v_contact_id uuid;
  v_contact_type text;
begin
  select * into v_bill from public.payables
  where id = p_payable_id and coalesce(is_deleted, false) = false
  for update;
  if not found then raise exception 'Payable not found.'; end if;
  if not exists (
    select 1 from public.users u
    where u.id = p_actor_id and coalesce(u.is_active, true)
      and (u.org_id = v_bill.org_id or upper(u.role::text) = 'SYSTEM_ADMIN')
  ) then raise exception 'The posting user does not belong to this organization.'; end if;

  select id into v_entry_id from public.journal_entries
  where source_ref = v_bill.id and source_type in ('BILL', 'CREDIT_MEMO')
  limit 1;
  if v_entry_id is not null then
    if v_bill.journal_entry_id is distinct from v_entry_id or v_bill.status = 'for_approval' then
      update public.payables set journal_entry_id = v_entry_id, status = 'approved',
        approved_by = coalesce(approved_by, p_actor_id), approved_at = coalesce(approved_at, now()), updated_at = now()
      where id = v_bill.id;
    end if;
    return jsonb_build_object('journalEntryId', v_entry_id, 'payableId', v_bill.id, 'idempotent', true);
  end if;
  if v_bill.status not in ('for_approval', 'approved') then
    raise exception 'Only an unposted payable awaiting approval can be posted.';
  end if;

  select p.id into v_period_id from public.accounting_periods p
  where p.org_id = v_bill.org_id and p.status = 'OPEN'
    and v_bill.bill_date between p.start_date and p.end_date
    and coalesce(p.is_deleted, false) = false
  order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the bill date.'; end if;
  if v_bill.gl_account_id is null or not exists (
    select 1 from public.chart_of_accounts a where a.id = v_bill.gl_account_id
      and a.org_id = v_bill.org_id and a.class = 'LIABILITY' and not a.is_header
  ) then raise exception 'A valid Accounts Payable control account is required.'; end if;

  v_is_credit := v_bill.invoice_type = 'credit_memo';
  v_net := coalesce(nullif(v_bill.net_payable, 0), v_bill.amount + coalesce(v_bill.input_vat_amount, 0) - coalesce(v_bill.withholding_amount, 0));
  v_contact_id := coalesce(v_bill.vendor_id, v_bill.employee_id);
  v_contact_type := case when v_bill.vendor_id is not null then 'VENDOR' else 'EMPLOYEE' end;
  v_entry_id := gen_random_uuid();
  v_gl_number := public.ap_next_gl_number(v_bill.org_id);

  insert into public.journal_entries (
    id, org_id, period_id, date, description, reference, status, created_by,
    source_type, source_ref, approved_by, approved_at, gl_entry_number, created_at, updated_at
  ) values (
    v_entry_id, v_bill.org_id, v_period_id, v_bill.bill_date,
    (case when v_is_credit then 'Credit Memo: ' else 'AP Bill: ' end) || v_bill.description,
    v_bill.payable_number, 'POSTED', p_actor_id,
    case when v_is_credit then 'CREDIT_MEMO' else 'BILL' end, v_bill.id,
    p_actor_id, now(), v_gl_number, now(), now()
  );

  if jsonb_typeof(v_bill.expense_allocations) = 'array' and jsonb_array_length(v_bill.expense_allocations) > 0 then
    for v_alloc in select value from jsonb_array_elements(v_bill.expense_allocations)
    loop
      v_account_id := coalesce((v_alloc->>'expense_account_id')::uuid, (v_alloc->>'expenseAccountId')::uuid);
      v_qualification_id := coalesce((v_alloc->>'qualification_id')::uuid, (v_alloc->>'qualificationId')::uuid);
      v_amount := coalesce((v_alloc->>'amount')::numeric, 0);
      if v_amount <= 0 or not exists (
        select 1 from public.chart_of_accounts a where a.id = v_account_id and a.org_id = v_bill.org_id
          and a.class in ('EXPENSE', 'ASSET') and not a.is_header
      ) then raise exception 'Every allocation requires a valid Expense or Asset account and positive amount.'; end if;
      v_alloc_total := v_alloc_total + v_amount;
      insert into public.journal_lines (
        id, journal_entry_id, account_id, debit, credit, description, contact_id, contact_type, classification_code
      ) values (
        gen_random_uuid(), v_entry_id, v_account_id,
        case when v_is_credit then 0 else v_amount end, case when v_is_credit then v_amount else 0 end,
        coalesce(v_alloc->>'description', v_bill.description), v_contact_id, v_contact_type,
        (select q.code from public.qualifications q where q.id = v_qualification_id and q.org_id = v_bill.org_id)
      );
    end loop;
    if abs(v_alloc_total - v_bill.amount) > 0.005 then raise exception 'Expense or asset allocations must equal the bill amount.'; end if;
  else
    if v_bill.expense_account_id is null or not exists (
      select 1 from public.chart_of_accounts a where a.id = v_bill.expense_account_id and a.org_id = v_bill.org_id
        and a.class in ('EXPENSE', 'ASSET') and not a.is_header
    ) then raise exception 'A valid Expense or Asset account is required.'; end if;
    insert into public.journal_lines (id, journal_entry_id, account_id, debit, credit, description, contact_id, contact_type)
    values (gen_random_uuid(), v_entry_id, v_bill.expense_account_id,
      case when v_is_credit then 0 else v_bill.amount end, case when v_is_credit then v_bill.amount else 0 end,
      v_bill.description, v_contact_id, v_contact_type);
  end if;

  if coalesce(v_bill.input_vat_amount, 0) > 0 then
    if v_bill.input_vat_account_id is null then
      select a.id into v_bill.input_vat_account_id from public.chart_of_accounts a
      where a.org_id = v_bill.org_id and a.class = 'ASSET' and not a.is_header
        and lower(a.name) like '%input%vat%'
      order by a.code limit 1;
    end if;
    if v_bill.input_vat_account_id is null then raise exception 'An Input VAT account is required.'; end if;
    insert into public.journal_lines (id, journal_entry_id, account_id, debit, credit, description)
    values (gen_random_uuid(), v_entry_id, v_bill.input_vat_account_id,
      case when v_is_credit then 0 else v_bill.input_vat_amount end,
      case when v_is_credit then v_bill.input_vat_amount else 0 end,
      'Input VAT - ' || v_bill.payable_number);
  end if;

  if coalesce(v_bill.withholding_amount, 0) > 0 then
    select a.id into v_account_id from public.chart_of_accounts a
    where a.org_id = v_bill.org_id and a.class = 'LIABILITY' and not a.is_header
      and (lower(a.name) like '%withholding%tax%' or a.code like '21%')
    order by case when lower(a.name) like '%withholding%tax%' then 0 else 1 end limit 1;
    if v_account_id is null then raise exception 'A Withholding Tax Payable account is required.'; end if;
    insert into public.journal_lines (id, journal_entry_id, account_id, debit, credit, description)
    values (gen_random_uuid(), v_entry_id, v_account_id,
      case when v_is_credit then v_bill.withholding_amount else 0 end,
      case when v_is_credit then 0 else v_bill.withholding_amount end,
      'Withholding Tax - ' || v_bill.payable_number);
  end if;

  insert into public.journal_lines (id, journal_entry_id, account_id, debit, credit, description, contact_id, contact_type)
  values (gen_random_uuid(), v_entry_id, v_bill.gl_account_id,
    case when v_is_credit then abs(v_net) else 0 end, case when v_is_credit then 0 else v_net end,
    'Accounts Payable - ' || v_bill.payable_number, v_contact_id, v_contact_type);

  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_debits, v_credits
  from public.journal_lines where journal_entry_id = v_entry_id;
  if abs(v_debits - v_credits) > 0.005 then
    raise exception 'Bill journal is not balanced (debits %, credits %).', v_debits, v_credits;
  end if;

  update public.payables set journal_entry_id = v_entry_id, status = 'approved',
    approved_by = p_actor_id, approved_at = now(), updated_at = now()
  where id = v_bill.id;
  return jsonb_build_object('journalEntryId', v_entry_id, 'payableId', v_bill.id, 'idempotent', false);
end;
$$;

create or replace function public.post_payable_payment(
  p_payment_event_id uuid, p_payable_ids uuid[], p_amounts numeric[],
  p_cash_account_id uuid, p_payment_date date, p_payment_method text, p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_entry_id uuid;
  v_period_id uuid;
  v_total numeric(15,2) := 0;
  v_bill public.payables%rowtype;
  v_amount numeric(15,2);
  v_outstanding numeric(15,2);
  v_i integer;
  v_first_payee text;
  v_payee text;
begin
  if array_length(p_payable_ids,1) is null or array_length(p_payable_ids,1) <> array_length(p_amounts,1) then
    raise exception 'Payment allocations are required and must match the selected bills.';
  end if;
  select journal_entry_id into v_entry_id from public.payable_payment_allocations
  where payment_event_id = p_payment_event_id limit 1;
  if v_entry_id is not null then return jsonb_build_object('journalEntryId', v_entry_id, 'paymentEventId', p_payment_event_id, 'idempotent', true); end if;

  for v_i in 1..array_length(p_payable_ids,1) loop
    select * into v_bill from public.payables where id = p_payable_ids[v_i] and coalesce(is_deleted,false)=false for update;
    if not found then raise exception 'A selected payable does not exist.'; end if;
    if v_i = 1 then
      v_org_id := v_bill.org_id;
      v_first_payee := case when v_bill.vendor_id is not null then 'V:'||v_bill.vendor_id else 'E:'||v_bill.employee_id end;
    end if;
    v_payee := case when v_bill.vendor_id is not null then 'V:'||v_bill.vendor_id else 'E:'||v_bill.employee_id end;
    if v_bill.org_id <> v_org_id or v_payee is distinct from v_first_payee then raise exception 'A payment may only combine bills for one payee and organization.'; end if;
    if v_bill.status not in ('approved','partially_paid') then raise exception 'Only approved posted bills can be paid.'; end if;
    if v_bill.journal_entry_id is null or not exists (
      select 1 from public.journal_entries j where j.id=v_bill.journal_entry_id and j.status='POSTED'
        and j.source_type in ('BILL','CREDIT_MEMO') and j.source_ref=v_bill.id
    ) then raise exception 'The bill-recognition journal must be posted before payment.'; end if;
    v_amount := round(p_amounts[v_i],2);
    v_outstanding := round(coalesce(nullif(v_bill.net_payable,0),v_bill.amount)
      + coalesce(v_bill.memo_adjustment_total,0) - coalesce(v_bill.paid_amount,0),2);
    if v_amount <= 0 or v_amount > v_outstanding + 0.005 then raise exception 'A payment allocation is invalid or exceeds the outstanding balance.'; end if;
    v_total := v_total + v_amount;
  end loop;

  if not exists (select 1 from public.users u where u.id=p_actor_id and coalesce(u.is_active,true)
    and (u.org_id=v_org_id or upper(u.role::text)='SYSTEM_ADMIN')) then raise exception 'The payment user does not belong to this organization.'; end if;
  if not exists (select 1 from public.chart_of_accounts a where a.id=p_cash_account_id and a.org_id=v_org_id and a.class='ASSET' and not a.is_header)
    then raise exception 'Select a valid Cash or Bank asset account.'; end if;
  select p.id into v_period_id from public.accounting_periods p where p.org_id=v_org_id and p.status='OPEN'
    and p_payment_date between p.start_date and p.end_date and coalesce(p.is_deleted,false)=false order by p.start_date desc limit 1;
  if v_period_id is null then raise exception 'No open accounting period exists for the payment date.'; end if;

  v_entry_id := gen_random_uuid();
  insert into public.journal_entries (id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,approved_by,approved_at,gl_entry_number,created_at,updated_at)
  values (v_entry_id,v_org_id,v_period_id,p_payment_date,'AP payment','PV-'||left(p_payment_event_id::text,8),'POSTED',p_actor_id,'PAYMENT',p_payment_event_id,p_actor_id,now(),public.ap_next_gl_number(v_org_id),now(),now());

  for v_i in 1..array_length(p_payable_ids,1) loop
    select * into v_bill from public.payables where id=p_payable_ids[v_i] for update;
    v_amount := round(p_amounts[v_i],2);
    insert into public.journal_lines (id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type)
    values (gen_random_uuid(),v_entry_id,v_bill.gl_account_id,v_amount,0,'Payment - '||v_bill.payable_number,
      coalesce(v_bill.vendor_id,v_bill.employee_id),case when v_bill.vendor_id is not null then 'VENDOR' else 'EMPLOYEE' end);
    insert into public.payable_payment_allocations (org_id,payment_event_id,payable_id,journal_entry_id,amount,payment_date,payment_method,cash_account_id,created_by)
    values (v_org_id,p_payment_event_id,v_bill.id,v_entry_id,v_amount,p_payment_date,p_payment_method,p_cash_account_id,p_actor_id);
    update public.payables set paid_amount=round(coalesce(paid_amount,0)+v_amount,2), payment_date=p_payment_date,
      payment_method=p_payment_method, paid_by=p_actor_id, updated_at=now(),
      status=case when coalesce(nullif(net_payable,0),amount)+coalesce(memo_adjustment_total,0)-round(coalesce(paid_amount,0)+v_amount,2)<=0.005 then 'paid' else 'partially_paid' end,
      paid_at=case when coalesce(nullif(net_payable,0),amount)+coalesce(memo_adjustment_total,0)-round(coalesce(paid_amount,0)+v_amount,2)<=0.005 then now() else paid_at end
    where id=v_bill.id;
  end loop;
  insert into public.journal_lines (id,journal_entry_id,account_id,debit,credit,description)
  values (gen_random_uuid(),v_entry_id,p_cash_account_id,0,v_total,'Cash/Bank payment');
  return jsonb_build_object('journalEntryId',v_entry_id,'paymentEventId',p_payment_event_id,'total',v_total,'idempotent',false);
end;
$$;

create or replace function public.cancel_payable(p_payable_id uuid, p_actor_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.payables%rowtype;
  v_original public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_period_id uuid;
begin
  select * into v_bill from public.payables where id=p_payable_id and coalesce(is_deleted,false)=false for update;
  if not found then raise exception 'Payable not found.'; end if;
  if not exists (select 1 from public.users u where u.id=p_actor_id and coalesce(u.is_active,true)
    and (u.org_id=v_bill.org_id or upper(u.role::text)='SYSTEM_ADMIN')) then raise exception 'The cancellation user does not belong to this organization.'; end if;
  if v_bill.status='cancelled' then return jsonb_build_object('payableId',v_bill.id,'journalEntryId',v_bill.reversal_journal_id,'idempotent',true); end if;
  if coalesce(v_bill.paid_amount,0)>0 or exists (select 1 from public.payable_payment_allocations a where a.payable_id=v_bill.id)
    then raise exception 'Reverse the payment before cancelling a paid or partially paid bill.'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A cancellation reason is required.'; end if;
  if v_bill.journal_entry_id is null then
    update public.payables set status='cancelled',updated_at=now() where id=v_bill.id;
    return jsonb_build_object('payableId',v_bill.id,'journalEntryId',null,'idempotent',false);
  end if;
  select * into v_original from public.journal_entries where id=v_bill.journal_entry_id for update;
  if not found then raise exception 'The original bill journal could not be found.'; end if;
  select id into v_reversal_id from public.journal_entries where original_entry_id=v_original.id and source_type='REVERSAL' limit 1;
  if v_reversal_id is null then
    select p.id into v_period_id from public.accounting_periods p
    where p.org_id=v_bill.org_id and p.status='OPEN' and current_date between p.start_date and p.end_date
      and coalesce(p.is_deleted,false)=false order by p.start_date desc limit 1;
    if v_period_id is null then raise exception 'No open accounting period exists for the cancellation date.'; end if;
    v_reversal_id:=gen_random_uuid();
    insert into public.journal_entries (id,org_id,period_id,date,description,reference,status,created_by,source_type,source_ref,approved_by,approved_at,gl_entry_number,original_entry_id,reversal_reason,created_at,updated_at)
    values (v_reversal_id,v_original.org_id,v_period_id,current_date,'Reversal: '||v_original.description,'REV-'||v_original.reference,'POSTED',p_actor_id,'REVERSAL',v_bill.id,p_actor_id,now(),public.ap_next_gl_number(v_original.org_id),v_original.id,p_reason,now(),now());
    insert into public.journal_lines (id,journal_entry_id,account_id,debit,credit,description,contact_id,contact_type,classification_code,tax_category_id)
    select gen_random_uuid(),v_reversal_id,account_id,credit,debit,'Reversal: '||coalesce(description,memo,''),contact_id,contact_type,classification_code,tax_category_id
    from public.journal_lines where journal_entry_id=v_original.id;
    update public.journal_entries set status='REVERSED',reversed_by=p_actor_id,reversed_at=now(),reversal_reason=p_reason,updated_at=now() where id=v_original.id;
  end if;
  update public.payables set status='cancelled',reversal_journal_id=v_reversal_id,updated_at=now() where id=v_bill.id;
  return jsonb_build_object('payableId',v_bill.id,'journalEntryId',v_reversal_id,'idempotent',false);
end;
$$;

revoke all on function public.ap_next_gl_number(uuid) from public;
revoke all on function public.post_payable_bill(uuid,uuid) from public;
revoke all on function public.post_payable_payment(uuid,uuid[],numeric[],uuid,date,text,uuid) from public;
revoke all on function public.cancel_payable(uuid,uuid,text) from public;
grant execute on function public.post_payable_bill(uuid,uuid) to anon, authenticated;
grant execute on function public.post_payable_payment(uuid,uuid[],numeric[],uuid,date,text,uuid) to anon, authenticated;
grant execute on function public.cancel_payable(uuid,uuid,text) to anon, authenticated;
grant select on public.payable_payment_allocations to authenticated;
