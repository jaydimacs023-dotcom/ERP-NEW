alter table public.transcript_records
  alter column enrollment_id drop not null;

alter table public.transcript_records
  drop constraint if exists transcript_records_org_id_enrollment_id_key;

create unique index if not exists uq_transcript_records_org_batch_student
  on public.transcript_records (org_id, batch_id, student_id);
