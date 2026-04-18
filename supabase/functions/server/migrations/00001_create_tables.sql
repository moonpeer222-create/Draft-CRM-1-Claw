-- Migration: 00001_create_tables.sql
-- Create proper PostgreSQL relational tables for CRM system
-- Replaces kv_store_5cdc87b7 key-value storage

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('master_admin', 'admin', 'agent', 'customer', 'operator')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    phone TEXT,
    avatar_url TEXT,
    department TEXT,
    employee_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    tenant_id UUID,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT UNIQUE,
    customer_name TEXT NOT NULL,
    father_name TEXT,
    phone TEXT,
    email TEXT,
    cnic TEXT,
    passport_number TEXT,
    country TEXT,
    job_type TEXT,
    job_description TEXT,
    address TEXT,
    city TEXT,
    marital_status TEXT,
    date_of_birth DATE,
    emergency_contact TEXT,
    education TEXT,
    experience TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'pending', 'completed', 'cancelled', 'on_hold')),
    agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_name TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    total_fee DECIMAL(12, 2) DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    current_stage TEXT DEFAULT 'intake',
    stage_started_at TIMESTAMP WITH TIME ZONE,
    stage_deadline_at TIMESTAMP WITH TIME ZONE,
    is_overdue BOOLEAN DEFAULT FALSE,
    timeline JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    payments JSONB DEFAULT '[]',
    medical_info JSONB DEFAULT '{}',
    notes JSONB DEFAULT '[]',
    medical_token TEXT,
    biometric_date TIMESTAMP WITH TIME ZONE,
    e_number TEXT,
    protector_date TIMESTAMP WITH TIME ZONE,
    ticket_info JSONB DEFAULT '{}',
    departure_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    flagged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    flagged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for cases
CREATE INDEX IF NOT EXISTS idx_cases_customer_name ON cases(customer_name);
CREATE INDEX IF NOT EXISTS idx_cases_passport ON cases(passport_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_agent ON cases(agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_country ON cases(country);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_tenant ON cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_flagged ON cases(flagged) WHERE flagged = TRUE;

-- Sessions table (replaces KV session storage)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_valid ON sessions(is_valid) WHERE is_valid = TRUE;

-- Agent codes table
CREATE TABLE IF NOT EXISTS agent_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    agent_name TEXT,
    description TEXT,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID
);

-- Indexes for agent codes
CREATE INDEX IF NOT EXISTS idx_agent_codes_code ON agent_codes(code);
CREATE INDEX IF NOT EXISTS idx_agent_codes_agent ON agent_codes(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_codes_active ON agent_codes(is_active) WHERE is_active = TRUE;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploader_name TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'holiday')),
    work_hours DECIMAL(4, 2),
    notes TEXT,
    location_in JSONB,
    location_out JSONB,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID,
    UNIQUE(user_id, date)
);

-- Indexes for attendance
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'system')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    action_type TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    tenant_id UUID
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'emergency', 'unpaid', 'other')),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID
);

-- Indexes for leave requests
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_tenant ON leave_requests(tenant_id);

-- Passport tracking table
CREATE TABLE IF NOT EXISTS passport_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    passport_number TEXT,
    status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'submitted', 'approved', 'rejected', 'returned', 'delivered')),
    location TEXT,
    current_holder TEXT,
    notes JSONB DEFAULT '[]',
    tracking_events JSONB DEFAULT '[]',
    estimated_return_date DATE,
    actual_return_date DATE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID
);

-- Indexes for passport tracking
CREATE INDEX IF NOT EXISTS idx_passport_case ON passport_tracking(case_id);
CREATE INDEX IF NOT EXISTS idx_passport_status ON passport_tracking(status);
CREATE INDEX IF NOT EXISTS idx_passport_number ON passport_tracking(passport_number);
CREATE INDEX IF NOT EXISTS idx_passport_tenant ON passport_tracking(tenant_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passport_tracking_updated_at BEFORE UPDATE ON passport_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_user_email TEXT,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_details JSONB,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_tenant_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, details, ip_address, user_agent, tenant_id)
    VALUES (p_user_id, p_user_email, p_action, p_entity_type, p_entity_id, p_details, p_ip_address, p_user_agent, p_tenant_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ language 'plpgsql';
