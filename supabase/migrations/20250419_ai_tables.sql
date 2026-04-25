-- AI Tables Migration for PostgreSQL
-- Creates tables for AI chat history and audit logging
-- Run this in Supabase SQL Editor

-- Drop old tables that may have different schemas from previous migrations
DROP TABLE IF EXISTS ai_chat_history CASCADE;
DROP TABLE IF EXISTS ai_audit_log CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS notes CASCADE;

-- ============ AI CHAT HISTORY ============
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conversation ON ai_chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_tenant ON ai_chat_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_created ON ai_chat_history(created_at);

-- ============ AI AUDIT LOG ============
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  action_type TEXT DEFAULT 'chat',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant ON ai_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_action ON ai_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_log(created_at);

-- Row Level Security
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_ai_chat ON ai_chat_history
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_ai_audit ON ai_audit_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- ============ PAYMENTS TABLE (if not exists) ============
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_name TEXT,
  amount DECIMAL(12,2) NOT NULL,
  method TEXT NOT NULL,
  receipt_number TEXT,
  receipt_photo TEXT,
  storage_path TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_case ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payments ON payments
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- ============ NOTES TABLE (if not exists) ============
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  important BOOLEAN DEFAULT false,
  date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_case ON notes(case_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant ON notes(tenant_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notes ON notes
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- ============ COMPLETION MARKER ============
INSERT INTO settings (key, value, description)
VALUES (
  'ai_tables_migrated',
  '{"version": "1.0", "date": "' || now() || '"}'::jsonb,
  'AI tables migration completed'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

SELECT 'AI Tables Migration Complete' as status;
