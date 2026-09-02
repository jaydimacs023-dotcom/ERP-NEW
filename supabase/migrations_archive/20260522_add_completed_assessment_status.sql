alter table if exists public.assessment_registrations
  drop constraint if exists assessment_registrations_status_check;

alter table if exists public.assessment_registrations
  add constraint assessment_registrations_status_check
  check (status in ('PENDING', 'BILLED', 'PAID', 'ASSESSED', 'COMPLETED', 'COMPETENT', 'NOT_YET_COMPETENT', 'CANCELLED'));

update public.assessment_registrations
set status = 'COMPLETED',
    updated_at = now()
where assessment_date is not null
  and assessment_date <= current_date
  and status not in ('COMPLETED', 'COMPETENT', 'NOT_YET_COMPETENT', 'CANCELLED');

notify pgrst, 'reload schema';
