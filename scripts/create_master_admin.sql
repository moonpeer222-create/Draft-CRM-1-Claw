-- =============================================================================
-- CREATE MASTER ADMIN USER
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- INSTRUCTIONS:
-- 1. Replace 'master@yourdomain.com' with your desired email
-- 2. Replace 'CHANGEME123!' with a strong password (min 8 chars)
-- 3. Run the entire script
-- 4. Log in at your app with the email and password
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════
-- CONFIGURATION: Change these values before running
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_email TEXT := 'master@yourdomain.com';  -- <-- CHANGE THIS
  v_password TEXT := 'CHANGEME123!';         -- <-- CHANGE THIS
  v_full_name TEXT := 'Master Administrator';
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════
  -- 1. Check if user already exists in auth.users
  -- ═══════════════════════════════════════════════════════════════════
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  -- ═══════════════════════════════════════════════════════════════════
  -- 2. Create auth user if not exists
  -- ═══════════════════════════════════════════════════════════════════
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_full_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Created new auth user: % (ID: %)', v_email, v_user_id;
  ELSE
    -- Update password for existing user
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', v_full_name),
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated existing auth user: % (ID: %)', v_email, v_user_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. Ensure the trigger-created profile has master_admin role
  -- ═══════════════════════════════════════════════════════════════════
  -- The handle_new_user trigger auto-creates a profile + organization.
  -- If this user was created via SQL, the trigger might not have fired.
  -- We upsert the profile to ensure it exists and has the right role.
  -- ═══════════════════════════════════════════════════════════════════
  
  -- First, get the tenant_id from an existing organization (or create one)
  SELECT id INTO v_tenant_id
  FROM public.tenants
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    -- Create a default tenant for the master admin
    v_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (id, name, status, max_users)
    VALUES (v_tenant_id, 'Master Tenant', 'active', 100);
    RAISE NOTICE 'Created default tenant: %', v_tenant_id;
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    status,
    tenant_id,
    last_seen,
    created_at
  ) VALUES (
    v_user_id,
    v_email,
    v_full_name,
    'master_admin',
    'active',
    v_tenant_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'master_admin',
    status = 'active',
    tenant_id = v_tenant_id,
    last_seen = NOW();

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MASTER ADMIN CREATED SUCCESSFULLY';
  RAISE NOTICE 'Email: %', v_email;
  RAISE NOTICE 'Role: master_admin';
  RAISE NOTICE 'Tenant ID: %', v_tenant_id;
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'IMPORTANT: Delete this script after running it!';
  RAISE NOTICE 'IMPORTANT: Change the placeholder password immediately!';

END $$;
