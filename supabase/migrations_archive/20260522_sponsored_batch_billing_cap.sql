alter table if exists public.batches
  drop column if exists billable_student_limit;

alter table if exists public.enrollments
  add column if not exists billing_type text not null default 'BILLABLE';

update public.enrollments
set billing_type = 'BILLABLE'
where billing_type = 'FREE_EXCESS';

alter table if exists public.enrollments
  drop constraint if exists enrollments_billing_type_check;

alter table if exists public.enrollments
  add constraint enrollments_billing_type_check
  check (billing_type in ('BILLABLE', 'FREE_SPONSORED', 'MANUAL_FREE'));

create index if not exists idx_enrollments_billing_type
  on public.enrollments(billing_type);

notify pgrst, 'reload schema';
