


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."billing_status" AS ENUM (
    'UNBILLED',
    'BILLED',
    'PARTIALLY_BILLED'
);


ALTER TYPE "public"."billing_status" OWNER TO "postgres";


CREATE TYPE "public"."enrollment_status" AS ENUM (
    'ACTIVE',
    'DROPPED',
    'COMPLETED',
    'ON_HOLD'
);


ALTER TYPE "public"."enrollment_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'DRAFT',
    'OPEN',
    'CLOSED',
    'VOIDED'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."apply_inventory_level_delta"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_quantity_change" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.inventory_levels (
    org_id,
    stock_item_id,
    warehouse_location_id,
    quantity_on_hand,
    quantity_reserved,
    quantity_available,
    last_counted,
    updated_at,
    is_deleted
  )
  values (
    p_org_id,
    p_stock_item_id,
    p_warehouse_location_id,
    p_quantity_change,
    0,
    p_quantity_change,
    now(),
    now(),
    false
  )
  on conflict (org_id, stock_item_id, warehouse_location_id)
  do update set
    quantity_on_hand = coalesce(public.inventory_levels.quantity_on_hand, 0) + excluded.quantity_on_hand,
    quantity_available =
      coalesce(public.inventory_levels.quantity_on_hand, 0)
      + excluded.quantity_on_hand
      - coalesce(public.inventory_levels.quantity_reserved, 0),
    last_counted = now(),
    updated_at = now(),
    is_deleted = false;
end;
$$;


ALTER FUNCTION "private"."apply_inventory_level_delta"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_quantity_change" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."protect_posted_inventory_records"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_table_name = 'inventory_ledger' then
    raise exception 'Inventory ledger entries are immutable';
  end if;
  if old.status = 'POSTED' then
    raise exception 'Posted inventory transactions are immutable; create a reversal';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."protect_posted_inventory_records"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_approved_stock_adjustment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
  old_effective boolean := false;
  new_effective boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_effective := old.approval_date is not null and not coalesce(old.is_deleted, false);
  end if;
  if tg_op <> 'DELETE' then
    new_effective := new.approval_date is not null and not coalesce(new.is_deleted, false);
  end if;

  if old_effective then
    perform private.apply_inventory_level_delta(
      old.org_id,
      old.stock_item_id,
      old.warehouse_location_id,
      -old.quantity_change
    );
  end if;

  if new_effective then
    perform private.apply_inventory_level_delta(
      new.org_id,
      new.stock_item_id,
      new.warehouse_location_id,
      new.quantity_change
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "private"."sync_approved_stock_adjustment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ap_memo_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.users u
    where u.id=p_actor_id and coalesce(u.is_active,true)
      and (u.org_id=p_org_id or upper(u.role::text)='SYSTEM_ADMIN')
      and upper(u.role::text) not in ('STUDENT','TRAINER')
  );
$$;


ALTER FUNCTION "public"."ap_memo_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ap_reclassification_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."ap_reclassification_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_journal_voucher_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."audit_journal_voucher_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_billable_qty"("p_batch_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with batch_cap as (
    select coalesce(nullif(b.billable_student_limit, 0), 0) as billable_limit
    from public.batches b
    where b.id = p_batch_id
  ),
  candidates as (
    select count(*)::integer as candidate_count
    from public.billing_valid_enrollments(p_batch_id) e
    where coalesce(e.billing_type::text, 'BILLABLE') not in ('MANUAL_FREE', 'FREE_SPONSORED')
  )
  select case
    when coalesce((select billable_limit from batch_cap), 0) > 0
      then least((select candidate_count from candidates), (select billable_limit from batch_cap))
    else (select candidate_count from candidates)
  end;
$$;


ALTER FUNCTION "public"."billing_billable_qty"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_classify_batch_cap"("p_batch_id" "uuid", "p_apply" boolean DEFAULT false) RETURNS TABLE("enrollment_id" "uuid", "student_id" "uuid", "batch_id" "uuid", "current_billing_type" "text", "expected_billing_type" "text", "billable_qty" integer, "billable_limit" integer, "sort_order" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_apply then
    update public.enrollments e
    set billing_type = classified.expected_billing_type,
        sponsor_id = coalesce(e.sponsor_id, b.sponsor_id),
        updated_at = timezone('utc', now())
    from public.batches b
    join (
      with valid_rows as (
        select
          ve.*,
          row_number() over (
            partition by (coalesce(ve.billing_type::text, 'BILLABLE') in ('MANUAL_FREE', 'FREE_SPONSORED'))
            order by coalesce(ve.enrollment_date, ve.created_at::date), ve.created_at, ve.id
          ) as candidate_order
        from public.billing_valid_enrollments(p_batch_id) ve
      ),
      cap as (
        select public.billing_billable_qty(p_batch_id) as billable_qty
      )
      select
        vr.id,
        case
          when coalesce(vr.billing_type::text, 'BILLABLE') in ('MANUAL_FREE', 'FREE_SPONSORED') then coalesce(vr.billing_type::text, 'BILLABLE')
          when vr.candidate_order <= (select billable_qty from cap) then 'BILLABLE'
          else 'FREE_EXCESS'
        end as expected_billing_type
      from valid_rows vr
    ) classified on classified.id = e.id
    where b.id = p_batch_id
      and e.id = classified.id
      and coalesce(e.billing_type::text, 'BILLABLE') not in ('MANUAL_FREE', 'FREE_SPONSORED');
  end if;

  return query
  with valid_rows as (
    select
      ve.*,
      row_number() over (order by coalesce(ve.enrollment_date, ve.created_at::date), ve.created_at, ve.id)::integer as sort_order,
      row_number() over (
        partition by (coalesce(ve.billing_type::text, 'BILLABLE') in ('MANUAL_FREE', 'FREE_SPONSORED'))
        order by coalesce(ve.enrollment_date, ve.created_at::date), ve.created_at, ve.id
      )::integer as candidate_order
    from public.billing_valid_enrollments(p_batch_id) ve
  ),
  cap as (
    select
      public.billing_billable_qty(p_batch_id) as billable_qty,
      coalesce(nullif(b.billable_student_limit, 0), 0)::integer as billable_limit
    from public.batches b
    where b.id = p_batch_id
  )
  select
    vr.id,
    vr.student_id,
    vr.batch_id,
    coalesce(vr.billing_type::text, 'BILLABLE')::text,
    case
      when coalesce(vr.billing_type::text, 'BILLABLE') in ('MANUAL_FREE', 'FREE_SPONSORED') then coalesce(vr.billing_type::text, 'BILLABLE')::text
      when vr.candidate_order <= (select billable_qty from cap) then 'BILLABLE'
      else 'FREE_EXCESS'
    end,
    (select billable_qty from cap),
    (select billable_limit from cap),
    vr.sort_order
  from valid_rows vr
  order by vr.sort_order;
end;
$$;


ALTER FUNCTION "public"."billing_classify_batch_cap"("p_batch_id" "uuid", "p_apply" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid") RETURNS TABLE("course_fee_id" "uuid", "description" "text", "quantity" integer, "unit_price" numeric, "amount" numeric, "line_type" "text", "gl_account_id" "uuid", "tax_category_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
        select
          cf.id,
          cf.fee_name,
          public.billing_valid_enrolled_qty(p_batch_id),
          coalesce(cf.amount, 0),
          round(coalesce(cf.amount, 0) * public.billing_valid_enrolled_qty(p_batch_id), 2),
          'COURSE_FEE',
          cf.gl_account_id,
          cf.tax_category_id
        from public.batches b
        left join public.sponsors s on s.id = b.sponsor_id
        join public.course_fees cf
          on cf.qualification_id = b.qualification_id
         and cf.funding_type = case
           when b.sponsor_id is null then 'PRIVATE'
           when s.course_fee_type = 'TESDA_SCHOLARSHIP' then 'TESDA_SCHOLARSHIP'
           else 'SPONSORED'
         end
        where b.id = p_batch_id
          and coalesce(cf.is_active, true) = true
          and coalesce(cf.is_deleted, false) = false
          -- Exclude this misc fee for sponsored transactions
          and (
            b.sponsor_id is null
            or cf.fee_code <> 'FORKLIFT-002'
          )
        order by cf.category, cf.fee_name, cf.id;
      $$;


ALTER FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_reconcile_payment_deposits"() RETURNS TABLE("payment_id" "uuid", "payment_no" "text", "actual_customer_deposit_balance" numeric, "expected_customer_deposit_balance" numeric, "is_mismatch" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.payment_no,
    greatest(coalesce(p.customer_deposit_balance, 0), 0),
    greatest(coalesce(p.amount_received, 0) + coalesce(p.ewt_amount_certified, 0) - coalesce(p.total_applied, 0), 0),
    abs(greatest(coalesce(p.customer_deposit_balance, 0), 0) - greatest(coalesce(p.amount_received, 0) + coalesce(p.ewt_amount_certified, 0) - coalesce(p.total_applied, 0), 0)) > 0.01
  from public.payments p
  where coalesce(p.is_deleted, false) = false;
$$;


ALTER FUNCTION "public"."billing_reconcile_payment_deposits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::integer
  from public.billing_valid_enrollments(p_batch_id);
$$;


ALTER FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "enrollment_code" character varying(50) NOT NULL,
    "student_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "sponsor_id" "uuid",
    "billing_status" "public"."billing_status" DEFAULT 'UNBILLED'::"public"."billing_status" NOT NULL,
    "enrollment_status" "public"."enrollment_status" DEFAULT 'ACTIVE'::"public"."enrollment_status" NOT NULL,
    "enrollment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_fees" numeric(15,2) DEFAULT 0 NOT NULL,
    "billed_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "billing_type" "text" DEFAULT 'BILLABLE'::"text" NOT NULL,
    CONSTRAINT "enrollments_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['BILLABLE'::"text", 'FREE_EXCESS'::"text", 'FREE_SPONSORED'::"text", 'MANUAL_FREE'::"text"]))),
    CONSTRAINT "valid_billed_amount" CHECK ((("billed_amount" >= (0)::numeric) AND ("billed_amount" <= "total_fees")))
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid") RETURNS SETOF "public"."enrollments"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.*
  from public.enrollments e
  where e.batch_id = p_batch_id
    and coalesce(e.is_deleted, false) = false
    and e.deleted_at is null
    and upper(coalesce(e.enrollment_status::text, 'ACTIVE')) not in ('DROPPED', 'CANCELLED', 'CANCELED', 'INACTIVE', 'ARCHIVED')
  order by coalesce(e.enrollment_date, e.created_at::date), e.created_at, e.id;
$$;


ALTER FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_validate_invoice_lines_against_batch_cap"("p_invoice_id" "uuid") RETURNS TABLE("invoice_id" "uuid", "invoice_no" "text", "batch_id" "uuid", "status" "text", "line_id" "uuid", "line_number" integer, "description" "text", "actual_qty" numeric, "expected_qty" integer, "is_mismatch" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    i.id,
    i.invoice_no,
    i.batch_id,
    i.status::text,
    il.id,
    il.line_number,
    il.description,
    coalesce(il.quantity, 0),
    public.billing_valid_enrolled_qty(i.batch_id),
    coalesce(il.quantity, 0) <> public.billing_valid_enrolled_qty(i.batch_id)
  from public.invoices i
  join public.invoice_lines il on il.invoice_id = i.id
  where i.id = p_invoice_id
    and i.batch_id is not null
    and i.status::text <> 'VOIDED'
    and il.course_fee_id is not null;
$$;


ALTER FUNCTION "public"."billing_validate_invoice_lines_against_batch_cap"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_net_book_value"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.net_book_value := COALESCE(NEW.purchase_cost, 0) - COALESCE(NEW.accumulated_depreciation, 0);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_net_book_value"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_po_item_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.total_amount := NEW.quantity * NEW.unit_price;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_po_item_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ap_memo"("p_org_id" "uuid", "p_memo_type" "text", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_memo_date" "date", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_adjustment_account_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_ap_memo"("p_org_id" "uuid", "p_memo_type" "text", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_memo_date" "date", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_adjustment_account_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ap_reclassification"("p_org_id" "uuid", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_date" "date", "p_original_account_id" "uuid", "p_target_account_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_department_code" "text", "p_cost_center_code" "text", "p_project_code" "text", "p_branch_code" "text", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_ap_reclassification"("p_org_id" "uuid", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_date" "date", "p_original_account_id" "uuid", "p_target_account_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_department_code" "text", "p_cost_center_code" "text", "p_project_code" "text", "p_branch_code" "text", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'org_id', '')::uuid,
    NULLIF(auth.jwt() ->> 'orgId', '')::uuid
  )
$$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_employee_org_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."enforce_employee_org_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_time_expense_class_org_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."enforce_time_expense_class_org_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_time_expense_tax_category_org_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.tax_category_id is not null and not exists (
    select 1
    from public.tax_categories tc
    where tc.id = new.tax_category_id
      and tc.org_id = new.org_id
  ) then
    raise exception 'Tax category must belong to the same organization';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_time_expense_tax_category_org_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_time_expense_user_org"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  creator_org_id uuid;
  creator_role text;
begin
  if new.created_by is null then
    raise exception 'A creator is required for every time expense.' using errcode = '23514';
  end if;

  select u.org_id, u.role
    into creator_org_id, creator_role
  from public.users u
  where u.id = new.created_by
    and coalesce(u.is_active, true);

  if not found then
    raise exception 'The time expense creator is unavailable or inactive.' using errcode = '23514';
  end if;

  if upper(coalesce(creator_role, '')) <> 'SYSTEM_ADMIN' then
    if creator_org_id is null then
      raise exception 'The time expense creator has no organization.' using errcode = '23514';
    end if;
    new.org_id := creator_org_id;
  elsif new.org_id is null then
    raise exception 'System administrators must select an organization.' using errcode = '23514';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_time_expense_user_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_check_number"("p_bank_account_id" "uuid", "p_org_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    v_prefix VARCHAR(20);
    v_start_number INTEGER;
    v_max_number INTEGER;
    v_next_number INTEGER;
    v_check_number VARCHAR(50);
BEGIN
    -- Get settings for this bank account
    SELECT prefix, start_number 
    INTO v_prefix, v_start_number
    FROM check_number_settings 
    WHERE bank_account_id = p_bank_account_id;
    
    -- Default values if no settings found
    IF v_prefix IS NULL THEN v_prefix := ''; END IF;
    IF v_start_number IS NULL THEN v_start_number := 1; END IF;
    
    -- Find the highest check number for this bank account
    SELECT COALESCE(MAX(
        CASE 
            WHEN v_prefix = '' THEN check_number::INTEGER
            ELSE NULLIF(REPLACE(check_number, v_prefix, ''), '')::INTEGER
        END
    ), v_start_number - 1)
    INTO v_max_number
    FROM check_vouchers 
    WHERE bank_account_id = p_bank_account_id
    AND check_number ~ ('^' || v_prefix || '[0-9]+$');
    
    -- Calculate next number
    v_next_number := GREATEST(v_max_number + 1, v_start_number);
    
    -- Format with prefix
    v_check_number := v_prefix || LPAD(v_next_number::TEXT, 6, '0');
    
    RETURN v_check_number;
END;
$_$;


