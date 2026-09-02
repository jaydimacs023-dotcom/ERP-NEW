create or replace function public.reverse_journal_entry(p_entry_id uuid)
returns public.journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.journal_entries%rowtype;
  v_reversal public.journal_entries%rowtype;
  v_next_gl_seq bigint;
  v_new_gl text;
begin
  select *
    into v_original
  from public.journal_entries
  where id = p_entry_id
  limit 1;

  if not found then
    raise exception 'Journal entry not found: %', p_entry_id;
  end if;

  if upper(coalesce(v_original.status, '')) <> 'POSTED' then
    raise exception 'Only posted journal entries can be reversed.';
  end if;

  if v_original.original_entry_id is not null
     or upper(coalesce(v_original.source_type, '')) = 'REVERSAL' then
    raise exception 'This journal entry is already a reversal and cannot be reversed again.';
  end if;

  if exists (
    select 1
    from public.journal_entries
    where original_entry_id = v_original.id
  ) then
    raise exception 'This journal entry has already been reversed.';
  end if;

  if not exists (
    select 1
    from public.journal_lines
    where journal_entry_id = v_original.id
  ) then
    raise exception 'Journal entry % has no lines to reverse.', p_entry_id;
  end if;

  select coalesce(max(seq), 0) + 1
    into v_next_gl_seq
  from (
    select nullif(substring(gl_key from '([0-9]+)$'), '')::bigint as seq
    from (
      select upper(trim(coalesce(gl_entry_number, reference, ''))) as gl_key
      from public.journal_entries
    ) refs
    where gl_key ~ '^GL(?:\s*NO\.?)?[\s-]*[0-9]+$'
  ) numbered_refs;

  v_new_gl := 'GL' || lpad(v_next_gl_seq::text, 8, '0');

  insert into public.journal_entries (
    org_id,
    period_id,
    date,
    description,
    reference,
    gl_entry_number,
    status,
    created_by,
    created_at,
    source_type,
    source_ref,
    reversed_at,
    reversal_reason,
    original_entry_id
  )
  values (
    v_original.org_id,
    v_original.period_id,
    current_date,
    'Reversal: ' || coalesce(nullif(v_original.description, ''), coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text)),
    v_new_gl,
    v_new_gl,
    'POSTED',
    v_original.created_by,
    timezone('utc', now()),
    'REVERSAL',
    v_original.id,
    timezone('utc', now()),
    'Auto-generated reversal for ' || coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text),
    v_original.id
  )
  returning *
    into v_reversal;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    memo,
    description,
    contact_id,
    contact_type,
    batch_id,
    item_id,
    asset_id,
    is_cleared
  )
  select
    v_reversal.id,
    account_id,
    coalesce(credit, 0),
    coalesce(debit, 0),
    memo,
    description,
    contact_id,
    contact_type,
    batch_id,
    item_id,
    asset_id,
    is_cleared
  from public.journal_lines
  where journal_entry_id = v_original.id;

  update public.journal_entries
  set
    status = 'REVERSED',
    reversed_at = timezone('utc', now()),
    reversal_reason = 'Auto-generated reversal for ' || coalesce(v_original.gl_entry_number, v_original.reference, v_original.id::text)
  where id = v_original.id;

  return v_reversal;
end;
$$;

grant execute on function public.reverse_journal_entry(uuid) to authenticated, anon;
