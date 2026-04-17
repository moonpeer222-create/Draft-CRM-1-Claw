-- ============================================================
-- Emerald Visa CRM — Supabase RLS Policies
-- Run this in the Supabase SQL Editor to enforce row-level
-- security on cases, profiles, documents, and organizations.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin')
    )
  );

-- ============================================================
-- cases
-- ============================================================
DROP POLICY IF EXISTS "cases_select_all_authenticated" ON public.cases;
CREATE POLICY "cases_select_all_authenticated"
  ON public.cases FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cases_insert_authenticated" ON public.cases;
CREATE POLICY "cases_insert_authenticated"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "cases_update_all_authenticated" ON public.cases;
CREATE POLICY "cases_update_all_authenticated"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cases_delete_admin_only" ON public.cases;
CREATE POLICY "cases_delete_admin_only"
  ON public.cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin')
    )
  );

-- ============================================================
-- documents
-- ============================================================
DROP POLICY IF EXISTS "documents_select_all_authenticated" ON public.documents;
CREATE POLICY "documents_select_all_authenticated"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "documents_insert_authenticated" ON public.documents;
CREATE POLICY "documents_insert_authenticated"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "documents_update_all_authenticated" ON public.documents;
CREATE POLICY "documents_update_all_authenticated"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "documents_delete_admin_only" ON public.documents;
CREATE POLICY "documents_delete_admin_only"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin')
    )
  );

-- ============================================================
-- organizations
-- ============================================================
DROP POLICY IF EXISTS "organizations_select_all_authenticated" ON public.organizations;
CREATE POLICY "organizations_select_all_authenticated"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "organizations_insert_admin_only" ON public.organizations;
CREATE POLICY "organizations_insert_admin_only"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin')
    )
  );

DROP POLICY IF EXISTS "organizations_update_admin_only" ON public.organizations;
CREATE POLICY "organizations_update_admin_only"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin')
    )
  );
