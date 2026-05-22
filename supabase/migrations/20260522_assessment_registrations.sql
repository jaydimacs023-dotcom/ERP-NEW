create table if not exists public.assessment_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  registration_code text,
  student_id uuid not null,
  qualification_id uuid not null,
  sponsor_id uuid,
  billing_party text not null default 'SELF',
  assessment_type text not null default 'FULL_ASSESSMENT',
  assessment_date date,
  status text not null default 'PENDING',
  billing_status text not null default 'UNBILLED',
  total_fees numeric default 0,
  billed_amount numeric default 0,
  invoice_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint assessment_registrations_billing_party_check
    check (billing_party in ('SELF', 'SPONSOR')),
  constraint assessment_registrations_assessment_type_check
    check (assessment_type in ('FULL_ASSESSMENT', 'REASSESSMENT', 'COC', 'RPL')),
  constraint assessment_registrations_status_check
    check (status in ('PENDING', 'BILLED', 'PAID', 'ASSESSED', 'COMPLETED', 'COMPETENT', 'NOT_YET_COMPETENT', 'CANCELLED')),
  constraint assessment_registrations_billing_status_check
    check (billing_status in ('UNBILLED', 'BILLED', 'PARTIALLY_BILLED'))
);

alter table public.invoices
  add column if not exists assessment_registration_id uuid;

alter table public.invoice_lines
  add column if not exists assessment_registration_id uuid;

create index if not exists idx_assessment_registrations_org_id
  on public.assessment_registrations(org_id);

create index if not exists idx_assessment_registrations_student_id
  on public.assessment_registrations(student_id);

create index if not exists idx_assessment_registrations_billing_status
  on public.assessment_registrations(billing_status);
