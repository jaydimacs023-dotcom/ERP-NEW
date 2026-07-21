alter table public.payables
  add column if not exists qualification_id uuid
  references public.qualifications(id) on delete restrict;

create index if not exists idx_payables_qualification_id
  on public.payables (qualification_id)
  where qualification_id is not null;

comment on column public.payables.qualification_id is
  'Qualification used as the accounting class for the payable expense.';
