-- ============================================================================
-- CREATE AR SPECIALIST USER
-- This script creates a user with 'AR_SPECIALIST' role.
-- It works in two ways:
-- 1. If the user doesn't exist in Authentication, it creates it (so you can login).
-- 2. If you already created the user in the Dashboard, it links it to the public.users table.
-- ============================================================================

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_org_id UUID;
  v_auth_id UUID;
  v_user_id UUID;
  
  -- CONFIGURATION: Change these values as needed
  v_email_input TEXT := 'ar@example.com';
  v_password_input TEXT := 'Password123!';
  v_name_input TEXT := 'AR Specialist User';
  v_role_input TEXT := 'AR_SPECIALIST';
  
BEGIN
  -- 1. Get the Organization ID (assumes single tenant for now)
  -- Uses the first available organization
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found via SELECT. Attempting to create default Organization...';
    INSERT INTO public.organizations (name, currency, plan_type) 
    VALUES ('Default Organization', 'PHP', 'BASIC')
    RETURNING id INTO v_org_id;
  END IF;

  RAISE NOTICE 'Using Organization ID: %', v_org_id;


  -- 2. Handle Supabase Auth User (auth.users)
  -- This creates the user in the internal auth system so login works
  -- We use gen_salt/crypt to hash the password securely
  SELECT id INTO v_auth_id FROM auth.users WHERE email = v_email_input;

  IF v_auth_id IS NULL THEN
    -- Create new auth user
    v_auth_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_id,
      'authenticated',
      'authenticated',
      v_email_input,
      crypt(v_password_input, gen_salt('bf')), -- Hash password
      now(), -- Auto-confirm email
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      FALSE
    );
    
    -- Create identity to allow login
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider_id,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_auth_id,
      jsonb_build_object('sub', v_auth_id, 'email', v_email_input),
      v_auth_id, -- external provider ID (often same as user ID for email)
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created new auth user: %', v_email_input;
  ELSE
    RAISE NOTICE 'Auth user already exists: % (ID: %)', v_email_input, v_auth_id;
  END IF;

  -- 3. Handle Public User (public.users)
  -- This creates the profile in OUR application's users table
  
  -- Check if public user exists by email
  SELECT id INTO v_user_id FROM public.users WHERE email = v_email_input;

  IF v_user_id IS NULL THEN
    -- Create new public user
    INSERT INTO public.users (
      org_id,
      name,
      email,
      role,
      auth_id, -- Link to the auth user we found/created
      created_at,
      is_deleted
    ) VALUES (
      v_org_id,
      v_name_input,
      v_email_input,
      v_role_input,
      v_auth_id, 
      now(),
      FALSE
    );
    RAISE NOTICE 'Created public user profile for % with role %', v_name_input, v_role_input;
  ELSE
    -- Update existing public user to link auth_id and ensure role
    UPDATE public.users
    SET 
      auth_id = v_auth_id,
      role = v_role_input,
      org_id = v_org_id, -- Ensure they are in the correct org
      is_deleted = FALSE -- Reactivate if deleted
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated existing public user profile for %', v_email_input;
  END IF;

END $$;
