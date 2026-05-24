alter table if exists public.payment_applications
  add column if not exists application_no text,
  add column if not exists gl_reference text,
  add column if not exists journal_entry_id uuid references public.journal_entries(id);

create index if not exists idx_payment_applications_journal_entry_id
  on public.payment_applications(journal_entry_id);
