create table if not exists public.transcript_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  object_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 15728640),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, enrollment_id)
);

create index if not exists idx_transcript_records_org_batch
  on public.transcript_records (org_id, batch_id);

alter table public.transcript_records enable row level security;

create policy "transcript_records_tenant_read"
  on public.transcript_records for select
  to authenticated
  using (
    org_id = (
      select u.org_id
      from public.users u
      where u.auth_uid = (select auth.uid())
      limit 1
    )
  );

create policy "transcript_records_registrar_write"
  on public.transcript_records for all
  to authenticated
  using (
    org_id = (
      select u.org_id
      from public.users u
      where u.auth_uid = (select auth.uid())
        and u.role in ('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR')
      limit 1
    )
  )
  with check (
    org_id = (
      select u.org_id
      from public.users u
      where u.auth_uid = (select auth.uid())
        and u.role in ('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR')
      limit 1
    )
    and exists (
      select 1
      from public.enrollments e
      where e.id = transcript_records.enrollment_id
        and e.org_id = transcript_records.org_id
        and e.student_id = transcript_records.student_id
        and e.batch_id = transcript_records.batch_id
        and e.enrollment_status = 'COMPLETED'
        and coalesce(e.is_deleted, false) = false
    )
  );

grant select, insert, update, delete on public.transcript_records to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transcripts',
  'transcripts',
  false,
  15728640,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "transcript_files_tenant_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transcripts'
    and (storage.foldername(name))[1] = (
      select u.org_id::text
      from public.users u
      where u.auth_uid = (select auth.uid())
      limit 1
    )
  );

create policy "transcript_files_registrar_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transcripts'
    and (storage.foldername(name))[1] = (
      select u.org_id::text
      from public.users u
      where u.auth_uid = (select auth.uid())
        and u.role in ('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR')
      limit 1
    )
  );
