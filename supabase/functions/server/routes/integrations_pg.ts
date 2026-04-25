import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { getDbClient } from "../lib/db.ts";
import { authMiddleware } from "../authMiddleware.ts";

const integrations = new Hono();

// Require master_admin or admin for all integration routes
integrations.use("*", authMiddleware(["master_admin", "admin"]));

// ── Helpers ──────────────────────────────────────────────────
function getSession(c: any) {
  return c.get("session");
}

function getTenantId(c: any): string | null {
  return getSession(c)?.tenantId || null;
}

// ── API Connections ──────────────────────────────────────────

// List connections
integrations.get("/connections", async (c) => {
  const tenantId = getTenantId(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { data, error } = await client
    .from("api_connections")
    .select("id, tenant_id, name, service_type, base_url, status, last_used_at, created_at, updated_at, config")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Create connection
integrations.post("/connections", async (c) => {
  const tenantId = getTenantId(c);
  const session = getSession(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  const { data, error } = await client
    .from("api_connections")
    .insert({
      tenant_id: tenantId,
      name: body.name,
      service_type: body.service_type,
      base_url: body.base_url,
      api_key_encrypted: body.api_key_encrypted,
      api_secret_encrypted: body.api_secret_encrypted,
      config: body.config || {},
      status: body.status || "active",
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Update connection
integrations.put("/connections/:id", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  const update: Record<string, any> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.service_type !== undefined) update.service_type = body.service_type;
  if (body.base_url !== undefined) update.base_url = body.base_url;
  if (body.api_key_encrypted !== undefined) update.api_key_encrypted = body.api_key_encrypted;
  if (body.api_secret_encrypted !== undefined) update.api_secret_encrypted = body.api_secret_encrypted;
  if (body.config !== undefined) update.config = body.config;
  if (body.status !== undefined) update.status = body.status;

  const { data, error } = await client
    .from("api_connections")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Delete connection
integrations.delete("/connections/:id", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { error } = await client
    .from("api_connections")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ── Automation Triggers ──────────────────────────────────────

// List triggers
integrations.get("/triggers", async (c) => {
  const tenantId = getTenantId(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { data, error } = await client
    .from("automation_triggers")
    .select("*, api_connections(name, service_type)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Create trigger
integrations.post("/triggers", async (c) => {
  const tenantId = getTenantId(c);
  const session = getSession(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  const { data, error } = await client
    .from("automation_triggers")
    .insert({
      tenant_id: tenantId,
      connection_id: body.connection_id,
      name: body.name,
      description: body.description,
      enabled: body.enabled ?? true,
      event_type: body.event_type,
      event_conditions: body.event_conditions || {},
      action_type: body.action_type,
      action_config: body.action_config || {},
      field_mapping: body.field_mapping || {},
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Update trigger
integrations.put("/triggers/:id", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  const update: Record<string, any> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.enabled !== undefined) update.enabled = body.enabled;
  if (body.event_type !== undefined) update.event_type = body.event_type;
  if (body.event_conditions !== undefined) update.event_conditions = body.event_conditions;
  if (body.action_type !== undefined) update.action_type = body.action_type;
  if (body.action_config !== undefined) update.action_config = body.action_config;
  if (body.field_mapping !== undefined) update.field_mapping = body.field_mapping;
  if (body.connection_id !== undefined) update.connection_id = body.connection_id;

  const { data, error } = await client
    .from("automation_triggers")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Delete trigger
integrations.delete("/triggers/:id", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { error } = await client
    .from("automation_triggers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// Execute trigger
integrations.post("/triggers/:id/execute", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  // Verify trigger exists and belongs to tenant
  const { data: trigger, error: triggerError } = await client
    .from("automation_triggers")
    .select("*, api_connections(*)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .single();

  if (triggerError || !trigger) {
    return c.json({ success: false, error: "Trigger not found or disabled" }, 404);
  }

  // Create execution log
  const { data: logEntry, error: logError } = await client
    .from("trigger_execution_logs")
    .insert({
      tenant_id: tenantId,
      trigger_id: id,
      event_data: body.event_data || {},
      status: "pending",
    })
    .select()
    .single();

  if (logError) return c.json({ success: false, error: logError.message }, 500);

  // Update trigger stats
  await client
    .from("automation_triggers")
    .update({
      run_count: (trigger.run_count || 0) + 1,
      last_run_at: new Date().toISOString(),
      last_run_status: "pending",
    })
    .eq("id", id);

  // For now, return the log ID and queue for async processing
  // In production, this would enqueue a background job
  return c.json({
    success: true,
    message: "Trigger execution queued",
    log_id: logEntry.id,
    trigger_id: id,
  });
});

// ── Webhook Endpoints ────────────────────────────────────────

// List webhooks
integrations.get("/webhooks", async (c) => {
  const tenantId = getTenantId(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { data, error } = await client
    .from("webhook_endpoints")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Create webhook
integrations.post("/webhooks", async (c) => {
  const tenantId = getTenantId(c);
  const session = getSession(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const body = await c.req.json();
  const client = getDbClient();

  const { data, error } = await client
    .from("webhook_endpoints")
    .insert({
      tenant_id: tenantId,
      name: body.name,
      description: body.description,
      endpoint_path: body.endpoint_path,
      secret_key: body.secret_key,
      active: body.active ?? true,
      event_handlers: body.event_handlers || {},
      allowed_ips: body.allowed_ips || [],
      require_signature: body.require_signature ?? true,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Delete webhook
integrations.delete("/webhooks/:id", async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param("id");
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const client = getDbClient();
  const { error } = await client
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ── Logs ─────────────────────────────────────────────────────

// Webhook logs
integrations.get("/webhooks/logs", async (c) => {
  const tenantId = getTenantId(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const limit = parseInt(c.req.query("limit") || "50");
  const client = getDbClient();

  const { data, error } = await client
    .from("webhook_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Trigger execution logs
integrations.get("/execution-logs", async (c) => {
  const tenantId = getTenantId(c);
  if (!tenantId) return c.json({ success: false, error: "Tenant required" }, 400);

  const limit = parseInt(c.req.query("limit") || "50");
  const client = getDbClient();

  const { data, error } = await client
    .from("trigger_execution_logs")
    .select("*, automation_triggers(name)")
    .eq("tenant_id", tenantId)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

export default integrations;
