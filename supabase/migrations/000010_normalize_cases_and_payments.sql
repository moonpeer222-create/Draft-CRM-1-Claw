-- Migration: Normalize cases table and create payments table
-- Extracts customer data from metadata JSONB into proper columns
-- Creates dedicated payments table replacing payments JSONB array

-- ============================================================
-- Part 1: Add missing customer columns to cases table
-- ============================================================

-- Father name
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS father_name TEXT;

-- CNIC (Computerized National Identity Card)
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS cnic TEXT;

-- Address
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS address TEXT;

-- City
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS city TEXT;

-- Marital status
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS marital_status TEXT
  CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'separated'));

-- Education level
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS education TEXT;

-- Work experience
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS experience TEXT;

-- Total fee for the case
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS total_fee DECIMAL(12, 2) DEFAULT 0.00;

-- Amount already paid
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12, 2) DEFAULT 0.00;

-- ============================================================
-- Part 2: Create payments table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    method TEXT CHECK (method IN ('cash', 'bank_transfer', 'cheque', 'card', 'online', 'other')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    reference TEXT,
    notes TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES public.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on payments.case_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_payments_case ON public.payments(case_id);

-- Index on payments.status for filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Index on payments.created_at for sorting
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at);

-- ============================================================
-- Part 3: Enable RLS on payments table
-- ============================================================

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Select: any authenticated user
DROP POLICY IF EXISTS "payments_select_all_authenticated" ON public.payments;

CREATE POLICY "payments_select_all_authenticated"
ON public.payments
FOR SELECT
TO authenticated
USING (true);

-- Insert: any authenticated user
DROP POLICY IF EXISTS "payments_insert_all_authenticated" ON public.payments;

CREATE POLICY "payments_insert_all_authenticated"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update: any authenticated user
DROP POLICY IF EXISTS "payments_update_all_authenticated" ON public.payments;

CREATE POLICY "payments_update_all_authenticated"
ON public.payments
FOR UPDATE
TO authenticated
USING (true);

-- Delete: only admin or master_admin
DROP POLICY IF EXISTS "payments_delete_admin_only" ON public.payments;

CREATE POLICY "payments_delete_admin_only"
ON public.payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'master_admin')
  )
);

-- ============================================================
-- Part 4: Auto-calculate paid_amount on cases
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_case_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cases
  SET paid_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.payments
    WHERE case_id = COALESCE(NEW.case_id, OLD.case_id)
    AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.case_id, OLD.case_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_recalculate_paid_amount ON public.payments;

-- Create trigger on payments table
CREATE TRIGGER trigger_recalculate_paid_amount
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_case_paid_amount();

-- ============================================================
-- Part 5: Additional indexes for common queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cases_cnic ON public.cases(cnic);
CREATE INDEX IF NOT EXISTS idx_cases_city ON public.cases(city);
CREATE INDEX IF NOT EXISTS idx_cases_marital_status ON public.cases(marital_status);
