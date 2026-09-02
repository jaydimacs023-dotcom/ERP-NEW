alter table public.users
  add column if not exists last_name text,
  add column if not exists profile_photo text,
  add column if not exists contact_number text,
  add column if not exists address text;

