alter table if exists public.organizations
  add column if not exists institution_type text not null default 'TRAINING';

update public.organizations
set institution_type = 'TRAINING'
where institution_type is null or institution_type = '';

alter table if exists public.organizations
  drop constraint if exists organizations_institution_type_check;

alter table if exists public.organizations
  add constraint organizations_institution_type_check
  check (institution_type in ('TRAINING', 'ACADEMIC', 'HYBRID'));

create index if not exists idx_organizations_institution_type
  on public.organizations(institution_type);
