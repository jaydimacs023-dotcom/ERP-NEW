create or replace function public.mark_time_expenses_billed_on_payable_post()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved'
     and new.journal_entry_id is not null
     and (
       old.status is distinct from new.status
       or old.journal_entry_id is distinct from new.journal_entry_id
     ) then
    update public.time_expenses
    set status = 'billed', updated_at = now()
    where payable_id = new.id
      and org_id = new.org_id
      and status = 'released';
  end if;

  return new;
end;
$$;

drop trigger if exists payables_mark_time_expenses_billed on public.payables;

create trigger payables_mark_time_expenses_billed
after update of status, journal_entry_id on public.payables
for each row
execute function public.mark_time_expenses_billed_on_payable_post();
