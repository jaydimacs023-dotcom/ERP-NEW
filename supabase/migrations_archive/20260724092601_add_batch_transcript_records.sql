create table if not exists public.batch_transcript_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  object_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 15728640),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, batch_id)
);

alter table public.batch_transcript_records enable row level security;

create policy "batch_transcript_records_tenant_read"
  on public.batch_transcript_records for select
  to authenticated
  using (
    org_id = (
      select u.org_id from public.users u
      where u.auth_uid = (select auth.uid()) limit 1
    )
  );

create policy "batch_transcript_records_registrar_write"
  on public.batch_transcript_records for all
  to authenticated
  using (
    org_id = (
      select u.org_id from public.users u
      where u.auth_uid = (select auth.uid())
        and u.role in ('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR') limit 1
    )
  )
  with check (
    org_id = (
      select u.org_id from public.users u
      where u.auth_uid = (select auth.uid())
        and u.role in ('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR') limit 1
    )
    and exists (
      select 1 from public.batches b
      where b.id = batch_transcript_records.batch_id
        and b.org_id = batch_transcript_records.org_id
        and b.status = 'COMPLETED'
    )
  );

grant select, insert, update, delete on public.batch_transcript_records to authenticated;
