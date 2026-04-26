-- ============================================================================
-- FIX: Correct default role assignment on user signup
-- Previous: ALL signups got 'admin' role (security vulnerability)
-- Now: Default role is 'customer', admin/master must be explicitly assigned
-- ============================================================================

-- STEP 1: Remove the old trigger completely
drop trigger if exists on_auth_user_created on auth.users;

-- STEP 2: Remove the old function completely  
drop function if exists public.handle_new_user();

-- STEP 3: Recreate the function with CORRECT logic
-- Default role: customer (least privilege)
-- Admin/Master must be assigned manually or through invitation
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_role text;
  v_tenant_id uuid;
begin
  -- Determine role from metadata if explicitly set (e.g., invitation flow)
  -- Otherwise default to 'customer' (least privilege principle)
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  
  -- Security check: only allow 'customer' as auto-assigned role
  -- Admin, agent, operator, master_admin must be explicitly assigned by existing admin
  if v_role not in ('customer') then
    v_role := 'customer';
  end if;

  -- Get or create tenant/organization context
  v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
  
  if v_tenant_id is null then
    -- Create a new organization for this customer
    insert into public.organizations (name, slug, subscription_status)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s Organization',
      'org-' || substr(md5(random()::text), 1, 8),
      'free'
    )
    returning id into v_tenant_id;
  end if;

  -- Create the user's profile with CORRECT role
  insert into public.profiles (id, email, full_name, organization_id, role, tenant_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_tenant_id,
    v_role,
    v_tenant_id
  );

  return new;
end;
$$;

-- STEP 4: Lock down search_path for security (PG15 hardening)
alter function public.handle_new_user() set search_path = '';

-- STEP 5: Re-attach the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- BACKWARD COMPATIBILITY: Update existing admin profiles that were 
-- incorrectly auto-assigned (optional - run only if needed)
-- ============================================================================
-- Uncomment below if you want to downgrade all existing auto-assigned admins
-- who don't have a verified admin flag:
--
-- update public.profiles 
-- set role = 'customer' 
-- where role = 'admin' 
-- and created_at < now() - interval '1 hour'
-- and (raw_user_meta_data->>'admin_invited_by') is null;
