-- Migration: Sync public.users accounts and password hashes into auth.users and auth.identities
-- Ensures all GoTrue text columns have non-null defaults to prevent scan errors.

-- 1. Ensure all string token columns in auth.users have default empty strings
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
  aud = COALESCE(aud, 'authenticated'),
  role = COALESCE(role, 'authenticated'),
  is_super_admin = COALESCE(is_super_admin, false);

-- 2. Sync password hashes from public.users to auth.users for existing accounts
UPDATE auth.users u
SET
  encrypted_password = p.password_hash,
  email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
  updated_at = now()
FROM public.users p
WHERE lower(u.email) = lower(p.email)
  AND p.password_hash IS NOT NULL
  AND p.password_hash <> '';

-- 3. Link public.users.auth_uid to auth.users.id
UPDATE public.users p
SET auth_uid = u.id
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND (p.auth_uid IS NULL OR p.auth_uid <> u.id);

-- 4. Create missing auth.users for any public.users not yet present in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  email_change_confirm_status,
  is_super_admin,
  is_sso_user,
  is_anonymous
)
SELECT
  COALESCE(p.auth_uid, gen_random_uuid()),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  lower(p.email),
  p.password_hash,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', p.name),
  now(),
  now(),
  '', '', '', '', '', '', '', '', 0, false, false, false
FROM public.users p
WHERE lower(p.email) NOT IN (SELECT lower(email) FROM auth.users WHERE email IS NOT NULL)
  AND p.password_hash IS NOT NULL;

-- 5. Re-link public.users.auth_uid for newly created users
UPDATE public.users p
SET auth_uid = u.id
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND (p.auth_uid IS NULL OR p.auth_uid <> u.id);

-- 6. Ensure every auth.users account has a corresponding auth.identities record
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM auth.identities)
  AND u.email IS NOT NULL;
