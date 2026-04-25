/**
 * emailService.ts — Brevo email notifications via the server.
 *
 * Call sendCaseStatusEmail() whenever a case status changes.
 * The server-side handler renders a bilingual (Urdu) HTML email
 * and delivers it via Brevo transactional email.
 */
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/admin_pg`;

export interface CaseStatusEmailPayload {
  caseId: string;
  customerName?: string;
  customerEmail?: string;
  agentName?: string;
  agentEmail?: string;
  oldStatus?: string;
  newStatus: string;
  phone?: string;
  country?: string;
}

/**
 * Send a case status change email notification.
 * Non-blocking — errors are logged but never thrown to the caller.
 */
export async function sendCaseStatusEmail(payload: CaseStatusEmailPayload): Promise<void> {
  // Skip if no email recipients are provided
  if (!payload.customerEmail && !payload.agentEmail) return;

  try {
    const res = await fetch(`${SERVER_BASE}/notifications/case-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return;
    }

    const data = await res.json();
    if (data.success) {
    }
  } catch (err) {
    // Non-fatal — email is a nice-to-have, never block the UI
  }
}

/**
 * Get the customer + agent emails from a case object.
 * Returns empty strings when not available.
 */
export function extractEmailsFromCase(caseObj: any): {
  customerEmail: string;
  agentEmail: string;
} {
  return {
    customerEmail: caseObj?.email || caseObj?.customerEmail || "",
    agentEmail: caseObj?.agentEmail || "",
  };
}
