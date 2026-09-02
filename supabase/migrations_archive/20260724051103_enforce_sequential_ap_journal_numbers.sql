-- Keep repaired AP entries in the same visible GL sequence as normal postings.
-- The helper holds an organization-scoped transaction advisory lock, so each
-- assigned number observes the number assigned immediately before it.
do $$
declare
  v_entry record;
begin
  for v_entry in
    select id, org_id
    from public.journal_entries
    where source_type in ('BILL', 'CREDIT_MEMO', 'PAYMENT')
      and gl_entry_number like 'GL-REPAIR-%'
    order by created_at, id
    for update
  loop
    update public.journal_entries
    set gl_entry_number = public.ap_next_gl_number(v_entry.org_id),
        updated_at = now()
    where id = v_entry.id;
  end loop;
end;
$$;

-- A journal number may only identify one entry inside an organization.
create unique index if not exists uq_journal_entries_org_gl_entry_number
  on public.journal_entries (org_id, gl_entry_number)
  where gl_entry_number is not null and btrim(gl_entry_number) <> '';
