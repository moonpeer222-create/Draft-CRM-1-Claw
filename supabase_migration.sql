-- ============================================================================
-- EMERALD CRM SAAS - PRODUCTION DATABASE SCHEMA
-- Project: nsglpnxboaxkrgtmlsps
-- ============================================================================

-- 1. ENABLE EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- ORGANIZATIONS (Tenants)
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  branding jsonb default '{"color": "#10b981", "logo_url": null}',
  subscription_status text default 'free', -- free, pro, enterprise
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROFILES (Users linked to Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text default 'agent', -- master_admin, admin, agent, customer
  organization_id uuid references public.organizations(id),
  avatar_url text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- CASES (Visa Applications)
create table public.cases (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations(id) not null,
  client_id uuid references public.profiles(id),
  agent_id uuid references public.profiles(id),
  case_number text not null,
  visa_type text,
  destination_country text,
  status text default 'initial_consultation', 
  priority text default 'normal',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DOCUMENTS
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations(id) not null,
  case_id uuid references public.cases(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size int,
  is_verified boolean default false,
  created_at timestamptz default now()
);

-- AUDIT LOGS (Security & Compliance)
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations(id),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

create index idx_cases_org on public.cases(organization_id);
create index idx_cases_status on public.cases(status);
create index idx_profiles_org on public.profiles(organization_id);
create index idx_docs_case on public.documents(case_id);
create index idx_audit_logs_org on public.audit_logs(organization_id);
create index idx_audit_logs_user on public.audit_logs(user_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) - MULTI-TENANCY ISOLATION
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;

-- Helper function to avoid infinite recursion in RLS policies
-- Security definer bypasses RLS, so querying profiles here is safe
create or replace function public.get_current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- POLICIES: Users can only see data in their own organization

-- Organizations: Users can see their own org
create policy "Org isolation select" on public.organizations
  for select using (
    id = public.get_current_user_org_id()
  );

-- Profiles: Users can see their own profile + others in same org
create policy "Select own or org profiles" on public.profiles
  for select using (
    id = auth.uid() or organization_id = public.get_current_user_org_id()
  );

-- Cases: Full CRUD within own org
create policy "CRUD own org cases" on public.cases
  for all using (
    organization_id = public.get_current_user_org_id()
  );

-- Documents: Full CRUD within own org
create policy "CRUD own org docs" on public.documents
  for all using (
    organization_id = public.get_current_user_org_id()
  );

-- Audit Logs: Select only within own org
create policy "Select own org logs" on public.audit_logs
  for select using (
    organization_id = public.get_current_user_org_id()
  );

-- ============================================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at column
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

create trigger update_org_updated_at
  before update on public.organizations
  for each row execute procedure public.update_updated_at_column();

create trigger update_case_updated_at
  before update on public.cases
  for each row execute procedure public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- Create a new organization for every new user
  insert into public.organizations (name, slug, subscription_status)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s Organization',
    'org-' || substr(md5(random()::text), 1, 8),
    'free'
  )
  returning id into v_org_id;

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

-- Trigger the function on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 6. SEED DATA (Optional - Creates a default org if none exist)
-- ============================================================================

insert into public.organizations (id, name, slug, subscription_status)
values ('00000000-0000-0000-0000-000000000001', 'Emerald Demo Org', 'emerald-demo', 'pro')
on conflict (id) do nothing;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
