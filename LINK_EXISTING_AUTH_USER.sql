-- ============================================================================
-- LINK EXISTING AUTH USER TO PUBLIC USER (AR_SPECIALIST)
-- This script links a manually created Supabase Auth User to the public.users table.
-- ============================================================================

DO $$
DECLARE
  -- 1. Configuration: Provided by User
  v_auth_uid UUID := '73fee794-bf3e-4935-a5ca-cf4a44589e8d';
  v_email TEXT := 'ar@endonela.edu';
  v_name TEXT := 'AR Specialist'; -- Default display name
  v_role TEXT := 'AR_SPECIALIST';

  v_org_id UUID;
  v_existing_user_id UUID;
BEGIN
  -- 2. Get the Organization ID (assumes single tenant/default org)
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found in public.organizations. Please run seed data first.';
  END IF;

  RAISE NOTICE 'Linking to Organization ID: %', v_org_id;

  -- 3. Create or Update Public User Record
  -- Check if a public user already exists with this email
  SELECT id INTO v_existing_user_id FROM public.users WHERE email = v_email;

  IF v_existing_user_id IS NULL THEN
    -- Create new public user
    -- Column mapping based on User provided schema:
    -- id, org_id, name, email, password_hash, salt, role, last_login_at, is_active, failed_login_attempts, locked_until, created_at, updated_at, auth_uid
    INSERT INTO public.users (
      org_id,
      name,
      email,
      role,
      is_active,
      auth_uid, 
      created_at,
      updated_at,
      password_hash, -- REQUIRED: Legacy/Schema constraint
      salt           -- REQUIRED: Legacy/Schema constraint
    ) VALUES (
      v_org_id,
      v_name,
      v_email,
      v_role,
      TRUE,
      v_auth_uid,
      now(),
      now(),
      'MANAGED_BY_SUPABASE_AUTH', -- Placeholder for password_hash
      'MANAGED_BY_SUPABASE_AUTH'  -- Placeholder for salt
    );
    RAISE NOTICE 'Created new public user profile for % (%)', v_name, v_email;
  ELSE
    -- Update existing public user to link auth_uid and ensure role is correct
    UPDATE public.users
    SET 
      auth_uid = v_auth_uid,
      role = v_role,
      org_id = v_org_id,
      name = COALESCE(name, v_name),
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_existing_user_id;
    
    RAISE NOTICE 'Updated existing public user profile for % (%) to link Auth ID', v_name, v_email;
  END IF;

  -- 4. Verification Check
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_uid = v_auth_uid AND role = v_role) THEN
     RAISE EXCEPTION 'Verification failed: User was not correctly linked or role mismatch.';
  ELSE
     RAISE NOTICE 'SUCCESS: User % is now linked with role %', v_email, v_role;
  END IF;

END $$;
