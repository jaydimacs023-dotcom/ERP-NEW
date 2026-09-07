-- Migration: Support mixed batch student billing by sponsor/private funding
-- Date: 2026-09-07

-- Clean up older single-argument signatures to avoid ambiguity
DROP FUNCTION IF EXISTS "public"."billing_course_fee_invoice"("uuid");
DROP FUNCTION IF EXISTS "public"."billing_valid_enrolled_qty"("uuid");
DROP FUNCTION IF EXISTS "public"."billing_valid_enrollments"("uuid");

CREATE OR REPLACE FUNCTION "public"."billing_valid_enrollments"(
  "p_batch_id" "uuid",
  "p_sponsor_id" "uuid" DEFAULT NULL
) RETURNS SETOF "public"."enrollments"
  LANGUAGE "sql" STABLE SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
  select e.*
  from public.enrollments e
  join public.batches b on b.id = e.batch_id
  where e.batch_id = p_batch_id
    and coalesce(e.is_deleted, false) = false
    and e.deleted_at is null
    and upper(coalesce(e.enrollment_status::text, 'ACTIVE')) not in ('DROPPED', 'CANCELLED', 'CANCELED', 'INACTIVE', 'ARCHIVED')
    and (
      p_sponsor_id is null
      or coalesce(e.sponsor_id, b.sponsor_id) = p_sponsor_id
    )
  order by coalesce(e.enrollment_date, e.created_at::date), e.created_at, e.id;
$$;

CREATE OR REPLACE FUNCTION "public"."billing_valid_enrolled_qty"(
  "p_batch_id" "uuid",
  "p_sponsor_id" "uuid" DEFAULT NULL
) RETURNS integer
  LANGUAGE "sql" STABLE SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
  select count(*)::integer
  from public.billing_valid_enrollments(p_batch_id, p_sponsor_id);
$$;

CREATE OR REPLACE FUNCTION "public"."billing_course_fee_invoice"(
  "p_batch_id" "uuid",
  "p_sponsor_id" "uuid" DEFAULT NULL
) RETURNS TABLE(
  "course_fee_id" "uuid",
  "description" "text",
  "quantity" integer,
  "unit_price" numeric,
  "amount" numeric,
  "line_type" "text",
  "gl_account_id" "uuid",
  "tax_category_id" "uuid"
)
  LANGUAGE "sql" STABLE SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
  with effective_sponsor as (
    select
      coalesce(p_sponsor_id, b.sponsor_id) as sponsor_id
    from public.batches b
    where b.id = p_batch_id
  ),
  matched_sponsor as (
    select
      s.id,
      s.course_fee_type
    from effective_sponsor es
    left join public.sponsors s on s.id = es.sponsor_id
  ),
  enrolled as (
    select public.billing_valid_enrolled_qty(p_batch_id, p_sponsor_id) as qty
  )
  select
    cf.id,
    cf.fee_name,
    enrolled.qty,
    coalesce(cf.amount, 0),
    round(coalesce(cf.amount, 0) * enrolled.qty, 2),
    'COURSE_FEE',
    cf.gl_account_id,
    cf.tax_category_id
  from public.batches b
  cross join enrolled
  cross join matched_sponsor ms
  join public.course_fees cf
    on cf.qualification_id = b.qualification_id
   and cf.funding_type = case
     when ms.id is null then 'PRIVATE'
     when ms.course_fee_type = 'TESDA_SCHOLARSHIP' then 'TESDA_SCHOLARSHIP'
     else 'SPONSORED'
   end
  where b.id = p_batch_id
    and coalesce(cf.is_active, true) = true
    and coalesce(cf.is_deleted, false) = false
    and (
      ms.id is null
      or cf.fee_code <> 'FORKLIFT-002'
    )
  order by cf.category, cf.fee_name, cf.id;
$$;

GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_valid_enrollments"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_valid_enrolled_qty"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_course_fee_invoice"("p_batch_id" "uuid", "p_sponsor_id" "uuid") TO "service_role";