ALTER FUNCTION "public"."get_next_check_number"("p_bank_account_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_invoice_no"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."get_next_invoice_no"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_payment_no"("p_org_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_max_seq INT;
  v_year INT;
  v_next_no VARCHAR;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  
  -- Use an advisory lock to prevent race conditions
  PERFORM pg_advisory_lock(
    ('x' || SUBSTR(MD5(p_org_id::text), 1, 16))::BIT(64)::BIGINT
  );
  
  -- Find the maximum sequence number for this org and year
  -- Extract the final number from format: PAY-2026-00001
  SELECT MAX(
    CAST(SUBSTRING(payment_no, LENGTH(payment_no) - 4, 5) AS INT)
  ) INTO v_max_seq
  FROM payments
  WHERE org_id = p_org_id
    AND payment_no LIKE 'PAY-' || v_year || '-%'
    AND is_deleted = FALSE;
  
  -- If no previous payment found, start at 1
  v_max_seq := COALESCE(v_max_seq, 0) + 1;
  
  -- Generate the payment number
  v_next_no := 'PAY-' || v_year || '-' || LPAD(v_max_seq::TEXT, 5, '0');
  
  -- Release the advisory lock (auto-released at transaction end, but explicit for safety)
  PERFORM pg_advisory_unlock(
    ('x' || SUBSTR(MD5(p_org_id::text), 1, 16))::BIT(64)::BIGINT
  );
  
  RETURN v_next_no;
END;
$$;


ALTER FUNCTION "public"."get_next_payment_no"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_journal_voucher_line"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare voucher_status text;
begin
  select status into voucher_status from public.journal_vouchers
  where id = coalesce(new.journal_voucher_id, old.journal_voucher_id);
  if voucher_status = 'POSTED' then raise exception 'Posted journal voucher lines are immutable.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_journal_voucher_line"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "invoice_no" character varying(50) NOT NULL,
    "sponsor_id" "uuid",
    "student_id" "uuid",
    "enrollment_id" "uuid",
    "batch_id" "uuid",
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'VOIDED'::"public"."invoice_status" NOT NULL,
    "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "vat_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_ewt_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "net_amount_due" numeric(15,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(15,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(15,2) DEFAULT 0 NOT NULL,
    "ewt_rate" numeric(5,4),
    "is_subject_to_ewt" boolean DEFAULT false NOT NULL,
    "reference" character varying(100),
    "terms" character varying(100),
    "notes" "text",
    "journal_entry_id" "uuid",
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "voided_by" "uuid",
    "voided_at" timestamp with time zone,
    "void_reason" "text",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "vat_pricing" "text" DEFAULT 'INCLUSIVE'::"text",
    "vat_rate" numeric DEFAULT 0.12,
    "gl_entry_number" "text",
    "assessment_registration_id" "uuid",
    "document_type" "text" DEFAULT 'INVOICE'::"text" NOT NULL,
    "payment_method" "text",
    "si_no" "text",
    CONSTRAINT "check_sponsor_or_student" CHECK ((("sponsor_id" IS NOT NULL) OR ("student_id" IS NOT NULL) OR ("upper"(COALESCE(("status")::"text", ''::"text")) = 'VOIDED'::"text"))),
    CONSTRAINT "invoices_document_type_check" CHECK (("document_type" = ANY (ARRAY['INVOICE'::"text", 'NON_INVOICE_PAYMENT'::"text"]))),
    CONSTRAINT "invoices_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['CASH'::"text", 'BANK_TRANSFER'::"text", 'EWALLET'::"text"]))))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ar_invoice_accounting_locked"("p_invoice" "public"."invoices") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    upper(coalesce(p_invoice.status::text, '')) in ('OPEN', 'CLOSED', 'VOIDED')
    or p_invoice.journal_entry_id is not null
    or p_invoice.posted_at is not null
    or nullif(trim(coalesce(p_invoice.gl_entry_number, '')), '') is not null;
$$;


ALTER FUNCTION "public"."is_ar_invoice_accounting_locked"("p_invoice" "public"."invoices") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_bank_reconciliation_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, details, created_at)
  VALUES (
    NEW.org_id,
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      WHEN TG_OP = 'DELETE' THEN 'DELETE'
    END,
    'BANK_RECONCILIATION',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'as_of_date', COALESCE(NEW.as_of_date, OLD.as_of_date),
      'status', COALESCE(NEW.status, OLD.status),
      'difference', COALESCE(NEW.difference, OLD.difference)
    ),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_bank_reconciliation_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_exchange_rate_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'CREATE',
    'EXCHANGE_RATE',
    NEW.id,
    NEW.from_currency || ' to ' || NEW.to_currency,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_exchange_rate_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_exchange_rate_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_deleted AND OLD.is_deleted IS FALSE THEN
    INSERT INTO audit_logs (
      org_id, user_id, user_name, action, entity_type, entity_id, 
      entity_name, timestamp
    ) VALUES (
      NEW.org_id,
      auth.uid(),
      (SELECT name FROM users WHERE id = auth.uid()),
      'DELETE',
      'EXCHANGE_RATE',
      NEW.id,
      NEW.from_currency || ' to ' || NEW.to_currency,
      CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_exchange_rate_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_exchange_rate_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'UPDATE',
    'EXCHANGE_RATE',
    NEW.id,
    NEW.from_currency || ' to ' || NEW.to_currency,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_exchange_rate_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_recurring_entry_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'CREATE',
    'RECURRING_JOURNAL_ENTRY',
    NEW.id,
    NEW.name,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_recurring_entry_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_recurring_entry_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_deleted AND OLD.is_deleted IS FALSE THEN
    INSERT INTO audit_logs (
      org_id, user_id, user_name, action, entity_type, entity_id, 
      entity_name, timestamp
    ) VALUES (
      NEW.org_id,
      auth.uid(),
      (SELECT name FROM users WHERE id = auth.uid()),
      'DELETE',
      'RECURRING_JOURNAL_ENTRY',
      NEW.id,
      NEW.name,
      CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_recurring_entry_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_recurring_entry_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO audit_logs (
    org_id, user_id, user_name, action, entity_type, entity_id, 
    entity_name, timestamp
  ) VALUES (
    NEW.org_id,
    auth.uid(),
    (SELECT name FROM users WHERE id = auth.uid()),
    'UPDATE',
    'RECURRING_JOURNAL_ENTRY',
    NEW.id,
    NEW.name,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_recurring_entry_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_time_expenses_billed_on_payable_post"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'approved'
     and new.journal_entry_id is not null
     and (
       old.status is distinct from new.status
       or old.journal_entry_id is distinct from new.journal_entry_id
     ) then
    update public.time_expenses
    set status = 'billed', updated_at = now()
    where payable_id = new.id
      and org_id = new.org_id
      and status = 'released';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."mark_time_expenses_billed_on_payable_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_ap_memo_number"("p_org_id" "uuid", "p_memo_type" "text", "p_memo_date" "date", "p_actor_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."next_ap_memo_number"("p_org_id" "uuid", "p_memo_type" "text", "p_memo_date" "date", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_ap_reclassification_number"("p_org_id" "uuid", "p_date" "date", "p_actor_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."next_ap_reclassification_number"("p_org_id" "uuid", "p_date" "date", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."post_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    (gen_random_uuid(),v_entry_id,v_record.target_account_id,v_record.amount,0,v_record.reclassification_number||' - target classification',v_record.vendor_id,'VENDOR',nullif(v_classification,'')),
    (gen_random_uuid(),v_entry_id,v_record.original_account_id,0,v_record.amount,v_record.reclassification_number||' - reverse original classification',v_record.vendor_id,'VENDOR',null);
  update public.ap_reclassifications set status='POSTED',journal_entry_id=v_entry_id,posted_by=p_actor_id,posted_at=now(),updated_by=p_actor_id,updated_at=now() where id=p_id;
  insert into public.audit_logs(org_id,user_id,action,entity_type,entity_id,details,created_at)
  values(v_record.org_id,p_actor_id,'POST','PAYABLE',p_id,'Posted AP reclassification '||v_record.reclassification_number||' linked to bill '||v_record.payable_id||' and journal '||v_entry_id||'.',now());
  return jsonb_build_object('id',v_record.id,'journalEntryId',v_entry_id,'status','POSTED','idempotent',false);
end;
$$;


ALTER FUNCTION "public"."post_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_inventory_movement"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_transaction_type" "text", "p_quantity_change" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_source_document" "text", "p_source_module" "text", "p_reason" "text", "p_actor_id" "uuid", "p_batch_lot" "text" DEFAULT NULL::"text", "p_serial_number" "text" DEFAULT NULL::"text", "p_reversal_of_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_item public.stock_items%rowtype;
  v_class public.inventory_classes%rowtype;
  v_transaction_id uuid;
  v_journal_id uuid;
  v_reference text;
  v_cost numeric(18,4);
  v_amount numeric(18,4);
  v_current_qty numeric(18,4);
  v_current_value numeric(18,4);
  v_cached_qty numeric(18,4);
  v_has_ledger boolean;
  v_new_qty numeric(18,4);
  v_new_value numeric(18,4);
  v_debit_account uuid;
  v_credit_account uuid;
begin
  if p_quantity_change = 0 then raise exception 'Inventory quantity change cannot be zero'; end if;
  if p_posting_date is null then raise exception 'Posting date is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_org_id::text || ':' || p_stock_item_id::text || ':' || p_warehouse_location_id::text, 0
  ));

  select * into v_item from public.stock_items
  where id = p_stock_item_id and org_id = p_org_id and not coalesce(is_deleted, false);
  if not found then raise exception 'Stock item not found in organization'; end if;
  if v_item.inventory_class_id is null then raise exception 'Stock item requires an Inventory Class before posting'; end if;

  select * into v_class from public.inventory_classes
  where id = v_item.inventory_class_id and org_id = p_org_id and is_active;
  if not found then raise exception 'Active Inventory Class not found'; end if;

  select coalesce(running_quantity, 0), coalesce(running_value, 0)
    into v_current_qty, v_current_value
  from public.inventory_ledger
  where org_id = p_org_id
    and stock_item_id = p_stock_item_id
    and warehouse_location_id = p_warehouse_location_id
  order by id desc limit 1;
  v_has_ledger := found;
  if not v_has_ledger then
    select coalesce(quantity_on_hand, 0) into v_cached_qty
    from public.inventory_levels
    where org_id = p_org_id
      and stock_item_id = p_stock_item_id
      and warehouse_location_id = p_warehouse_location_id
      and not coalesce(is_deleted, false);
    if coalesce(v_cached_qty, 0) <> 0 and p_transaction_type <> 'OPENING_INVENTORY' then
      raise exception 'Legacy stock balance % must be migrated through Opening Inventory before posting movements', v_cached_qty;
    end if;
  end if;
  v_current_qty := coalesce(v_current_qty, 0);
  v_current_value := coalesce(v_current_value, 0);
  if p_quantity_change < 0 and v_current_qty > 0
     and coalesce(v_item.valuation_method_override, v_class.valuation_method) = 'WEIGHTED_AVERAGE' then
    v_cost := round(v_current_value / v_current_qty, 4);
  else
    v_cost := coalesce(nullif(p_unit_cost, 0), v_item.standard_cost, 0);
  end if;
  if v_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  v_amount := round(abs(p_quantity_change) * v_cost, 4);
  v_new_qty := v_current_qty + p_quantity_change;
  if v_new_qty < 0 then raise exception 'Insufficient stock: available %, requested %', v_current_qty, abs(p_quantity_change); end if;
  v_new_value := v_current_value + case when p_quantity_change > 0 then v_amount else -v_amount end;

  v_reference := concat('INV-', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), '-', upper(substr(gen_random_uuid()::text, 1, 6)));
  insert into public.inventory_transactions (
    org_id, reference_number, stock_item_id, transaction_type, to_location_id,
    quantity, unit_cost, total_cost, notes, created_by, posting_date, status,
    source_document, source_module, posted_by, posted_at, reversal_of_id,
    batch_lot, serial_number, is_deleted
  ) values (
    p_org_id, v_reference, p_stock_item_id, p_transaction_type, p_warehouse_location_id,
    abs(p_quantity_change), v_cost, v_amount, p_reason, p_actor_id, p_posting_date, 'DRAFT',
    p_source_document, p_source_module, p_actor_id, now(), p_reversal_of_id,
    p_batch_lot, p_serial_number, false
  ) returning id into v_transaction_id;

  insert into public.inventory_ledger (
    org_id, transaction_id, stock_item_id, warehouse_location_id, posting_date,
    quantity_change, unit_cost, extended_cost, running_quantity, running_value
  ) values (
    p_org_id, v_transaction_id, p_stock_item_id, p_warehouse_location_id, p_posting_date,
    p_quantity_change, v_cost,
    case when p_quantity_change > 0 then v_amount else -v_amount end,
    v_new_qty, v_new_value
  );

  insert into public.inventory_levels (
    org_id, stock_item_id, warehouse_location_id, quantity_on_hand,
    quantity_reserved, quantity_available, last_counted, updated_at, is_deleted
  ) values (
    p_org_id, p_stock_item_id, p_warehouse_location_id, v_new_qty,
    0, v_new_qty, now(), now(), false
  )
  on conflict (org_id, stock_item_id, warehouse_location_id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    quantity_available = excluded.quantity_on_hand - coalesce(public.inventory_levels.quantity_reserved, 0),
    updated_at = now(), is_deleted = false;

  if p_transaction_type = 'OPENING_INVENTORY' then
    v_debit_account := v_class.inventory_asset_account_id;
    v_credit_account := v_class.opening_balance_equity_account_id;
  elsif p_transaction_type = 'INVENTORY_WRITEOFF' then
    v_debit_account := v_class.write_off_account_id;
    v_credit_account := v_class.inventory_asset_account_id;
  elsif p_quantity_change > 0 then
    v_debit_account := v_class.inventory_asset_account_id;
    v_credit_account := v_class.adjustment_account_id;
  else
    v_debit_account := v_class.adjustment_account_id;
    v_credit_account := v_class.inventory_asset_account_id;
  end if;
  if v_debit_account is null or v_credit_account is null then
    raise exception 'Inventory Class GL mapping is incomplete for %', p_transaction_type;
  end if;

  insert into public.journal_entries (
    org_id, period_id, date, description, reference, status, created_by,
    source_type, created_at, approved_by, approved_at, source_ref
  ) values (
    p_org_id, 'CURRENT', p_posting_date, coalesce(p_reason, p_transaction_type),
    v_reference, 'POSTED', p_actor_id, 'INVENTORY', now(), p_actor_id, now(), v_transaction_id
  ) returning id into v_journal_id;

  insert into public.journal_lines (
    journal_entry_id, account_id, debit, credit, memo, item_id, description
  ) values
    (v_journal_id, v_debit_account, v_amount, 0, p_reason, p_stock_item_id, p_transaction_type),
    (v_journal_id, v_credit_account, 0, v_amount, p_reason, p_stock_item_id, p_transaction_type);

  update public.inventory_transactions
  set status = 'POSTED', journal_entry_id = v_journal_id
  where id = v_transaction_id;

  return jsonb_build_object(
    'transactionId', v_transaction_id, 'referenceNumber', v_reference,
    'journalEntryId', v_journal_id, 'quantityOnHand', v_new_qty,
    'inventoryValue', v_new_value
  );
end;
$$;


ALTER FUNCTION "public"."post_inventory_movement"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_transaction_type" "text", "p_quantity_change" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_source_document" "text", "p_source_module" "text", "p_reason" "text", "p_actor_id" "uuid", "p_batch_lot" "text", "p_serial_number" "text", "p_reversal_of_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "branch_id" "uuid",
    "jv_number" "text" NOT NULL,
    "journal_date" "date" NOT NULL,
    "accounting_period_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "reference_no" "text",
    "status" "text" DEFAULT 'ON_HOLD'::"text" NOT NULL,
    "gl_reference" "text",
    "prepared_by" "uuid" NOT NULL,
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "remarks" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "journal_vouchers_attachments_check" CHECK (("jsonb_typeof"("attachments") = 'array'::"text")),
    CONSTRAINT "journal_vouchers_status_check" CHECK (("status" = ANY (ARRAY['ON_HOLD'::"text", 'POSTED'::"text"])))
);


ALTER TABLE "public"."journal_vouchers" OWNER TO "postgres";


COMMENT ON TABLE "public"."journal_vouchers" IS 'Source document for all manually recorded journal transactions.';



CREATE OR REPLACE FUNCTION "public"."post_journal_voucher"("p_voucher_id" "uuid", "p_posted_by" "uuid") RETURNS "public"."journal_vouchers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."post_journal_voucher"("p_voucher_id" "uuid", "p_posted_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_opening_inventory"("p_org_id" "uuid", "p_document_number" "text", "p_posting_date" "date", "p_remarks" "text", "p_actor_id" "uuid", "p_lines" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_header_id uuid;
  v_line jsonb;
  v_posting jsonb;
  v_first_journal uuid;
  v_count integer := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Opening inventory requires at least one line';
  end if;
  insert into public.opening_inventory_headers (
    org_id, document_number, posting_date, status, remarks,
    created_by, created_at, posted_by, posted_at
  ) values (
    p_org_id, p_document_number, p_posting_date, 'DRAFT', p_remarks,
    p_actor_id, now(), p_actor_id, now()
  ) returning id into v_header_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.opening_inventory_lines (
      header_id, warehouse_location_id, stock_item_id, quantity, unit_cost,
      batch_lot, expiration_date, remarks
    ) values (
      v_header_id,
      (v_line->>'warehouseLocationId')::uuid,
      (v_line->>'stockItemId')::uuid,
      (v_line->>'quantity')::numeric,
      (v_line->>'unitCost')::numeric,
      nullif(v_line->>'batchLot',''),
      nullif(v_line->>'expirationDate','')::date,
      nullif(v_line->>'remarks','')
    );
    v_posting := public.post_inventory_movement(
      p_org_id,
      (v_line->>'stockItemId')::uuid,
      (v_line->>'warehouseLocationId')::uuid,
      'OPENING_INVENTORY',
      (v_line->>'quantity')::numeric,
      (v_line->>'unitCost')::numeric,
      p_posting_date,
      p_document_number,
      'OPENING_INVENTORY',
      coalesce(nullif(v_line->>'remarks',''), p_remarks, 'Opening inventory'),
      p_actor_id,
      nullif(v_line->>'batchLot',''),
      null,
      null
    );
    v_first_journal := coalesce(v_first_journal, (v_posting->>'journalEntryId')::uuid);
    v_count := v_count + 1;
  end loop;

  update public.opening_inventory_headers
  set status = 'POSTED', journal_entry_id = v_first_journal
  where id = v_header_id;

  return jsonb_build_object(
    'headerId', v_header_id, 'documentNumber', p_document_number,
    'status', 'POSTED', 'lineCount', v_count, 'journalEntryId', v_first_journal
  );
end;
$$;


ALTER FUNCTION "public"."post_opening_inventory"("p_org_id" "uuid", "p_document_number" "text", "p_posting_date" "date", "p_remarks" "text", "p_actor_id" "uuid", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_stock_adjustment"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_adjustment_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_reason" "text", "p_notes" "text", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_adjustment_id uuid;
  v_adjustment_number text;
  v_quantity_change numeric;
  v_transaction_type text;
  v_posting jsonb;
begin
  if p_quantity <= 0 then raise exception 'Adjustment quantity must be greater than zero'; end if;
  v_adjustment_number := concat('ADJ-', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'));
  if p_adjustment_type in ('DAMAGE','DAMAGED','LOST','EXPIRED','SHRINKAGE','WRITEOFF') then
    v_quantity_change := -abs(p_quantity);
    v_transaction_type := 'INVENTORY_WRITEOFF';
  elsif p_adjustment_type = 'OPENING_INVENTORY' then
    v_quantity_change := abs(p_quantity);
    v_transaction_type := 'OPENING_INVENTORY';
  elsif p_adjustment_type = 'PHYSICAL_COUNT' then
    v_quantity_change := p_quantity;
    v_transaction_type := 'CYCLE_COUNT_ADJUSTMENT';
  else
    v_quantity_change := p_quantity;
    v_transaction_type := 'STOCK_ADJUSTMENT';
  end if;

  insert into public.stock_adjustments (
    org_id, adjustment_number, stock_item_id, warehouse_location_id,
    quantity_change, adjustment_type, reason, notes, approved_by,
    approval_date, created_by, created_at, is_deleted
  ) values (
    p_org_id, v_adjustment_number, p_stock_item_id, p_warehouse_location_id,
    v_quantity_change, p_adjustment_type, p_reason, p_notes, p_actor_id,
    now(), p_actor_id, now(), false
  ) returning id into v_adjustment_id;

  v_posting := public.post_inventory_movement(
    p_org_id, p_stock_item_id, p_warehouse_location_id, v_transaction_type,
    v_quantity_change, p_unit_cost, p_posting_date, v_adjustment_number,
    'STOCK_ADJUSTMENT', p_reason, p_actor_id, null, null, null
  );

  update public.stock_adjustments
  set journal_entry_id = (v_posting->>'journalEntryId')::uuid
  where id = v_adjustment_id;

  return v_posting || jsonb_build_object(
    'adjustmentId', v_adjustment_id,
    'adjustmentNumber', v_adjustment_number
  );
end;
$$;


ALTER FUNCTION "public"."post_stock_adjustment"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_adjustment_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_reason" "text", "p_notes" "text", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_journal_voucher"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."prepare_journal_voucher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_posted_invoice_accounting_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_allowed_keys text[] := array[
    'amount_paid',
    'balance_due',
    'status',
    'journal_entry_id',
    'gl_entry_number',
    'posted_by',
    'posted_at',
    'voided_by',
    'voided_at',
    'void_reason',
    'updated_at',
    'updated_by',
    -- Allow FK side-effects when students are deleted (student_id -> NULL)
    'student_id'
  ];
  v_old_accounting jsonb;
  v_new_accounting jsonb;
  v_next_status text;
  v_old_student_id uuid;
  v_new_student_id uuid;
BEGIN
  -- If invoice isn't locked, allow any change.
  IF NOT public.is_ar_invoice_accounting_locked(old) THEN
    RETURN new;
  END IF;

  -- Default: compare all accounting fields excluding the allowed keys.
  v_old_student_id := old.student_id;
  v_new_student_id := new.student_id;

  v_old_accounting := to_jsonb(old) - v_allowed_keys;
  v_new_accounting := to_jsonb(new) - v_allowed_keys;

  IF v_old_accounting IS DISTINCT FROM v_new_accounting THEN
    RAISE EXCEPTION 'Posted invoices are locked. Reverse or void the invoice instead of changing accounting fields.';
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    v_next_status := upper(coalesce(new.status::text, ''));
    IF v_next_status NOT IN ('OPEN', 'CLOSED', 'VOIDED') THEN
      RAISE EXCEPTION 'Posted invoices cannot be moved back to draft/on-hold status.';
    END IF;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."prevent_posted_invoice_accounting_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_posted_invoice_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if public.is_ar_invoice_accounting_locked(old) then
    raise exception 'Posted invoices cannot be deleted. Void the invoice instead.';
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_posted_invoice_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_posted_invoice_line_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_invoice_id uuid;
  v_invoice public.invoices%rowtype;
begin
  if tg_op = 'DELETE' then
    v_invoice_id := old.invoice_id;
  else
    v_invoice_id := new.invoice_id;
  end if;

  if v_invoice_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select *
    into v_invoice
  from public.invoices
  where id = v_invoice_id;

  if found and public.is_ar_invoice_accounting_locked(v_invoice) then
    raise exception 'Posted invoice lines are locked. Reverse or void the invoice instead of changing lines.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_posted_invoice_line_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_time_expense_without_payable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.payable_id is not null and new.payable_id is null then
    new.status := 'open';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."reopen_time_expense_without_payable"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_voucher_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_voucher_id" "uuid" NOT NULL,
    "coa_id" "uuid" NOT NULL,
    "debit" numeric(18,2) DEFAULT 0 NOT NULL,
    "credit" numeric(18,2) DEFAULT 0 NOT NULL,
    "line_description" "text",
    "cost_center_id" "uuid",
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "journal_voucher_lines_check" CHECK (((("debit" > (0)::numeric) AND ("credit" = (0)::numeric)) OR (("credit" > (0)::numeric) AND ("debit" = (0)::numeric)))),
    CONSTRAINT "journal_voucher_lines_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "journal_voucher_lines_debit_check" CHECK (("debit" >= (0)::numeric))
);


ALTER TABLE "public"."journal_voucher_lines" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_journal_voucher_lines"("p_voucher_id" "uuid", "p_lines" "jsonb") RETURNS SETOF "public"."journal_voucher_lines"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."replace_journal_voucher_lines"("p_voucher_id" "uuid", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reverse_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reverse_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "period_id" character varying(50) DEFAULT 'CURRENT'::character varying NOT NULL,
    "date" "date" NOT NULL,
    "description" character varying(500) NOT NULL,
    "reference" character varying(100),
    "status" character varying(20) DEFAULT 'POSTED'::character varying,
    "created_by" "uuid",
    "source_type" character varying(50) DEFAULT 'MANUAL'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "gl_entry_number" character varying(50),
    "review_comments" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_by" "text",
    "source_ref" "uuid",
    "deposit_id" "uuid",
    "reversed_by" "text",
    "reversed_at" timestamp with time zone,
    "reversal_reason" "text",
    "original_entry_id" "uuid",
    CONSTRAINT "journal_entries_source_type_check" CHECK ((("source_type")::"text" = ANY ((ARRAY['MANUAL'::character varying, 'JOURNAL'::character varying, 'INVOICE'::character varying, 'BILL'::character varying, 'PAYMENT'::character varying, 'COLLECTION'::character varying, 'DEPRECIATION'::character varying, 'TRANSFER'::character varying, 'PURCHASE_ORDER'::character varying, 'PAYROLL'::character varying, 'CREDIT_MEMO'::character varying, 'DEBIT_MEMO'::character varying, 'GR_IR'::character varying, 'ACCRUAL'::character varying, 'REVERSAL'::character varying, 'APPLICATION'::character varying, 'VOID'::character varying, 'DEPOSIT'::character varying, 'INVENTORY'::character varying, 'AP_RECLASSIFICATION'::character varying])::"text"[]))),
    CONSTRAINT "journal_entries_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'ON_HOLD'::character varying, 'PENDING_APPROVAL'::character varying, 'APPROVED'::character varying, 'POSTED'::character varying, 'REVERSED'::character varying, 'REVISION_REQUESTED'::character varying])::"text"[])))
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."journal_entries"."status" IS 'Workflow: ON_HOLD -> PENDING_APPROVAL (optional) -> APPROVED -> POSTED. DRAFT and REVISION_REQUESTED remain for historical compatibility.';



COMMENT ON COLUMN "public"."journal_entries"."approved_by" IS 'User who approved this journal entry (invoice approver role required)';



COMMENT ON COLUMN "public"."journal_entries"."approved_at" IS 'Timestamp when journal entry was approved and posted to general ledger';



COMMENT ON COLUMN "public"."journal_entries"."gl_entry_number" IS 'Sequential GL entry number generated when entry is posted (e.g., GL-2026-00001)';



COMMENT ON COLUMN "public"."journal_entries"."review_comments" IS 'JSON array of review comments: [{id, userId, userName, comment, action: "COMMENT"|"REQUEST_REVISION"|"APPROVED"|"REJECTED", createdAt}]';



COMMENT ON COLUMN "public"."journal_entries"."source_ref" IS 'Unified reference to source document ID (Invoice ID, Payment ID, Deposit ID, etc.)';



COMMENT ON COLUMN "public"."journal_entries"."deposit_id" IS 'FK to bank_deposits table for deposit-type entries';



CREATE OR REPLACE FUNCTION "public"."reverse_journal_entry"("p_entry_id" "uuid") RETURNS "public"."journal_entries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_original public.journal_entries%rowtype;
  v_reversal public.journal_entries%rowtype;
  v_next_gl_seq bigint;
  v_new_gl text;
begin
  select *
    into v_original
  from public.journal_entries
  where id = p_entry_id
  limit 1;

  if not found then
    raise exception 'Journal entry not found: %', p_entry_id;
  end if;

  if upper(coalesce(v_original.status, '')) <> 'POSTED' then
    raise exception 'Only posted journal entries can be reversed.';
  end if;

  if v_original.original_entry_id is not null
     or upper(coalesce(v_original.source_type, '')) = 'REVERSAL' then
    raise exception 'This journal entry is already a reversal and cannot be reversed again.';
  end if;

  if exists (
    select 1
    from public.journal_entries
    where original_entry_id = v_original.id
  ) then
    raise exception 'This journal entry has already been reversed.';
  end if;

  if not exists (
    select 1
    from public.journal_lines
    where journal_entry_id = v_original.id
  ) then
    raise exception 'Journal entry % has no lines to reverse.', p_entry_id;
  end if;

  select coalesce(max(seq), 0) + 1
    into v_next_gl_seq
  from (
    select nullif(substring(gl_key from '([0-9]+)$'), '')::bigint as seq
    from (
      select upper(trim(coalesce(gl_entry_number, reference, ''))) as gl_key
      from public.journal_entries
    ) refs
    where gl_key ~ '^GL(?:\s*NO\.?)?[\s-]*[0-9]+$'
  ) numbered_refs;

  v_new_gl := 'GL' || lpad(v_next_gl_seq::text, 8, '0');

  insert into public.journal_entries (
    org_id,
    period_id,
    date,
    description,
    reference,
    gl_entry_number,
    status,
    created_by,
    created_at,
    source_type,
    source_ref,
    reversed_at,
    reversal_reason,
    original_entry_id
  )
  values (
    v_original.org_id,
    v_original.period_id,
    current_date,
    'Reversal: ' || coalesce(nullif(v_original.description, ''), coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text)),
    v_new_gl,
    v_new_gl,
    'POSTED',
    v_original.created_by,
    timezone('utc', now()),
    'REVERSAL',
    v_original.id,
    timezone('utc', now()),
    'Auto-generated reversal for ' || coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text),
    v_original.id
  )
  returning *
    into v_reversal;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    memo,
    description,
    contact_id,
    contact_type,
    batch_id,
    item_id,
    asset_id,
    is_cleared
  )
  select
    v_reversal.id,
    account_id,
    coalesce(credit, 0),
    coalesce(debit, 0),
    memo,
    description,
    contact_id,
    contact_type,
    batch_id,
    item_id,
    asset_id,
    is_cleared
  from public.journal_lines
  where journal_entry_id = v_original.id;

  update public.journal_entries
  set
    status = 'REVERSED',
    reversed_at = timezone('utc', now()),
    reversal_reason = 'Auto-generated reversal for ' || coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text)
  where id = v_original.id;

  return v_reversal;
