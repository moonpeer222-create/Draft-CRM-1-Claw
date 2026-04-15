-- ============================================================================
-- BULLETPROOF FIX v2 - EMERALD CRM LIVE DATABASE
-- Run this in the Supabase SQL Editor and look for ALL green checkmarks
-- ============================================================================

-- STEP 1: Remove the old trigger completely
-- ✅ Should show green checkmark
drop trigger if exists on_auth_user_created on auth.users;

-- STEP 2: Remove the old function completely  
-- ✅ Should show green checkmark
drop function if exists public.handle_new_user();

-- STEP 3: Recreate the function with the CORRECT logic
-- ✅ Should show green checkmark
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
begin
  -- Create a brand NEW organization for every signup
  insert into public.organizations (name, slug, subscription_status)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s Organization',
    'org-' || substr(md5(random()::text), 1, 8),
    'free'
  )
  returning id into v_org_id;

  -- Create the user's profile linked to their new org
  insert into public.profiles (id, email, full_name, organization_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_org_id,
    'admin'
  );

  return new;
end;
$$;

-- STEP 4: Lock down search_path for security (PG15 hardening)
-- ✅ Should show green checkmark
alter function public.handle_new_user() set search_path = '';

-- STEP 5: Re-attach the trigger
-- ✅ Should show green checkmark
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- VERIFICATION QUERY (Run this too)
-- Should return "handle_new_user" with source code containing "brand NEW"
-- ============================================================================
select 
  proname as function_name,
  pg_get_functiondef(oid) as source_code
from pg_proc
where proname = 'handle_new_user';
