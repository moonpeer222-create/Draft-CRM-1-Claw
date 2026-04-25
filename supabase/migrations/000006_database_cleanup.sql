-- ==============================================================================
-- EMERALD CRM: DATABASE CLEANUP (MIGRATION 000006)
-- Fixes: orphan FKs, empty users table, missing organizations, exec_sql hole
-- ==============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. SEED ORGANIZATIONS TABLE
-- profiles.organization_id references these but the table is empty
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.organizations (id, name, slug, subscription_status, created_at, updated_at)
VALUES
  ('be8be659-28a8-45c9-a5ce-146fb6037d5b', 'Emerald Consultancy Company', 'emerald-consultancy', 'active', NOW(), NOW()),
  ('c97b25a9-15ac-457d-9ef2-5a95e7553236', 'Demo Organization', 'demo-org', 'free', NOW(), NOW()),
  ('0ac49b95-f8d9-4e25-88d6-9c138732775c', 'Moonpeer Organization', 'moonpeer-org', 'active', NOW(), NOW()),
  ('5be311f9-4818-46ca-94d7-93de402b9964', 'Example Admin Org', 'example-admin', 'free', NOW(), NOW()),
  ('ab4535d1-97b6-47be-9210-034e14f2884f', 'Example Customer Org', 'example-customer', 'free', NOW(), NOW()),
  ('be0fbdc0-f658-4269-862a-6a7cc2ae8ae1', 'Example Operator Org', 'example-operator', 'free', NOW(), NOW()),
  ('f1eedd07-3e91-4269-ab98-f349b34d425b', 'Example Agent Org', 'example-agent', 'free', NOW(), NOW()),
  ('08432762-d990-4166-b2cb-cab7167728ad', 'Wasim Azhar Org 1', 'wasim-azhar-1', 'active', NOW(), NOW()),
  ('1d549671-dc26-489e-9434-36c50ccb5be2', 'Wasim Azhar Org 2', 'wasim-azhar-2', 'active', NOW(), NOW()),
  ('4694aac0-87b8-4599-a426-050bb2d9e089', 'Wasim Azhar Org 3', 'wasim-azhar-3', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2. RE-POINT FOREIGN KEYS FROM `users` TO `profiles`
-- These tables have user_id FK → users(id), but users table is empty.
-- profiles table is the one linked to auth.users and has actual data.
-- ═══════════════════════════════════════════════════════════════════

-- 2a. attendance.user_id → profiles(id)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_fkey;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2b. notifications.user_id → profiles(id)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2c. ai_chat_history.user_id → profiles(id)
ALTER TABLE public.ai_chat_history DROP CONSTRAINT IF EXISTS ai_chat_history_user_id_fkey;
ALTER TABLE public.ai_chat_history
  ADD CONSTRAINT ai_chat_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2d. ai_audit_log.user_id → profiles(id)
ALTER TABLE public.ai_audit_log DROP CONSTRAINT IF EXISTS ai_audit_log_user_id_fkey;
ALTER TABLE public.ai_audit_log
  ADD CONSTRAINT ai_audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. DROP THE EMPTY `users` TABLE
-- It duplicates `profiles` and has 0 rows. Not used by the app.
-- ═══════════════════════════════════════════════════════════════════

-- First drop any remaining FK constraints pointing TO users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'users'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  ) LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) ||
            ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- Now safe to drop
DROP TABLE IF EXISTS public.users CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- 4. REMOVE exec_sql SECURITY HOLE
-- This function allows arbitrary SQL execution — major security risk
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.exec_sql(text, jsonb);
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- ═══════════════════════════════════════════════════════════════════
-- 5. ADD MISSING RLS POLICIES FOR NEW TABLES
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS on tables that may not have it
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Organizations: users can see their own org
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
CREATE POLICY "Users can view own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Payments: tenant isolation
DROP POLICY IF EXISTS "Tenant Isolation: payments" ON public.payments;
CREATE POLICY "Tenant Isolation: payments"
  ON public.payments FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- Notes: tenant isolation
DROP POLICY IF EXISTS "Tenant Isolation: notes" ON public.notes;
CREATE POLICY "Tenant Isolation: notes"
  ON public.notes FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- AI chat: users see own chats
DROP POLICY IF EXISTS "Users can manage own AI chats" ON public.ai_chat_history;
CREATE POLICY "Users can manage own AI chats"
  ON public.ai_chat_history FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- AI audit log: admins only
DROP POLICY IF EXISTS "Admins can view AI audit log" ON public.ai_audit_log;
CREATE POLICY "Admins can view AI audit log"
  ON public.ai_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 6. FIX updated_at TRIGGERS (they referenced old users table)
-- ═══════════════════════════════════════════════════════════════════

-- Remove trigger that referenced old users table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

-- Ensure the trigger function still exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist on active tables
DO $$
DECLARE
  t_name TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'cases', 'attendance', 'organizations', 'notes', 'tenants'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables_with_updated_at
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t_name AND table_schema = 'public') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'updated_at' AND table_schema = 'public') THEN
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t_name, t_name);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t_name, t_name);
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
