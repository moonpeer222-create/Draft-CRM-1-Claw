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
create table organizations (
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
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text default 'agent', -- master_admin, admin, agent, customer
  organization_id uuid references organizations(id),
  avatar_url text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- CASES (Visa Applications)
create table cases (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references organizations(id) not null,
  client_id uuid references profiles(id),
  agent_id uuid references profiles(id),
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
create table documents (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references organizations(id) not null,
  case_id uuid references cases(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size int,
  is_verified boolean default false,
  created_at timestamptz default now()
);

-- AUDIT LOGS (Security & Compliance)
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references organizations(id),
  user_id uuid references profiles(id),
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

create index idx_cases_org on cases(organization_id);
create index idx_cases_status on cases(status);
create index idx_profiles_org on profiles(organization_id);
create index idx_docs_case on documents(case_id);
create index idx_audit_logs_org on audit_logs(organization_id);
create index idx_audit_logs_user on audit_logs(user_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) - MULTI-TENANCY ISOLATION
-- ============================================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table cases enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;

-- POLICIES: Users can only see data in their own organization

-- Organizations: Users can see their own org
create policy "Org isolation select" on organizations
  for select using ( 
    id in (select organization_id from profiles where id = auth.uid()) 
  );

-- Profiles: Users can see others in their own org
create policy "View own org profiles" on profiles
  for select using ( 
    organization_id in (select organization_id from profiles where id = auth.uid()) 
  );

-- Cases: Full CRUD within own org
create policy "View own org cases" on cases
  for all using ( 
    organization_id in (select organization_id from profiles where id = auth.uid()) 
  );

-- Documents: Full CRUD within own org
create policy "View own org docs" on documents
  for all using ( 
    organization_id in (select organization_id from profiles where id = auth.uid()) 
  );

-- Audit Logs: Select only within own org
create policy "View own org logs" on audit_logs
  for select using ( 
    organization_id in (select organization_id from profiles where id = auth.uid()) 
  );

-- ============================================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_org_updated_at before update on organizations
  for each row execute procedure update_updated_at_column();

create trigger update_case_updated_at before update on cases
  for each row execute procedure update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_org_id uuid;
begin
  -- If this is the first user ever, create a demo org for them
  -- In production, you might want a more complex onboarding flow
  select id into v_org_id from organizations limit 1;
  
  if v_org_id is null then
    insert into organizations (name, slug, subscription_status)
    values ('My Organization', 'my-org-' || substr(md5(random()::text), 1, 6), 'free')
    returning id into v_org_id;
  end if;

  insert into public.profiles (id, email, full_name, organization_id, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    v_org_id,
    'admin' -- First user becomes admin
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 6. SEED DATA (Optional - Creates a default org if none exist)
-- ============================================================================

insert into organizations (id, name, slug, subscription_status) 
values ('00000000-0000-0000-0000-000000000001', 'Emerald Demo Org', 'emerald-demo', 'pro')
on conflict (id) do nothing;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
