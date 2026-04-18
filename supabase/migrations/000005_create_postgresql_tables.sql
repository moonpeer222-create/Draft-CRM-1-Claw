-- Migration: Create proper PostgreSQL tables for CRM system
-- Replaces KV store with relational schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (replaces crm:users_db)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'master_admin', 'agent', 'operator', 'customer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    phone TEXT,
    avatar_url TEXT,
    department TEXT,
    employee_id TEXT,
    tenant_id UUID,
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Cases table (replaces crm:cases)
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,
    passport_number TEXT,
    passport_expiry DATE,
    date_of_birth DATE,
    nationality TEXT,
    visa_type TEXT,
    country TEXT NOT NULL,
    status TEXT DEFAULT 'new' NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    agent_id UUID REFERENCES users(id),
    operator_id UUID REFERENCES users(id),
    employer_name TEXT,
    employer_contact TEXT,
    job_title TEXT,
    salary_offered DECIMAL(12, 2),
    medical_status TEXT,
    visa_status TEXT,
    ticket_status TEXT,
    contract_signed BOOLEAN DEFAULT FALSE,
    oep_status TEXT,
    beoe_status TEXT,
    protectorate_status TEXT,
    embassy_status TEXT,
    travel_date DATE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    documents JSONB DEFAULT '[]',
    payments JSONB DEFAULT '[]',
    timeline JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    tenant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cases
CREATE INDEX IF NOT EXISTS idx_cases_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_agent ON cases(agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_customer_phone ON cases(customer_phone);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_tenant ON cases(tenant_id);

-- Sessions table (replaces crm:session:*)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Agent codes table (replaces crm:agent_codes)
CREATE TABLE IF NOT EXISTS agent_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    agent_id UUID REFERENCES users(id),
    agent_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES users(id),
    tenant_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent codes
CREATE INDEX IF NOT EXISTS idx_agent_codes_code ON agent_codes(code);
CREATE INDEX IF NOT EXISTS idx_agent_codes_status ON agent_codes(status);
CREATE INDEX IF NOT EXISTS idx_agent_codes_expires ON agent_codes(expires_at);

-- Audit log table (replaces crm:audit_log)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    tenant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Settings table (replaces crm:settings)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (replaces crm:document_files)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    document_type TEXT,
    uploaded_by UUID REFERENCES users(id),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- Attendance table (replaces crm:attendance:*)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave')),
    notes TEXT,
    location TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes for attendance
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- Notifications table (replaces crm:notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    link TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Leave requests table (replaces crm:leave_requests)
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT DEFAULT 'annual' CHECK (leave_type IN ('annual', 'sick', 'emergency', 'unpaid', 'other')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for leave requests
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);

-- Passport tracking table (replaces crm:passport_tracking)
CREATE TABLE IF NOT EXISTS passport_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    passport_number TEXT NOT NULL,
    status TEXT DEFAULT 'with_applicant' CHECK (status IN ('with_applicant', 'with_agency', 'with_embassy', 'with_employer', 'in_transit', 'returned')),
    location TEXT,
    received_by TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    returned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for passport tracking
CREATE INDEX IF NOT EXISTS idx_passport_case ON passport_tracking(case_id);
CREATE INDEX IF NOT EXISTS idx_passport_number ON passport_tracking(passport_number);

-- AI Audit log table (replaces crm:ai_audit_log)
CREATE TABLE IF NOT EXISTS ai_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    role TEXT,
    message TEXT NOT NULL,
    message_preview TEXT,
    has_actions BOOLEAN DEFAULT FALSE,
    model TEXT,
    response_tokens INTEGER,
    request_tokens INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for AI audit
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_log(created_at);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for password reset
CREATE INDEX IF NOT EXISTS idx_reset_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_reset_code ON password_reset_tokens(code);
CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passport_tracking_updated_at BEFORE UPDATE ON passport_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_tracking ENABLE ROW LEVEL SECURITY;

-- Create exec_sql function for migrations (if not exists)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT, params JSONB DEFAULT '[]')
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    EXECUTE sql INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE users IS 'CRM users (admin, agents, operators, customers)';
COMMENT ON TABLE cases IS 'Visa/employment cases with full tracking';
COMMENT ON TABLE sessions IS 'User session tokens with expiration';
COMMENT ON TABLE agent_codes IS '6-digit login codes for agents';
COMMENT ON TABLE audit_log IS 'Activity audit trail for compliance';