end;
$_$;


ALTER FUNCTION "public"."reverse_journal_entry"("p_entry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."submit_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."submit_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bank_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bank_accounts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bank_deposit_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Recalculate totals for the affected deposit
    UPDATE bank_deposits
    SET 
        check_amount = COALESCE((
            SELECT SUM(amount) 
            FROM bank_deposit_lines 
            WHERE deposit_id = COALESCE(NEW.deposit_id, OLD.deposit_id)
        ), 0),
        total_amount = cash_amount + COALESCE((
            SELECT SUM(amount) 
            FROM bank_deposit_lines 
            WHERE deposit_id = COALESCE(NEW.deposit_id, OLD.deposit_id)
        ), 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.deposit_id, OLD.deposit_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_bank_deposit_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_check_number_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_check_number_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_check_vouchers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_check_vouchers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_enrollments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_enrollments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_exchange_rates_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_exchange_rates_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_balance_on_application"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_invoice_id UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
    v_amount_paid NUMERIC(15,2);
    v_net_amount_due NUMERIC(15,2);
    v_new_status invoice_status;
BEGIN
    -- Recalculate applied amount from non-reversed applications
    SELECT COALESCE(SUM(amount_applied), 0)
    INTO v_amount_paid
    FROM payment_applications
    WHERE invoice_id = v_invoice_id
      AND is_reversed = FALSE;

    -- Fetch invoice net amount due (fallback to grand_total if needed)
    SELECT COALESCE(net_amount_due, grand_total, 0)
    INTO v_net_amount_due
    FROM invoices
    WHERE id = v_invoice_id;

    -- Determine new status using enum-safe values
    IF (v_net_amount_due - v_amount_paid) <= 0 THEN
        v_new_status := 'CLOSED'::invoice_status;
    ELSE
        v_new_status := 'OPEN'::invoice_status;
    END IF;

    -- Apply invoice updates
    UPDATE invoices
    SET
        amount_paid = v_amount_paid,
        balance_due = GREATEST(v_net_amount_due - v_amount_paid, 0),
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_invoice_balance_on_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_lines_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_invoice_lines_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoices_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_invoices_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Recalculate totals for the affected payment
    UPDATE payments
    SET 
        total_applied = COALESCE((
            SELECT SUM(amount_applied) 
            FROM payment_applications 
            WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id) 
            AND is_reversed = FALSE
        ), 0),
        customer_deposit_balance = amount_received + ewt_amount_certified - COALESCE((
            SELECT SUM(amount_applied) 
            FROM payment_applications 
            WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id) 
            AND is_reversed = FALSE
        ), 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_payment_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recurring_entries_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_recurring_entries_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_students_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_students_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tax_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tax_categories_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounting_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "period_type" character varying(50) NOT NULL,
    "fiscal_year" integer NOT NULL,
    "period_number" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" character varying(50) DEFAULT 'OPEN'::character varying NOT NULL,
    "ap_closed" boolean DEFAULT false,
    "ap_closed_by" "uuid",
    "ap_closed_at" timestamp with time zone,
    "ar_closed" boolean DEFAULT false,
    "ar_closed_by" "uuid",
    "ar_closed_at" timestamp with time zone,
    "gl_closed" boolean DEFAULT false,
    "gl_closed_by" "uuid",
    "gl_closed_at" timestamp with time zone,
    "locked_by" "uuid",
    "locked_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "accounting_periods_period_type_check" CHECK ((("period_type")::"text" = ANY ((ARRAY['MONTHLY'::character varying, 'QUARTERLY'::character varying, 'ANNUAL'::character varying])::"text"[]))),
    CONSTRAINT "accounting_periods_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'SOFT_CLOSE'::character varying, 'HARD_CLOSE'::character varying, 'LOCKED'::character varying])::"text"[])))
);


ALTER TABLE "public"."accounting_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alumni_employment_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "employment_status" character varying(100),
    "employment_type" character varying(100),
    "employer_name" "text",
    "position" "text",
    "date_hired" "date",
    "salary_range" character varying(100),
    "is_related_to_course" boolean DEFAULT true,
    "employer_address" "text",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alumni_employment_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."alumni_employment_reports" IS 'Graduate career tracking data for Tracer Reports';



CREATE TABLE IF NOT EXISTS "public"."ap_memos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "memo_number" "text" NOT NULL,
    "memo_type" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "payable_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "memo_date" "date" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "reason" "text" NOT NULL,
    "reference" "text",
    "adjustment_account_id" "uuid" NOT NULL,
    "journal_entry_id" "uuid",
    "reversal_journal_id" "uuid",
    "legacy_payable_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "reversed_by" "uuid",
    "reversed_at" timestamp with time zone,
    "reversal_reason" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ap_memos_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "ap_memos_memo_type_check" CHECK (("memo_type" = ANY (ARRAY['CREDIT'::"text", 'DEBIT'::"text"]))),
    CONSTRAINT "ap_memos_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING_APPROVAL'::"text", 'POSTED'::"text", 'CANCELLED'::"text", 'REVERSED'::"text"])))
);


ALTER TABLE "public"."ap_memos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ap_reclassifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "reclassification_number" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "payable_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "reclassification_date" "date" NOT NULL,
    "original_account_id" "uuid" NOT NULL,
    "target_account_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "reason" "text" NOT NULL,
    "reference" "text",
    "department_code" "text",
    "cost_center_code" "text",
    "project_code" "text",
    "branch_code" "text",
    "journal_entry_id" "uuid",
    "reversal_journal_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "reversed_by" "uuid",
    "reversed_at" timestamp with time zone,
    "reversal_reason" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ap_reclassifications_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "ap_reclassifications_check" CHECK (("original_account_id" <> "target_account_id")),
    CONSTRAINT "ap_reclassifications_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING_APPROVAL'::"text", 'POSTED'::"text", 'CANCELLED'::"text", 'REVERSED'::"text"])))
);


ALTER TABLE "public"."ap_reclassifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessment_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "registration_code" "text",
    "student_id" "uuid" NOT NULL,
    "qualification_id" "uuid" NOT NULL,
    "sponsor_id" "uuid",
    "billing_party" "text" DEFAULT 'SELF'::"text" NOT NULL,
    "assessment_type" "text" DEFAULT 'FULL_ASSESSMENT'::"text" NOT NULL,
    "assessment_date" "date",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "billing_status" "text" DEFAULT 'UNBILLED'::"text" NOT NULL,
    "total_fees" numeric DEFAULT 0,
    "billed_amount" numeric DEFAULT 0,
    "invoice_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "assessment_registrations_assessment_type_check" CHECK (("assessment_type" = ANY (ARRAY['FULL_ASSESSMENT'::"text", 'REASSESSMENT'::"text", 'COC'::"text", 'RPL'::"text"]))),
    CONSTRAINT "assessment_registrations_billing_party_check" CHECK (("billing_party" = ANY (ARRAY['SELF'::"text", 'SPONSOR'::"text"]))),
    CONSTRAINT "assessment_registrations_billing_status_check" CHECK (("billing_status" = ANY (ARRAY['UNBILLED'::"text", 'BILLED'::"text", 'PARTIALLY_BILLED'::"text"]))),
    CONSTRAINT "assessment_registrations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'BILLED'::"text", 'PAID'::"text", 'ASSESSED'::"text", 'COMPLETED'::"text", 'COMPETENT'::"text", 'NOT_YET_COMPETENT'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."assessment_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atc_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."atc_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atc_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "atc_code" character varying(20) NOT NULL,
    "description" "text" NOT NULL,
    "taxpayer_type" character varying(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "atc_items_taxpayer_type_check" CHECK ((("taxpayer_type")::"text" = ANY ((ARRAY['Individual'::character varying, 'Corporation'::character varying, 'Both'::character varying])::"text"[])))
);


ALTER TABLE "public"."atc_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atc_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "atc_item_id" "uuid" NOT NULL,
    "rate" numeric(10,2) DEFAULT NULL::numeric,
    "rate_label" character varying(255) DEFAULT NULL::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."atc_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" character varying(50) NOT NULL,
    "entity_type" character varying(50),
    "entity_id" "uuid",
    "details" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bank_name" character varying(255) NOT NULL,
    "account_number" character varying(50) NOT NULL,
    "type" character varying(20) NOT NULL,
    "gl_account_id" "uuid",
    "currency" character varying(3) DEFAULT 'PHP'::character varying,
    "balance" numeric(15,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "bank_accounts_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['CHECKING'::character varying, 'SAVINGS'::character varying, 'CREDIT'::character varying])::"text"[])))
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_deposit_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deposit_id" "uuid" NOT NULL,
    "payment_id" "uuid",
    "description" character varying(255) NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "check_number" character varying(50),
    "check_date" "date",
    "payer_name" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "bank_deposit_lines_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."bank_deposit_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_deposits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "deposit_no" character varying(50) NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "reference_no" character varying(100),
    "deposit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    "total_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cash_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "check_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "journal_entry_id" "uuid",
    "posted_at" timestamp with time zone,
    "posted_by" "uuid",
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "bank_deposits_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'POSTED'::character varying, 'VOIDED'::character varying])::"text"[]))),
    CONSTRAINT "chk_amounts_positive" CHECK ((("total_amount" >= (0)::numeric) AND ("cash_amount" >= (0)::numeric) AND ("check_amount" >= (0)::numeric)))
);


ALTER TABLE "public"."bank_deposits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_reconciliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "as_of_date" "date" NOT NULL,
    "statement_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "book_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "cleared_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "difference" numeric(15,2) DEFAULT 0 NOT NULL,
    "status" character varying(50) DEFAULT 'IN_PROGRESS'::character varying,
    "reconciliation_details" "text",
    "reconcilied_by" "uuid",
    "reconcilied_at" timestamp without time zone,
    "locked_by" "uuid",
    "locked_at" timestamp without time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp without time zone,
    "deleted_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."bank_reconciliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_transcript_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "object_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "batch_transcript_records_file_size_check" CHECK ((("file_size" > 0) AND ("file_size" <= 15728640))),
    CONSTRAINT "batch_transcript_records_mime_type_check" CHECK (("mime_type" = 'application/pdf'::"text"))
);


ALTER TABLE "public"."batch_transcript_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "qualification_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "sponsor_id" "uuid",
    "location_id" "uuid",
    "batch_code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" character varying(20) DEFAULT 'PLANNED'::character varying,
    "max_students" integer NOT NULL,
    "current_students" integer DEFAULT 0,
    "student_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "billable_student_limit" integer,
    CONSTRAINT "batches_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PLANNED'::character varying, 'ONGOING'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);


ALTER TABLE "public"."batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "reference" "text" NOT NULL,
    "bill_date" "date" NOT NULL,
    "due_date" "date",
    "currency" "text" DEFAULT 'PHP'::"text",
    "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "vat_purchases" numeric(15,2) DEFAULT 0,
    "input_vat" numeric(15,2) DEFAULT 0,
    "non_vat_purchases" numeric(15,2) DEFAULT 0,
    "total_ewt" numeric(15,2) DEFAULT 0,
    "gross_amount" numeric(15,2) NOT NULL,
    "net_payable" numeric(15,2) NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text",
    "journal_entry_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "bills_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'POSTED'::"text", 'PAID'::"text", 'PARTIALLY_PAID'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(255) NOT NULL,
    "class" character varying(50) NOT NULL,
    "parent_id" "uuid",
    "is_header" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chart_of_accounts_class_check" CHECK ((("class")::"text" = ANY ((ARRAY['ASSET'::character varying, 'LIABILITY'::character varying, 'EQUITY'::character varying, 'REVENUE'::character varying, 'EXPENSE'::character varying])::"text"[])))
);


ALTER TABLE "public"."chart_of_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_number_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "prefix" character varying(20) DEFAULT ''::character varying,
    "start_number" integer DEFAULT 1,
    "current_number" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."check_number_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "check_number" character varying(50) NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "payee_id" "uuid",
    "payee_type" character varying(20),
    "payee_name" character varying(255) NOT NULL,
    "check_date" "date" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "amount_in_words" character varying(500),
    "status" character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    "payable_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "journal_entry_id" "uuid",
    "prepared_by" "uuid",
    "prepared_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "printed_by" "uuid",
    "printed_at" timestamp with time zone,
    "released_by" "uuid",
    "released_at" timestamp with time zone,
    "cleared_by" "uuid",
    "cleared_at" timestamp with time zone,
    "voided_by" "uuid",
    "voided_at" timestamp with time zone,
    "void_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "check_vouchers_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "check_vouchers_payee_type_check" CHECK ((("payee_type")::"text" = ANY ((ARRAY['VENDOR'::character varying, 'EMPLOYEE'::character varying, 'OTHER'::character varying])::"text"[]))),
    CONSTRAINT "check_vouchers_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'PRINTED'::character varying, 'RELEASED'::character varying, 'CLEARED'::character varying, 'VOIDED'::character varying, 'STALE'::character varying])::"text"[])))
);


ALTER TABLE "public"."check_vouchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "fee_code" "text" NOT NULL,
    "qualification_id" "uuid" NOT NULL,
    "fee_name" "text" NOT NULL,
    "amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "gl_account_id" "uuid" NOT NULL,
    "tax_category_id" "uuid",
    "is_subject_to_ewt" boolean DEFAULT false NOT NULL,
    "ewt_rate" numeric(5,4),
    "category" "text",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "funding_type" "text",
    CONSTRAINT "course_fees_category_check" CHECK (("category" = ANY (ARRAY['TUITION'::"text", 'REGISTRATION'::"text", 'CERTIFICATION'::"text", 'ASSESSMENT'::"text", 'MATERIALS'::"text", 'MISCELLANEOUS'::"text"]))),
    CONSTRAINT "course_fees_funding_type_check" CHECK (("funding_type" = ANY (ARRAY['PRIVATE'::"text", 'SPONSORED'::"text", 'TESDA_SCHOLARSHIP'::"text"])))
);


ALTER TABLE "public"."course_fees" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_fees" IS 'Course fee structures linked to qualifications/courses';



COMMENT ON COLUMN "public"."course_fees"."fee_code" IS 'Unique identifier code for the fee (e.g., NC2-FEE-001)';



COMMENT ON COLUMN "public"."course_fees"."qualification_id" IS 'Links to the qualification/course this fee belongs to';



COMMENT ON COLUMN "public"."course_fees"."fee_name" IS 'Descriptive name of the fee';



COMMENT ON COLUMN "public"."course_fees"."amount" IS 'Fee amount in base currency';



COMMENT ON COLUMN "public"."course_fees"."gl_account_id" IS 'G/L revenue account for income recognition';



COMMENT ON COLUMN "public"."course_fees"."tax_category_id" IS 'Optional link to ATC tax category';



COMMENT ON COLUMN "public"."course_fees"."is_subject_to_ewt" IS 'Whether Expanded Withholding Tax applies to this fee';



COMMENT ON COLUMN "public"."course_fees"."ewt_rate" IS 'EWT rate as decimal (e.g., 0.02 = 2%)';



COMMENT ON COLUMN "public"."course_fees"."category" IS 'Fee category: TUITION, REGISTRATION, CERTIFICATION, ASSESSMENT, MATERIALS, MISCELLANEOUS';



COMMENT ON COLUMN "public"."course_fees"."is_active" IS 'Whether this fee is currently available for billing';



COMMENT ON COLUMN "public"."course_fees"."funding_type" IS 'Explicitly selected pricing schedule: PRIVATE, SPONSORED, or TESDA_SCHOLARSHIP. Legacy null rows must be classified manually.';



CREATE OR REPLACE VIEW "public"."course_fees_excluding_forklift_002" AS
 SELECT "id",
    "org_id",
    "fee_code",
    "qualification_id",
    "fee_name",
    "amount",
    "gl_account_id",
    "tax_category_id",
    "is_subject_to_ewt",
    "ewt_rate",
    "category",
    "description",
    "is_active",
    "created_at",
    "updated_at",
    "is_deleted",
    "deleted_at",
    "deleted_by",
    "funding_type"
   FROM "public"."course_fees"
  WHERE (("fee_code" <> 'FORKLIFT-002'::"text") OR ("fee_code" IS NULL));


