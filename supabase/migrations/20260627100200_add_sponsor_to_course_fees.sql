alter table public.sponsors
  add column if not exists course_fee_type text;

update public.sponsors
set course_fee_type = 'SPONSORED'
where course_fee_type is null;

alter table public.sponsors
  alter column course_fee_type set default 'SPONSORED',
  alter column course_fee_type set not null;

alter table public.sponsors
  drop constraint if exists sponsors_course_fee_type_check;

alter table public.sponsors
  add constraint sponsors_course_fee_type_check
  check (course_fee_type in ('SPONSORED', 'TESDA_SCHOLARSHIP'));

comment on column public.sponsors.course_fee_type is
  'Selects the standard sponsored or TESDA scholarship course-fee schedule for batches funded by this sponsor.';

alter table public.course_fees
  add column if not exists funding_type text;

alter table public.course_fees
  alter column funding_type drop default,
  alter column funding_type drop not null;

alter table public.course_fees
  drop constraint if exists course_fees_funding_type_check;

alter table public.course_fees
  add constraint course_fees_funding_type_check
  check (funding_type in ('PRIVATE', 'SPONSORED', 'TESDA_SCHOLARSHIP'));

create index if not exists idx_course_fees_qualification_funding_type
  on public.course_fees (qualification_id, funding_type)
  where coalesce(is_active, true) = true and coalesce(is_deleted, false) = false;

comment on column public.course_fees.funding_type is
  'Explicitly selected pricing schedule: PRIVATE, SPONSORED, or TESDA_SCHOLARSHIP. Legacy null rows must be classified manually.';

do $migration$
begin
  if to_regprocedure('public.billing_course_fee_invoice(uuid)') is not null then
    execute $function$
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
      as $body$
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
      $body$;
    $function$;
  end if;
end;
$migration$;
