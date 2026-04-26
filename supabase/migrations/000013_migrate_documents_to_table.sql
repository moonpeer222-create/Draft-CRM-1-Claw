-- ============================================================================
-- Migration: Move documents from cases.metadata to documents table
-- ============================================================================

-- Migrate existing documents from cases.metadata.documents to documents table
DO $$
DECLARE
    case_record RECORD;
    doc JSONB;
    new_doc_id UUID;
BEGIN
    -- Iterate through cases that have documents in metadata
    FOR case_record IN 
        SELECT id, metadata->'documents' as docs, tenant_id
        FROM cases 
        WHERE metadata->'documents' IS NOT NULL 
        AND jsonb_array_length(metadata->'documents') > 0
    LOOP
        -- Iterate through each document in the array
        FOR doc IN 
            SELECT jsonb_array_elements(case_record.docs)
        LOOP
            -- Only insert if not already migrated (check by name + case_id)
            IF NOT EXISTS (
                SELECT 1 FROM documents 
                WHERE case_id = case_record.id 
                AND file_name = doc->>'name'
            ) THEN
                INSERT INTO documents (
                    case_id,
                    tenant_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size,
                    document_type,
                    uploaded_by,
                    verified,
                    metadata
                ) VALUES (
                    case_record.id,
                    case_record.tenant_id,
                    doc->>'name',
                    doc->>'url',
                    COALESCE(doc->>'type', 'application/pdf'),
                    COALESCE((doc->>'size')::INTEGER, 0),
                    COALESCE(doc->>'checklistKey', 'other'),
                    NULL, -- Can't determine uploader from metadata
                    COALESCE((doc->>'status' = 'verified')::BOOLEAN, FALSE),
                    jsonb_build_object(
                        'migrated_from_metadata', true,
                        'original_status', doc->>'status',
                        'original_id', doc->>'id',
                        'notes', doc->>'notes',
                        'verified_by', doc->>'verifiedBy',
                        'verified_at', doc->>'verifiedAt',
                        'rejection_reason', doc->>'rejectionReason',
                        'verification_history', doc->'verificationHistory'
                    )
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- Add trigger to sync future document uploads to documents table
-- ============================================================================

-- Function to extract and save documents from metadata to documents table
CREATE OR REPLACE FUNCTION public.sync_documents_from_metadata()
RETURNS TRIGGER AS $$
DECLARE
    doc JSONB;
BEGIN
    -- Only process if metadata contains documents
    IF NEW.metadata->'documents' IS NOT NULL THEN
        FOR doc IN SELECT jsonb_array_elements(NEW.metadata->'documents')
        LOOP
            -- Upsert document (insert or update)
            INSERT INTO documents (
                case_id,
                tenant_id,
                file_name,
                file_url,
                file_type,
                document_type,
                verified,
                metadata
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                doc->>'name',
                doc->>'url',
                COALESCE(doc->>'type', 'application/pdf'),
                COALESCE(doc->>'checklistKey', 'other'),
                COALESCE((doc->>'status' = 'verified')::BOOLEAN, FALSE),
                jsonb_build_object('auto_synced', true)
            )
            ON CONFLICT (case_id, file_name) 
            DO UPDATE SET
                file_url = EXCLUDED.file_url,
                file_type = EXCLUDED.file_type,
                verified = EXCLUDED.verified,
                metadata = jsonb_build_object('auto_synced', true, 'updated_at', NOW());
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_documents ON cases;

-- Create trigger (optional - can be enabled later when code is fully migrated)
-- CREATE TRIGGER trigger_sync_documents
--     AFTER INSERT OR UPDATE OF metadata ON cases
--     FOR EACH ROW
--     EXECUTE FUNCTION public.sync_documents_from_metadata();

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
    'Documents migrated' as check_name,
    COUNT(*) as count 
FROM documents 
WHERE metadata->>'migrated_from_metadata' = 'true';
