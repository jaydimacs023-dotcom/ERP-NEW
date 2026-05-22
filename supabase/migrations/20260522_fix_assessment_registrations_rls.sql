alter table if exists public.assessment_registrations disable row level security;

grant select, insert, update, delete on public.assessment_registrations to anon, authenticated;

notify pgrst, 'reload schema';
