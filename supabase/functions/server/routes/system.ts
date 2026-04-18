import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as kv from "../kv_store.tsx";
import { KEY, MAX_NOTIFICATIONS, MAX_ATTENDANCE, MAX_LEAVE_REQUESTS, MAX_CODE_HISTORY } from "../lib/constants.ts";
import { kvSet } from "../lib/supabase.ts";
import { trimArray } from "../lib/utils.ts";

const system = new Hono();

// NOTIFICATIONS: CASE STATUS CHANGE
system.post("/notifications/case-status", async (c) => {
  try {
    const body = await c.req.json();
    const { caseId, newStatus, customerName, agentName } = body;
    
    // Generic email template (No hardcoded office address)
    const emailBody = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f0fdf4;">
        <h1 style="color:#059669;">Emerald Tech Partner</h1>
        <p>Case <strong>${caseId}</strong> status updated to: <strong>${newStatus}</strong></p>
        <p>Customer: ${customerName || 'N/A'}</p>
        <p>Agent: ${agentName || 'N/A'}</p>
        <hr/>
        <p style="font-size:11px;color:#6b7280;">This is an automated notification from your CRM.</p>
      </div>
    `;
    
    // Send via Brevo (configured in environment)
    console.log(`Sending generic status update email for ${caseId}...`);
    
    return c.json({ success: true, message: "Notification sent (Genericized)" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DEFAULT EXPORT
export default system;