ALTER VIEW "public"."course_fees_excluding_forklift_002" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "designation" character varying(100),
    "tin" character varying(50),
    "sss" character varying(50),
    "philhealth" character varying(50),
    "pagibig" character varying(50),
    "basic_salary" numeric(12,2) DEFAULT 0 NOT NULL,
    "bank_name" character varying(100),
    "bank_account" character varying(50),
    "is_active" boolean DEFAULT true,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_org_id" CHECK (("org_id" IS NOT NULL)),
    CONSTRAINT "valid_salary" CHECK (("basic_salary" >= (0)::numeric))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."employees" IS 'Employee/Staff records with payroll information';



COMMENT ON COLUMN "public"."employees"."tin" IS 'Tax Identification Number';



COMMENT ON COLUMN "public"."employees"."sss" IS 'Social Security System number';



COMMENT ON COLUMN "public"."employees"."philhealth" IS 'PhilHealth number';



COMMENT ON COLUMN "public"."employees"."pagibig" IS 'Pag-IBIG number';



CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "from_currency" character varying(3) NOT NULL,
    "to_currency" character varying(3) NOT NULL,
    "rate" numeric(18,8) NOT NULL,
    "effective_date" "date" NOT NULL,
    "source" character varying(50) DEFAULT 'MANUAL'::character varying NOT NULL,
    "is_manual" boolean DEFAULT true,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" boolean DEFAULT false,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "valid_currencies" CHECK ((("from_currency")::"text" <> ("to_currency")::"text")),
    CONSTRAINT "valid_rate" CHECK (("rate" > (0)::numeric))
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "screenshot_data_url" "text",
    "screenshot_name" "text",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "created_by" "uuid",
    "created_by_name" "text" NOT NULL,
    "created_by_role" "text" NOT NULL,
    "assigned_to" "uuid",
    "admin_notes" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "feedback_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'URGENT'::"text"]))),
    CONSTRAINT "feedback_tickets_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."feedback_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixed_assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" character varying(100),
    "purchase_date" "date",
    "purchase_cost" numeric(15,2),
    "accumulated_depreciation" numeric(15,2) DEFAULT 0,
    "net_book_value" numeric(15,2) GENERATED ALWAYS AS (("purchase_cost" - "accumulated_depreciation")) STORED,
    "depreciation_method" character varying(20) DEFAULT 'STRAIGHT_LINE'::character varying,
    "useful_life_years" integer,
    "gl_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fixed_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_journals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "gl_reference" "text" NOT NULL,
    "journal_date" "date" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "posted_by" "uuid" NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "general_journals_source_check" CHECK (("source" = 'JOURNAL_VOUCHER'::"text"))
);


ALTER TABLE "public"."general_journals" OWNER TO "postgres";


COMMENT ON TABLE "public"."general_journals" IS 'Official journal headers created only when a source document posts.';



CREATE TABLE IF NOT EXISTS "public"."general_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "general_journal_id" "uuid" NOT NULL,
    "gl_reference" "text" NOT NULL,
    "journal_date" "date" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(18,2) DEFAULT 0 NOT NULL,
    "credit" numeric(18,2) DEFAULT 0 NOT NULL,
    "running_balance" numeric(18,2) NOT NULL,
    "description" "text",
    "source_document" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "general_ledger_source_document_check" CHECK (("source_document" = 'JOURNAL_VOUCHER'::"text"))
);


ALTER TABLE "public"."general_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."general_ledger" IS 'Immutable ledger detail generated atomically from posted source documents.';



CREATE TABLE IF NOT EXISTS "public"."inventory_classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "inventory_asset_account_id" "uuid" NOT NULL,
    "cogs_account_id" "uuid" NOT NULL,
    "adjustment_account_id" "uuid" NOT NULL,
    "purchase_price_variance_account_id" "uuid",
    "in_transit_account_id" "uuid",
    "write_off_account_id" "uuid",
    "opening_balance_equity_account_id" "uuid",
    "default_warehouse_id" "uuid",
    "valuation_method" "text" DEFAULT 'FIFO'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_classes_valuation_method_check" CHECK (("valuation_method" = ANY (ARRAY['FIFO'::"text", 'WEIGHTED_AVERAGE'::"text", 'STANDARD_COST'::"text"])))
);


ALTER TABLE "public"."inventory_classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_ledger" (
    "id" bigint NOT NULL,
    "org_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "warehouse_location_id" "uuid" NOT NULL,
    "posting_date" "date" NOT NULL,
    "quantity_change" numeric(18,4) NOT NULL,
    "unit_cost" numeric(18,4) NOT NULL,
    "extended_cost" numeric(18,4) NOT NULL,
    "running_quantity" numeric(18,4) NOT NULL,
    "running_value" numeric(18,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_ledger_quantity_change_check" CHECK (("quantity_change" <> (0)::numeric)),
    CONSTRAINT "inventory_ledger_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."inventory_ledger" OWNER TO "postgres";


ALTER TABLE "public"."inventory_ledger" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."inventory_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "warehouse_location_id" "uuid" NOT NULL,
    "quantity_on_hand" numeric(15,4) DEFAULT 0,
    "quantity_reserved" numeric(15,4) DEFAULT 0,
    "quantity_available" numeric(15,4) DEFAULT 0,
    "last_counted" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."inventory_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "reference_number" character varying(100) NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "from_location_id" "uuid",
    "to_location_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_cost" numeric(15,2) NOT NULL,
    "total_cost" numeric(15,2) NOT NULL,
    "notes" "text",
    "journal_entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "posting_date" "date",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "source_document" "text",
    "source_module" "text",
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "reversal_of_id" "uuid",
    "batch_lot" "text",
    "serial_number" "text",
    CONSTRAINT "inventory_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['OPENING_INVENTORY'::character varying, 'PURCHASE_RECEIPT'::character varying, 'PURCHASE_RETURN'::character varying, 'SALES_ISSUE'::character varying, 'SALES_RETURN'::character varying, 'TRANSFER_IN'::character varying, 'TRANSFER_OUT'::character varying, 'STOCK_ADJUSTMENT'::character varying, 'PRODUCTION_RECEIPT'::character varying, 'PRODUCTION_CONSUMPTION'::character varying, 'INVENTORY_WRITEOFF'::character varying, 'CYCLE_COUNT_ADJUSTMENT'::character varying, 'REVERSAL'::character varying, 'PURCHASE'::character varying, 'SALE'::character varying, 'ADJUSTMENT'::character varying, 'TRANSFER'::character varying, 'RETURN'::character varying, 'DAMAGE'::character varying, 'WRITEOFF'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "description" "text" NOT NULL,
    "course_fee_id" "uuid",
    "enrollment_id" "uuid",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "tax_category_id" "uuid",
    "vat_amount" numeric(12,2) DEFAULT 0,
    "gl_account_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "net_amount" numeric(12,2) DEFAULT 0,
    "gross_amount" numeric DEFAULT 0,
    "org_id" "uuid",
    "classification_code" "text",
    "assessment_registration_id" "uuid",
    "line_type" "text" DEFAULT 'MANUAL'::"text" NOT NULL,
    CONSTRAINT "invoice_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['COURSE_FEE'::"text", 'DISCOUNT'::"text", 'ADJUSTMENT'::"text", 'MANUAL'::"text"])))
);


ALTER TABLE "public"."invoice_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(18,4) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."item_groups"."items" IS 'JSON array of item group items: [{itemId: string, qty: number, price: number}]';



CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "unit_price" numeric(12,2),
    "income_account_id" "uuid",
    "expense_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tax_category_id" "uuid"
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entry_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(15,2) DEFAULT 0 NOT NULL,
    "credit" numeric(15,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "journal_entry_lines_check" CHECK ((("debit" > (0)::numeric) OR ("credit" > (0)::numeric)))
);


ALTER TABLE "public"."journal_entry_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_entry_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(15,2) DEFAULT 0,
    "credit" numeric(15,2) DEFAULT 0,
    "memo" "text",
    "contact_id" "uuid",
    "contact_type" "text",
    "batch_id" "uuid",
    "item_id" "uuid",
    "asset_id" "uuid",
    "is_cleared" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "classification_code" "text",
    "tax_category_id" "uuid",
    CONSTRAINT "journal_lines_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['STUDENT'::"text", 'TRAINER'::"text", 'SPONSOR'::"text", 'VENDOR'::"text", 'OTHER'::"text", 'EMPLOYEE'::"text"]))),
    CONSTRAINT "valid_debit_credit" CHECK (((("debit" = (0)::numeric) OR ("credit" = (0)::numeric)) AND (("debit" > (0)::numeric) OR ("credit" > (0)::numeric))))
);


ALTER TABLE "public"."journal_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "address" "text",
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opening_inventory_headers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "document_number" "text" NOT NULL,
    "posting_date" "date" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "remarks" "text",
    "journal_entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    CONSTRAINT "opening_inventory_headers_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'POSTED'::"text", 'REVERSED'::"text"])))
);


ALTER TABLE "public"."opening_inventory_headers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opening_inventory_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "header_id" "uuid" NOT NULL,
    "warehouse_location_id" "uuid" NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "quantity" numeric(18,4) NOT NULL,
    "unit_cost" numeric(18,4) NOT NULL,
    "batch_lot" "text",
    "expiration_date" "date",
    "remarks" "text",
    CONSTRAINT "opening_inventory_lines_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "opening_inventory_lines_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."opening_inventory_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "currency" character varying(3) DEFAULT 'PHP'::character varying,
    "tax_id" character varying(50),
    "is_vat_registered" boolean DEFAULT false,
    "subscription_status" character varying(20) DEFAULT 'TRIAL'::character varying,
    "plan_type" character varying(20) DEFAULT 'BASIC'::character varying,
    "pending_plan_type" character varying(20),
    "payment_reference" character varying(100),
    "license_expiry" "date",
    "primary_color" character varying(7) DEFAULT '#4f46e5'::character varying,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "institution_type" "text" DEFAULT 'TRAINING'::"text" NOT NULL,
    CONSTRAINT "organizations_institution_type_check" CHECK (("institution_type" = ANY (ARRAY['TRAINING'::"text", 'ACADEMIC'::"text", 'HYBRID'::"text"]))),
    CONSTRAINT "organizations_plan_type_check" CHECK ((("plan_type")::"text" = ANY ((ARRAY['BASIC'::character varying, 'PROFESSIONAL'::character varying, 'ENTERPRISE'::character varying])::"text"[]))),
    CONSTRAINT "organizations_subscription_status_check" CHECK ((("subscription_status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'TRIAL'::character varying, 'SUSPENDED'::character varying, 'EXPIRED'::character varying, 'PENDING'::character varying])::"text"[])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payable_payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "payment_event_id" "uuid" NOT NULL,
    "payable_id" "uuid" NOT NULL,
    "journal_entry_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_method" "text" NOT NULL,
    "cash_account_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payable_payment_allocations_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."payable_payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "payable_number" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "bill_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "payment_date" "date",
    "currency" "text" DEFAULT 'PHP'::"text",
    "status" "text" DEFAULT 'for_approval'::"text",
    "reference_document" "text",
    "journal_entry_id" "uuid",
    "gl_account_id" "uuid",
    "notes" "text",
    "withholding_type" "text",
    "atc_item_id" "uuid",
    "atc_rate_id" "uuid",
    "applied_rate_percent" numeric(5,2) DEFAULT 0,
    "withholding_amount" numeric(15,2) DEFAULT 0,
    "net_payable" numeric(15,2),
    "created_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "paid_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "paid_amount" numeric DEFAULT 0,
    "qualification_id" "uuid",
    "expense_account_id" "uuid",
    "expense_allocations" "jsonb",
    "claimed_by" "text",
    "employee_id" "uuid",
    "invoice_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "input_vat_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "input_vat_account_id" "uuid",
    "payment_method" "text",
    "payment_bank_account_id" "uuid",
    "check_number" "text",
    "check_date" "date",
    "reversal_journal_id" "uuid",
    "memo_adjustment_total" numeric(15,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "payables_category_check" CHECK (("category" = ANY (ARRAY['utilities'::"text", 'supplies'::"text", 'training_materials'::"text", 'contractor_services'::"text", 'assessments'::"text", 'insurance'::"text", 'government_obligations'::"text", 'scholarship_advances'::"text", 'employee_reimbursements'::"text", 'other'::"text"]))),
    CONSTRAINT "payables_expense_allocations_is_array" CHECK ((("expense_allocations" IS NULL) OR ("jsonb_typeof"("expense_allocations") = 'array'::"text"))),
    CONSTRAINT "payables_payee_required" CHECK ((("vendor_id" IS NOT NULL) OR (("employee_id" IS NOT NULL) AND ("category" = 'employee_reimbursements'::"text") AND (NULLIF("btrim"("claimed_by"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "payables_status_check" CHECK (("status" = ANY (ARRAY['for_approval'::"text", 'approved'::"text", 'paid'::"text", 'partially_paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "payables_withholding_type_check" CHECK (("withholding_type" = ANY (ARRAY['EXPANDED'::"text", 'FINAL'::"text"])))
);


ALTER TABLE "public"."payables" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payables"."qualification_id" IS 'Qualification used as the accounting class for the payable expense.';



COMMENT ON COLUMN "public"."payables"."expense_account_id" IS 'Expense GL account selected when the payable bill is created.';



CREATE TABLE IF NOT EXISTS "public"."payment_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount_applied" numeric(15,2) NOT NULL,
    "is_reversed" boolean DEFAULT false,
    "reversal_reason" "text",
    "reversed_at" timestamp with time zone,
    "reversed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_applications_amount_applied_check" CHECK (("amount_applied" > (0)::numeric))
);


ALTER TABLE "public"."payment_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_histories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "due_date" "date" NOT NULL,
    "paid_date" "date",
    "status" character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    "plan_type" character varying(50),
    "description" "text",
    "invoice_number" character varying(100),
    "payment_method" character varying(50),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_amount" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "valid_dates" CHECK ((("paid_date" IS NULL) OR ("paid_date" >= "due_date"))),
    CONSTRAINT "valid_org_id" CHECK (("org_id" IS NOT NULL)),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['PAID'::character varying, 'PENDING'::character varying, 'OVERDUE'::character varying, 'CANCELLED'::character varying])::"text"[])))
);


ALTER TABLE "public"."payment_histories" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_histories" IS 'Subscription/service payment tracking for organizations';



COMMENT ON COLUMN "public"."payment_histories"."status" IS 'PAID: Received, PENDING: Not yet due, OVERDUE: Past due, CANCELLED: Not collected';



COMMENT ON COLUMN "public"."payment_histories"."plan_type" IS 'Subscription tier: TRIAL, PROFESSIONAL, ENTERPRISE';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "payment_no" character varying(50) NOT NULL,
    "sponsor_id" "uuid",
    "student_id" "uuid",
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    "payment_method" character varying(30) DEFAULT 'CHECK'::character varying NOT NULL,
    "ref_no" character varying(100),
    "bank_account_id" "uuid",
    "check_number" character varying(50),
    "check_date" "date",
    "amount_received" numeric(15,2) DEFAULT 0 NOT NULL,
    "ewt_amount_certified" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_applied" numeric(15,2) DEFAULT 0 NOT NULL,
    "customer_deposit_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "journal_entry_id" "uuid",
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "posted_at" timestamp with time zone,
    "posted_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "chk_amounts" CHECK ((("amount_received" >= (0)::numeric) AND ("ewt_amount_certified" >= (0)::numeric))),
    CONSTRAINT "chk_payer" CHECK ((("sponsor_id" IS NOT NULL) OR ("student_id" IS NOT NULL) OR ("upper"(COALESCE(("status")::"text", ''::"text")) = 'VOIDED'::"text"))),
    CONSTRAINT "payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['CASH'::character varying, 'CHECK'::character varying, 'BANK_TRANSFER'::character varying, 'CREDIT_CARD'::character varying, 'EWALLET'::character varying, 'OFFSET'::character varying])::"text"[]))),
    CONSTRAINT "payments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'POSTED'::character varying, 'VOIDED'::character varying])::"text"[])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "payroll_run_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "gross_pay" numeric(12,2) DEFAULT 0 NOT NULL,
    "deductions_tax" numeric(12,2) DEFAULT 0 NOT NULL,
    "deductions_sss" numeric(12,2) DEFAULT 0 NOT NULL,
    "deductions_philhealth" numeric(12,2) DEFAULT 0 NOT NULL,
    "deductions_pagibig" numeric(12,2) DEFAULT 0 NOT NULL,
    "deductions_other" numeric(12,2) DEFAULT 0 NOT NULL,
    "net_pay" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_amounts" CHECK ((("gross_pay" >= (0)::numeric) AND ("net_pay" >= (0)::numeric))),
    CONSTRAINT "valid_calculation" CHECK (("net_pay" = ("gross_pay" - (((("deductions_tax" + "deductions_sss") + "deductions_philhealth") + "deductions_pagibig") + "deductions_other")))),
    CONSTRAINT "valid_ids" CHECK ((("payroll_run_id" IS NOT NULL) AND ("employee_id" IS NOT NULL))),
    CONSTRAINT "valid_org_id" CHECK (("org_id" IS NOT NULL))
);


ALTER TABLE "public"."payroll_lines" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_lines" IS 'Individual payroll entries (one per employee per payroll run)';



COMMENT ON COLUMN "public"."payroll_lines"."deductions_tax" IS 'Income tax deduction';



COMMENT ON COLUMN "public"."payroll_lines"."deductions_sss" IS 'Social Security System deduction';



COMMENT ON COLUMN "public"."payroll_lines"."deductions_philhealth" IS 'PhilHealth insurance deduction';



COMMENT ON COLUMN "public"."payroll_lines"."deductions_pagibig" IS 'Pag-IBIG housing fund deduction';



COMMENT ON COLUMN "public"."payroll_lines"."deductions_other" IS 'Other deductions (loans, etc)';



CREATE TABLE IF NOT EXISTS "public"."payroll_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" character varying(50) DEFAULT 'DRAFT'::character varying NOT NULL,
    "total_gross" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_net" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_dates" CHECK (("period_start" <= "period_end")),
    CONSTRAINT "valid_org_id" CHECK (("org_id" IS NOT NULL)),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'POSTED'::character varying])::"text"[]))),
    CONSTRAINT "valid_totals" CHECK ((("total_gross" >= (0)::numeric) AND ("total_deductions" >= (0)::numeric) AND ("total_net" >= (0)::numeric)))
);


ALTER TABLE "public"."payroll_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_runs" IS 'Payroll processing batches for a given period';



COMMENT ON COLUMN "public"."payroll_runs"."status" IS 'Draft: Under preparation, Posted: Finalized and recorded';



CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "total_amount" numeric(15,2) GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "received_quantity" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "po_number" character varying(50) NOT NULL,
    "order_date" "date" NOT NULL,
    "expected_delivery_date" "date",
    "status" character varying(20) DEFAULT 'DRAFT'::character varying,
    "total_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gl_entry_number" character varying(50),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "purchase_orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'SENT'::character varying, 'APPROVED'::character varying, 'RECEIVED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_orders"."gl_entry_number" IS 'Sequential GL entry number generated when PO is approved (e.g., GL-2026-00001)';



COMMENT ON COLUMN "public"."purchase_orders"."approved_by" IS 'User ID who approved the PO';



COMMENT ON COLUMN "public"."purchase_orders"."approved_at" IS 'Timestamp when PO was approved';



CREATE TABLE IF NOT EXISTS "public"."qualifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "duration_days" integer NOT NULL,
    "sector" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."qualifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "frequency" character varying(50) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "next_run_date" "date" NOT NULL,
    "last_run_date" "date",
    "max_runs" integer,
    "times_run" integer DEFAULT 0,
    "status" character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "auto_post" boolean DEFAULT true,
    "last_generated_entry_id" "uuid",
    "template_entry" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" boolean DEFAULT false,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "frequency_check" CHECK ((("frequency")::"text" = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'MONTHLY'::character varying, 'QUARTERLY'::character varying, 'SEMIANNUAL'::character varying, 'ANNUAL'::character varying, 'CUSTOM'::character varying])::"text"[]))),
    CONSTRAINT "status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'PAUSED'::character varying, 'COMPLETED'::character varying, 'INACTIVE'::character varying])::"text"[])))
);


