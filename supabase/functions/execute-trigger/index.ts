import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
}));

// Helper: get nested value
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

// Helper: match conditions
function matchesConditions(data: any, conditions: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  for (const [field, expectedValue] of Object.entries(conditions)) {
    if (getNestedValue(data, field) !== expectedValue) return false;
  }
  return true;
}

// Execute external API action
async function executeAction(connection: any, actionType: string, actionConfig: any, fieldMapping: any, eventData: any): Promise<any> {
  const apiKey = connection.api_key_encrypted;
  const params: any = {};
  for (const [apiParam, dataField] of Object.entries(fieldMapping || {})) {
    params[apiParam] = getNestedValue(eventData, dataField as string);
  }
  const finalParams = { ...actionConfig, ...params };

  switch (actionType) {
    case "send_sms": {
      if (connection.service_type === "twilio") {
        const { accountSid, authToken, from, to, body } = finalParams;
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ From: from, To: to, Body: body }),
        });
        const data = await response.json();
        return { success: response.ok, statusCode: response.status, request: finalParams, response: data, error: response.ok ? null : data.message };
      }
      return { success: false, error: "Unsupported SMS provider" };
    }
    case "send_email": {
      if (connection.service_type === "sendgrid") {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: finalParams.to }] }],
            from: { email: finalParams.from },
            subject: finalParams.subject,
            content: [{ type: "text/html", value: finalParams.body }],
          }),
        });
        const data = response.status === 202 ? { sent: true } : await response.json();
        return { success: response.ok, statusCode: response.status, request: finalParams, response: data, error: response.ok ? null : data.errors?.[0]?.message };
      }
      return { success: false, error: "Unsupported email provider" };
    }
    case "send_whatsapp": {
      const baseUrl = connection.base_url || "https://api.whatsapp.com";
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: finalParams.to, type: "text", text: { body: finalParams.body } }),
      });
      const data = await response.json();
      return { success: response.ok, statusCode: response.status, request: finalParams, response: data, error: response.ok ? null : data.error?.message };
    }
    case "webhook": {
      const { url, method = "POST", headers = {}, body } = finalParams;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: method !== "GET" ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      return { success: response.ok, statusCode: response.status, request: { url, method, body }, response: data, error: response.ok ? null : data.error || "Request failed" };
    }
    case "create_payment": {
      if (connection.service_type === "stripe") {
        const response = await fetch("https://api.stripe.com/v1/payment_intents", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ amount: finalParams.amount.toString(), currency: finalParams.currency || "usd", description: finalParams.description }),
        });
        const data = await response.json();
        return { success: response.ok, statusCode: response.status, request: finalParams, response: data, error: response.ok ? null : data.error?.message };
      }
      return { success: false, error: "Unsupported payment provider" };
    }
    default:
      return { success: false, error: `Unknown action type: ${actionType}` };
  }
}

// Main execute endpoint
app.post("/", async (c) => {
  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { trigger_id, event_data } = await c.req.json();

    // Get trigger configuration
    const { data: trigger, error: triggerError } = await supabase
      .from("automation_triggers")
      .select(`*, api_connections (id, service_type, base_url, api_key_encrypted, api_secret_encrypted, config)`)
      .eq("id", trigger_id)
      .eq("enabled", true)
      .single();

    if (triggerError || !trigger) {
      return c.json({ error: "Trigger not found or disabled" }, 404);
    }

    // Check event conditions
    if (!matchesConditions(event_data, trigger.event_conditions)) {
      return c.json({ skipped: true, reason: "Conditions not met" }, 200);
    }

    // Create execution log
    const { data: logEntry } = await supabase
      .from("trigger_execution_logs")
      .insert({ tenant_id: trigger.tenant_id, trigger_id: trigger.id, event_data, status: "pending" })
      .select()
      .single();

    // Execute the action
    const result = await executeAction(
      trigger.api_connections,
      trigger.action_type,
      trigger.action_config,
      trigger.field_mapping,
      event_data
    );

    const duration = Date.now() - startTime;

    // Update execution log
    await supabase.from("trigger_execution_logs").update({
      status: result.success ? "success" : "failed",
      request_payload: result.request,
      response_payload: result.response,
      http_status_code: result.statusCode,
      error_message: result.error,
      duration_ms: duration,
    }).eq("id", logEntry.id);

    // Update trigger stats
    await supabase.from("automation_triggers").update({
      run_count: trigger.run_count + 1,
      last_run_at: new Date().toISOString(),
      last_run_status: result.success ? "success" : "failed",
      last_error: result.error,
    }).eq("id", trigger.id);

    // Update connection last_used_at
    await supabase.from("api_connections").update({ last_used_at: new Date().toISOString() }).eq("id", trigger.api_connections.id);

    return c.json({
      success: result.success,
      log_id: logEntry.id,
      duration_ms: duration,
      ...result,
    }, result.success ? 200 : 500);

  } catch (err: any) {
    console.error("Trigger execution error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Health check
app.get("/", (c) => c.text("Execute Trigger Service - Emerald Tech Partner"));
app.get("/health", (c) => c.json({ status: "ok", service: "execute-trigger", timestamp: new Date().toISOString() }));

Deno.serve(app.fetch);
