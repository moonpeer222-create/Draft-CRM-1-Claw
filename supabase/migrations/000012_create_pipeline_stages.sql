-- ============================================================================
-- Pipeline Stages Lookup Table
-- Provides referential integrity and enables reporting/analytics on pipeline
-- ============================================================================

-- Create pipeline_stages lookup table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_type TEXT NOT NULL CHECK (pipeline_type IN ('lead', 'visa')),
    stage_key TEXT NOT NULL,
    stage_number INTEGER NOT NULL,
    label_en TEXT NOT NULL,
    label_urdu TEXT NOT NULL,
    deadline_hours INTEGER,
    is_final BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    requires_approval BOOLEAN DEFAULT FALSE,
    requires_doc_checklist BOOLEAN DEFAULT FALSE,
    requires_payment_verification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pipeline_type, stage_key)
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Everyone can read pipeline stages
CREATE POLICY "pipeline_stages_select_all" ON public.pipeline_stages
    FOR SELECT TO authenticated USING (true);

-- Only admin/master_admin can modify
CREATE POLICY "pipeline_stages_modify_admin" ON public.pipeline_stages
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'master_admin')
        )
    );

-- ============================================================================
-- Seed with lead pipeline stages
-- ============================================================================

INSERT INTO public.pipeline_stages (pipeline_type, stage_key, stage_number, label_en, label_urdu, deadline_hours, is_final, is_cancelled)
VALUES 
    ('lead', 'new_lead', 1, 'New Lead', 'نئی لیڈ', 24, FALSE, FALSE),
    ('lead', 'interested', 2, 'Interested', 'دلچسپی', 48, FALSE, FALSE),
    ('lead', 'follow_up', 3, 'Follow-up', 'فالو اپ', 24, FALSE, FALSE),
    ('lead', 'office_visit', 4, 'Office Visit', 'آفس وزٹ', 48, FALSE, FALSE),
    ('lead', 'agreement', 5, 'Agreement', 'معاہدہ', 24, FALSE, FALSE),
    ('lead', 'lead_cancelled', 0, 'Cancelled', 'منسوخ', NULL, FALSE, TRUE)
ON CONFLICT (pipeline_type, stage_key) DO NOTHING;

-- ============================================================================
-- Seed with visa pipeline stages
-- ============================================================================

INSERT INTO public.pipeline_stages (pipeline_type, stage_key, stage_number, label_en, label_urdu, deadline_hours, is_final, is_cancelled, requires_approval, requires_doc_checklist, requires_payment_verification)
VALUES 
    ('visa', 'new_entry', 1, 'New Entry', 'نئی اندراج', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'documents_received', 2, 'Documents Received', 'دستاویزات موصول', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'documents_sent_to_company', 3, 'Documents Sent to Company', 'دستاویزات کمپنی کو بھیجی گئیں', 48, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'selection_done', 4, 'Selection Done', 'سلیکشن ہو گیا', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'interview_done', 5, 'Interview Done', 'انٹرویو ہو گیا', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'offer_letter_issued', 6, 'Offer Letter Issued', 'آفر لیٹر جاری', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'invitation_letter_received', 7, 'Invitation Letter Received', 'دعوت نامہ موصول', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'candidate_office_visit', 8, 'Candidate Office Visit', 'امیدوار آفس وزٹ', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'agreement_with_client', 9, 'Agreement with Client', 'کلائنٹ سے معاہدہ', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'medical_done', 10, 'Medical Done', 'میڈیکل ہو گیا', 48, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'e_number_granted', 11, 'E Number Granted', 'ای نمبر جاری', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'finger_process', 12, 'Finger Process', 'فنگر پروسیس', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'case_handover_to_owner', 13, 'Case Hand Over to Platform Owner', 'کیس مالک کو حوالے', 24, FALSE, FALSE, TRUE, TRUE, TRUE),
    ('visa', 'case_submitted_to_agency', 14, 'Case Submitted to Agency', 'کیس ایجنسی کو جمع', 24, FALSE, FALSE, TRUE, TRUE, TRUE),
    ('visa', 'visa_applied', 15, 'Visa Applied', 'ویزا اپلائی', 48, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'visa_issued', 16, 'Visa Issued', 'ویزا جاری', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'ready_for_protector', 17, 'Ready for Protector', 'پروٹیکٹر کے لیے تیار', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'protector_done', 18, 'Protector Done', 'پروٹیکٹر ہو گیا', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'ticket_issued', 19, 'Ticket Issued', 'ٹکٹ جاری', 24, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'flying_ready', 20, 'Flying Ready', 'فلائنگ ریڈی', NULL, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'visa_completed', 21, 'Completed', 'مکمل', NULL, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('visa', 'visa_cancelled', 0, 'Cancelled', 'منسوخ', NULL, FALSE, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (pipeline_type, stage_key) DO NOTHING;

-- ============================================================================
-- Add status validation to cases table (optional - keeps data clean)
-- ============================================================================

-- Note: We don't add a CHECK constraint on cases.status because
-- the application may introduce new stages before they're added to the lookup table.
-- Instead, we rely on application-layer validation + the lookup table for reporting.

-- Create index for fast pipeline lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_type ON public.pipeline_stages(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_key ON public.pipeline_stages(stage_key);

-- ============================================================================
-- View: Active pipeline stages for easy querying
-- ============================================================================

CREATE OR REPLACE VIEW public.active_pipeline_stages AS
SELECT 
    pipeline_type,
    stage_key,
    stage_number,
    label_en,
    label_urdu,
    deadline_hours,
    requires_approval,
    requires_doc_checklist,
    requires_payment_verification
FROM public.pipeline_stages
WHERE is_cancelled = FALSE
ORDER BY pipeline_type, stage_number;

COMMENT ON TABLE public.pipeline_stages IS 'Lookup table for valid pipeline stages. Both lead and visa pipelines.';
