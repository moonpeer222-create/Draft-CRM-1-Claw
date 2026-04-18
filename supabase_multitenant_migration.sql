-- ==============================================================================
-- EMERALD CRM: MULTI-TENANT SAAS MIGRATION - CHUNK 1
-- Run this script in the Supabase SQL Editor.
-- WARNING: This modifies existing tables. Back up your data first!
-- ==============================================================================

-- 1. Create the `tenants` table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, -- Optional: for custom subdomains later
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
    max_users INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Add tenant_id to all existing public tables
DO $$ 
DECLARE
    t_name TEXT;
    tables_to_update TEXT[] := ARRAY[
        'users', 'cases', 'payments', 'documents', 
        'timeline_events', 'notes', 'notifications', 'attendance'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_update
    LOOP
        -- Add tenant_id column if it doesn't exist
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || 
                ' ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;';
        
        -- Create an index to keep queries fast
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || t_name || '_tenant_id ON public.' || quote_ident(t_name) || '(tenant_id);';
    END LOOP;
END $$;

-- 3. Create a helper function to safely get the current user's tenant_id
-- We use SECURITY DEFINER and specifically query the users table to avoid 
-- infinite recursion in RLS policies.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- 4. Initial RLS Structure Update
-- We will replace the old 'master_admin' global policies with tenant-scoped policies.
-- We must Drop old policies first (you may need to adjust names if they differ slightly)

DO $$ 
DECLARE
    -- Add all your existing policy names here if you need to drop them dynamically
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 5. Create new Tenant-Scoped Policies 
-- Note: 'master_admin' is now the highest role WITHIN a tenant (Agency Owner).
-- We'll introduce a 'super_admin' role later for cross-tenant management.

-- TENANTS TABLE: Users can only see their own tenant
CREATE POLICY "Users can view their own tenant" 
ON public.tenants FOR SELECT TO authenticated
USING (id = public.get_auth_tenant_id());

-- USERS TABLE: Users can see all other users IN THEIR SAME TENANT
CREATE POLICY "Users view peers in same tenant" 
ON public.users FOR SELECT TO authenticated
USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Admins update users in same tenant" 
ON public.users FOR UPDATE TO authenticated
USING (
    tenant_id = public.get_auth_tenant_id() AND 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('master_admin', 'admin'))
);

CREATE POLICY "Admins insert users in same tenant" 
ON public.users FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = public.get_auth_tenant_id() AND 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('master_admin', 'admin'))
);

-- CASES TABLE: Data is strictly isolated by tenant
CREATE POLICY "View cases in same tenant" 
ON public.cases FOR SELECT TO authenticated
USING (
    tenant_id = public.get_auth_tenant_id() AND
    (-- Standard role logic: admins see all in tenant, agents see assigned, customers see own
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('master_admin', 'admin')) OR 
        agent_id = auth.uid() OR 
        customer_id = auth.uid()
    )
);

CREATE POLICY "Insert cases in same tenant" 
ON public.cases FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = public.get_auth_tenant_id() AND
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('master_admin', 'admin', 'agent'))
);

CREATE POLICY "Update cases in same tenant" 
ON public.cases FOR UPDATE TO authenticated
USING (
    tenant_id = public.get_auth_tenant_id() AND
    (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('master_admin', 'admin')) OR 
        agent_id = auth.uid()
    )
);

-- ==============================================================================
-- REPEAT PATTERN FOR OTHER TABLES (PAYMENTS, DOCUMENTS, ETC)
-- ==============================================================================

-- Function to execute for all child tables to apply a generic read policy
DO $$ 
DECLARE
    t_name TEXT;
    child_tables TEXT[] := ARRAY['payments', 'documents', 'timeline_events', 'notes', 'attendance'];
BEGIN
    FOREACH t_name IN ARRAY child_tables
    LOOP
        EXECUTE format('
            CREATE POLICY "View %I in same tenant" 
            ON public.%I FOR SELECT TO authenticated 
            USING (tenant_id = public.get_auth_tenant_id());
        ', t_name, t_name);
        
        EXECUTE format('
            CREATE POLICY "Insert %I in same tenant" 
            ON public.%I FOR INSERT TO authenticated 
            WITH CHECK (tenant_id = public.get_auth_tenant_id());
        ', t_name, t_name);
        
        EXECUTE format('
            CREATE POLICY "Update %I in same tenant" 
            ON public.%I FOR UPDATE TO authenticated 
            USING (tenant_id = public.get_auth_tenant_id());
        ', t_name, t_name);

        EXECUTE format('
            CREATE POLICY "Delete %I in same tenant" 
            ON public.%I FOR DELETE TO authenticated 
            USING (tenant_id = public.get_auth_tenant_id());
        ', t_name, t_name);
    END LOOP;
END $$;

-- 6. Trigger to automatically inject tenant_id on INSERT for child tables
-- Avoids having to pass tenant_id from the frontend client every time!
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.get_auth_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables
DO $$ 
DECLARE
    t_name TEXT;
    tables_to_trigger TEXT[] := ARRAY[
        'users', 'cases', 'payments', 'documents', 
        'timeline_events', 'notes', 'notifications', 'attendance'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_trigger
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS ensure_tenant_id ON public.%I;
            CREATE TRIGGER ensure_tenant_id
            BEFORE INSERT ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.set_tenant_id();
        ', t_name, t_name);
    END LOOP;
END $$;