ALTER TABLE "public"."recurring_journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reorder_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "min_level" numeric(15,4) NOT NULL,
    "max_level" numeric(15,4) NOT NULL,
    "reorder_quantity" numeric(15,4) NOT NULL,
    "lead_time_days" integer DEFAULT 7,
    "last_reorder_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."reorder_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "slots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_org_id" CHECK (("org_id" IS NOT NULL)),
    CONSTRAINT "valid_trainer_id" CHECK (("trainer_id" IS NOT NULL))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedules" IS 'Trainer schedules with daily time slots for availability';



COMMENT ON COLUMN "public"."schedules"."slots" IS 'JSON array: [{"dayIndex": 0-6, "startTime": "HH:MM", "endTime": "HH:MM"}]';



CREATE TABLE IF NOT EXISTS "public"."sponsors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "contact_person" character varying(255),
    "email" character varying(255),
    "phone" character varying(50),
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ar_account_id" "uuid",
    "sponsor_code" "text",
    "tin" "text",
    "tax_type" "text",
    "ewt_rate" numeric(5,4),
    "course_fee_type" "text" DEFAULT 'SPONSORED'::"text" NOT NULL,
    "customer_type" "text" DEFAULT 'SPONSOR'::"text" NOT NULL,
    CONSTRAINT "sponsors_course_fee_type_check" CHECK (("course_fee_type" = ANY (ARRAY['SPONSORED'::"text", 'TESDA_SCHOLARSHIP'::"text"]))),
    CONSTRAINT "sponsors_customer_type_check" CHECK (("customer_type" = ANY (ARRAY['SPONSOR'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "sponsors_tax_type_check" CHECK (("tax_type" = ANY (ARRAY['VAT'::"text", 'NON_VAT'::"text", 'ZERO_RATED'::"text"])))
);


ALTER TABLE "public"."sponsors" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sponsors"."sponsor_code" IS 'Unique identifier code for the sponsor (e.g., SP-001)';



COMMENT ON COLUMN "public"."sponsors"."tin" IS 'Tax Identification Number for the sponsor';



COMMENT ON COLUMN "public"."sponsors"."tax_type" IS 'Tax classification: VAT, NON_VAT, or ZERO_RATED';



COMMENT ON COLUMN "public"."sponsors"."ewt_rate" IS 'Expanded Withholding Tax rate as decimal (e.g., 0.02 = 2%)';



COMMENT ON COLUMN "public"."sponsors"."course_fee_type" IS 'Selects the standard sponsored or TESDA scholarship course-fee schedule for batches funded by this sponsor.';



CREATE TABLE IF NOT EXISTS "public"."stock_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "adjustment_number" character varying(100) NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "warehouse_location_id" "uuid" NOT NULL,
    "quantity_change" numeric(15,4) NOT NULL,
    "reason" character varying(255) NOT NULL,
    "notes" "text",
    "approved_by" "uuid",
    "approval_date" timestamp with time zone,
    "journal_entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "adjustment_type" "text" DEFAULT 'ADJUSTMENT'::"text" NOT NULL,
    CONSTRAINT "stock_adjustments_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['OPENING_INVENTORY'::"text", 'PHYSICAL_COUNT'::"text", 'DAMAGE'::"text", 'DAMAGED'::"text", 'LOST'::"text", 'EXPIRED'::"text", 'SHRINKAGE'::"text", 'WRITEOFF'::"text", 'ADJUSTMENT'::"text", 'CORRECTION'::"text"])))
);


ALTER TABLE "public"."stock_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "unit_price" numeric(15,2) DEFAULT 0,
    "cost_price" numeric(15,2) DEFAULT 0,
    "warehouse_location_id" "uuid",
    "income_account_id" "uuid",
    "cogs_account_id" "uuid",
    "expense_account_id" "uuid",
    "tax_category_id" "uuid",
    "valuation_method" character varying(20) DEFAULT 'FIFO'::character varying,
    "min_stock_level" numeric(15,2) DEFAULT 0,
    "max_stock_level" numeric(15,2) DEFAULT 0,
    "reorder_quantity" numeric(15,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "type" "text" DEFAULT 'STOCK_ITEM'::"text" NOT NULL,
    "unit_of_measure" "text" DEFAULT 'PCS'::"text" NOT NULL,
    "reorder_level" numeric DEFAULT 0 NOT NULL,
    "safety_stock" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "inventory_class_id" "uuid",
    "default_warehouse_id" "uuid",
    "standard_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "valuation_method_override" "text",
    "barcode" "text",
    "brand" "text",
    "category" "text",
    "preferred_supplier_id" "uuid",
    CONSTRAINT "stock_items_type_check" CHECK (("type" = ANY (ARRAY['STOCK_ITEM'::"text", 'NON_STOCK_ITEM'::"text"]))),
    CONSTRAINT "stock_items_valuation_method_check" CHECK ((("valuation_method")::"text" = ANY ((ARRAY['FIFO'::character varying, 'LIFO'::character varying, 'WEIGHTED_AVERAGE'::character varying, 'STANDARD_COST'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stock_items"."reorder_level" IS 'Quantity at or below which the item should be reordered.';



COMMENT ON COLUMN "public"."stock_items"."safety_stock" IS 'Operational buffer quantity retained below the reorder level.';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "uli" character varying(50),
    "last_name" character varying(255) NOT NULL,
    "first_name" character varying(255) NOT NULL,
    "middle_name" character varying(255),
    "extension" character varying(10),
    "sex" character varying(10),
    "date_of_birth" "date",
    "birth_region" character varying(100),
    "birth_province" character varying(100),
    "birth_city" character varying(100),
    "civil_status" character varying(50),
    "educational_attainment" character varying(100),
    "nationality" character varying(100),
    "email" character varying(255),
    "contact_number" character varying(50),
    "street" character varying(255),
    "barangay" character varying(100),
    "city" character varying(100),
    "district" character varying(100),
    "province" character varying(100),
    "guardian" character varying(255),
    "location_id" "uuid",
    "sponsor_id" "uuid",
    "documents" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_photo" "text",
    "mailing_region" "text",
    "tesda_employment_status" "text",
    "tesda_employment_type" "text",
    "tesda_learner_classifications" "text"[],
    "tesda_other_classification" "text",
    "tesda_disability_types" "text"[],
    "tesda_disability_causes" "text"[],
    "tesda_course_qualification" "text",
    "tesda_scholarship_package" "text",
    "tesda_privacy_consent" "text"
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tax_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "description" "text",
    "type" character varying(20) DEFAULT 'VAT'::character varying NOT NULL,
    "rate" numeric(6,2) DEFAULT 0.1200 NOT NULL,
    "is_inclusive" boolean DEFAULT true NOT NULL,
    "output_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tax_type" "text" NOT NULL
);


ALTER TABLE "public"."tax_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "rfq_code" "text" NOT NULL,
    "transaction_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "supplier_id" "uuid",
    "claimed_by" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "payable_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity" numeric(15,2) NOT NULL,
    "unit_cost" numeric(15,2) NOT NULL,
    "expense_account_id" "uuid",
    "supplier_name" "text" NOT NULL,
    "employee_id" "uuid",
    "qualification_id" "uuid",
    "tax_category_id" "uuid",
    CONSTRAINT "time_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "time_expenses_amount_matches_cost" CHECK (("amount" = "round"(("quantity" * "unit_cost"), 2))),
    CONSTRAINT "time_expenses_claimed_by_not_blank" CHECK (("btrim"("claimed_by") <> ''::"text")),
    CONSTRAINT "time_expenses_quantity_positive" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "time_expenses_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'released'::"text", 'billed'::"text"]))),
    CONSTRAINT "time_expenses_supplier_name_not_blank" CHECK (("btrim"("supplier_name") <> ''::"text")),
    CONSTRAINT "time_expenses_unit_cost_positive" CHECK (("unit_cost" > (0)::numeric))
);


ALTER TABLE "public"."time_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "schedule_date" "date" DEFAULT CURRENT_DATE,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "subject" character varying(255),
    "batch_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."trainer_schedules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trainer_schedules"."slots" IS 'Array of time slots: [{dayIndex: number, startTime: string, endTime: string}]';



CREATE TABLE IF NOT EXISTS "public"."trainers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "first_name" character varying(255) NOT NULL,
    "last_name" character varying(255) NOT NULL,
    "middle_name" character varying(255),
    "email" character varying(255) NOT NULL,
    "contact_number" character varying(50),
    "specialization" "text",
    "qualification_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trainers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transcript_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "object_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transcript_records_file_size_check" CHECK ((("file_size" > 0) AND ("file_size" <= 15728640))),
    CONSTRAINT "transcript_records_mime_type_check" CHECK (("mime_type" = 'application/pdf'::"text"))
);


ALTER TABLE "public"."transcript_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "salt" character varying(255) NOT NULL,
    "role" character varying(20) NOT NULL,
    "last_login_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_uid" "uuid",
    "trainer_id" "uuid",
    "student_id" "uuid",
    "last_name" "text",
    "profile_photo" "text",
    "contact_number" "text",
    "address" "text",
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY (ARRAY['SYSTEM_ADMIN'::"text", 'ADMIN'::"text", 'PRESIDENT'::"text", 'FINANCE_MANAGER'::"text", 'ACCOUNTANT'::"text", 'AR_SPECIALIST'::"text", 'AP_SPECIALIST'::"text", 'AP_CLERK'::"text", 'AP_SUPERVISOR'::"text", 'TREASURY'::"text", 'AUDITOR'::"text", 'REGISTRAR'::"text", 'TRAINER'::"text", 'STUDENT'::"text", 'VIEWER'::"text"]))),
    CONSTRAINT "users_trainer_or_student_exclusive" CHECK ((("trainer_id" IS NULL) OR ("student_id" IS NULL)))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouse_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "address" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."warehouse_locations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inventory_status" AS
 SELECT "il"."org_id",
    "si"."code",
    "si"."name",
    "wl"."name" AS "location",
    "il"."quantity_on_hand",
    "il"."quantity_reserved",
    "il"."quantity_available",
    "si"."min_stock_level",
    "si"."max_stock_level",
        CASE
            WHEN ("il"."quantity_available" <= "si"."min_stock_level") THEN 'URGENT_REORDER'::"text"
            WHEN ("il"."quantity_available" <= ("si"."min_stock_level" * 1.5)) THEN 'LOW_STOCK'::"text"
            WHEN ("il"."quantity_available" > "si"."max_stock_level") THEN 'OVERSTOCKED'::"text"
            ELSE 'NORMAL'::"text"
        END AS "stock_status",
    "il"."last_counted"
   FROM (("public"."inventory_levels" "il"
     JOIN "public"."stock_items" "si" ON (("il"."stock_item_id" = "si"."id")))
     JOIN "public"."warehouse_locations" "wl" ON (("il"."warehouse_location_id" = "wl"."id")))
  WHERE (("il"."is_deleted" = false) AND ("si"."is_deleted" = false));


ALTER VIEW "public"."v_inventory_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inventory_transactions_summary" AS
 SELECT "org_id",
    "reference_number",
    "transaction_type",
    "sum"("quantity") AS "total_quantity",
    "sum"("total_cost") AS "total_value",
    "created_at"
   FROM "public"."inventory_transactions"
  WHERE ("is_deleted" = false)
  GROUP BY "org_id", "reference_number", "transaction_type", "created_at";


ALTER VIEW "public"."v_inventory_transactions_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_tax_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "atc_item_id" "uuid",
    "atc_rate_id" "uuid",
    "withholding_type" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "vendor_tax_settings_withholding_type_check" CHECK (("withholding_type" = ANY (ARRAY['EXPANDED'::"text", 'FINAL'::"text"])))
);


ALTER TABLE "public"."vendor_tax_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "category" character varying(100),
    "email" character varying(255),
    "contact_number" character varying(50),
    "address" "text",
    "ap_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_terms_days" integer DEFAULT 30 NOT NULL,
    CONSTRAINT "vendors_payment_terms_days_check" CHECK (("payment_terms_days" >= 0))
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_org_id_fiscal_year_period_number_period__key" UNIQUE ("org_id", "fiscal_year", "period_number", "period_type");



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alumni_employment_reports"
    ADD CONSTRAINT "alumni_employment_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_legacy_payable_id_key" UNIQUE ("legacy_payable_id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_org_id_memo_number_key" UNIQUE ("org_id", "memo_number");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_org_id_reclassification_number_key" UNIQUE ("org_id", "reclassification_number");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assessment_registrations"
    ADD CONSTRAINT "assessment_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atc_categories"
    ADD CONSTRAINT "atc_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."atc_categories"
    ADD CONSTRAINT "atc_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atc_items"
    ADD CONSTRAINT "atc_items_atc_code_key" UNIQUE ("atc_code");



ALTER TABLE ONLY "public"."atc_items"
    ADD CONSTRAINT "atc_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atc_rates"
    ADD CONSTRAINT "atc_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_deposit_lines"
    ADD CONSTRAINT "bank_deposit_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_org_id_deposit_no_key" UNIQUE ("org_id", "deposit_no");



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_transcript_records"
    ADD CONSTRAINT "batch_transcript_records_org_id_batch_id_key" UNIQUE ("org_id", "batch_id");



ALTER TABLE ONLY "public"."batch_transcript_records"
    ADD CONSTRAINT "batch_transcript_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_number_settings"
    ADD CONSTRAINT "check_number_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_org_id_fee_code_key" UNIQUE ("org_id", "fee_code");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollment_code_per_org" UNIQUE ("org_id", "enrollment_code");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_org_id_from_currency_to_currency_effective_d_key" UNIQUE ("org_id", "from_currency", "to_currency", "effective_date");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_org_id_gl_reference_key" UNIQUE ("org_id", "gl_reference");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_source_source_id_key" UNIQUE ("source", "source_id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_transaction_id_warehouse_location_id_key" UNIQUE ("transaction_id", "warehouse_location_id");



ALTER TABLE ONLY "public"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_org_id_stock_item_id_warehouse_location_id_key" UNIQUE ("org_id", "stock_item_id", "warehouse_location_id");



ALTER TABLE ONLY "public"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_org_id_reference_number_key" UNIQUE ("org_id", "reference_number");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoice_no_per_org" UNIQUE ("org_id", "invoice_no");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_org_code_unique" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_voucher_lines"
    ADD CONSTRAINT "journal_voucher_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_org_id_gl_reference_key" UNIQUE ("org_id", "gl_reference");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_org_id_jv_number_key" UNIQUE ("org_id", "jv_number");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_org_id_document_number_key" UNIQUE ("org_id", "document_number");



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_inventory_lines"
    ADD CONSTRAINT "opening_inventory_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_payment_event_id_payable_id_key" UNIQUE ("payment_event_id", "payable_id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_org_id_payable_number_key" UNIQUE ("org_id", "payable_number");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_histories"
    ADD CONSTRAINT "payment_histories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_org_id_payment_no_key" UNIQUE ("org_id", "payment_no");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_lines"
    ADD CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qualifications"
    ADD CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reorder_points"
    ADD CONSTRAINT "reorder_points_org_id_stock_item_id_key" UNIQUE ("org_id", "stock_item_id");



ALTER TABLE ONLY "public"."reorder_points"
    ADD CONSTRAINT "reorder_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sponsors"
    ADD CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_org_id_adjustment_number_key" UNIQUE ("org_id", "adjustment_number");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_uli_key" UNIQUE ("uli");



ALTER TABLE ONLY "public"."tax_categories"
    ADD CONSTRAINT "tax_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tax_categories"
    ADD CONSTRAINT "tax_category_code_per_org" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_schedules"
    ADD CONSTRAINT "trainer_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_org_id_enrollment_id_key" UNIQUE ("org_id", "enrollment_id");



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "unique_check_number_per_bank" UNIQUE ("bank_account_id", "check_number");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "unique_line_per_invoice" UNIQUE ("invoice_id", "line_number");



ALTER TABLE ONLY "public"."check_number_settings"
    ADD CONSTRAINT "unique_settings_per_bank" UNIQUE ("bank_account_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "unique_student_batch" UNIQUE ("org_id", "student_id", "batch_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_tax_settings"
    ADD CONSTRAINT "vendor_tax_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouse_locations"
    ADD CONSTRAINT "warehouse_locations_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."warehouse_locations"
    ADD CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounting_periods_is_deleted" ON "public"."accounting_periods" USING "btree" ("is_deleted");



CREATE INDEX "idx_accounting_periods_org_fiscal_year" ON "public"."accounting_periods" USING "btree" ("org_id", "fiscal_year");



CREATE INDEX "idx_accounting_periods_org_id" ON "public"."accounting_periods" USING "btree" ("org_id");



CREATE INDEX "idx_accounting_periods_status" ON "public"."accounting_periods" USING "btree" ("status");



CREATE INDEX "idx_alumni_reports_org_id" ON "public"."alumni_employment_reports" USING "btree" ("org_id");



CREATE INDEX "idx_alumni_reports_status" ON "public"."alumni_employment_reports" USING "btree" ("employment_status");



CREATE INDEX "idx_alumni_reports_student_id" ON "public"."alumni_employment_reports" USING "btree" ("student_id");



CREATE INDEX "idx_ap_memos_org_date" ON "public"."ap_memos" USING "btree" ("org_id", "memo_date" DESC, "created_at" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_ap_memos_payable_status" ON "public"."ap_memos" USING "btree" ("payable_id", "status") WHERE ("is_deleted" = false);



CREATE INDEX "idx_ap_memos_vendor" ON "public"."ap_memos" USING "btree" ("vendor_id", "memo_date" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_ap_reclassifications_bill" ON "public"."ap_reclassifications" USING "btree" ("payable_id", "original_account_id", "status") WHERE ("is_deleted" = false);



CREATE INDEX "idx_ap_reclassifications_org_date" ON "public"."ap_reclassifications" USING "btree" ("org_id", "reclassification_date" DESC, "created_at" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_assessment_registrations_billing_status" ON "public"."assessment_registrations" USING "btree" ("billing_status");



CREATE INDEX "idx_assessment_registrations_org_id" ON "public"."assessment_registrations" USING "btree" ("org_id");



CREATE INDEX "idx_assessment_registrations_student_id" ON "public"."assessment_registrations" USING "btree" ("student_id");



CREATE INDEX "idx_audit_logs_org_created" ON "public"."audit_logs" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_org_user_created" ON "public"."audit_logs" USING "btree" ("org_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_bank_accounts_gl_account" ON "public"."bank_accounts" USING "btree" ("gl_account_id");



CREATE INDEX "idx_bank_accounts_org_id" ON "public"."bank_accounts" USING "btree" ("org_id");



CREATE INDEX "idx_bank_accounts_type" ON "public"."bank_accounts" USING "btree" ("type");



CREATE INDEX "idx_bank_deposit_lines_deposit_id" ON "public"."bank_deposit_lines" USING "btree" ("deposit_id");



CREATE INDEX "idx_bank_deposit_lines_payment_id" ON "public"."bank_deposit_lines" USING "btree" ("payment_id");



CREATE INDEX "idx_bank_deposits_bank_account_id" ON "public"."bank_deposits" USING "btree" ("bank_account_id");



CREATE INDEX "idx_bank_deposits_deposit_date" ON "public"."bank_deposits" USING "btree" ("deposit_date");



CREATE INDEX "idx_bank_deposits_not_deleted" ON "public"."bank_deposits" USING "btree" ("org_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_bank_deposits_org_id" ON "public"."bank_deposits" USING "btree" ("org_id");



CREATE INDEX "idx_bank_deposits_status" ON "public"."bank_deposits" USING "btree" ("status");



CREATE INDEX "idx_bank_reconciliations_as_of_date" ON "public"."bank_reconciliations" USING "btree" ("as_of_date");



CREATE INDEX "idx_bank_reconciliations_bank_account_id" ON "public"."bank_reconciliations" USING "btree" ("bank_account_id");



CREATE INDEX "idx_bank_reconciliations_created_at" ON "public"."bank_reconciliations" USING "btree" ("created_at");



CREATE INDEX "idx_bank_reconciliations_org_id" ON "public"."bank_reconciliations" USING "btree" ("org_id");



CREATE INDEX "idx_bank_reconciliations_status" ON "public"."bank_reconciliations" USING "btree" ("status");



CREATE INDEX "idx_batches_org_qualification" ON "public"."batches" USING "btree" ("org_id", "qualification_id");



CREATE INDEX "idx_batches_org_status" ON "public"."batches" USING "btree" ("org_id", "status");



CREATE INDEX "idx_bills_org_id" ON "public"."bills" USING "btree" ("org_id");



CREATE INDEX "idx_bills_reference" ON "public"."bills" USING "btree" ("org_id", "reference");



CREATE INDEX "idx_bills_status" ON "public"."bills" USING "btree" ("org_id", "status");



CREATE INDEX "idx_bills_vendor_id" ON "public"."bills" USING "btree" ("vendor_id");



CREATE INDEX "idx_check_number_settings_bank_id" ON "public"."check_number_settings" USING "btree" ("bank_account_id");



CREATE INDEX "idx_check_number_settings_org_id" ON "public"."check_number_settings" USING "btree" ("org_id");



CREATE INDEX "idx_check_vouchers_bank_account_id" ON "public"."check_vouchers" USING "btree" ("bank_account_id");



CREATE INDEX "idx_check_vouchers_bank_status" ON "public"."check_vouchers" USING "btree" ("bank_account_id", "status");



CREATE INDEX "idx_check_vouchers_check_date" ON "public"."check_vouchers" USING "btree" ("check_date");



CREATE INDEX "idx_check_vouchers_check_number" ON "public"."check_vouchers" USING "btree" ("check_number");



CREATE INDEX "idx_check_vouchers_created_at" ON "public"."check_vouchers" USING "btree" ("created_at");



CREATE INDEX "idx_check_vouchers_org_id" ON "public"."check_vouchers" USING "btree" ("org_id");



CREATE INDEX "idx_check_vouchers_org_status" ON "public"."check_vouchers" USING "btree" ("org_id", "status");



CREATE INDEX "idx_check_vouchers_payee_id" ON "public"."check_vouchers" USING "btree" ("payee_id");



CREATE INDEX "idx_check_vouchers_status" ON "public"."check_vouchers" USING "btree" ("status");



CREATE INDEX "idx_course_fees_fee_code" ON "public"."course_fees" USING "btree" ("fee_code");



CREATE INDEX "idx_course_fees_gl_account_id" ON "public"."course_fees" USING "btree" ("gl_account_id");



CREATE INDEX "idx_course_fees_is_active" ON "public"."course_fees" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_course_fees_org_id" ON "public"."course_fees" USING "btree" ("org_id");



CREATE INDEX "idx_course_fees_qualification_funding_type" ON "public"."course_fees" USING "btree" ("qualification_id", "funding_type") WHERE ((COALESCE("is_active", true) = true) AND (COALESCE("is_deleted", false) = false));



CREATE INDEX "idx_course_fees_qualification_id" ON "public"."course_fees" USING "btree" ("qualification_id");



CREATE INDEX "idx_employees_created_at" ON "public"."employees" USING "btree" ("created_at");



CREATE INDEX "idx_employees_is_active" ON "public"."employees" USING "btree" ("is_active");



CREATE INDEX "idx_employees_org_id" ON "public"."employees" USING "btree" ("org_id");



CREATE INDEX "idx_enrollments_batch_id" ON "public"."enrollments" USING "btree" ("batch_id");



CREATE INDEX "idx_enrollments_billing_status" ON "public"."enrollments" USING "btree" ("billing_status");



CREATE INDEX "idx_enrollments_billing_type" ON "public"."enrollments" USING "btree" ("billing_type");



CREATE INDEX "idx_enrollments_enrollment_date" ON "public"."enrollments" USING "btree" ("enrollment_date");



CREATE INDEX "idx_enrollments_enrollment_status" ON "public"."enrollments" USING "btree" ("enrollment_status");



CREATE INDEX "idx_enrollments_not_deleted" ON "public"."enrollments" USING "btree" ("org_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_enrollments_org_id" ON "public"."enrollments" USING "btree" ("org_id");



CREATE INDEX "idx_enrollments_sponsor_id" ON "public"."enrollments" USING "btree" ("sponsor_id");



CREATE INDEX "idx_enrollments_student_id" ON "public"."enrollments" USING "btree" ("student_id");



CREATE INDEX "idx_exchange_rates_created_at" ON "public"."exchange_rates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_exchange_rates_currency_pair" ON "public"."exchange_rates" USING "btree" ("org_id", "from_currency", "to_currency");



CREATE INDEX "idx_exchange_rates_effective_date" ON "public"."exchange_rates" USING "btree" ("org_id", "effective_date" DESC);



CREATE INDEX "idx_exchange_rates_org_id" ON "public"."exchange_rates" USING "btree" ("org_id");



CREATE INDEX "idx_feedback_tickets_created_by" ON "public"."feedback_tickets" USING "btree" ("created_by");



CREATE INDEX "idx_feedback_tickets_org_id" ON "public"."feedback_tickets" USING "btree" ("org_id");



CREATE INDEX "idx_feedback_tickets_status" ON "public"."feedback_tickets" USING "btree" ("status");



CREATE INDEX "idx_general_ledger_account_date" ON "public"."general_ledger" USING "btree" ("org_id", "account_id", "journal_date", "created_at");



CREATE INDEX "idx_inventory_levels_location" ON "public"."inventory_levels" USING "btree" ("org_id", "warehouse_location_id");



CREATE INDEX "idx_inventory_levels_low_stock" ON "public"."inventory_levels" USING "btree" ("org_id") WHERE ("quantity_on_hand" < (100)::numeric);



CREATE INDEX "idx_inventory_levels_org" ON "public"."inventory_levels" USING "btree" ("org_id", "stock_item_id");



CREATE INDEX "idx_inventory_transactions_item" ON "public"."inventory_transactions" USING "btree" ("org_id", "stock_item_id");



CREATE INDEX "idx_inventory_transactions_location" ON "public"."inventory_transactions" USING "btree" ("org_id", "to_location_id");



CREATE INDEX "idx_inventory_transactions_org" ON "public"."inventory_transactions" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_inventory_transactions_type" ON "public"."inventory_transactions" USING "btree" ("org_id", "transaction_type");



CREATE INDEX "idx_invoice_lines_course_fee_id" ON "public"."invoice_lines" USING "btree" ("course_fee_id");



CREATE INDEX "idx_invoice_lines_invoice_id" ON "public"."invoice_lines" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_lines_line_type" ON "public"."invoice_lines" USING "btree" ("line_type");



CREATE INDEX "idx_invoice_lines_org_invoice" ON "public"."invoice_lines" USING "btree" ("org_id", "invoice_id");



CREATE INDEX "idx_invoices_batch_id" ON "public"."invoices" USING "btree" ("batch_id");



CREATE INDEX "idx_invoices_due_date" ON "public"."invoices" USING "btree" ("due_date");



CREATE INDEX "idx_invoices_gl_entry_number" ON "public"."invoices" USING "btree" ("org_id", "gl_entry_number");



CREATE INDEX "idx_invoices_invoice_date" ON "public"."invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_invoices_not_deleted" ON "public"."invoices" USING "btree" ("org_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_invoices_org_id" ON "public"."invoices" USING "btree" ("org_id");



CREATE INDEX "idx_invoices_org_sponsor" ON "public"."invoices" USING "btree" ("org_id", "sponsor_id");



CREATE INDEX "idx_invoices_org_status_date" ON "public"."invoices" USING "btree" ("org_id", "status", "invoice_date" DESC);



CREATE INDEX "idx_invoices_org_student" ON "public"."invoices" USING "btree" ("org_id", "student_id");



CREATE INDEX "idx_invoices_sponsor_id" ON "public"."invoices" USING "btree" ("sponsor_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_invoices_student_id" ON "public"."invoices" USING "btree" ("student_id");



CREATE INDEX "idx_item_groups_is_active" ON "public"."item_groups" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_item_groups_is_deleted" ON "public"."item_groups" USING "btree" ("is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_item_groups_org_id" ON "public"."item_groups" USING "btree" ("org_id");



CREATE INDEX "idx_journal_entries_approved_at" ON "public"."journal_entries" USING "btree" ("org_id", "approved_at" DESC) WHERE (("status")::"text" = 'POSTED'::"text");



CREATE INDEX "idx_journal_entries_approved_by" ON "public"."journal_entries" USING "btree" ("org_id", "approved_by") WHERE ("approved_by" IS NOT NULL);



CREATE INDEX "idx_journal_entries_date" ON "public"."journal_entries" USING "btree" ("date");



CREATE INDEX "idx_journal_entries_deposit_id" ON "public"."journal_entries" USING "btree" ("deposit_id");



CREATE INDEX "idx_journal_entries_gl_entry_number" ON "public"."journal_entries" USING "btree" ("gl_entry_number") WHERE ("gl_entry_number" IS NOT NULL);



CREATE INDEX "idx_journal_entries_org_id" ON "public"."journal_entries" USING "btree" ("org_id");



CREATE INDEX "idx_journal_entries_org_source" ON "public"."journal_entries" USING "btree" ("org_id", "source_type", "source_ref");



CREATE INDEX "idx_journal_entries_org_status_date" ON "public"."journal_entries" USING "btree" ("org_id", "status", "date" DESC);



CREATE INDEX "idx_journal_entries_source_ref" ON "public"."journal_entries" USING "btree" ("source_ref");



CREATE INDEX "idx_journal_entries_source_type" ON "public"."journal_entries" USING "btree" ("source_type");



CREATE INDEX "idx_journal_entries_status" ON "public"."journal_entries" USING "btree" ("status");



CREATE INDEX "idx_journal_lines_account_id" ON "public"."journal_lines" USING "btree" ("account_id");



CREATE INDEX "idx_journal_lines_contact" ON "public"."journal_lines" USING "btree" ("contact_type", "contact_id");



CREATE INDEX "idx_journal_lines_contact_id" ON "public"."journal_lines" USING "btree" ("contact_id");



CREATE INDEX "idx_journal_lines_entry_account" ON "public"."journal_lines" USING "btree" ("journal_entry_id", "account_id");



CREATE INDEX "idx_journal_lines_entry_id" ON "public"."journal_lines" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_journal_voucher_lines_voucher" ON "public"."journal_voucher_lines" USING "btree" ("journal_voucher_id");



CREATE INDEX "idx_journal_vouchers_org_date" ON "public"."journal_vouchers" USING "btree" ("org_id", "journal_date" DESC);



CREATE INDEX "idx_organizations_institution_type" ON "public"."organizations" USING "btree" ("institution_type");



CREATE INDEX "idx_payable_payment_allocations_journal" ON "public"."payable_payment_allocations" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_payable_payment_allocations_payable" ON "public"."payable_payment_allocations" USING "btree" ("payable_id", "created_at");



CREATE INDEX "idx_payables_employee_id" ON "public"."payables" USING "btree" ("employee_id");



CREATE INDEX "idx_payables_expense_account_id" ON "public"."payables" USING "btree" ("expense_account_id") WHERE ("expense_account_id" IS NOT NULL);



CREATE INDEX "idx_payables_org_status_due" ON "public"."payables" USING "btree" ("org_id", "status", "due_date");



CREATE INDEX "idx_payables_org_vendor" ON "public"."payables" USING "btree" ("org_id", "vendor_id");



CREATE INDEX "idx_payables_qualification_id" ON "public"."payables" USING "btree" ("qualification_id") WHERE ("qualification_id" IS NOT NULL);



CREATE INDEX "idx_payment_applications_invoice_id" ON "public"."payment_applications" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_applications_invoice_payment" ON "public"."payment_applications" USING "btree" ("invoice_id", "payment_id");



CREATE INDEX "idx_payment_applications_not_reversed" ON "public"."payment_applications" USING "btree" ("payment_id") WHERE ("is_reversed" = false);



CREATE INDEX "idx_payment_applications_payment_id" ON "public"."payment_applications" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_histories_created_at" ON "public"."payment_histories" USING "btree" ("created_at");



CREATE INDEX "idx_payment_histories_due_date" ON "public"."payment_histories" USING "btree" ("due_date");



CREATE INDEX "idx_payment_histories_org_id" ON "public"."payment_histories" USING "btree" ("org_id");



CREATE INDEX "idx_payment_histories_paid_date" ON "public"."payment_histories" USING "btree" ("paid_date");



CREATE INDEX "idx_payment_histories_status" ON "public"."payment_histories" USING "btree" ("status");



CREATE INDEX "idx_payments_not_deleted" ON "public"."payments" USING "btree" ("org_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_payments_org_id" ON "public"."payments" USING "btree" ("org_id");



CREATE INDEX "idx_payments_org_status_date" ON "public"."payments" USING "btree" ("org_id", "status", "payment_date" DESC);



CREATE INDEX "idx_payments_payment_date" ON "public"."payments" USING "btree" ("payment_date");



CREATE INDEX "idx_payments_sponsor_id" ON "public"."payments" USING "btree" ("sponsor_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_student_id" ON "public"."payments" USING "btree" ("student_id");



CREATE INDEX "idx_payroll_lines_created_at" ON "public"."payroll_lines" USING "btree" ("created_at");



CREATE INDEX "idx_payroll_lines_employee_id" ON "public"."payroll_lines" USING "btree" ("employee_id");



CREATE INDEX "idx_payroll_lines_org_id" ON "public"."payroll_lines" USING "btree" ("org_id");



CREATE INDEX "idx_payroll_lines_payroll_run_id" ON "public"."payroll_lines" USING "btree" ("payroll_run_id");



CREATE INDEX "idx_payroll_runs_created_at" ON "public"."payroll_runs" USING "btree" ("created_at");



CREATE INDEX "idx_payroll_runs_org_id" ON "public"."payroll_runs" USING "btree" ("org_id");



CREATE INDEX "idx_payroll_runs_period_start" ON "public"."payroll_runs" USING "btree" ("period_start");



CREATE INDEX "idx_payroll_runs_status" ON "public"."payroll_runs" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_gl_entry_number" ON "public"."purchase_orders" USING "btree" ("gl_entry_number") WHERE ("gl_entry_number" IS NOT NULL);



CREATE INDEX "idx_purchase_orders_org_status_date" ON "public"."purchase_orders" USING "btree" ("org_id", "status", "order_date" DESC);



CREATE INDEX "idx_purchase_orders_org_vendor" ON "public"."purchase_orders" USING "btree" ("org_id", "vendor_id");



CREATE INDEX "idx_qualifications_org_code" ON "public"."qualifications" USING "btree" ("org_id", "code");



CREATE INDEX "idx_recurring_journal_entries_created_at" ON "public"."recurring_journal_entries" USING "btree" ("created_at");



CREATE INDEX "idx_recurring_journal_entries_next_run_date" ON "public"."recurring_journal_entries" USING "btree" ("next_run_date");



CREATE INDEX "idx_recurring_journal_entries_org_id" ON "public"."recurring_journal_entries" USING "btree" ("org_id");



CREATE INDEX "idx_recurring_journal_entries_status" ON "public"."recurring_journal_entries" USING "btree" ("status");



CREATE INDEX "idx_reorder_points_needs_reorder" ON "public"."reorder_points" USING "btree" ("org_id") WHERE ("last_reorder_date" IS NULL);



CREATE INDEX "idx_reorder_points_org" ON "public"."reorder_points" USING "btree" ("org_id");



CREATE INDEX "idx_schedules_created_at" ON "public"."schedules" USING "btree" ("created_at");



CREATE INDEX "idx_schedules_location_id" ON "public"."schedules" USING "btree" ("location_id");



CREATE INDEX "idx_schedules_org_id" ON "public"."schedules" USING "btree" ("org_id");



CREATE INDEX "idx_schedules_trainer_id" ON "public"."schedules" USING "btree" ("trainer_id");



CREATE INDEX "idx_sponsors_org_name" ON "public"."sponsors" USING "btree" ("org_id", "name");



CREATE INDEX "idx_sponsors_sponsor_code" ON "public"."sponsors" USING "btree" ("sponsor_code");



CREATE INDEX "idx_sponsors_tin" ON "public"."sponsors" USING "btree" ("tin");



CREATE INDEX "idx_stock_adjustments_item" ON "public"."stock_adjustments" USING "btree" ("org_id", "stock_item_id");



CREATE INDEX "idx_stock_adjustments_org" ON "public"."stock_adjustments" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_stock_adjustments_reason" ON "public"."stock_adjustments" USING "btree" ("org_id", "reason");



CREATE INDEX "idx_stock_items_code" ON "public"."stock_items" USING "btree" ("org_id", "code");



CREATE INDEX "idx_stock_items_location" ON "public"."stock_items" USING "btree" ("org_id", "warehouse_location_id");



CREATE INDEX "idx_stock_items_org" ON "public"."stock_items" USING "btree" ("org_id", "is_deleted");



CREATE INDEX "idx_students_org_created" ON "public"."students" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_students_org_id" ON "public"."students" USING "btree" ("org_id");



CREATE INDEX "idx_students_org_name" ON "public"."students" USING "btree" ("org_id", "last_name", "first_name");



CREATE INDEX "idx_tax_categories_org_id" ON "public"."tax_categories" USING "btree" ("org_id");



CREATE INDEX "idx_time_expenses_employee_id" ON "public"."time_expenses" USING "btree" ("employee_id");



CREATE INDEX "idx_time_expenses_qualification_id" ON "public"."time_expenses" USING "btree" ("qualification_id");



CREATE INDEX "idx_time_expenses_tax_category_id" ON "public"."time_expenses" USING "btree" ("tax_category_id");



CREATE INDEX "idx_trainers_org_name" ON "public"."trainers" USING "btree" ("org_id", "last_name", "first_name");



CREATE INDEX "idx_transcript_records_org_batch" ON "public"."transcript_records" USING "btree" ("org_id", "batch_id");



CREATE UNIQUE INDEX "idx_unique_active_application" ON "public"."payment_applications" USING "btree" ("payment_id", "invoice_id") WHERE ("is_reversed" = false);



CREATE INDEX "idx_users_auth_uid" ON "public"."users" USING "btree" ("auth_uid");



CREATE INDEX "idx_users_org_id" ON "public"."users" USING "btree" ("org_id");



CREATE INDEX "idx_vendors_org_name" ON "public"."vendors" USING "btree" ("org_id", "name");



CREATE INDEX "idx_warehouse_locations_code" ON "public"."warehouse_locations" USING "btree" ("org_id", "code");



CREATE INDEX "idx_warehouse_locations_org" ON "public"."warehouse_locations" USING "btree" ("org_id", "is_active");



CREATE INDEX "inventory_classes_org_active_idx" ON "public"."inventory_classes" USING "btree" ("org_id", "code") WHERE "is_active";



CREATE INDEX "inventory_ledger_item_warehouse_date_idx" ON "public"."inventory_ledger" USING "btree" ("org_id", "stock_item_id", "warehouse_location_id", "posting_date", "id");



CREATE INDEX "inventory_transactions_posted_idx" ON "public"."inventory_transactions" USING "btree" ("org_id", "posting_date", "stock_item_id") WHERE ("status" = 'POSTED'::"text");



CREATE INDEX "invoices_org_document_type_date_idx" ON "public"."invoices" USING "btree" ("org_id", "document_type", "invoice_date" DESC) WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "invoices_org_invoice_no_active_idx" ON "public"."invoices" USING "btree" ("org_id", "invoice_no") WHERE (COALESCE("is_deleted", false) = false);



CREATE UNIQUE INDEX "journal_entries_one_reversal_per_original_idx" ON "public"."journal_entries" USING "btree" ("original_entry_id") WHERE ("original_entry_id" IS NOT NULL);



CREATE INDEX "opening_inventory_lines_header_idx" ON "public"."opening_inventory_lines" USING "btree" ("header_id");



CREATE INDEX "sponsors_org_customer_type_name_idx" ON "public"."sponsors" USING "btree" ("org_id", "customer_type", "name");



CREATE INDEX "stock_items_inventory_class_idx" ON "public"."stock_items" USING "btree" ("inventory_class_id");



CREATE INDEX "time_expenses_expense_account_idx" ON "public"."time_expenses" USING "btree" ("expense_account_id");



CREATE UNIQUE INDEX "time_expenses_org_rfq_code_idx" ON "public"."time_expenses" USING "btree" ("org_id", "rfq_code");



CREATE INDEX "time_expenses_org_status_idx" ON "public"."time_expenses" USING "btree" ("org_id", "status");



CREATE INDEX "time_expenses_supplier_idx" ON "public"."time_expenses" USING "btree" ("supplier_id");



CREATE UNIQUE INDEX "uq_ap_bill_journal_per_payable" ON "public"."journal_entries" USING "btree" ("source_ref") WHERE ((("source_type")::"text" = ANY ((ARRAY['BILL'::character varying, 'CREDIT_MEMO'::character varying])::"text"[])) AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "uq_ap_memo_posting_journal" ON "public"."journal_entries" USING "btree" ("source_type", "source_ref") WHERE ((("source_type")::"text" = ANY ((ARRAY['CREDIT_MEMO'::character varying, 'DEBIT_MEMO'::character varying])::"text"[])) AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "uq_ap_payment_journal_per_event" ON "public"."journal_entries" USING "btree" ("source_ref") WHERE ((("source_type")::"text" = 'PAYMENT'::"text") AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "uq_ap_reclassification_posting_journal" ON "public"."journal_entries" USING "btree" ("source_type", "source_ref") WHERE ((("source_type")::"text" = 'AP_RECLASSIFICATION'::"text") AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "uq_ap_reversal_per_original" ON "public"."journal_entries" USING "btree" ("original_entry_id") WHERE ((("source_type")::"text" = 'REVERSAL'::"text") AND ("original_entry_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_journal_entries_org_gl_entry_number" ON "public"."journal_entries" USING "btree" ("org_id", "gl_entry_number") WHERE (("gl_entry_number" IS NOT NULL) AND ("btrim"(("gl_entry_number")::"text") <> ''::"text"));



CREATE OR REPLACE TRIGGER "bank_reconciliation_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."bank_reconciliations" FOR EACH ROW EXECUTE FUNCTION "public"."log_bank_reconciliation_changes"();



CREATE OR REPLACE TRIGGER "enforce_payable_employee_org" BEFORE INSERT OR UPDATE OF "employee_id", "org_id" ON "public"."payables" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_employee_org_match"();



CREATE OR REPLACE TRIGGER "enforce_time_expense_class_org" BEFORE INSERT OR UPDATE OF "qualification_id", "org_id" ON "public"."time_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_time_expense_class_org_match"();



CREATE OR REPLACE TRIGGER "enforce_time_expense_employee_org" BEFORE INSERT OR UPDATE OF "employee_id", "org_id" ON "public"."time_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_employee_org_match"();



CREATE OR REPLACE TRIGGER "enforce_time_expense_tax_category_org" BEFORE INSERT OR UPDATE OF "tax_category_id", "org_id" ON "public"."time_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_time_expense_tax_category_org_match"();



CREATE OR REPLACE TRIGGER "enforce_time_expense_user_org_trigger" BEFORE INSERT OR UPDATE OF "org_id", "created_by" ON "public"."time_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_time_expense_user_org"();



CREATE OR REPLACE TRIGGER "exchange_rate_created_trigger" AFTER INSERT ON "public"."exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."log_exchange_rate_creation"();



CREATE OR REPLACE TRIGGER "exchange_rate_deleted_trigger" AFTER UPDATE ON "public"."exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."log_exchange_rate_delete"();



CREATE OR REPLACE TRIGGER "exchange_rate_updated_trigger" AFTER UPDATE ON "public"."exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."log_exchange_rate_update"();



CREATE OR REPLACE TRIGGER "exchange_rates_updated_at_trigger" BEFORE UPDATE ON "public"."exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_exchange_rates_timestamp"();



CREATE OR REPLACE TRIGGER "payables_mark_time_expenses_billed" AFTER UPDATE OF "status", "journal_entry_id" ON "public"."payables" FOR EACH ROW EXECUTE FUNCTION "public"."mark_time_expenses_billed_on_payable_post"();



CREATE OR REPLACE TRIGGER "protect_inventory_ledger" BEFORE DELETE OR UPDATE ON "public"."inventory_ledger" FOR EACH ROW EXECUTE FUNCTION "private"."protect_posted_inventory_records"();

ALTER TABLE "public"."inventory_ledger" DISABLE TRIGGER "protect_inventory_ledger";



CREATE OR REPLACE TRIGGER "protect_posted_inventory_transaction" BEFORE DELETE OR UPDATE ON "public"."inventory_transactions" FOR EACH ROW EXECUTE FUNCTION "private"."protect_posted_inventory_records"();



CREATE OR REPLACE TRIGGER "recurring_entries_updated_at_trigger" BEFORE UPDATE ON "public"."recurring_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_recurring_entries_timestamp"();



CREATE OR REPLACE TRIGGER "recurring_entry_created_trigger" AFTER INSERT ON "public"."recurring_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_recurring_entry_creation"();



CREATE OR REPLACE TRIGGER "recurring_entry_deleted_trigger" AFTER UPDATE ON "public"."recurring_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_recurring_entry_delete"();



CREATE OR REPLACE TRIGGER "recurring_entry_updated_trigger" AFTER UPDATE ON "public"."recurring_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_recurring_entry_update"();



CREATE OR REPLACE TRIGGER "reopen_time_expense_without_payable_trigger" BEFORE UPDATE OF "payable_id" ON "public"."time_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."reopen_time_expense_without_payable"();



CREATE OR REPLACE TRIGGER "students_updated_at_trigger" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_students_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_journal_voucher_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."journal_vouchers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_journal_voucher_change"();



CREATE OR REPLACE TRIGGER "trg_guard_journal_voucher_line" BEFORE INSERT OR DELETE OR UPDATE ON "public"."journal_voucher_lines" FOR EACH ROW EXECUTE FUNCTION "public"."guard_journal_voucher_line"();



CREATE OR REPLACE TRIGGER "trg_prepare_journal_voucher" BEFORE INSERT OR UPDATE ON "public"."journal_vouchers" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_journal_voucher"();



CREATE OR REPLACE TRIGGER "trg_prevent_posted_invoice_accounting_update" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_invoice_accounting_update"();



CREATE OR REPLACE TRIGGER "trg_prevent_posted_invoice_delete" BEFORE DELETE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_invoice_delete"();



CREATE OR REPLACE TRIGGER "trg_prevent_posted_invoice_line_delete" BEFORE DELETE ON "public"."invoice_lines" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_invoice_line_change"();



CREATE OR REPLACE TRIGGER "trg_prevent_posted_invoice_line_insert" BEFORE INSERT ON "public"."invoice_lines" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_invoice_line_change"();



CREATE OR REPLACE TRIGGER "trg_prevent_posted_invoice_line_update" BEFORE UPDATE ON "public"."invoice_lines" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_invoice_line_change"();



CREATE OR REPLACE TRIGGER "trigger_bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_bank_accounts_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_check_number_settings_updated_at" BEFORE UPDATE ON "public"."check_number_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_check_number_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_check_vouchers_updated_at" BEFORE UPDATE ON "public"."check_vouchers" FOR EACH ROW EXECUTE FUNCTION "public"."update_check_vouchers_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_enrollments_updated_at" BEFORE UPDATE ON "public"."enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."update_enrollments_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_invoice_lines_updated_at" BEFORE UPDATE ON "public"."invoice_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_lines_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoices_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_net_book_value" BEFORE INSERT OR UPDATE ON "public"."fixed_assets" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_net_book_value"();



CREATE OR REPLACE TRIGGER "trigger_po_item_total" BEFORE INSERT OR UPDATE ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_po_item_total"();



CREATE OR REPLACE TRIGGER "trigger_tax_categories_updated_at" BEFORE UPDATE ON "public"."tax_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_tax_categories_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_bank_deposit_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."bank_deposit_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_bank_deposit_totals"();



CREATE OR REPLACE TRIGGER "trigger_update_invoice_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_balance_on_application"();



CREATE OR REPLACE TRIGGER "trigger_update_payment_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_totals"();



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_ap_closed_by_fkey" FOREIGN KEY ("ap_closed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_ar_closed_by_fkey" FOREIGN KEY ("ar_closed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_gl_closed_by_fkey" FOREIGN KEY ("gl_closed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alumni_employment_reports"
    ADD CONSTRAINT "alumni_employment_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."alumni_employment_reports"
    ADD CONSTRAINT "alumni_employment_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_adjustment_account_id_fkey" FOREIGN KEY ("adjustment_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_legacy_payable_id_fkey" FOREIGN KEY ("legacy_payable_id") REFERENCES "public"."payables"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_reversal_journal_id_fkey" FOREIGN KEY ("reversal_journal_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_memos"
    ADD CONSTRAINT "ap_memos_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_original_account_id_fkey" FOREIGN KEY ("original_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_reversal_journal_id_fkey" FOREIGN KEY ("reversal_journal_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ap_reclassifications"
    ADD CONSTRAINT "ap_reclassifications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."atc_items"
    ADD CONSTRAINT "atc_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."atc_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atc_rates"
    ADD CONSTRAINT "atc_rates_atc_item_id_fkey" FOREIGN KEY ("atc_item_id") REFERENCES "public"."atc_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_deposit_lines"
    ADD CONSTRAINT "bank_deposit_lines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposit_lines"
    ADD CONSTRAINT "bank_deposit_lines_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "public"."bank_deposits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_deposit_lines"
    ADD CONSTRAINT "bank_deposit_lines_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_deposits"
    ADD CONSTRAINT "bank_deposits_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_reconcilied_by_fkey" FOREIGN KEY ("reconcilied_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."batch_transcript_records"
    ADD CONSTRAINT "batch_transcript_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_transcript_records"
    ADD CONSTRAINT "batch_transcript_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_transcript_records"
    ADD CONSTRAINT "batch_transcript_records_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."check_number_settings"
    ADD CONSTRAINT "check_number_settings_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_number_settings"
    ADD CONSTRAINT "check_number_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."check_vouchers"
    ADD CONSTRAINT "check_vouchers_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id");



ALTER TABLE ONLY "public"."course_fees"
    ADD CONSTRAINT "course_fees_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "public"."atc_categories"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fk_asset_gl_account" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "fk_bank_gl_account" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "fk_item_expense_account" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "fk_item_income_account" FOREIGN KEY ("income_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "fk_vendor_ap_account" FOREIGN KEY ("ap_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."general_journals"
    ADD CONSTRAINT "general_journals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."journal_vouchers"("id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_general_journal_id_fkey" FOREIGN KEY ("general_journal_id") REFERENCES "public"."general_journals"("id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."journal_vouchers"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_adjustment_account_id_fkey" FOREIGN KEY ("adjustment_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_cogs_account_id_fkey" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_in_transit_account_id_fkey" FOREIGN KEY ("in_transit_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_inventory_asset_account_id_fkey" FOREIGN KEY ("inventory_asset_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_opening_balance_equity_account_id_fkey" FOREIGN KEY ("opening_balance_equity_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_purchase_price_variance_account_id_fkey" FOREIGN KEY ("purchase_price_variance_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_classes"
    ADD CONSTRAINT "inventory_classes_write_off_account_id_fkey" FOREIGN KEY ("write_off_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."inventory_transactions"("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."inventory_transactions"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_course_fee_id_fkey" FOREIGN KEY ("course_fee_id") REFERENCES "public"."course_fees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "public"."bank_deposits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_voucher_lines"
    ADD CONSTRAINT "journal_voucher_lines_coa_id_fkey" FOREIGN KEY ("coa_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."journal_voucher_lines"
    ADD CONSTRAINT "journal_voucher_lines_journal_voucher_id_fkey" FOREIGN KEY ("journal_voucher_id") REFERENCES "public"."journal_vouchers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_accounting_period_id_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."journal_vouchers"
    ADD CONSTRAINT "journal_vouchers_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opening_inventory_headers"
    ADD CONSTRAINT "opening_inventory_headers_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."opening_inventory_lines"
    ADD CONSTRAINT "opening_inventory_lines_header_id_fkey" FOREIGN KEY ("header_id") REFERENCES "public"."opening_inventory_headers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opening_inventory_lines"
    ADD CONSTRAINT "opening_inventory_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id");



ALTER TABLE ONLY "public"."opening_inventory_lines"
    ADD CONSTRAINT "opening_inventory_lines_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payable_payment_allocations"
    ADD CONSTRAINT "payable_payment_allocations_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_atc_item_id_fkey" FOREIGN KEY ("atc_item_id") REFERENCES "public"."atc_items"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_atc_rate_id_fkey" FOREIGN KEY ("atc_rate_id") REFERENCES "public"."atc_rates"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_input_vat_account_id_fkey" FOREIGN KEY ("input_vat_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_payment_bank_account_id_fkey" FOREIGN KEY ("payment_bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_reversal_journal_id_fkey" FOREIGN KEY ("reversal_journal_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_histories"
    ADD CONSTRAINT "payment_histories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_lines"
    ADD CONSTRAINT "payroll_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."payroll_lines"
    ADD CONSTRAINT "payroll_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payroll_lines"
    ADD CONSTRAINT "payroll_lines_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."qualifications"
    ADD CONSTRAINT "qualifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reorder_points"
    ADD CONSTRAINT "reorder_points_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reorder_points"
    ADD CONSTRAINT "reorder_points_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id");



ALTER TABLE ONLY "public"."sponsors"
    ADD CONSTRAINT "sponsors_ar_account_id_fkey" FOREIGN KEY ("ar_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."sponsors"
    ADD CONSTRAINT "sponsors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_cogs_account_id_fkey" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_income_account_id_fkey" FOREIGN KEY ("income_account_id") REFERENCES "public"."chart_of_accounts"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_inventory_class_id_fkey" FOREIGN KEY ("inventory_class_id") REFERENCES "public"."inventory_classes"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "public"."atc_categories"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_warehouse_location_id_fkey" FOREIGN KEY ("warehouse_location_id") REFERENCES "public"."warehouse_locations"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id");



ALTER TABLE ONLY "public"."tax_categories"
    ADD CONSTRAINT "tax_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tax_categories"
    ADD CONSTRAINT "tax_categories_output_account_id_fkey" FOREIGN KEY ("output_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualifications"("id");



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."time_expenses"
    ADD CONSTRAINT "time_expenses_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "public"."tax_categories"("id");



ALTER TABLE ONLY "public"."trainer_schedules"
    ADD CONSTRAINT "trainer_schedules_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id");



ALTER TABLE ONLY "public"."trainer_schedules"
    ADD CONSTRAINT "trainer_schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."trainer_schedules"
    ADD CONSTRAINT "trainer_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_schedules"
    ADD CONSTRAINT "trainer_schedules_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcript_records"
    ADD CONSTRAINT "transcript_records_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_tax_settings"
    ADD CONSTRAINT "vendor_tax_settings_atc_item_id_fkey" FOREIGN KEY ("atc_item_id") REFERENCES "public"."atc_items"("id");



ALTER TABLE ONLY "public"."vendor_tax_settings"
    ADD CONSTRAINT "vendor_tax_settings_atc_rate_id_fkey" FOREIGN KEY ("atc_rate_id") REFERENCES "public"."atc_rates"("id");



ALTER TABLE ONLY "public"."vendor_tax_settings"
    ADD CONSTRAINT "vendor_tax_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."vendor_tax_settings"
    ADD CONSTRAINT "vendor_tax_settings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouse_locations"
    ADD CONSTRAINT "warehouse_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Enable insert for authenticated users only" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."users" FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);



CREATE POLICY "Users can create reconciliations for their org" ON "public"."bank_reconciliations" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete accounting periods for their org" ON "public"."accounting_periods" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete bank accounts in their org" ON "public"."bank_accounts" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete bank deposit lines for their deposits" ON "public"."bank_deposit_lines" FOR DELETE USING (("deposit_id" IN ( SELECT "bank_deposits"."id"
   FROM "public"."bank_deposits"
  WHERE ("bank_deposits"."org_id" IN ( SELECT "users"."org_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete bank deposits in their organization" ON "public"."bank_deposits" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete course fees in their organization" ON "public"."course_fees" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete item groups in their organization" ON "public"."item_groups" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete reconciliations for their org" ON "public"."bank_reconciliations" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert accounting periods for their org" ON "public"."accounting_periods" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert bank accounts in their org" ON "public"."bank_accounts" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert bank deposit lines for their deposits" ON "public"."bank_deposit_lines" FOR INSERT WITH CHECK (("deposit_id" IN ( SELECT "bank_deposits"."id"
   FROM "public"."bank_deposits"
  WHERE ("bank_deposits"."org_id" IN ( SELECT "users"."org_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert bank deposits in their organization" ON "public"."bank_deposits" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert course fees in their organization" ON "public"."course_fees" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert item groups in their organization" ON "public"."item_groups" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update accounting periods for their org" ON "public"."accounting_periods" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update bank accounts in their org" ON "public"."bank_accounts" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update bank deposit lines for their deposits" ON "public"."bank_deposit_lines" FOR UPDATE USING (("deposit_id" IN ( SELECT "bank_deposits"."id"
   FROM "public"."bank_deposits"
  WHERE ("bank_deposits"."org_id" IN ( SELECT "users"."org_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update bank deposits in their organization" ON "public"."bank_deposits" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update course fees in their organization" ON "public"."course_fees" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update item groups in their organization" ON "public"."item_groups" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update reconciliations for their org" ON "public"."bank_reconciliations" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view bank accounts in their org" ON "public"."bank_accounts" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view bank deposit lines for their deposits" ON "public"."bank_deposit_lines" FOR SELECT USING (("deposit_id" IN ( SELECT "bank_deposits"."id"
   FROM "public"."bank_deposits"
  WHERE ("bank_deposits"."org_id" IN ( SELECT "users"."org_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view bank deposits in their organization" ON "public"."bank_deposits" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view course fees in their organization" ON "public"."course_fees" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view item groups in their organization" ON "public"."item_groups" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view reconciliations for their org" ON "public"."bank_reconciliations" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their org's accounting periods" ON "public"."accounting_periods" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."alumni_employment_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alumni_reports_delete" ON "public"."alumni_employment_reports" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "alumni_reports_insert" ON "public"."alumni_employment_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "alumni_reports_select" ON "public"."alumni_employment_reports" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "alumni_reports_update" ON "public"."alumni_employment_reports" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."ap_memos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ap_memos_org_insert" ON "public"."ap_memos" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE ((("u"."id" = "auth"."uid"()) OR ("u"."auth_uid" = "auth"."uid"())) AND ("u"."org_id" = "ap_memos"."org_id") AND COALESCE("u"."is_active", true) AND ("upper"(("u"."role")::"text") <> ALL (ARRAY['STUDENT'::"text", 'TRAINER'::"text"]))))));



CREATE POLICY "ap_memos_org_select" ON "public"."ap_memos" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE ((("u"."id" = "auth"."uid"()) OR ("u"."auth_uid" = "auth"."uid"())) AND ("u"."org_id" = "ap_memos"."org_id") AND COALESCE("u"."is_active", true)))));



CREATE POLICY "ap_memos_org_update" ON "public"."ap_memos" FOR UPDATE TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE ((("u"."id" = "auth"."uid"()) OR ("u"."auth_uid" = "auth"."uid"())) AND ("u"."org_id" = "ap_memos"."org_id") AND COALESCE("u"."is_active", true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE ((("u"."id" = "auth"."uid"()) OR ("u"."auth_uid" = "auth"."uid"())) AND ("u"."org_id" = "ap_memos"."org_id") AND COALESCE("u"."is_active", true)))));



ALTER TABLE "public"."ap_reclassifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated users can create own feedback tickets" ON "public"."feedback_tickets" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("auth"."role"() = 'anon'::"text") OR (("created_by")::"text" = ("auth"."uid"())::"text") OR (COALESCE(("auth"."jwt"() ->> 'appRole'::"text"), ("auth"."jwt"() ->> 'app_role'::"text")) = 'system_admin'::"text")));



ALTER TABLE "public"."bank_deposit_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_deposits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_reconciliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_transcript_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "batch_transcript_records_registrar_write" ON "public"."batch_transcript_records" TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE (("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")) AND (("u"."role")::"text" = ANY ((ARRAY['SYSTEM_ADMIN'::character varying, 'ADMIN'::character varying, 'REGISTRAR'::character varying])::"text"[])))
 LIMIT 1))) WITH CHECK ((("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE (("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")) AND (("u"."role")::"text" = ANY ((ARRAY['SYSTEM_ADMIN'::character varying, 'ADMIN'::character varying, 'REGISTRAR'::character varying])::"text"[])))
 LIMIT 1)) AND (EXISTS ( SELECT 1
   FROM "public"."batches" "b"
  WHERE (("b"."id" = "batch_transcript_records"."batch_id") AND ("b"."org_id" = "batch_transcript_records"."org_id") AND (("b"."status")::"text" = 'COMPLETED'::"text"))))));



CREATE POLICY "batch_transcript_records_tenant_read" ON "public"."batch_transcript_records" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



ALTER TABLE "public"."bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_fees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_fees_delete" ON "public"."course_fees" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "course_fees_insert" ON "public"."course_fees" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "course_fees_select" ON "public"."course_fees" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "course_fees_update" ON "public"."course_fees" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollments_org_isolation" ON "public"."enrollments" USING (("org_id" IN ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."id" = "auth"."uid"()))));



ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exchange_rates_delete_org" ON "public"."exchange_rates" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "exchange_rates_insert_org" ON "public"."exchange_rates" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "exchange_rates_update_org" ON "public"."exchange_rates" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "exchange_rates_view_org" ON "public"."exchange_rates" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "feedback tickets are visible to owner and system admin" ON "public"."feedback_tickets" FOR SELECT TO "authenticated", "anon" USING ((("auth"."role"() = 'anon'::"text") OR (COALESCE(("auth"."jwt"() ->> 'appRole'::"text"), ("auth"."jwt"() ->> 'app_role'::"text")) = 'system_admin'::"text") OR (("created_by")::"text" = ("auth"."uid"())::"text")));



ALTER TABLE "public"."feedback_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general journals tenant read" ON "public"."general_journals" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "general ledger tenant read" ON "public"."general_ledger" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



ALTER TABLE "public"."general_journals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."general_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_levels_org_isolation" ON "public"."inventory_levels" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "inventory_levels_update_org" ON "public"."inventory_levels" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_transactions_org_isolation" ON "public"."inventory_transactions" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "inventory_transactions_update_org" ON "public"."inventory_transactions" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."invoice_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_lines_delete" ON "public"."invoice_lines" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "invoice_lines_insert" ON "public"."invoice_lines" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "invoice_lines_org_isolation" ON "public"."invoice_lines" USING (("invoice_id" IN ( SELECT "i"."id"
   FROM "public"."invoices" "i"
  WHERE ("i"."org_id" IN ( SELECT "u"."org_id"
           FROM "public"."users" "u"
          WHERE ("u"."id" = "auth"."uid"()))))));



CREATE POLICY "invoice_lines_select" ON "public"."invoice_lines" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "invoice_lines_update" ON "public"."invoice_lines" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_insert" ON "public"."invoices" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "invoices_org_isolation" ON "public"."invoices" USING (("org_id" IN ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "invoices_update" ON "public"."invoices" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."item_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal voucher lines tenant access" ON "public"."journal_voucher_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."journal_vouchers" "v"
     JOIN "public"."users" "u" ON (("u"."org_id" = "v"."org_id")))
  WHERE (("v"."id" = "journal_voucher_lines"."journal_voucher_id") AND ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."journal_vouchers" "v"
     JOIN "public"."users" "u" ON (("u"."org_id" = "v"."org_id")))
  WHERE (("v"."id" = "journal_voucher_lines"."journal_voucher_id") AND ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "journal vouchers tenant access" ON "public"."journal_vouchers" TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1))) WITH CHECK (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entries_delete" ON "public"."journal_entries" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "journal_entries_insert" ON "public"."journal_entries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "journal_entries_select" ON "public"."journal_entries" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "journal_entries_update" ON "public"."journal_entries" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_lines_delete" ON "public"."journal_lines" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "journal_lines_insert" ON "public"."journal_lines" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "journal_lines_select" ON "public"."journal_lines" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "journal_lines_update" ON "public"."journal_lines" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."journal_voucher_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_vouchers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opening_inventory_headers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opening_inventory_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_all" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "organizations_update" ON "public"."organizations" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."payable_payment_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payable_payment_allocations_select_org" ON "public"."payable_payment_allocations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."org_id" = "u"."org_id") AND COALESCE("u"."is_active", true)))));



ALTER TABLE "public"."payment_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_applications_delete_anon_unblock" ON "public"."payment_applications" FOR DELETE TO "anon" USING (true);



CREATE POLICY "payment_applications_delete_service_role" ON "public"."payment_applications" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "payment_applications_insert_anon" ON "public"."payment_applications" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "payment_applications_insert_anon_unblock" ON "public"."payment_applications" FOR INSERT TO "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."payments" "p"
     JOIN "public"."invoices" "i" ON (("i"."id" = "payment_applications"."invoice_id")))
  WHERE (("p"."id" = "payment_applications"."payment_id") AND ("p"."org_id" = "i"."org_id") AND (COALESCE("p"."is_deleted", false) = false) AND (COALESCE("i"."is_deleted", false) = false)))));



CREATE POLICY "payment_applications_insert_service_role" ON "public"."payment_applications" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "payment_applications_select_anon" ON "public"."payment_applications" FOR SELECT TO "anon" USING (true);



CREATE POLICY "payment_applications_select_anon_unblock" ON "public"."payment_applications" FOR SELECT TO "anon" USING (true);



CREATE POLICY "payment_applications_select_service_role" ON "public"."payment_applications" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "payment_applications_update_anon" ON "public"."payment_applications" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "payment_applications_update_anon_unblock" ON "public"."payment_applications" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "payment_applications_update_service_role" ON "public"."payment_applications" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_delete_anon_unblock" ON "public"."payments" FOR DELETE TO "anon" USING (true);



CREATE POLICY "payments_delete_service_role" ON "public"."payments" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "payments_insert_anon" ON "public"."payments" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "payments_insert_service_role" ON "public"."payments" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "payments_select_anon" ON "public"."payments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "payments_select_anon_unblock" ON "public"."payments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "payments_select_service_role" ON "public"."payments" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "payments_update_anon" ON "public"."payments" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "payments_update_anon_unblock" ON "public"."payments" FOR UPDATE TO "anon" USING (true) WITH CHECK (("org_id" IS NOT NULL));



CREATE POLICY "payments_update_service_role" ON "public"."payments" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "recurring_entries_delete_org" ON "public"."recurring_journal_entries" FOR DELETE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "recurring_entries_insert_org" ON "public"."recurring_journal_entries" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "recurring_entries_update_org" ON "public"."recurring_journal_entries" FOR UPDATE USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "recurring_entries_view_org" ON "public"."recurring_journal_entries" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."recurring_journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reorder_points" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reorder_points_org_isolation" ON "public"."reorder_points" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "reorder_points_update_org" ON "public"."reorder_points" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."stock_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_adjustments_org_isolation" ON "public"."stock_adjustments" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "stock_adjustments_update_org" ON "public"."stock_adjustments" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."stock_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_items_org_isolation" ON "public"."stock_items" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "stock_items_update_org" ON "public"."stock_items" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "system admin can update feedback tickets" ON "public"."feedback_tickets" FOR UPDATE TO "authenticated", "anon" USING ((("auth"."role"() = 'anon'::"text") OR (COALESCE(("auth"."jwt"() ->> 'appRole'::"text"), ("auth"."jwt"() ->> 'app_role'::"text")) = 'system_admin'::"text"))) WITH CHECK ((("auth"."role"() = 'anon'::"text") OR (COALESCE(("auth"."jwt"() ->> 'appRole'::"text"), ("auth"."jwt"() ->> 'app_role'::"text")) = 'system_admin'::"text")));



CREATE POLICY "system_admin_update_organizations" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")) AND (("u"."role")::"text" = 'SYSTEM_ADMIN'::"text")))));



CREATE POLICY "tax_categories_org_isolation" ON "public"."tax_categories" USING (("org_id" IN ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "time expenses tenant access" ON "public"."time_expenses" TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1))) WITH CHECK (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



ALTER TABLE "public"."time_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_expenses_insert_own" ON "public"."time_expenses" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = "auth"."uid"())
 LIMIT 1))));



ALTER TABLE "public"."transcript_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transcript_records_registrar_write" ON "public"."transcript_records" TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE (("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")) AND (("u"."role")::"text" = ANY ((ARRAY['SYSTEM_ADMIN'::character varying, 'ADMIN'::character varying, 'REGISTRAR'::character varying])::"text"[])))
 LIMIT 1))) WITH CHECK (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE (("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid")) AND (("u"."role")::"text" = ANY ((ARRAY['SYSTEM_ADMIN'::character varying, 'ADMIN'::character varying, 'REGISTRAR'::character varying])::"text"[])))
 LIMIT 1)));



CREATE POLICY "transcript_records_tenant_read" ON "public"."transcript_records" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "u"."org_id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_uid" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_all" ON "public"."users" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "users_self_view" ON "public"."users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."warehouse_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "warehouse_locations_org_isolation" ON "public"."warehouse_locations" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "warehouse_locations_update_org" ON "public"."warehouse_locations" WITH CHECK (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."accounting_periods";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."journal_entries";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."journal_lines";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."apply_inventory_level_delta"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_quantity_change" numeric) FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."sync_approved_stock_adjustment"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."ap_memo_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ap_memo_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ap_next_gl_number"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ap_reclassification_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ap_reclassification_actor_allowed"("p_actor_id" "uuid", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_journal_voucher_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_journal_voucher_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_journal_voucher_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_billable_qty"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_billable_qty"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_billable_qty"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_classify_batch_cap"("p_batch_id" "uuid", "p_apply" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."billing_classify_batch_cap"("p_batch_id" "uuid", "p_apply" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_classify_batch_cap"("p_batch_id" "uuid", "p_apply" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_reconcile_payment_deposits"() TO "anon";
GRANT ALL ON FUNCTION "public"."billing_reconcile_payment_deposits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_reconcile_payment_deposits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."billing_validate_invoice_lines_against_batch_cap"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_validate_invoice_lines_against_batch_cap"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_validate_invoice_lines_against_batch_cap"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_net_book_value"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_net_book_value"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_net_book_value"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_po_item_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_po_item_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_po_item_total"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_payable"("p_payable_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_ap_memo"("p_org_id" "uuid", "p_memo_type" "text", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_memo_date" "date", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_adjustment_account_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ap_memo"("p_org_id" "uuid", "p_memo_type" "text", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_memo_date" "date", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_adjustment_account_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_ap_reclassification"("p_org_id" "uuid", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_date" "date", "p_original_account_id" "uuid", "p_target_account_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_department_code" "text", "p_cost_center_code" "text", "p_project_code" "text", "p_branch_code" "text", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ap_reclassification"("p_org_id" "uuid", "p_payable_id" "uuid", "p_vendor_id" "uuid", "p_date" "date", "p_original_account_id" "uuid", "p_target_account_id" "uuid", "p_amount" numeric, "p_reason" "text", "p_reference" "text", "p_department_code" "text", "p_cost_center_code" "text", "p_project_code" "text", "p_branch_code" "text", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_employee_org_match"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_employee_org_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_time_expense_class_org_match"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_time_expense_class_org_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_time_expense_tax_category_org_match"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_time_expense_tax_category_org_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_time_expense_user_org"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_time_expense_user_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_check_number"("p_bank_account_id" "uuid", "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_check_number"("p_bank_account_id" "uuid", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_check_number"("p_bank_account_id" "uuid", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_invoice_no"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_invoice_no"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_invoice_no"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_payment_no"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_payment_no"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_payment_no"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_journal_voucher_line"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_journal_voucher_line"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_journal_voucher_line"() TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ar_invoice_accounting_locked"("p_invoice" "public"."invoices") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ar_invoice_accounting_locked"("p_invoice" "public"."invoices") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ar_invoice_accounting_locked"("p_invoice" "public"."invoices") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_bank_reconciliation_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_bank_reconciliation_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_bank_reconciliation_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_exchange_rate_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_exchange_rate_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_exchange_rate_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_exchange_rate_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_recurring_entry_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_recurring_entry_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_recurring_entry_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_recurring_entry_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_time_expenses_billed_on_payable_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_time_expenses_billed_on_payable_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_time_expenses_billed_on_payable_post"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_ap_memo_number"("p_org_id" "uuid", "p_memo_type" "text", "p_memo_date" "date", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_ap_memo_number"("p_org_id" "uuid", "p_memo_type" "text", "p_memo_date" "date", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_ap_reclassification_number"("p_org_id" "uuid", "p_date" "date", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_ap_reclassification_number"("p_org_id" "uuid", "p_date" "date", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_inventory_movement"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_transaction_type" "text", "p_quantity_change" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_source_document" "text", "p_source_module" "text", "p_reason" "text", "p_actor_id" "uuid", "p_batch_lot" "text", "p_serial_number" "text", "p_reversal_of_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_inventory_movement"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_transaction_type" "text", "p_quantity_change" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_source_document" "text", "p_source_module" "text", "p_reason" "text", "p_actor_id" "uuid", "p_batch_lot" "text", "p_serial_number" "text", "p_reversal_of_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."journal_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."journal_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_vouchers" TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_journal_voucher"("p_voucher_id" "uuid", "p_posted_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_journal_voucher"("p_voucher_id" "uuid", "p_posted_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_journal_voucher"("p_voucher_id" "uuid", "p_posted_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_opening_inventory"("p_org_id" "uuid", "p_document_number" "text", "p_posting_date" "date", "p_remarks" "text", "p_actor_id" "uuid", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_opening_inventory"("p_org_id" "uuid", "p_document_number" "text", "p_posting_date" "date", "p_remarks" "text", "p_actor_id" "uuid", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_payable_bill"("p_payable_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_payable_payment"("p_payment_event_id" "uuid", "p_payable_ids" "uuid"[], "p_amounts" numeric[], "p_cash_account_id" "uuid", "p_payment_date" "date", "p_payment_method" "text", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_stock_adjustment"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_adjustment_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_reason" "text", "p_notes" "text", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_stock_adjustment"("p_org_id" "uuid", "p_stock_item_id" "uuid", "p_warehouse_location_id" "uuid", "p_adjustment_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_posting_date" "date", "p_reason" "text", "p_notes" "text", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prepare_journal_voucher"() TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_journal_voucher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_journal_voucher"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_accounting_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_accounting_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_accounting_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_line_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_line_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_posted_invoice_line_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_time_expense_without_payable"() TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_time_expense_without_payable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_time_expense_without_payable"() TO "service_role";



GRANT ALL ON TABLE "public"."journal_voucher_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_voucher_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_voucher_lines" TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_journal_voucher_lines"("p_voucher_id" "uuid", "p_lines" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_journal_voucher_lines"("p_voucher_id" "uuid", "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_journal_voucher_lines"("p_voucher_id" "uuid", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON FUNCTION "public"."reverse_journal_entry"("p_entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reverse_journal_entry"("p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_journal_entry"("p_entry_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_ap_memo"("p_memo_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_ap_reclassification"("p_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bank_accounts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bank_accounts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bank_accounts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bank_deposit_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bank_deposit_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bank_deposit_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_check_number_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_check_number_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_check_number_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_check_vouchers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_check_vouchers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_check_vouchers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_enrollments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_enrollments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_enrollments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_exchange_rates_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_exchange_rates_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_exchange_rates_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_balance_on_application"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_balance_on_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_balance_on_application"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_lines_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_lines_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_lines_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoices_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoices_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoices_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_recurring_entries_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_recurring_entries_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recurring_entries_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tax_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tax_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tax_categories_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."accounting_periods" TO "anon";
GRANT ALL ON TABLE "public"."accounting_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_periods" TO "service_role";



GRANT ALL ON TABLE "public"."alumni_employment_reports" TO "anon";
GRANT ALL ON TABLE "public"."alumni_employment_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."alumni_employment_reports" TO "service_role";



GRANT ALL ON TABLE "public"."ap_memos" TO "service_role";



GRANT ALL ON TABLE "public"."ap_reclassifications" TO "service_role";



GRANT ALL ON TABLE "public"."assessment_registrations" TO "anon";
GRANT ALL ON TABLE "public"."assessment_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."atc_categories" TO "anon";
GRANT ALL ON TABLE "public"."atc_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."atc_categories" TO "service_role";



GRANT ALL ON TABLE "public"."atc_items" TO "anon";
GRANT ALL ON TABLE "public"."atc_items" TO "authenticated";
GRANT ALL ON TABLE "public"."atc_items" TO "service_role";



GRANT ALL ON TABLE "public"."atc_rates" TO "anon";
GRANT ALL ON TABLE "public"."atc_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."atc_rates" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."bank_deposit_lines" TO "anon";
GRANT ALL ON TABLE "public"."bank_deposit_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_deposit_lines" TO "service_role";



GRANT ALL ON TABLE "public"."bank_deposits" TO "anon";
GRANT ALL ON TABLE "public"."bank_deposits" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_deposits" TO "service_role";



GRANT ALL ON TABLE "public"."bank_reconciliations" TO "anon";
GRANT ALL ON TABLE "public"."bank_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_reconciliations" TO "service_role";



GRANT ALL ON TABLE "public"."batch_transcript_records" TO "anon";
GRANT ALL ON TABLE "public"."batch_transcript_records" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_transcript_records" TO "service_role";



GRANT ALL ON TABLE "public"."batches" TO "anon";
GRANT ALL ON TABLE "public"."batches" TO "authenticated";
GRANT ALL ON TABLE "public"."batches" TO "service_role";



GRANT ALL ON TABLE "public"."bills" TO "anon";
GRANT ALL ON TABLE "public"."bills" TO "authenticated";
GRANT ALL ON TABLE "public"."bills" TO "service_role";



GRANT ALL ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."check_number_settings" TO "anon";
GRANT ALL ON TABLE "public"."check_number_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."check_number_settings" TO "service_role";



GRANT ALL ON TABLE "public"."check_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."check_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."check_vouchers" TO "service_role";



GRANT ALL ON TABLE "public"."course_fees" TO "anon";
GRANT ALL ON TABLE "public"."course_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."course_fees" TO "service_role";



GRANT ALL ON TABLE "public"."course_fees_excluding_forklift_002" TO "anon";
GRANT ALL ON TABLE "public"."course_fees_excluding_forklift_002" TO "authenticated";
GRANT ALL ON TABLE "public"."course_fees_excluding_forklift_002" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_tickets" TO "anon";
GRANT ALL ON TABLE "public"."feedback_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_assets" TO "anon";
GRANT ALL ON TABLE "public"."fixed_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_assets" TO "service_role";



GRANT ALL ON TABLE "public"."general_journals" TO "anon";
GRANT ALL ON TABLE "public"."general_journals" TO "authenticated";
GRANT ALL ON TABLE "public"."general_journals" TO "service_role";



GRANT ALL ON TABLE "public"."general_ledger" TO "anon";
GRANT ALL ON TABLE "public"."general_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."general_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_classes" TO "anon";
GRANT ALL ON TABLE "public"."inventory_classes" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_classes" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_ledger" TO "anon";
GRANT ALL ON TABLE "public"."inventory_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_levels" TO "anon";
GRANT ALL ON TABLE "public"."inventory_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_levels" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_lines" TO "anon";
GRANT ALL ON TABLE "public"."invoice_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_lines" TO "service_role";



GRANT ALL ON TABLE "public"."item_groups" TO "anon";
GRANT ALL ON TABLE "public"."item_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."item_groups" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "service_role";



GRANT ALL ON TABLE "public"."journal_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_lines" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."opening_inventory_headers" TO "anon";
GRANT ALL ON TABLE "public"."opening_inventory_headers" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_inventory_headers" TO "service_role";



GRANT ALL ON TABLE "public"."opening_inventory_lines" TO "anon";
GRANT ALL ON TABLE "public"."opening_inventory_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_inventory_lines" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payable_payment_allocations" TO "anon";
GRANT ALL ON TABLE "public"."payable_payment_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."payable_payment_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."payables" TO "anon";
GRANT ALL ON TABLE "public"."payables" TO "authenticated";
GRANT ALL ON TABLE "public"."payables" TO "service_role";



GRANT ALL ON TABLE "public"."payment_applications" TO "anon";
GRANT ALL ON TABLE "public"."payment_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_applications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_histories" TO "anon";
GRANT ALL ON TABLE "public"."payment_histories" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_histories" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_lines" TO "anon";
GRANT ALL ON TABLE "public"."payroll_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_lines" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_runs" TO "anon";
GRANT ALL ON TABLE "public"."payroll_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_runs" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."qualifications" TO "anon";
GRANT ALL ON TABLE "public"."qualifications" TO "authenticated";
GRANT ALL ON TABLE "public"."qualifications" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."reorder_points" TO "anon";
GRANT ALL ON TABLE "public"."reorder_points" TO "authenticated";
GRANT ALL ON TABLE "public"."reorder_points" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."sponsors" TO "anon";
GRANT ALL ON TABLE "public"."sponsors" TO "authenticated";
GRANT ALL ON TABLE "public"."sponsors" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."stock_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_items" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."tax_categories" TO "anon";
GRANT ALL ON TABLE "public"."tax_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."tax_categories" TO "service_role";



GRANT ALL ON TABLE "public"."time_expenses" TO "anon";
GRANT ALL ON TABLE "public"."time_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."time_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_schedules" TO "anon";
GRANT ALL ON TABLE "public"."trainer_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."trainers" TO "anon";
GRANT ALL ON TABLE "public"."trainers" TO "authenticated";
GRANT ALL ON TABLE "public"."trainers" TO "service_role";



GRANT ALL ON TABLE "public"."transcript_records" TO "anon";
GRANT ALL ON TABLE "public"."transcript_records" TO "authenticated";
GRANT ALL ON TABLE "public"."transcript_records" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."warehouse_locations" TO "anon";
GRANT ALL ON TABLE "public"."warehouse_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouse_locations" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_status" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_status" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_status" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_transactions_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_transactions_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_transactions_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_tax_settings" TO "anon";
GRANT ALL ON TABLE "public"."vendor_tax_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_tax_settings" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































