-- =============================================================================
-- MIGRATION 000007: Fix profiles table columns + repoint FKs after users drop
-- =============================================================================
-- This migration adds the missing columns to `profiles` that the edge functions
-- expect, and fixes any remaining FK references that still point to the old
-- `users` table (which was dropped in migration 000006).
--
-- RUN THIS IN THE SUPABASE SQL EDITOR BEFORE deploying the updated edge functions.
-- =============================================================================

BEGIN;

-- 1. Add missing columns to profiles (safe to re-run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Ensure updated_at trigger exists on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Fix FKs on tables created AFTER migration 000006 that may still reference users(id)
--    (These are defensive — they only run if the table + old FK exist)

-- ai_chat_history
DO $$
BEGIN
  ALTER TABLE public.ai_chat_history
    DROP CONSTRAINT IF EXISTS ai_chat_history_user_id_fkey;
  ALTER TABLE public.ai_chat_history
    ADD CONSTRAINT ai_chat_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ai_chat_history FK fix skipped: %', SQLERRM;
END $$;

-- ai_audit_log
DO $$
BEGIN
  ALTER TABLE public.ai_audit_log
    DROP CONSTRAINT IF EXISTS ai_audit_log_user_id_fkey;
  ALTER TABLE public.ai_audit_log
    ADD CONSTRAINT ai_audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ai_audit_log FK fix skipped: %', SQLERRM;
END $$;

-- payments (if it has a user_id FK)
DO $$
BEGIN
  ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'payments FK fix skipped (table or column may not exist): %', SQLERRM;
END $$;

-- notes (if it has a user_id FK)
DO $$
BEGIN
  ALTER TABLE public.notes
    DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
  ALTER TABLE public.notes
    ADD CONSTRAINT notes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notes FK fix skipped (table or column may not exist): %', SQLERRM;
END $$;

-- 5. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Add a policy for profiles if one doesn't exist
DO $$
BEGIN
  CREATE POLICY "Tenant Isolation: profiles"
    ON public.profiles FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Profiles RLS policy already exists';
END $$;

COMMIT;
