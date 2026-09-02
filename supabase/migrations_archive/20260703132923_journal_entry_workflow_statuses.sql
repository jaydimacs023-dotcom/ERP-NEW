-- Preserve historical statuses while enabling the full manual-journal workflow.
-- Drop only CHECK constraints that directly constrain journal_entries.status;
-- installations may have different generated constraint names.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'journal_entries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '\mstatus\M'
  loop
    execute format(
      'alter table public.journal_entries drop constraint %I',
      constraint_name
    );
  end loop;
end
$$;

alter table public.journal_entries
  add constraint journal_entries_status_check
  check (
    status in (
      'DRAFT',
      'ON_HOLD',
      'PENDING_APPROVAL',
      'APPROVED',
      'POSTED',
      'REVERSED',
      'REVISION_REQUESTED'
    )
  );

comment on column public.journal_entries.status is
  'Workflow: ON_HOLD -> PENDING_APPROVAL (optional) -> APPROVED -> POSTED. DRAFT and REVISION_REQUESTED remain for historical compatibility.';
