import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["authorization", "x-client-info", "apikey", "content-type", "x-webhook-signature"],
}));

// Helper: verify HMAC signature
async function verifySignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expectedSignature === signature;
  } catch {
    return false;
  }
}

// Helper: get nested value
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

// Helper: log webhook request
async function logWebhookRequest(
  supabase: any,
  endpoint: any,
  c: any,
  payload: any,
  status: string,
  response: any,
  errorMessage: string | null,
  duration?: number
) {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => { headers[key] = value; });

  await supabase.from("webhook_logs").insert({
    tenant_id: endpoint.tenant_id,
    endpoint_id: endpoint.id,
    method: c.req.method,
    headers,
    payload,
    status,
    response,
    error_message: errorMessage,
    duration_ms: duration,
    ip_address: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    user_agent: c.req.header("user-agent"),
  });
}

// Main webhook handler
app.post("/*", async (c) => {
  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const endpointPath = new URL(c.req.url).pathname;

    // Get webhook endpoint configuration
    const { data: endpoint, error: endpointError } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("endpoint_path", endpointPath)
      .eq("active", true)
      .single();

    if (endpointError || !endpoint) {
      return c.json({ error: "Webhook endpoint not found" }, 404);
    }

    const payload = await c.req.json().catch(() => ({}));

    // Verify signature if required
    if (endpoint.require_signature) {
      const signature = c.req.header("x-webhook-signature");
      const bodyText = JSON.stringify(payload);
      const isValid = await verifySignature(bodyText, signature, endpoint.secret_key);

      if (!isValid) {
        await logWebhookRequest(supabase, endpoint, c, payload, "failed", null, "Invalid signature");
        return c.json({ error: "Invalid signature" }, 401);
      }
    }

    // Check IP whitelist
    if (endpoint.allowed_ips && endpoint.allowed_ips.length > 0) {
      const clientIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
      if (!endpoint.allowed_ips.includes(clientIp)) {
        await logWebhookRequest(supabase, endpoint, c, payload, "failed", null, "IP not allowed");
        return c.json({ error: "IP not allowed" }, 403);
      }
    }

    // Process based on event type
    const eventType = payload.event || payload.type || "unknown";
    const handlers = endpoint.event_handlers || {};
    const handler = handlers[eventType];

    let processResult = { success: true, message: "Webhook received" };

    if (handler) {
      const { action, target_table, field_mapping, match_field, match_source } = handler;

      if (action === "update_record") {
        const updates: any = {};
        for (const [targetField, sourceField] of Object.entries(field_mapping || {})) {
          updates[targetField] = getNestedValue(payload, sourceField as string);
        }
        const { error } = await supabase
          .from(target_table)
          .update(updates)
          .eq("tenant_id", endpoint.tenant_id)
          .eq(match_field, getNestedValue(payload, match_source));
        if (error) processResult = { success: false, message: error.message };
      }

      if (action === "create_record") {
        const newRecord: any = { tenant_id: endpoint.tenant_id };
        for (const [targetField, sourceField] of Object.entries(field_mapping || {})) {
          newRecord[targetField] = getNestedValue(payload, sourceField as string);
        }
        const { error } = await supabase.from(target_table).insert(newRecord);
        if (error) processResult = { success: false, message: error.message };
      }
    }

    const duration = Date.now() - startTime;
    await logWebhookRequest(
      supabase, endpoint, c, payload,
      processResult.success ? "success" : "failed",
      processResult,
      processResult.success ? null : processResult.message,
      duration
    );

    return c.json(processResult, processResult.success ? 200 : 500);
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Health check
app.get("/", (c) => c.text("Process Webhook Service - Emerald Tech Partner"));
app.get("/health", (c) => c.json({ status: "ok", service: "process-webhook", timestamp: new Date().toISOString() }));

Deno.serve(app.fetch);
