-- Centralized batch billing computation RPCs.
-- Sponsored reductions are handled as invoice discount lines, not enrollment caps.

create or replace function public.billing_valid_enrollments(p_batch_id uuid)
returns setof public.enrollments
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.enrollments e
  where e.batch_id = p_batch_id
    and coalesce(e.is_deleted, false) = false
    and e.deleted_at is null
    and upper(coalesce(e.enrollment_status::text, 'ACTIVE')) not in ('DROPPED', 'CANCELLED', 'CANCELED', 'INACTIVE', 'ARCHIVED')
  order by coalesce(e.enrollment_date, e.created_at::date), e.created_at, e.id;
$$;

create or replace function public.billing_billable_qty(p_batch_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.billing_valid_enrollments(p_batch_id) e
  where coalesce(e.billing_type::text, 'BILLABLE') not in ('MANUAL_FREE', 'FREE_SPONSORED');
$$;

create or replace function public.billing_valid_enrolled_qty(p_batch_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with enrollment_count as (
    select count(*)::integer as qty
    from public.billing_valid_enrollments(p_batch_id)
  ),
  batch_student_count as (
    select coalesce(cardinality(array_remove(b.student_ids, null)), 0)::integer as qty
    from public.batches b
    where b.id = p_batch_id
  )
  select case
    when (select qty from enrollment_count) > 0 then (select qty from enrollment_count)
    else coalesce((select qty from batch_student_count), 0)
  end;
$$;

create or replace function public.billing_classify_batch_cap(p_batch_id uuid, p_apply boolean default false)
returns table (
  enrollment_id uuid,
  student_id uuid,
  batch_id uuid,
  current_billing_type text,
  expected_billing_type text,
  billable_qty integer,
  billable_limit integer,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_apply then
    update public.enrollments e
    set billing_type = classified.expected_billing_type,
        sponsor_id = coalesce(e.sponsor_id, b.sponsor_id),
        updated_at = timezone('utc', now())
    from public.batches b
    join (
      with valid_rows as (
        select ve.*
        from public.billing_valid_enrollments(p_batch_id) ve
      )
      select
        vr.id,
        case
          when coalesce(vr.billing_type::text, 'BILLABLE') in ('MANUAL_FREE', 'FREE_SPONSORED') then coalesce(vr.billing_type::text, 'BILLABLE')
          else 'BILLABLE'
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
      row_number() over (order by coalesce(ve.enrollment_date, ve.created_at::date), ve.created_at, ve.id)::integer as sort_order
    from public.billing_valid_enrollments(p_batch_id) ve
  ),
  cap as (
    select
      public.billing_billable_qty(p_batch_id) as billable_qty,
      0::integer as billable_limit
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
      else 'BILLABLE'
    end,
    (select billable_qty from cap),
    (select billable_limit from cap),
    vr.sort_order
  from valid_rows vr
  order by vr.sort_order;
end;
$$;

drop function if exists public.billing_course_fee_invoice(uuid);

create or replace function public.billing_course_fee_invoice(p_batch_id uuid)
returns table (
  course_fee_id uuid,
  description text,
  quantity integer,
  unit_price numeric,
  amount numeric,
  line_type text,
  gl_account_id uuid,
  tax_category_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
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
  order by cf.category, cf.fee_name, cf.id;
$$;

create or replace function public.billing_validate_invoice_lines_against_batch_cap(p_invoice_id uuid)
returns table (
  invoice_id uuid,
  invoice_no text,
  batch_id uuid,
  status text,
  line_id uuid,
  line_number integer,
  description text,
  actual_qty numeric,
  expected_qty integer,
  is_mismatch boolean
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.billing_reconcile_payment_deposits()
returns table (
  payment_id uuid,
  payment_no text,
  actual_customer_deposit_balance numeric,
  expected_customer_deposit_balance numeric,
  is_mismatch boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.payment_no,
    greatest(coalesce(p.customer_deposit_balance, 0), 0),
    greatest(coalesce(p.amount_received, 0) + coalesce(p.ewt_amount_certified, 0) - coalesce(p.total_applied, 0), 0),
    abs(greatest(coalesce(p.customer_deposit_balance, 0), 0) - greatest(coalesce(p.amount_received, 0) + coalesce(p.ewt_amount_certified, 0) - coalesce(p.total_applied, 0), 0)) > 0.01
  from public.payments p
  where coalesce(p.is_deleted, false) = false;
$$;

grant execute on function public.billing_valid_enrollments(uuid) to authenticated, anon;
grant execute on function public.billing_billable_qty(uuid) to authenticated, anon;
grant execute on function public.billing_valid_enrolled_qty(uuid) to authenticated, anon;
grant execute on function public.billing_classify_batch_cap(uuid, boolean) to authenticated, anon;
grant execute on function public.billing_course_fee_invoice(uuid) to authenticated, anon;
grant execute on function public.billing_validate_invoice_lines_against_batch_cap(uuid) to authenticated, anon;
grant execute on function public.billing_reconcile_payment_deposits() to authenticated, anon;
