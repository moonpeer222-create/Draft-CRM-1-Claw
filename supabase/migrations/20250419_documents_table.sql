-- Documents Table Migration
-- Creates documents table with tenant isolation and RLS
-- Run this in Supabase SQL Editor

-- Drop old table from 000005 (different schema: no tenant_id, uploader_name, description)
DROP TABLE IF EXISTS documents CASCADE;

-- ============ DOCUMENTS TABLE ============
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploader_name TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation - users can only see docs from their tenant
DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
CREATE POLICY tenant_isolation_documents ON documents
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Additional policy: Users can only see documents linked to cases they have access to
DROP POLICY IF EXISTS case_linked_documents ON documents;
CREATE POLICY case_linked_documents ON documents
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant')::UUID
    AND case_id IN (
      SELECT id FROM cases 
      WHERE tenant_id = current_setting('app.current_tenant')::UUID
    )
  );

-- ============ MASTER ADMIN DOCUMENT VIEW ============
-- Master admin can see all documents across all tenants
CREATE OR REPLACE VIEW master_documents_view AS
SELECT 
  d.*,
  t.name as tenant_name,
  c.customer_name as case_client_name,
  c.status as case_status
FROM documents d
JOIN tenants t ON d.tenant_id = t.id
LEFT JOIN cases c ON d.case_id = c.id;

-- ============ DOCUMENT UPLOAD FUNCTION ============
-- Helper function to create document records with tenant context
CREATE OR REPLACE FUNCTION create_document(
  p_case_id UUID,
  p_file_name TEXT,
  p_file_url TEXT,
  p_file_type TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_uploaded_by UUID DEFAULT NULL,
  p_uploader_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_document_id UUID;
BEGIN
  -- Get tenant_id from the case
  SELECT tenant_id INTO v_tenant_id FROM cases WHERE id = p_case_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Case not found or no tenant associated';
  END IF;
  
  -- Verify current user has access to this tenant
  IF v_tenant_id != current_setting('app.current_tenant')::UUID THEN
    RAISE EXCEPTION 'Unauthorized: Cannot add document to case in different tenant';
  END IF;
  
  -- Insert document
  INSERT INTO documents (
    case_id, tenant_id, file_name, file_url, file_type, file_size,
    uploaded_by, uploader_name, description, metadata
  ) VALUES (
    p_case_id, v_tenant_id, p_file_name, p_file_url, p_file_type, p_file_size,
    p_uploaded_by, p_uploader_name, p_description, p_metadata
  ) RETURNING id INTO v_document_id;
  
  RETURN v_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ COMPLETION MARKER ============
INSERT INTO settings (key, value, description)
VALUES (
  'documents_table_migrated',
  jsonb_build_object('version', '1.0', 'date', now()),
  'Documents table migration completed'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

SELECT 'Documents Table Migration Complete' as status;