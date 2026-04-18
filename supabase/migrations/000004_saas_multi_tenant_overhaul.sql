-- ==============================================================================
-- EMERALD CRM: SAAS MULTI-TENANT OVERHAUL (MIGRATION 000004)
-- ==============================================================================

BEGIN;

-- 1. Create or Upgrade the Tenants/Organizations system
-- Check if 'tenants' exists, otherwise create it.
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
    max_users INTEGER DEFAULT 10,
    onboarding_completed BOOLEAN DEFAULT FALSE, -- Added for the new wizard
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add tenant_id to all core tables
DO $$ 
DECLARE
    t_name TEXT;
    tables_to_update TEXT[] := ARRAY[
        'profiles', 'cases', 'payments', 'documents', 
        'timeline_events', 'notes', 'notifications', 'attendance'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_update
    LOOP
        -- Skip if table doesn't exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t_name AND table_schema = 'public') THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || 
                    ' ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;';
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || t_name || '_tenant_id ON public.' || quote_ident(t_name) || '(tenant_id);';
        END IF;
    END LOOP;
END $$;

-- 3. Tenant Isolation RLS Policies
-- We strictly isolate data by tenant_id. 

-- Helper function for RLS
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Apply isolation to all child tables
DO $$ 
DECLARE
    t_name TEXT;
    tables_to_isolate TEXT[] := ARRAY['cases', 'payments', 'documents', 'notes', 'attendance', 'notifications'];
BEGIN
    FOREACH t_name IN ARRAY tables_to_isolate
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t_name AND table_schema = 'public') THEN
            -- Drop old wide-open policies from 000001
            EXECUTE format('DROP POLICY IF EXISTS "%I_select_all_authenticated" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "%I_insert_authenticated" ON public.%I', t_name, t_name);
            
            -- Add new isolated policies
            EXECUTE format('
                CREATE POLICY "Tenant Isolation: %I" 
                ON public.%I FOR ALL TO authenticated 
                USING (tenant_id = public.get_auth_tenant_id());
            ', t_name, t_name);
        END IF;
    END LOOP;
END $$;

-- 4. Enable Realtime for all tables
-- Add missing tables to publication
DO $$
DECLARE
    t_name TEXT;
    tables_to_realtime TEXT[] := ARRAY['tenants', 'profiles', 'notifications', 'attendance'];
BEGIN
    FOREACH t_name IN ARRAY tables_to_realtime
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t_name AND table_schema = 'public') THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND tablename = t_name
            ) THEN
                EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(t_name) || ';';
            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;
