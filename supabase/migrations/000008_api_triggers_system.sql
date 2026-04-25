-- API Triggers & Webhooks Management System
-- Migration for Emerald Agency CRM

-- =====================================================
-- 1. API Connections Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.api_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL, -- 'twilio', 'sendgrid', 'stripe', 'whatsapp', 'slack', 'custom'
    base_url TEXT,
    api_key_encrypted TEXT NOT NULL, -- Encrypted API key
    api_secret_encrypted TEXT, -- Optional encrypted secret
    config JSONB DEFAULT '{}'::jsonb, -- Additional configuration
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_connections (idempotent)
DROP POLICY IF EXISTS "Users can view their tenant's API connections" ON public.api_connections;
CREATE POLICY "Users can view their tenant's API connections"
    ON public.api_connections FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Admins can manage API connections" ON public.api_connections;
CREATE POLICY "Admins can manage API connections"
    ON public.api_connections FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'admin')
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_connections_tenant ON public.api_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_status ON public.api_connections(status);

-- =====================================================
-- 2. Automation Triggers Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.api_connections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,

    -- Trigger configuration
    event_type TEXT NOT NULL, -- 'case_created', 'case_status_changed', 'document_uploaded', etc.
    event_conditions JSONB DEFAULT '{}'::jsonb, -- Filter conditions (e.g., {"status": "approved"})

    -- Action configuration
    action_type TEXT NOT NULL, -- 'send_sms', 'send_email', 'webhook', 'send_whatsapp', etc.
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Action-specific configuration

    -- Field mapping (map CRM fields to API parameters)
    field_mapping JSONB DEFAULT '{}'::jsonb,

    -- Execution tracking
    run_count INTEGER DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'pending')),
    last_error TEXT,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their tenant's triggers" ON public.automation_triggers;
CREATE POLICY "Users can view their tenant's triggers"
    ON public.automation_triggers FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Admins can manage triggers" ON public.automation_triggers;
CREATE POLICY "Admins can manage triggers"
    ON public.automation_triggers FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'admin')
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_triggers_tenant ON public.automation_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_triggers_event ON public.automation_triggers(event_type) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_automation_triggers_connection ON public.automation_triggers(connection_id);

-- =====================================================
-- 3. Webhook Endpoints Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,

    -- Webhook configuration
    endpoint_path TEXT NOT NULL UNIQUE, -- e.g., '/webhooks/stripe-payments'
    secret_key TEXT NOT NULL, -- For signature verification
    active BOOLEAN DEFAULT true,

    -- Event handling
    event_handlers JSONB DEFAULT '{}'::jsonb, -- Map event types to handlers

    -- Security
    allowed_ips TEXT[], -- Optional IP whitelist
    require_signature BOOLEAN DEFAULT true,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their tenant's webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Users can view their tenant's webhook endpoints"
    ON public.webhook_endpoints FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Admins can manage webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Admins can manage webhook endpoints"
    ON public.webhook_endpoints FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'admin')
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON public.webhook_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_path ON public.webhook_endpoints(endpoint_path) WHERE active = true;

-- =====================================================
-- 4. Webhook Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,

    -- Request details
    method TEXT NOT NULL,
    headers JSONB,
    payload JSONB,

    -- Response details
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'retrying')),
    status_code INTEGER,
    response JSONB,
    error_message TEXT,

    -- Performance
    duration_ms INTEGER,

    -- Metadata
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their tenant's webhook logs" ON public.webhook_logs;
CREATE POLICY "Users can view their tenant's webhook logs"
    ON public.webhook_logs FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "System can insert webhook logs"
    ON public.webhook_logs FOR INSERT
    WITH CHECK (true); -- Edge functions will insert logs

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON public.webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON public.webhook_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON public.webhook_logs(status);

-- =====================================================
-- 5. Trigger Execution Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trigger_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES public.automation_triggers(id) ON DELETE CASCADE,

    -- Execution details
    event_data JSONB, -- The event that triggered this
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'retrying')),

    -- API call details
    request_payload JSONB,
    response_payload JSONB,
    http_status_code INTEGER,
    error_message TEXT,

    -- Performance
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,

    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.trigger_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their tenant's execution logs" ON public.trigger_execution_logs;
CREATE POLICY "Users can view their tenant's execution logs"
    ON public.trigger_execution_logs FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trigger_logs_tenant ON public.trigger_execution_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_trigger ON public.trigger_execution_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_executed ON public.trigger_execution_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_status ON public.trigger_execution_logs(status);

-- =====================================================
-- 6. Updated_at Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at (idempotent)
DROP TRIGGER IF EXISTS update_api_connections_updated_at ON public.api_connections;
CREATE TRIGGER update_api_connections_updated_at
    BEFORE UPDATE ON public.api_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_triggers_updated_at ON public.automation_triggers;
CREATE TRIGGER update_automation_triggers_updated_at
    BEFORE UPDATE ON public.automation_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON public.webhook_endpoints;
CREATE TRIGGER update_webhook_endpoints_updated_at
    BEFORE UPDATE ON public.webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. Helper Functions
-- =====================================================

-- Function to execute a trigger
CREATE OR REPLACE FUNCTION execute_automation_trigger(
    p_trigger_id UUID,
    p_event_data JSONB
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- Insert execution log
    INSERT INTO public.trigger_execution_logs (
        tenant_id,
        trigger_id,
        event_data,
        status
    )
    SELECT
        tenant_id,
        id,
        p_event_data,
        'pending'
    FROM public.automation_triggers
    WHERE id = p_trigger_id
    RETURNING id INTO v_log_id;

    -- Update trigger stats
    UPDATE public.automation_triggers
    SET
        run_count = run_count + 1,
        last_run_at = NOW(),
        last_run_status = 'pending'
    WHERE id = p_trigger_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Comments
COMMENT ON TABLE public.api_connections IS 'External API connection configurations with encrypted credentials';
COMMENT ON TABLE public.automation_triggers IS 'Automated workflow triggers that call external APIs';
COMMENT ON TABLE public.webhook_endpoints IS 'Incoming webhook endpoints for receiving external events';
COMMENT ON TABLE public.webhook_logs IS 'Logs of all incoming webhook requests';
COMMENT ON TABLE public.trigger_execution_logs IS 'Logs of all automation trigger executions';
