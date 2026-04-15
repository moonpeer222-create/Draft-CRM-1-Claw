-- ============================================================================
-- LIVE FIX FOR EXISTING EMERALD CRM DATABASE
-- Run this in the Supabase SQL Editor to fix broken RLS + auth trigger
-- ============================================================================

-- 1. Fix helper function (bypasses RLS safely)
create or replace function public.get_current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- 2. Fix auto-update triggers
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_org_updated_at on public.organizations;
create trigger update_org_updated_at
  before update on public.organizations
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_case_updated_at on public.cases;
create trigger update_case_updated_at
  before update on public.cases
  for each row execute procedure public.update_updated_at_column();

-- 3. Fix the auth signup trigger (add public. schema prefix + set search_path)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations limit 1;

  if v_org_id is null then
    insert into public.organizations (name, slug, subscription_status)
    values (
      'My Organization',
      'my-org-' || substr(md5(random()::text), 1, 6),
      'free'
    )
    returning id into v_org_id;
  end if;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Fix broken RLS policies (remove recursive references)

-- Organizations
drop policy if exists "Org isolation select" on public.organizations;
create policy "Org isolation select" on public.organizations
  for select using (id = public.get_current_user_org_id());

-- Profiles
drop policy if exists "View own org profiles" on public.profiles;
drop policy if exists "Select own or org profiles" on public.profiles;
create policy "Select own or org profiles" on public.profiles
  for select using (id = auth.uid() or organization_id = public.get_current_user_org_id());

-- Cases
drop policy if exists "View own org cases" on public.cases;
drop policy if exists "CRUD own org cases" on public.cases;
create policy "CRUD own org cases" on public.cases
  for all using (organization_id = public.get_current_user_org_id());

-- Documents
drop policy if exists "View own org docs" on public.documents;
drop policy if exists "CRUD own org docs" on public.documents;
create policy "CRUD own org docs" on public.documents
  for all using (organization_id = public.get_current_user_org_id());

-- Audit Logs
drop policy if exists "View own org logs" on public.audit_logs;
drop policy if exists "Select own org logs" on public.audit_logs;
create policy "Select own org logs" on public.audit_logs
  for select using (organization_id = public.get_current_user_org_id());

-- 5. Ensure seed org exists
insert into public.organizations (id, name, slug, subscription_status)
values ('00000000-0000-0000-0000-000000000001', 'Emerald Demo Org', 'emerald-demo', 'pro')
on conflict (id) do nothing;

-- ============================================================================
-- DONE - Try signing up a new user now
-- ============================================================================
