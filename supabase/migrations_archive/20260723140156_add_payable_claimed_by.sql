alter table public.payables
  add column if not exists claimed_by text;

update public.payables
set claimed_by = nullif(
  btrim(substring(notes from '(?i)(?:Reimburse|Claimed by):\s*([^\r\n]+)')),
  ''
)
where claimed_by is null
  and notes ~* '(?:Reimburse|Claimed by):';
