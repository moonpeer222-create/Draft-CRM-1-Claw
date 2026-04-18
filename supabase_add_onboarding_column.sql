-- Add onboarding_completed flag to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update RLS to allow users to see their own tenant details (which includes onboarding status)
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" 
ON public.tenants FOR SELECT TO authenticated
USING (id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
