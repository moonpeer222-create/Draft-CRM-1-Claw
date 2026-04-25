-- Fix for infinite recursion in RLS policies on profiles table
-- The problem: policies checking admin status by querying profiles table
-- cause infinite recursion because RLS applies to the subquery too.
-- Solution: Use a SECURITY DEFINER function that bypasses RLS.

-- ============================================================
-- 1. Create a SECURITY DEFINER function to get user role
-- This function runs as the table owner and bypasses RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon;

-- ============================================================
-- 2. Drop and recreate the broken policies using the function
-- ============================================================

-- profiles UPDATE policy
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR public.get_user_role(auth.uid()) IN ('admin','master_admin')
  );

-- cases DELETE policy
DROP POLICY IF EXISTS "cases_delete_admin_only" ON public.cases;
CREATE POLICY "cases_delete_admin_only"
  ON public.cases FOR DELETE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin','master_admin')
  );

-- documents DELETE policy
DROP POLICY IF EXISTS "documents_delete_admin_only" ON public.documents;
CREATE POLICY "documents_delete_admin_only"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin','master_admin')
  );

-- organizations INSERT policy
DROP POLICY IF EXISTS "organizations_insert_admin_only" ON public.organizations;
CREATE POLICY "organizations_insert_admin_only"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin','master_admin')
  );

-- organizations UPDATE policy
DROP POLICY IF EXISTS "organizations_update_admin_only" ON public.organizations;
CREATE POLICY "organizations_update_admin_only"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin','master_admin')
  );

-- ============================================================
-- 3. Additional policies that may have the same recursion issue
-- ============================================================

-- If there are other tables with similar recursive checks, add fixes here.
-- Example pattern: replace
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master_admin'))
-- with
--   public.get_user_role(auth.uid()) IN ('admin','master_admin')

-- ============================================================
-- 4. Verify the fix works
-- ============================================================
-- Run this to confirm no infinite recursion:
-- SELECT * FROM public.profiles LIMIT 1;
-- If it returns a row without error, the fix is working.
