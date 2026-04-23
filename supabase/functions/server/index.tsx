import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
// Improvement #6: Extracted modules
import { handleStreamingAIChat } from "./aiRoutes.ts";
import { safeHandler, withRetry } from "./errorUtils.ts";

// ── Inline session helpers (avoid import-cache issues with authMiddleware.ts) ──
const SESSION_PREFIX = "crm:session:";
const SESSION_TTL: Record<string, number> = {
  master_admin: 12*60*60*1000, admin: 8*60*60*1000, agent: 6*60*60*1000,
  customer: 12*60*60*1000, operator: 8*60*60*1000,
};

async function createSession(userId: string, fullName: string, email: string, role: string, ip?: string) {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const now = new Date();
  const session = { token, userId, fullName, email, role, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + (SESSION_TTL[role] || 8*60*60*1000)).toISOString(), ip };
  await kvSet(`${SESSION_PREFIX}${token}`, session, "create-session");
  console.log(`Session created for ${fullName} (${role}) — token prefix: ${token.substring(0, 8)}...`);
  return session;
}

async function validateSession(token: string) {
  if (!token || token.length < 10) return null;
  try {
    const session = await kv.get(`${SESSION_PREFIX}${token}`) as any;
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) { await kv.del(`${SESSION_PREFIX}${token}`); return null; }
    return session;
  } catch { return null; }
}

async function destroySession(token: string) {
  if (token) await kv.del(`${SESSION_PREFIX}${token}`);
}

// Rate limiter — in-memory per-IP
const _rl = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(max: number) {
  return async (c: any, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    let e = _rl.get(`${ip}:${max}`);
    if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60000 }; _rl.set(`${ip}:${max}`, e); }
    e.count++;
    if (e.count > max) return c.json({ success: false, error: "Too many requests. Please slow down." }, 429);
    if (_rl.size > 1000) { for (const [k,v] of _rl.entries()) { if (now > v.resetAt) _rl.delete(k); } }
    await next();
  };
}

// ── Input validation helpers (Improvement #4) ──────────────
function validateCaseFields(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data.customerName !== undefined && (typeof data.customerName !== "string" || data.customerName.length > 200)) {
    errors.push("customerName must be a string under 200 chars");
  }
  if (data.phone !== undefined && (typeof data.phone !== "string" || data.phone.length > 30)) {
    errors.push("phone must be a string under 30 chars");
  }
  if (data.totalFee !== undefined && (typeof data.totalFee !== "number" || data.totalFee < 0 || data.totalFee > 100000000)) {
    errors.push("totalFee must be a number between 0 and 100,000,000");
  }
  if (data.paidAmount !== undefined && (typeof data.paidAmount !== "number" || data.paidAmount < 0)) {
    errors.push("paidAmount must be a non-negative number");
  }
  if (data.priority !== undefined && !["low", "medium", "high", "urgent"].includes(data.priority)) {
    errors.push("priority must be one of: low, medium, high, urgent");
  }
  return { valid: errors.length === 0, errors };
}

// ── AI prompt injection sanitizer (Improvement #3) ──────────
function sanitizeAIInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input
    .replace(/\[SYSTEM\]/gi, "[filtered]")
    .replace(/\[INST\]/gi, "[filtered]")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/SYS>/gi, "")
    .replace(/\[\/INST\]/gi, "")
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "[filtered]")
    .replace(/forget\s+(all\s+)?previous\s+instructions/gi, "[filtered]")
    .replace(/you\s+are\s+now\s+/gi, "[filtered]")
    .replace(/new\s+system\s+prompt/gi, "[filtered]")
    .replace(/override\s+system/gi, "[filtered]")
    .replace(/disregard\s+(all\s+)?above/gi, "[filtered]");
  if (sanitized.length > 4000) sanitized = sanitized.substring(0, 4000);
  return sanitized;
}

// ── AI Audit Logger (Improvement #17) ──────────────────────
const AI_AUDIT_KEY = "crm:ai_audit_log";
async function logAIAudit(entry: { role: string; userId?: string; message: string; hasActions: boolean; model: string; timestamp: string }) {
  try {
    const log = (await kv.get(AI_AUDIT_KEY)) || [];
    log.unshift({
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...entry,
      messagePreview: entry.message.substring(0, 100),
    });
    if (log.length > 500) log.length = 500;
    await kvSet(AI_AUDIT_KEY, log, "ai-audit-log");
  } catch (e) {
    console.log("AI audit log error (non-fatal):", e);
  }
}

// Retry-wrapped KV write helper for transient connection errors
const kvSet = (key: string, value: any, label = "kv-set") =>
  withRetry(() => kv.set(key, value), label);
const kvDel = (key: string, label = "kv-del") =>
  withRetry(() => kv.del(key), label);

const app = new Hono();

// Supabase client for Storage operations
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Storage bucket name for document files
const DOC_BUCKET = "make-5cdc87b7-documents";

// Idempotently create private storage bucket on startup
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === DOC_BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(DOC_BUCKET, { public: false });
      console.log(`Created storage bucket: ${DOC_BUCKET}`);
    }
  } catch (err) {
    console.log("Storage bucket setup error (non-fatal):", err);
  }
})();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-session-token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Helper: safely truncate arrays to prevent payload size exceeding edge function limits
const MAX_CASES = 500;
const MAX_AUDIT_LOG = 300;
const MAX_NOTIFICATIONS = 100;
const MAX_ATTENDANCE = 500;
const MAX_LEAVE_REQUESTS = 200;
const MAX_PASSPORT_TRACKING = 300;
const MAX_CODE_HISTORY = 200;

function trimArray(data: any, max: number): any {
  if (!Array.isArray(data)) return data;
  return data.length > max ? data.slice(0, max) : data;
}

// Strip large embedded fields from cases to reduce payload size
function trimCases(cases: any): any {
  if (!Array.isArray(cases)) return cases;
  return cases.slice(0, MAX_CASES).map((c: any) => {
    const trimmed = { ...c };
    // Cap timeline/notes arrays per case
    if (Array.isArray(trimmed.timeline) && trimmed.timeline.length > 50) {
      trimmed.timeline = trimmed.timeline.slice(-50);
    }
    if (Array.isArray(trimmed.notes) && trimmed.notes.length > 50) {
      trimmed.notes = trimmed.notes.slice(-50);
    }
    return trimmed;
  });
}

// Helper: prefix all KV keys to avoid collisions
const KEY = {
  cases: "crm:cases",
  agents: "crm:agent_codes",
  adminProfile: "crm:admin_profile",
  agentProfile: (name: string) => `crm:agent_profile:${name}`,
  agentAvatar: (name: string) => `crm:agent_avatar:${name}`,
  settings: "crm:settings",
  codeHistory: "crm:code_history",
  notifications: "crm:notifications",
  attendance: (date: string) => `crm:attendance:${date}`,
  attendanceAll: "crm:attendance_all",
  leaveRequests: "crm:leave_requests",
  users: "crm:users_db",
  passportTracking: "crm:passport_tracking",
  auditLog: "crm:audit_log",
  documentFiles: "crm:document_files",
  meta: "crm:meta",
  operatorData: "crm:operator_data",
};

// ============================================================
// Health check (public — no auth needed)
// ============================================================
app.get("/make-server-5cdc87b7/health", (c) => {
  return c.json({ success: true, status: "ok", version: "2.1-softauth", timestamp: new Date().toISOString() });
});

// ============================================================
// AUTH ROUTES (public — Improvement #1)
// ============================================================
app.post("/make-server-5cdc87b7/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, role: requestedRole } = body;
    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }
    const users = (await kv.get(KEY.users)) || [];
    const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return c.json({ success: false, error: "User not found" }, 401);
    if (user.status !== "active") return c.json({ success: false, error: `Account is ${user.status}` }, 403);
    const hashedInput = await hashPw(password);
    if (user.password !== hashedInput) return c.json({ success: false, error: "Invalid password" }, 401);
    if (requestedRole && user.role !== requestedRole) {
      if (!(requestedRole === "admin" && user.role === "master_admin")) {
        return c.json({ success: false, error: `Not a ${requestedRole} account` }, 403);
      }
    }
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const session = await createSession(user.id, user.fullName, user.email, user.role, ip);
    const idx = users.findIndex((u: any) => u.id === user.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], lastLogin: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await kvSet(KEY.users, users, "login-update-user");
    }
    return c.json({
      success: true,
      data: { token: session.token, userId: session.userId, fullName: session.fullName, email: session.email, role: session.role, expiresAt: session.expiresAt },
    });
  } catch (err: any) {
    console.log("Auth login error:", err);
    return c.json({ success: false, error: `Login error: ${err?.message || err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/auth/validate", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) return c.json({ success: false, valid: false });
    const session = await validateSession(token);
    if (!session) return c.json({ success: true, valid: false });
    return c.json({ success: true, valid: true, data: { userId: session.userId, fullName: session.fullName, email: session.email, role: session.role, expiresAt: session.expiresAt } });
  } catch (err: any) {
    return c.json({ success: false, valid: false, error: `Validation error: ${err?.message || err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/auth/logout", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (token) await destroySession(token);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Logout error: ${err?.message || err}` }, 500);
  }
});

// ============================================================
// PASSWORD RESET — Forgot Password via Brevo Email
// ============================================================
const RESET_PREFIX = "crm:pw_reset:";
const RESET_TTL = 10 * 60 * 1000; // 10 minutes

const PW_SALT = "emerald-visa-crm-2024-salt-v1";
async function hashPw(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(PW_SALT + plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

app.post("/make-server-5cdc87b7/auth/forgot-password", rateLimiter(5), async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ success: false, error: "Email is required" }, 400);
    const users = (await kv.get(KEY.users)) || [];
    const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.log(`Password reset requested for unknown email: ${email}`);
      return c.json({ success: true, message: "If this email exists, a code was sent." });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + RESET_TTL;
    await kvSet(`${RESET_PREFIX}${email.toLowerCase()}`, { code, expiresAt, used: false }, "pw-reset-store");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      try {
        const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "accept": "application/json", "content-type": "application/json", "api-key": brevoKey },
          body: JSON.stringify({
            sender: { name: "Emerald Visa CRM", email: "noreply@emeraldvisa.com" },
            to: [{ email: user.email, name: user.fullName }],
            subject: "Password Reset Code - Emerald Visa CRM",
            htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#f8f9fa;border-radius:12px;"><div style="text-align:center;padding:20px 0;"><h2 style="color:#059669;margin:0;">Emerald Visa Consultancy</h2><p style="color:#6b7280;font-size:14px;">Password Reset Request</p></div><div style="background:white;padding:30px;border-radius:8px;text-align:center;"><p style="color:#374151;font-size:16px;">Hello <strong>${user.fullName}</strong>,</p><p style="color:#6b7280;font-size:14px;">Use this code to reset your password:</p><div style="background:#059669;color:white;font-size:32px;letter-spacing:8px;padding:20px;border-radius:8px;margin:20px 0;font-family:monospace;font-weight:bold;">${code}</div><p style="color:#9ca3af;font-size:12px;">This code expires in 10 minutes.</p><p style="color:#9ca3af;font-size:12px;">If you didn't request this, ignore this email.</p></div><p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:20px;">Emerald Visa Consultancy Service | Lahore, Pakistan</p></div>`,
          }),
        });
        if (!emailRes.ok) { const errBody = await emailRes.text(); console.log("Brevo email error:", errBody); }
        else { console.log(`Password reset code sent to ${email}`); }
      } catch (emailErr) { console.log("Brevo send error (non-fatal):", emailErr); }
    } else {
      console.log(`[WARN] BREVO_API_KEY not set. Reset code for ${email}: ${code}`);
    }
    return c.json({ success: true, message: "If this email exists, a code was sent." });
  } catch (err: any) {
    console.log("Forgot password error:", err);
    return c.json({ success: false, error: `Server error: ${err?.message || err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/auth/verify-reset-code", rateLimiter(10), async (c) => {
  try {
    const { email, code } = await c.req.json();
    if (!email || !code) return c.json({ success: false, error: "Email and code required" }, 400);
    const stored = await kv.get(`${RESET_PREFIX}${email.toLowerCase()}`) as any;
    if (!stored) return c.json({ success: false, error: "No reset request found. Request a new code." }, 400);
    if (stored.used) return c.json({ success: false, error: "Code already used. Request a new one." }, 400);
    if (Date.now() > stored.expiresAt) return c.json({ success: false, error: "Code expired. Request a new one." }, 400);
    if (stored.code !== code) return c.json({ success: false, error: "Invalid code" }, 400);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Verification error: ${err?.message || err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/auth/reset-password", rateLimiter(5), async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    if (!email || !code || !newPassword) return c.json({ success: false, error: "All fields required" }, 400);
    if (newPassword.length < 8) return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    const stored = await kv.get(`${RESET_PREFIX}${email.toLowerCase()}`) as any;
    if (!stored || stored.code !== code || stored.used || Date.now() > stored.expiresAt) {
      return c.json({ success: false, error: "Invalid or expired code" }, 400);
    }
    await kvSet(`${RESET_PREFIX}${email.toLowerCase()}`, { ...stored, used: true }, "pw-reset-used");
    const hashedPw = await hashPw(newPassword);
    const users = (await kv.get(KEY.users)) || [];
    const idx = users.findIndex((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (idx !== -1) {
      users[idx] = { ...users[idx], password: hashedPw, passwordChangedAt: new Date().toISOString(), mustChangePassword: false, updatedAt: new Date().toISOString() };
      await kvSet(KEY.users, users, "pw-reset-update-user");
      console.log(`Password reset completed for ${email}`);
    }
    return c.json({ success: true });
  } catch (err: any) {
    console.log("Password reset error:", err);
    return c.json({ success: false, error: `Reset error: ${err?.message || err}` }, 500);
  }
});

// ============================================================
// MIDDLEWARE WIRING — Improvement #1, #9
// Inline softAuth: attaches session info when available, NEVER blocks.
// This ensures offline-first data routes (/sync, /cases, etc.) always work
// even before a user has logged in.
// ============================================================
app.use("/make-server-5cdc87b7/*", async (c: any, next: () => Promise<void>) => {
  // Soft auth — attach session if token present, NEVER block
  const token = c.req.header("x-session-token");
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) c.set("session", session);
    } catch { /* non-fatal */ }
  }
  await next();
});
app.use("/make-server-5cdc87b7/ai/*", rateLimiter(10));
app.use("/make-server-5cdc87b7/backup/*", rateLimiter(10));

// ============================================================
// CASES
// ============================================================
app.get("/make-server-5cdc87b7/cases", async (c) => {
  try {
    const cases = await kv.get(KEY.cases);
    return c.json({ success: true, data: trimCases(cases) || [] });
  } catch (err) {
    console.log("Error fetching cases:", err);
    return c.json({ success: false, error: `Error fetching cases: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/cases", async (c) => {
  try {
    const body = await c.req.json();
    const cases = body.cases;
    if (!Array.isArray(cases)) {
      return c.json({ success: false, error: "cases must be an array" }, 400);
    }
    await kvSet(KEY.cases, trimCases(cases), "save-cases");
    return c.json({ success: true, count: cases.length });
  } catch (err) {
    console.log("Error saving cases:", err);
    return c.json({ success: false, error: `Error saving cases: ${err}` }, 500);
  }
});

app.put("/make-server-5cdc87b7/cases/:caseId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const updates = await c.req.json();
    // Improvement #4: Input validation
    const { valid, errors } = validateCaseFields(updates);
    if (!valid) {
      return c.json({ success: false, error: `Validation failed: ${errors.join("; ")}` }, 400);
    }
    const cases = (await kv.get(KEY.cases)) || [];
    const index = cases.findIndex((cs: any) => cs.id === caseId);
    if (index === -1) {
      return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
    }
    cases[index] = { ...cases[index], ...updates, updatedDate: new Date().toISOString() };
    await kvSet(KEY.cases, cases, "update-case");
    return c.json({ success: true, data: cases[index] });
  } catch (err) {
    console.log("Error updating case:", err);
    return c.json({ success: false, error: `Error updating case: ${err}` }, 500);
  }
});

app.delete("/make-server-5cdc87b7/cases/:caseId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const cases = (await kv.get(KEY.cases)) || [];
    const filtered = cases.filter((cs: any) => cs.id !== caseId);
    await kvSet(KEY.cases, filtered, "delete-case");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error deleting case:", err);
    return c.json({ success: false, error: `Error deleting case: ${err}` }, 500);
  }
});

// ============================================================
// AGENT ACCESS CODES
// ============================================================
app.get("/make-server-5cdc87b7/agent-codes", async (c) => {
  try {
    const codes = await kv.get(KEY.agents);
    return c.json({ success: true, data: codes || [] });
  } catch (err) {
    console.log("Error fetching agent codes:", err);
    return c.json({ success: false, error: `Error fetching agent codes: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/agent-codes", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.agents, body.codes, "save-agent-codes");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving agent codes:", err);
    return c.json({ success: false, error: `Error saving agent codes: ${err}` }, 500);
  }
});

// ============================================================
// CODE HISTORY
// ============================================================
app.get("/make-server-5cdc87b7/code-history", async (c) => {
  try {
    const history = await kv.get(KEY.codeHistory);
    return c.json({ success: true, data: trimArray(history, MAX_CODE_HISTORY) || [] });
  } catch (err) {
    console.log("Error fetching code history:", err);
    return c.json({ success: false, error: `Error fetching code history: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/code-history", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.codeHistory, body.history, "save-code-history");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving code history:", err);
    return c.json({ success: false, error: `Error saving code history: ${err}` }, 500);
  }
});

// ============================================================
// ADMIN PROFILE
// ============================================================
app.get("/make-server-5cdc87b7/admin-profile", async (c) => {
  try {
    const profile = await kv.get(KEY.adminProfile);
    return c.json({ success: true, data: profile });
  } catch (err) {
    console.log("Error fetching admin profile:", err);
    return c.json({ success: false, error: `Error fetching admin profile: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/admin-profile", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.adminProfile, body.profile, "save-admin-profile");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving admin profile:", err);
    return c.json({ success: false, error: `Error saving admin profile: ${err}` }, 500);
  }
});

// ============================================================
// AGENT PROFILE
// ============================================================
app.get("/make-server-5cdc87b7/agent-profile/:name", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const profile = await kv.get(KEY.agentProfile(name));
    return c.json({ success: true, data: profile });
  } catch (err) {
    console.log("Error fetching agent profile:", err);
    return c.json({ success: false, error: `Error fetching agent profile: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/agent-profile/:name", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const body = await c.req.json();
    await kvSet(KEY.agentProfile(name), body.profile, "save-agent-profile");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving agent profile:", err);
    return c.json({ success: false, error: `Error saving agent profile: ${err}` }, 500);
  }
});

// ============================================================
// AGENT AVATAR
// ============================================================
app.get("/make-server-5cdc87b7/agent-avatar/:name", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const avatar = await kv.get(KEY.agentAvatar(name));
    return c.json({ success: true, data: avatar });
  } catch (err) {
    console.log("Error fetching agent avatar:", err);
    return c.json({ success: false, error: `Error fetching agent avatar: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/agent-avatar/:name", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const body = await c.req.json();
    await kvSet(KEY.agentAvatar(name), body.avatar, "save-agent-avatar");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving agent avatar:", err);
    return c.json({ success: false, error: `Error saving agent avatar: ${err}` }, 500);
  }
});

// ============================================================
// SETTINGS
// ============================================================
app.get("/make-server-5cdc87b7/settings", async (c) => {
  try {
    const settings = await kv.get(KEY.settings);
    return c.json({ success: true, data: settings });
  } catch (err) {
    console.log("Error fetching settings:", err);
    return c.json({ success: false, error: `Error fetching settings: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/settings", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.settings, body.settings, "save-settings");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving settings:", err);
    return c.json({ success: false, error: `Error saving settings: ${err}` }, 500);
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================
app.get("/make-server-5cdc87b7/notifications", async (c) => {
  try {
    const notifs = await kv.get(KEY.notifications);
    return c.json({ success: true, data: trimArray(notifs, MAX_NOTIFICATIONS) || [] });
  } catch (err) {
    console.log("Error fetching notifications:", err);
    return c.json({ success: false, error: `Error fetching notifications: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/notifications", async (c) => {
  try {
    const body = await c.req.json();
    let notifications = body.notifications;

    // Ensure notifications is an array
    if (!Array.isArray(notifications)) {
      notifications = [];
    }

    // Trim to most recent 100 to prevent exceeding row size limits
    if (notifications.length > 100) {
      notifications = notifications.slice(0, 100);
    }

    // Strip excessively large metadata to prevent payload bloat
    notifications = notifications.map((n: any) => {
      if (n.metadata) {
        const metaStr = JSON.stringify(n.metadata);
        if (metaStr.length > 2000) {
          const { type, caseId, customerName, agentName, amount, status, approvalStatus, documentId, documentName } = n.metadata;
          n = { ...n, metadata: { type, caseId, customerName, agentName, amount, status, approvalStatus, documentId, documentName } };
        }
      }
      return n;
    });

    await kvSet(KEY.notifications, notifications, "save-notifications");
    return c.json({ success: true });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.log("Error saving notifications:", errMsg);
    return c.json({ success: false, error: `Error saving notifications: ${errMsg}` }, 500);
  }
});

// ============================================================
// USERS DATABASE
// ============================================================
app.get("/make-server-5cdc87b7/users", async (c) => {
  try {
    const users = await kv.get(KEY.users);
    return c.json({ success: true, data: users || [] });
  } catch (err) {
    console.log("Error fetching users:", err);
    return c.json({ success: false, error: `Error fetching users: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/users", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.users, body.users, "save-users");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving users:", err);
    return c.json({ success: false, error: `Error saving users: ${err}` }, 500);
  }
});

// ============================================================
// ATTENDANCE
// ============================================================
app.get("/make-server-5cdc87b7/attendance/:date", async (c) => {
  try {
    const date = c.req.param("date");
    const attendance = await kv.get(KEY.attendance(date));
    return c.json({ success: true, data: attendance || [] });
  } catch (err) {
    console.log("Error fetching attendance:", err);
    return c.json({ success: false, error: `Error fetching attendance: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/attendance/:date", async (c) => {
  try {
    const date = c.req.param("date");
    const body = await c.req.json();
    await kvSet(KEY.attendance(date), body.records, "save-attendance-date");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving attendance:", err);
    return c.json({ success: false, error: `Error saving attendance: ${err}` }, 500);
  }
});

// ============================================================
// ATTENDANCE - BULK (all records)
// ============================================================
app.get("/make-server-5cdc87b7/attendance-all", async (c) => {
  try {
    const records = await kv.get(KEY.attendanceAll);
    return c.json({ success: true, data: trimArray(records, MAX_ATTENDANCE) || [] });
  } catch (err) {
    console.log("Error fetching all attendance:", err);
    return c.json({ success: false, error: `Error fetching all attendance: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/attendance-all", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.attendanceAll, body.records, "save-attendance-all");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving all attendance:", err);
    return c.json({ success: false, error: `Error saving all attendance: ${err}` }, 500);
  }
});

// ============================================================
// LEAVE REQUESTS
// ============================================================
app.get("/make-server-5cdc87b7/leave-requests", async (c) => {
  try {
    const requests = await kv.get(KEY.leaveRequests);
    return c.json({ success: true, data: trimArray(requests, MAX_LEAVE_REQUESTS) || [] });
  } catch (err) {
    console.log("Error fetching leave requests:", err);
    return c.json({ success: false, error: `Error fetching leave requests: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/leave-requests", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.leaveRequests, body.requests, "save-leave-requests");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving leave requests:", err);
    return c.json({ success: false, error: `Error saving leave requests: ${err}` }, 500);
  }
});

// ============================================================
// BULK SYNC - upload/download all data at once
// ============================================================
app.get("/make-server-5cdc87b7/sync", async (c) => {
  try {
    const [cases, agentCodes, adminProfile, codeHistory, settings, notifications, users, attendance, leaveRequests, passportTracking, auditLog, documentFiles, meta] = await Promise.all([
      kv.get(KEY.cases),
      kv.get(KEY.agents),
      kv.get(KEY.adminProfile),
      kv.get(KEY.codeHistory),
      kv.get(KEY.settings),
      kv.get(KEY.notifications),
      kv.get(KEY.users),
      kv.get(KEY.attendanceAll),
      kv.get(KEY.leaveRequests),
      kv.get(KEY.passportTracking),
      kv.get(KEY.auditLog),
      kv.get(KEY.documentFiles),
      kv.get(KEY.meta),
    ]);
    return c.json({
      success: true,
      data: {
        cases: trimCases(cases) || null,
        agentCodes: agentCodes || null,
        adminProfile: adminProfile || null,
        codeHistory: trimArray(codeHistory, MAX_CODE_HISTORY) || null,
        settings: settings || null,
        notifications: trimArray(notifications, MAX_NOTIFICATIONS) || null,
        users: users || null,
        attendance: trimArray(attendance, MAX_ATTENDANCE) || null,
        leaveRequests: trimArray(leaveRequests, MAX_LEAVE_REQUESTS) || null,
        passportTracking: trimArray(passportTracking, MAX_PASSPORT_TRACKING) || null,
        auditLog: trimArray(auditLog, MAX_AUDIT_LOG) || null,
        documentFiles: (() => {
          // Cap document files metadata to prevent payload bloat
          if (!documentFiles) return null;
          const str = JSON.stringify(documentFiles);
          if (str.length > 100000) {
            console.log(`Warning: documentFiles metadata is ${(str.length / 1024).toFixed(0)}KB, omitting from sync`);
            return null;
          }
          return documentFiles;
        })(),
      },
      entityTimestamps: meta?.entityTimestamps || null,
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.log("Error during sync download:", errMsg);
    return c.json({ success: false, error: `Sync download error: ${errMsg}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/sync", async (c) => {
  try {
    const body = await c.req.json();
    const ops: Promise<void>[] = [];

    if (body.cases !== undefined) ops.push(kvSet(KEY.cases, trimCases(body.cases), "sync-cases"));
    if (body.agentCodes !== undefined) ops.push(kvSet(KEY.agents, body.agentCodes, "sync-agentCodes"));
    if (body.adminProfile !== undefined) ops.push(kvSet(KEY.adminProfile, body.adminProfile, "sync-adminProfile"));
    if (body.codeHistory !== undefined) ops.push(kvSet(KEY.codeHistory, trimArray(body.codeHistory, MAX_CODE_HISTORY), "sync-codeHistory"));
    if (body.settings !== undefined) ops.push(kvSet(KEY.settings, body.settings, "sync-settings"));
    if (body.notifications !== undefined) ops.push(kvSet(KEY.notifications, trimArray(body.notifications, MAX_NOTIFICATIONS), "sync-notifications"));
    if (body.users !== undefined) ops.push(kvSet(KEY.users, body.users, "sync-users"));
    if (body.attendance !== undefined) ops.push(kvSet(KEY.attendanceAll, trimArray(body.attendance, MAX_ATTENDANCE), "sync-attendance"));
    if (body.leaveRequests !== undefined) ops.push(kvSet(KEY.leaveRequests, trimArray(body.leaveRequests, MAX_LEAVE_REQUESTS), "sync-leaveRequests"));
    if (body.passportTracking !== undefined) ops.push(kvSet(KEY.passportTracking, trimArray(body.passportTracking, MAX_PASSPORT_TRACKING), "sync-passportTracking"));
    if (body.auditLog !== undefined) ops.push(kvSet(KEY.auditLog, trimArray(body.auditLog, MAX_AUDIT_LOG), "sync-auditLog"));
    if (body.documentFiles !== undefined) ops.push(kvSet(KEY.documentFiles, body.documentFiles, "sync-documentFiles"));

    await Promise.all(ops);

    // Track per-entity sync timestamps for conflict detection
    const now = new Date().toISOString();
    const existingMeta = (await kv.get(KEY.meta)) || {};
    const entityTimestamps: Record<string, string> = existingMeta.entityTimestamps || {};

    if (body.cases !== undefined) entityTimestamps.cases = now;
    if (body.agentCodes !== undefined) entityTimestamps.agentCodes = now;
    if (body.adminProfile !== undefined) entityTimestamps.adminProfile = now;
    if (body.codeHistory !== undefined) entityTimestamps.codeHistory = now;
    if (body.settings !== undefined) entityTimestamps.settings = now;
    if (body.notifications !== undefined) entityTimestamps.notifications = now;
    if (body.users !== undefined) entityTimestamps.users = now;
    if (body.attendance !== undefined) entityTimestamps.attendance = now;
    if (body.leaveRequests !== undefined) entityTimestamps.leaveRequests = now;
    if (body.passportTracking !== undefined) entityTimestamps.passportTracking = now;
    if (body.auditLog !== undefined) entityTimestamps.auditLog = now;
    if (body.documentFiles !== undefined) entityTimestamps.documentFiles = now;

    await kvSet(KEY.meta, { lastSync: now, source: "frontend", entityTimestamps }, "sync-meta");

    return c.json({ success: true, synced: ops.length });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.log("Error during sync upload:", errMsg);
    return c.json({ success: false, error: `Sync upload error: ${errMsg}` }, 500);
  }
});

// ============================================================
// OPERATOR DATA — sync operator-specific localStorage to cloud
// ============================================================
app.get("/make-server-5cdc87b7/operator-data", async (c) => {
  try {
    const data = await kv.get(KEY.operatorData);
    return c.json({ success: true, data: data || null });
  } catch (err) {
    console.log("Error fetching operator data:", err);
    return c.json({ success: false, error: `Error fetching operator data: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/operator-data", async (c) => {
  try {
    const body = await c.req.json();
    const opData = body.data;
    if (!opData || typeof opData !== "object") {
      return c.json({ success: false, error: "data must be an object" }, 400);
    }
    // Cap arrays to prevent payload bloat
    if (Array.isArray(opData.notifications) && opData.notifications.length > 100) {
      opData.notifications = opData.notifications.slice(0, 100);
    }
    if (Array.isArray(opData.payments) && opData.payments.length > 500) {
      opData.payments = opData.payments.slice(0, 500);
    }
    if (Array.isArray(opData.visits) && opData.visits.length > 500) {
      opData.visits = opData.visits.slice(0, 500);
    }
    if (Array.isArray(opData.attendance) && opData.attendance.length > 500) {
      opData.attendance = opData.attendance.slice(0, 500);
    }
    if (Array.isArray(opData.appointments) && opData.appointments.length > 500) {
      opData.appointments = opData.appointments.slice(0, 500);
    }
    opData.updatedAt = new Date().toISOString();
    await kvSet(KEY.operatorData, opData, "save-operator-data");
    return c.json({ success: true });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.log("Error saving operator data:", errMsg);
    return c.json({ success: false, error: `Error saving operator data: ${errMsg}` }, 500);
  }
});

// ============================================================
// GENERIC KV - get/set any key (for extensibility)
// ============================================================
app.get("/make-server-5cdc87b7/kv/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const value = await kv.get(`crm:${key}`);
    return c.json({ success: true, data: value });
  } catch (err) {
    console.log("Error in generic KV get:", err);
    return c.json({ success: false, error: `KV get error: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/kv/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const body = await c.req.json();
    await kvSet(`crm:${key}`, body.value, "generic-kv-set");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error in generic KV set:", err);
    return c.json({ success: false, error: `KV set error: ${err}` }, 500);
  }
});

// ============================================================
// VISAVERSE ANALYTICS - Cross-session persistence
// ============================================================
const VISAVERSE_ANALYTICS_KEY = "crm:visaverse_analytics";

app.get("/make-server-5cdc87b7/visaverse/analytics", async (c) => {
  try {
    const analytics = await kv.get(VISAVERSE_ANALYTICS_KEY);
    return c.json({ success: true, data: analytics || { events: [], featureUsage: {}, sessions: [] } });
  } catch (err) {
    console.log("Error fetching VisaVerse analytics:", err);
    return c.json({ success: false, error: `VisaVerse analytics get error: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/visaverse/analytics/event", async (c) => {
  try {
    const body = await c.req.json();
    const { featureKey, action, userId, userRole, caseId, metadata } = body;
    if (!featureKey || !action) {
      return c.json({ success: false, error: "featureKey and action are required" }, 400);
    }
    const existing = (await kv.get(VISAVERSE_ANALYTICS_KEY)) || { events: [], featureUsage: {}, sessions: [] };
    const event = {
      id: `VV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      featureKey, action, userId: userId || "anonymous", userRole: userRole || "unknown",
      caseId: caseId || null, metadata: metadata || {}, timestamp: new Date().toISOString(),
    };
    existing.events = [event, ...(existing.events || [])].slice(0, 500);
    if (!existing.featureUsage[featureKey]) {
      existing.featureUsage[featureKey] = { total: 0, byAction: {}, lastUsed: null };
    }
    existing.featureUsage[featureKey].total += 1;
    existing.featureUsage[featureKey].byAction[action] = (existing.featureUsage[featureKey].byAction[action] || 0) + 1;
    existing.featureUsage[featureKey].lastUsed = new Date().toISOString();
    await kvSet(VISAVERSE_ANALYTICS_KEY, existing, "visaverse-event");
    return c.json({ success: true, eventId: event.id });
  } catch (err) {
    console.log("Error tracking VisaVerse event:", err);
    return c.json({ success: false, error: `VisaVerse event tracking error: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/visaverse/sync", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, xp, badges, features, classicMode, satisfaction } = body;
    if (!userId) return c.json({ success: false, error: "userId is required" }, 400);
    await kvSet(`crm:visaverse_user:${userId}`, { xp, badges, features, classicMode, satisfaction, updatedAt: new Date().toISOString() }, "visaverse-sync");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error syncing VisaVerse state:", err);
    return c.json({ success: false, error: `VisaVerse sync error: ${err}` }, 500);
  }
});

app.get("/make-server-5cdc87b7/visaverse/sync/:userId", async (c) => {
  try {
    const userId = decodeURIComponent(c.req.param("userId"));
    const data = await kv.get(`crm:visaverse_user:${userId}`);
    return c.json({ success: true, data: data || null });
  } catch (err) {
    console.log("Error fetching VisaVerse state:", err);
    return c.json({ success: false, error: `VisaVerse fetch error: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/visaverse/mood", async (c) => {
  try {
    const body = await c.req.json();
    const { caseId, stage, rating, userId, userRole } = body;
    if (!caseId || !stage || !rating) return c.json({ success: false, error: "caseId, stage, and rating are required" }, 400);
    const moodKey = `crm:visaverse_mood:${caseId}`;
    const existing = (await kv.get(moodKey)) || { feedbacks: [] };
    existing.feedbacks.push({ stage, rating, userId: userId || "anonymous", userRole: userRole || "unknown", timestamp: new Date().toISOString() });
    if (existing.feedbacks.length > 50) existing.feedbacks = existing.feedbacks.slice(-50);
    await kvSet(moodKey, existing, "visaverse-mood");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving mood feedback:", err);
    return c.json({ success: false, error: `Mood feedback error: ${err}` }, 500);
  }
});

app.get("/make-server-5cdc87b7/visaverse/mood/:caseId", async (c) => {
  try {
    const caseId = decodeURIComponent(c.req.param("caseId"));
    const data = await kv.get(`crm:visaverse_mood:${caseId}`);
    return c.json({ success: true, data: data || { feedbacks: [] } });
  } catch (err) {
    console.log("Error fetching mood data:", err);
    return c.json({ success: false, error: `Mood fetch error: ${err}` }, 500);
  }
});

// ============================================================
// NUCLEAR PANIC MODE - Cross-Device Kill Switch
// ============================================================
const PANIC_KEY = "crm:panic_mode";

// Backup KV keys
const BACKUP_SETTINGS_KEY = "crm:backup_settings";
const BACKUP_HISTORY_KEY = "crm:backup_history";

// Trigger panic mode - sets server flag that ALL devices will detect
app.post("/make-server-5cdc87b7/api/panic/trigger", async (c) => {
  try {
    const timestamp = Date.now();
    await kvSet(PANIC_KEY, { active: true, timestamp }, "panic-trigger");
    console.log(`🚨 PANIC MODE TRIGGERED at ${new Date(timestamp).toISOString()}`);
    return c.json({ success: true, timestamp });
  } catch (err) {
    console.log("Error triggering panic mode:", err);
    return c.json({ success: false, error: `Panic trigger error: ${err}` }, 500);
  }
});

// Check panic mode status
app.get("/make-server-5cdc87b7/api/panic/status", async (c) => {
  try {
    const panicData = await kv.get(PANIC_KEY);
    const isActive = panicData?.active === true;
    return c.json({ 
      success: true, 
      active: isActive,
      timestamp: panicData?.timestamp || null
    });
  } catch (err) {
    console.log("Error checking panic status:", err);
    return c.json({ success: false, error: `Panic status error: ${err}` }, 500);
  }
});

// Clear panic mode - ONLY callable from login pages
app.post("/make-server-5cdc87b7/api/panic/clear", async (c) => {
  try {
    await kvSet(PANIC_KEY, { active: false, clearedAt: Date.now() }, "panic-clear");
    console.log(`✅ PANIC MODE CLEARED at ${new Date().toISOString()}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Error clearing panic mode:", err);
    return c.json({ success: false, error: `Panic clear error: ${err}` }, 500);
  }
});

// ============================================================
// DAILY BACKUP + BREVO EMAIL INTEGRATION
// ============================================================

// Get backup settings
app.get("/make-server-5cdc87b7/backup/settings", async (c) => {
  try {
    const settings = await kv.get(BACKUP_SETTINGS_KEY);
    return c.json({ success: true, data: settings || null });
  } catch (err) {
    console.log("Error fetching backup settings:", err);
    return c.json({ success: false, error: `Error fetching backup settings: ${err}` }, 500);
  }
});

// Save backup settings
app.post("/make-server-5cdc87b7/backup/settings", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(BACKUP_SETTINGS_KEY, body.settings, "save-backup-settings");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving backup settings:", err);
    return c.json({ success: false, error: `Error saving backup settings: ${err}` }, 500);
  }
});

// Get backup history
app.get("/make-server-5cdc87b7/backup/history", async (c) => {
  try {
    const history = await kv.get(BACKUP_HISTORY_KEY);
    return c.json({ success: true, data: history || [] });
  } catch (err) {
    console.log("Error fetching backup history:", err);
    return c.json({ success: false, error: `Error fetching backup history: ${err}` }, 500);
  }
});

// Send backup now - collects all data and emails via Brevo
app.post("/make-server-5cdc87b7/backup/send-now", async (c) => {
  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      return c.json({ success: false, error: "BREVO_API_KEY not configured. Please set up the Brevo API key." }, 400);
    }

    const body = await c.req.json();
    const recipients: string[] = body.recipients || [];
    const selectedContent: string[] = body.selectedContent || ["cases"];
    const format: string = body.format || "json";
    // backupType: "daily" | "weekly" | "monthly" | "auto"
    let backupType: string = body.backupType || "auto";

    if (recipients.length === 0) {
      return c.json({ success: false, error: "No recipient emails provided for backup delivery." }, 400);
    }

    // Auto-detect backup type based on current day
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri
    const dayOfMonth = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    if (backupType === "auto") {
      if (dayOfMonth === lastDayOfMonth) {
        backupType = "monthly";
      } else if (dayOfWeek === 5) { // Friday
        backupType = "weekly";
      } else {
        backupType = "daily";
      }
    }

    const isFullBackup = backupType === "weekly" || backupType === "monthly";

    // Collect data based on selected content
    const backupData: Record<string, any> = {};
    const collectOps: { key: string; kvKey: string }[] = [];

    if (selectedContent.includes("cases")) collectOps.push({ key: "cases", kvKey: KEY.cases });
    if (selectedContent.includes("payments")) collectOps.push({ key: "cases", kvKey: KEY.cases }); // payments from cases
    if (selectedContent.includes("documents")) collectOps.push({ key: "cases", kvKey: KEY.cases }); // doc metadata from cases
    if (selectedContent.includes("activity")) collectOps.push({ key: "notifications", kvKey: KEY.notifications });
    if (selectedContent.includes("vendors")) collectOps.push({ key: "settings", kvKey: KEY.settings });
    if (selectedContent.includes("medical")) collectOps.push({ key: "cases", kvKey: KEY.cases });
    if (selectedContent.includes("protector")) collectOps.push({ key: "cases", kvKey: KEY.cases });
    if (selectedContent.includes("attendance")) collectOps.push({ key: "attendance", kvKey: KEY.attendanceAll });

    // Deduplicate and fetch
    const uniqueKeys = [...new Set(collectOps.map(o => o.kvKey))];
    const results = await Promise.all(uniqueKeys.map(k => kv.get(k)));
    uniqueKeys.forEach((k, i) => {
      const label = collectOps.find(o => o.kvKey === k)?.key || k;
      // Apply trimming to known large entities
      if (label === "cases") {
        backupData[label] = trimCases(results[i]) || [];
      } else if (label === "notifications") {
        backupData[label] = trimArray(results[i], MAX_NOTIFICATIONS) || [];
      } else {
        backupData[label] = results[i] || [];
      }
    });

    // Also fetch users and agent codes for a complete backup
    const [users, agentCodes, adminProfile, leaveRequests] = await Promise.all([
      kv.get(KEY.users),
      kv.get(KEY.agents),
      kv.get(KEY.adminProfile),
      kv.get(KEY.leaveRequests),
    ]);
    backupData.users = users || [];
    backupData.agentCodes = agentCodes || [];
    backupData.adminProfile = adminProfile || null;
    backupData.leaveRequests = trimArray(leaveRequests, MAX_LEAVE_REQUESTS) || [];

    // Calculate stats
    const cases = backupData.cases || [];
    const totalCases = Array.isArray(cases) ? cases.length : 0;
    const today = new Date().toISOString().split("T")[0];
    const newCasesToday = Array.isArray(cases)
      ? cases.filter((c: any) => c.createdDate && c.createdDate.startsWith(today)).length
      : 0;
    const totalPayments = Array.isArray(cases)
      ? cases.reduce((sum: number, c: any) => sum + (c.paidAmount || 0), 0)
      : 0;
    const pendingPayments = Array.isArray(cases)
      ? cases.reduce((sum: number, c: any) => sum + ((c.totalFee || 0) - (c.paidAmount || 0)), 0)
      : 0;
    const activeCases = Array.isArray(cases)
      ? cases.filter((c: any) => c.status && !["completed", "cancelled", "rejected"].includes(c.status.toLowerCase())).length
      : 0;
    const completedCases = Array.isArray(cases)
      ? cases.filter((c: any) => c.status && c.status.toLowerCase() === "completed").length
      : 0;

    // Weekly stats: cases created this week (Mon-Sun)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const newCasesThisWeek = Array.isArray(cases)
      ? cases.filter((c: any) => c.createdDate && new Date(c.createdDate).getTime() >= weekStart.getTime()).length
      : 0;

    // Monthly stats: cases created this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newCasesThisMonth = Array.isArray(cases)
      ? cases.filter((c: any) => c.createdDate && new Date(c.createdDate).getTime() >= monthStart.getTime()).length
      : 0;

    // Attendance stats
    const attendanceData = backupData.attendance || [];
    const totalUsers = Array.isArray(backupData.users) ? backupData.users.length : 0;
    const totalAgents = Array.isArray(backupData.agentCodes) ? backupData.agentCodes.length : 0;

    const backupTimestamp = new Date().toISOString();

    // Build date/time strings (used by email and PDF)
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeFormatted = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // For full backups, include JSON data; for daily, only stats
    let backupJson = "";
    let backupSizeBytes = 0;
    let attachmentContent = ""; // base64 attachment for Brevo
    let attachmentName = "";
    
    if (isFullBackup) {
      backupJson = JSON.stringify(backupData, null, 2);
      backupSizeBytes = new TextEncoder().encode(backupJson).length;
    } else {
      // Daily: lightweight summary object
      const dailySummary = {
        reportType: "daily",
        date: today,
        stats: { totalCases, newCasesToday, activeCases, completedCases, totalPayments, pendingPayments, totalUsers, totalAgents },
      };
      backupJson = JSON.stringify(dailySummary, null, 2);
      backupSizeBytes = new TextEncoder().encode(backupJson).length;
    }

    // Preliminary size for use in PDF template
    let backupSizeKB = (backupSizeBytes / 1024).toFixed(1);
    let backupSizeMB = (backupSizeBytes / (1024 * 1024)).toFixed(2);

    // Generate PDF-style HTML report when format is "pdf"
    if (format === "pdf") {
      // Build a comprehensive cases table for full backups
      let casesTableHtml = "";
      if (isFullBackup && Array.isArray(cases) && cases.length > 0) {
        const caseRows = cases.map((cs: any, i: number) => `
          <tr style="${i % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;'}">
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${i + 1}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;font-weight:600;">${cs.clientName || cs.name || 'N/A'}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${cs.passportNumber || 'N/A'}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${cs.visaType || cs.type || 'N/A'}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${cs.status || 'N/A'}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:right;">PKR ${(cs.totalFee || 0).toLocaleString()}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:right;">PKR ${(cs.paidAmount || 0).toLocaleString()}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:right;">PKR ${((cs.totalFee || 0) - (cs.paidAmount || 0)).toLocaleString()}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${cs.agentName || 'Direct'}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${cs.createdDate ? new Date(cs.createdDate).toLocaleDateString() : 'N/A'}</td>
          </tr>`).join("");

        casesTableHtml = `
          <div style="margin-top:30px;page-break-before:auto;">
            <h2 style="color:#1e40af;font-size:16px;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #3b82f6;">📋 Cases Detail (${totalCases} Records)</h2>
            <table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;">
              <thead>
                <tr style="background:#1e40af;">
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">#</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Client Name</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Passport</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Visa Type</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Status</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:right;">Total Fee</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:right;">Paid</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:right;">Balance</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Agent</th>
                  <th style="padding:10px 8px;border:1px solid #1e3a8a;color:#fff;font-size:10px;text-align:left;">Created</th>
                </tr>
              </thead>
              <tbody>${caseRows}</tbody>
              <tfoot>
                <tr style="background:#1e3a8a;">
                  <td colspan="5" style="padding:10px;border:1px solid #1e3a8a;color:#fff;font-size:11px;font-weight:700;">TOTALS</td>
                  <td style="padding:10px;border:1px solid #1e3a8a;color:#fff;font-size:11px;font-weight:700;text-align:right;">PKR ${cases.reduce((s: number, c: any) => s + (c.totalFee || 0), 0).toLocaleString()}</td>
                  <td style="padding:10px;border:1px solid #1e3a8a;color:#fff;font-size:11px;font-weight:700;text-align:right;">PKR ${totalPayments.toLocaleString()}</td>
                  <td style="padding:10px;border:1px solid #1e3a8a;color:#fff;font-size:11px;font-weight:700;text-align:right;">PKR ${pendingPayments.toLocaleString()}</td>
                  <td colspan="2" style="padding:10px;border:1px solid #1e3a8a;color:#fff;font-size:11px;"></td>
                </tr>
              </tfoot>
            </table>
          </div>`;
      }

      // Build agents table
      let agentsTableHtml = "";
      if (isFullBackup && Array.isArray(backupData.agentCodes) && backupData.agentCodes.length > 0) {
        const agentRows = backupData.agentCodes.map((ag: any, i: number) => `
          <tr style="${i % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;'}">
            <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;">${i + 1}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;font-weight:600;">${ag.name || ag.agentName || 'N/A'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;">${ag.code || 'N/A'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;">${ag.status || ag.active !== false ? 'Active' : 'Inactive'}</td>
          </tr>`).join("");

        agentsTableHtml = `
          <div style="margin-top:24px;">
            <h2 style="color:#0891b2;font-size:16px;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #06b6d4;">👥 Agent Codes (${backupData.agentCodes.length})</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#0891b2;">
                  <th style="padding:8px;border:1px solid #0e7490;color:#fff;font-size:10px;text-align:left;">#</th>
                  <th style="padding:8px;border:1px solid #0e7490;color:#fff;font-size:10px;text-align:left;">Agent Name</th>
                  <th style="padding:8px;border:1px solid #0e7490;color:#fff;font-size:10px;text-align:left;">Code</th>
                  <th style="padding:8px;border:1px solid #0e7490;color:#fff;font-size:10px;text-align:left;">Status</th>
                </tr>
              </thead>
              <tbody>${agentRows}</tbody>
            </table>
          </div>`;
      }

      const pdfReportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Emerald Visa CRM — ${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup Report — ${today}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }
  </style>
</head>
<body>
  <!-- Print instruction banner -->
  <div class="no-print" style="background:#eff6ff;padding:12px 20px;text-align:center;border-bottom:2px solid #3b82f6;font-size:13px;color:#1e40af;">
    <strong>💡 To save as PDF:</strong> Press <kbd style="background:#fff;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;">Ctrl+P</kbd> (or <kbd style="background:#fff;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;">⌘+P</kbd> on Mac) → Destination: <strong>Save as PDF</strong> → Save
  </div>

  <div style="max-width:900px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1e40af;">
      <h1 style="color:#1e40af;font-size:28px;margin:0 0 4px 0;">💎 Emerald Visa Consultancy Service</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup Report</p>
      <p style="color:#94a3b8;font-size:12px;margin:0;">Generated: ${dateFormatted} at ${timeFormatted}</p>
    </div>

    <!-- Summary Card -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h2 style="color:#1e40af;font-size:18px;margin:0 0 16px 0;">📊 Summary Overview</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 16px;width:50%;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Total Cases</span><br/><strong style="font-size:20px;color:#1e293b;">${totalCases}</strong></td>
          <td style="padding:10px 16px;width:50%;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">New Cases Today</span><br/><strong style="font-size:20px;color:#1e293b;">${newCasesToday}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Active Cases</span><br/><strong style="font-size:20px;color:#059669;">${activeCases}</strong></td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Completed Cases</span><br/><strong style="font-size:20px;color:#6366f1;">${completedCases}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Total Payments Received</span><br/><strong style="font-size:20px;color:#059669;">PKR ${totalPayments.toLocaleString()}</strong></td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Pending Payments</span><br/><strong style="font-size:20px;color:#dc2626;">PKR ${pendingPayments.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;"><span style="color:#64748b;font-size:13px;">Total Users</span><br/><strong style="font-size:20px;color:#1e293b;">${totalUsers}</strong></td>
          <td style="padding:10px 16px;"><span style="color:#64748b;font-size:13px;">Total Agents</span><br/><strong style="font-size:20px;color:#1e293b;">${totalAgents}</strong></td>
        </tr>
        ${backupType === "weekly" || backupType === "monthly" ? `
        <tr>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">New Cases This Week</span><br/><strong style="font-size:20px;color:#0891b2;">${newCasesThisWeek}</strong></td>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">New Cases This Month</span><br/><strong style="font-size:20px;color:#7c3aed;">${newCasesThisMonth}</strong></td>
        </tr>` : ""}
      </table>
    </div>

    ${casesTableHtml}
    ${agentsTableHtml}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        Emerald Visa Consultancy Service — Automated Backup System<br/>
        Report Size: ${backupSizeKB} KB | Format: PDF Report | Type: ${backupType.charAt(0).toUpperCase() + backupType.slice(1)}<br/>
        This report was generated automatically on ${dateFormatted} at ${timeFormatted}
      </p>
    </div>
  </div>
</body>
</html>`;

      const pdfBytes = new TextEncoder().encode(pdfReportHtml);
      // Use chunked btoa to avoid "Maximum call stack size exceeded" on large reports
      let binaryStr = "";
      const chunkSize = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        const chunk = pdfBytes.subarray(i, i + chunkSize);
        binaryStr += String.fromCharCode(...chunk);
      }
      attachmentContent = btoa(binaryStr);
      attachmentName = `Emerald-CRM-${backupType}-backup-${today}.html`;
      // Update size to reflect the PDF report
      backupSizeBytes = pdfBytes.length;
      backupSizeKB = (backupSizeBytes / 1024).toFixed(1);
      backupSizeMB = (backupSizeBytes / (1024 * 1024)).toFixed(2);
    }

    const typeLabel = backupType === "monthly" ? "📅 Monthly Full Backup" : backupType === "weekly" ? "📆 Weekly Full Backup" : "📊 Daily Summary Report";
    const typeColor = backupType === "monthly" ? "#7c3aed" : backupType === "weekly" ? "#0891b2" : "#1e40af";
    const typeBgGradient = backupType === "monthly"
      ? "linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #a78bfa 100%)"
      : backupType === "weekly"
        ? "linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #22d3ee 100%)"
        : "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)";

    // Build stats rows for email
    let statsRowsHtml = `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📋 Total Cases</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${totalCases}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">🆕 New Cases Today</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${newCasesToday}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">✅ Active Cases</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${activeCases}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">🏁 Completed Cases</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${completedCases}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">💰 Total Payments</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">PKR ${totalPayments.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">⏳ Pending Payments</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">PKR ${pendingPayments.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">👥 Total Users / Agents</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${totalUsers} / ${totalAgents}</td>
      </tr>`;

    // Add weekly/monthly-specific stats
    if (backupType === "weekly" || backupType === "monthly") {
      statsRowsHtml += `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📆 New Cases This Week</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${newCasesThisWeek}</td>
      </tr>`;
    }
    if (backupType === "monthly") {
      statsRowsHtml += `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📅 New Cases This Month</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${newCasesThisMonth}</td>
      </tr>`;
    }

    statsRowsHtml += `
      <tr>
        <td style="padding: 10px 12px; color: #64748b; font-size: 14px;">📦 Backup Size</td>
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${backupSizeKB} KB</td>
      </tr>`;

    // Full data section (only for weekly/monthly)
    const fullDataSection = isFullBackup ? `
          <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #475569; font-size: 14px; margin: 0 0 8px 0;">📋 Complete Backup Data (JSON)</h3>
            <pre style="background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 11px; overflow: auto; max-height: 300px; white-space: pre-wrap; word-wrap: break-word;">${backupJson.length > 20000 ? backupJson.substring(0, 20000) + "\n\n... [truncated - full data in attached file]" : backupJson}</pre>
          </div>` : `
          <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #bbf7d0;">
            <p style="color: #166534; font-size: 13px; margin: 0;">
              <strong>ℹ️ Daily Summary Only</strong> — Full data backup with complete JSON is sent every <strong>Friday (Weekly)</strong> and on the <strong>last day of each month (Monthly)</strong>.
            </p>
          </div>`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: ${typeBgGradient}; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">💎 Emerald Visa CRM</h1>
          <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0 0 4px 0;">${typeLabel}</p>
          <p style="color: rgba(255,255,255,0.65); font-size: 12px; margin: 0;">${dateFormatted}</p>
        </div>

        <div style="padding: 24px;">
          <div style="background: #ffffff; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h2 style="color: ${typeColor}; font-size: 18px; margin: 0 0 16px 0;">${typeLabel}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${statsRowsHtml}
            </table>
          </div>

          <div style="background: #eff6ff; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #bfdbfe;">
            <p style="color: #1e40af; font-size: 13px; margin: 0;">
              <strong>📅 Generated:</strong> ${dateFormatted} at ${timeFormatted}<br/>
              <strong>🔄 Type:</strong> ${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup<br/>
              <strong>📦 Format:</strong> ${format.toUpperCase()}${format === "pdf" ? "<br/><strong>📎 PDF report is attached to this email — open and print/save as PDF</strong>" : isFullBackup ? "<br/><strong>📎 Full backup data is attached below as inline JSON</strong>" : ""}
            </p>
          </div>

          ${fullDataSection}

          <div style="background: #ffffff; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #475569; font-size: 13px; margin: 0 0 8px 0;">🗓️ Backup Schedule</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 6px 8px; color: #1e40af;">📊 Daily</td>
                <td style="padding: 6px 8px; color: #475569;">Summary report with key metrics</td>
              </tr>
              <tr>
                <td style="padding: 6px 8px; color: #0891b2;">📆 Weekly (Fri)</td>
                <td style="padding: 6px 8px; color: #475569;">Full data backup with complete JSON</td>
              </tr>
              <tr>
                <td style="padding: 6px 8px; color: #7c3aed;">📅 Monthly (Last day)</td>
                <td style="padding: 6px 8px; color: #475569;">Full data backup with complete JSON</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="background: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Emerald Visa Consultancy Service — Automated Backup System<br/>
            This email was sent automatically. Do not reply.
          </p>
        </div>
      </div>
    `;

    // Email subject based on type
    const subjectPrefix = backupType === "monthly"
      ? `Monthly Full Backup`
      : backupType === "weekly"
        ? `Weekly Full Backup`
        : `Daily Summary`;

    // Send via Brevo API
    const toRecipients = recipients.map((email: string) => ({ email: email.trim() }));

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Emerald Visa CRM", email: "info@emeraldconsultancycompany.com" },
        to: toRecipients,
        subject: `Emerald Visa CRM - ${subjectPrefix} [${today}]`,
        htmlContent: emailHtml,
        attachment: attachmentContent ? [
          {
            name: attachmentName,
            content: attachmentContent,
          }
        ] : undefined,
      }),
    });

    let brevoResult: any;
    try {
      brevoResult = await brevoResponse.json();
    } catch {
      brevoResult = { status: brevoResponse.status };
    }

    if (!brevoResponse.ok) {
      console.log(`Brevo API error (HTTP ${brevoResponse.status}):`, JSON.stringify(brevoResult));
      console.log(`Brevo error details — code: ${brevoResult.code}, message: ${brevoResult.message}`);

      // Build detailed user-facing error
      let userError = `Brevo email failed (HTTP ${brevoResponse.status})`;
      if (brevoResponse.status === 401) {
        userError = "Brevo API key is invalid or expired. Go to https://app.brevo.com/settings/keys/api to get a new key.";
      } else if (brevoResponse.status === 403) {
        userError = "Brevo account permission denied. Check if sender email is verified at https://app.brevo.com/senders/domain/list";
      } else if (brevoResult.message) {
        userError = `Brevo: ${brevoResult.message}`;
      }

      // Save failed entry to history
      const history = (await kv.get(BACKUP_HISTORY_KEY)) || [];
      history.unshift({
        id: `backup-${Date.now()}`,
        timestamp: backupTimestamp,
        status: "failed",
        error: userError,
        sizeKB: backupSizeKB,
        format,
        recipients,
        contentTypes: selectedContent,
        backupType,
      });
      await kvSet(BACKUP_HISTORY_KEY, history.slice(0, 100), "backup-history-failed");
      return c.json({
        success: false,
        error: userError,
        brevoStatus: brevoResponse.status,
        brevoCode: brevoResult.code || null,
        brevoMessage: brevoResult.message || null,
      }, 502);
    }

    // Save successful entry to history
    const history = (await kv.get(BACKUP_HISTORY_KEY)) || [];
    history.unshift({
      id: `backup-${Date.now()}`,
      timestamp: backupTimestamp,
      status: "success",
      sizeKB: backupSizeKB,
      sizeMB: backupSizeMB,
      format,
      recipients,
      contentTypes: selectedContent,
      totalCases,
      newCasesToday,
      totalPayments,
      backupType,
      brevoMessageId: brevoResult.messageId || null,
    });
    // Keep only last 100 entries
    await kvSet(BACKUP_HISTORY_KEY, history.slice(0, 100), "backup-history-success");

    console.log(`✅ [${backupType.toUpperCase()}] Backup email sent to ${recipients.join(", ")} at ${backupTimestamp} (${backupSizeKB} KB)`);

    return c.json({
      success: true,
      data: {
        timestamp: backupTimestamp,
        sizeKB: backupSizeKB,
        recipients,
        totalCases,
        newCasesToday,
        totalPayments,
        backupType,
        isFullBackup,
        messageId: brevoResult.messageId,
      },
    });
  } catch (err) {
    console.log("Error sending backup:", err);
    return c.json({ success: false, error: `Error sending backup email: ${err}` }, 500);
  }
});

// ============================================================
// BREVO DIAGNOSTIC TEST ENDPOINT
// ============================================================
app.post("/make-server-5cdc87b7/backup/test-brevo", async (c) => {
  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    // Step 1: Check if key exists
    if (!brevoApiKey) {
      return c.json({
        success: false,
        error: "BREVO_API_KEY not found in environment variables.",
        diagnosis: "KEY_MISSING",
        fix: "Add your Brevo API key in Supabase secrets.",
      }, 400);
    }

    const keyPreview = brevoApiKey.substring(0, 8) + "..." + brevoApiKey.substring(brevoApiKey.length - 4);
    console.log(`Brevo test: key preview = ${keyPreview}, length = ${brevoApiKey.length}`);

    // Step 2: Validate key by calling Brevo account info
    const accountRes = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
      },
    });

    let accountData: any;
    try { accountData = await accountRes.json(); } catch { accountData = { status: accountRes.status }; }

    if (!accountRes.ok) {
      console.log("Brevo account check failed:", JSON.stringify(accountData));
      return c.json({
        success: false,
        error: `Brevo API key invalid or expired (HTTP ${accountRes.status}).`,
        diagnosis: "KEY_INVALID",
        brevoError: accountData.message || accountData.code || `HTTP ${accountRes.status}`,
        fix: "Go to https://app.brevo.com/settings/keys/api → generate a new API key → update the BREVO_API_KEY secret.",
        keyPreview,
      }, 401);
    }

    // Step 3: Check senders
    const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
      },
    });

    let sendersData: any;
    try { sendersData = await sendersRes.json(); } catch { sendersData = {}; }

    const senders = sendersData.senders || [];
    const activeSenders = senders.filter((s: any) => s.active);
    const ourSender = "info@emeraldconsultancycompany.com";
    const senderVerified = activeSenders.some((s: any) => s.email?.toLowerCase() === ourSender.toLowerCase());

    // Step 4: Check email credits
    const credits = accountData.plan?.[0]?.credits || 0;
    const creditsType = accountData.plan?.[0]?.type || "unknown";

    // Step 5: Try sending a test email if provided
    const body = await c.req.json().catch(() => ({}));
    const testEmail = body.testEmail || "";

    let sendResult: any = null;
    let sendStatus = "skipped";

    if (testEmail && senderVerified) {
      const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Emerald Visa CRM", email: ourSender },
          to: [{ email: testEmail.trim() }],
          subject: "✅ Emerald CRM - Brevo Test Email",
          htmlContent: `<div style="font-family:Arial;padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
            <h2 style="color:#166534;">✅ Brevo Email Test Successful!</h2>
            <p style="color:#15803d;">Your Brevo API is working correctly with Emerald Visa CRM.</p>
            <p style="color:#6b7280;font-size:12px;">Test sent at: ${new Date().toISOString()}</p>
          </div>`,
        }),
      });

      try { sendResult = await sendRes.json(); } catch { sendResult = { status: sendRes.status }; }
      sendStatus = sendRes.ok ? "sent" : "failed";
      console.log(`Brevo test send (${sendStatus}):`, JSON.stringify(sendResult));
    }

    return c.json({
      success: true,
      data: {
        keyValid: true,
        keyPreview,
        accountEmail: accountData.email || "unknown",
        companyName: accountData.companyName || "unknown",
        senderVerified,
        senderEmail: ourSender,
        activeSenders: activeSenders.map((s: any) => s.email),
        credits,
        creditsType,
        testEmailStatus: sendStatus,
        testEmailResult: sendResult,
        diagnosis: !senderVerified
          ? "SENDER_NOT_VERIFIED"
          : credits <= 0
            ? "NO_CREDITS"
            : "ALL_OK",
        fix: !senderVerified
          ? `The sender email "${ourSender}" is NOT verified in Brevo. Go to https://app.brevo.com/senders/domain/list → Add & verify this sender email.`
          : credits <= 0
            ? "Your Brevo account has 0 email credits. Upgrade your plan or wait for daily reset."
            : "Everything looks good! Brevo should be working.",
      },
    });
  } catch (err: any) {
    console.log("Brevo diagnostic error:", err);
    return c.json({ success: false, error: `Brevo test error: ${err?.message || err}` }, 500);
  }
});

// Delete backup history entry
app.delete("/make-server-5cdc87b7/backup/history/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const history = (await kv.get(BACKUP_HISTORY_KEY)) || [];
    const filtered = history.filter((h: any) => h.id !== id);
    await kvSet(BACKUP_HISTORY_KEY, filtered, "backup-history-delete");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error deleting backup history entry:", err);
    return c.json({ success: false, error: `Error deleting backup history: ${err}` }, 500);
  }
});

// Clear old backup history (auto-delete > 90 days)
app.post("/make-server-5cdc87b7/backup/cleanup", async (c) => {
  try {
    const history = (await kv.get(BACKUP_HISTORY_KEY)) || [];
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const filtered = history.filter((h: any) => new Date(h.timestamp).getTime() > cutoff);
    const removed = history.length - filtered.length;
    await kvSet(BACKUP_HISTORY_KEY, filtered, "backup-history-cleanup");
    return c.json({ success: true, removed });
  } catch (err) {
    console.log("Error cleaning up backup history:", err);
    return c.json({ success: false, error: `Error cleaning up backup history: ${err}` }, 500);
  }
});

// Auto-export email — triggered by periodic sync, sends full data dump via Brevo
app.post("/make-server-5cdc87b7/backup/auto-export", async (c) => {
  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      return c.json({ success: false, error: "BREVO_API_KEY not configured" }, 400);
    }

    const body = await c.req.json();
    const recipients: string[] = body.recipients || [];
    if (recipients.length === 0) {
      return c.json({ success: false, error: "No recipients specified" }, 400);
    }

    // Collect all data from KV store
    const [cases, agentCodes, adminProfile, settings, notifications, users,
           attendance, leaveRequests, passportTracking, auditLog, documentFiles] = await Promise.all([
      kv.get(KEY.cases),
      kv.get(KEY.agents),
      kv.get(KEY.adminProfile),
      kv.get(KEY.settings),
      kv.get(KEY.notifications),
      kv.get(KEY.users),
      kv.get(KEY.attendanceAll),
      kv.get(KEY.leaveRequests),
      kv.get(KEY.passportTracking),
      kv.get(KEY.auditLog),
      kv.get(KEY.documentFiles),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0-auto",
      source: "auto-export",
      data: {
        Cases: trimCases(cases) || [],
        "Agent Codes": agentCodes || [],
        "Admin Profile": adminProfile || null,
        Settings: settings || null,
        Notifications: trimArray(notifications, MAX_NOTIFICATIONS) || [],
        Users: users || [],
        Attendance: trimArray(attendance, MAX_ATTENDANCE) || [],
        "Leave Requests": trimArray(leaveRequests, MAX_LEAVE_REQUESTS) || [],
        "Passport Tracking": trimArray(passportTracking, MAX_PASSPORT_TRACKING) || [],
        "Audit Log": trimArray(auditLog, MAX_AUDIT_LOG) || [],
        "Document Files (metadata)": documentFiles || null,
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const jsonBytes = new TextEncoder().encode(json);
    const sizeKB = Math.round(jsonBytes.length / 1024);
    // Use chunked btoa to avoid "Maximum call stack size exceeded" on large payloads
    let binaryStr = "";
    const chunkSize = 8192;
    for (let i = 0; i < jsonBytes.length; i += chunkSize) {
      const chunk = jsonBytes.subarray(i, i + chunkSize);
      binaryStr += String.fromCharCode(...chunk);
    }
    const base64Content = btoa(binaryStr);
    const today = new Date().toISOString().split("T")[0];
    const casesCount = Array.isArray(cases) ? cases.length : 0;

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">Emerald Visa CRM - Auto Export</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">Scheduled full data export</p>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <table style="width:100%;font-size:13px;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;">${today}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Total Cases</td><td style="padding:6px 0;font-weight:600;">${casesCount}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Export Size</td><td style="padding:6px 0;font-weight:600;">${sizeKB} KB</td></tr>
          </table>
          <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
            The full CRM data export is attached as a JSON file. Import it via the Data Storage panel to restore.
          </p>
        </div>
      </div>`;

    const toRecipients = recipients.map((email: string) => ({ email: email.trim() }));
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Emerald Visa CRM", email: "info@emeraldconsultancycompany.com" },
        to: toRecipients,
        subject: `Emerald Visa CRM - Auto Export [${today}]`,
        htmlContent: emailHtml,
        attachment: [{
          name: `emerald-crm-auto-export-${today}.json`,
          content: base64Content,
        }],
      }),
    });

    if (!brevoResponse.ok) {
      let errMsg = `Brevo HTTP ${brevoResponse.status}`;
      try { const errJson = await brevoResponse.json(); errMsg = errJson.message || errMsg; } catch { /* ignore */ }
      console.log("Auto-export Brevo error:", errMsg);
      return c.json({ success: false, error: errMsg }, 502);
    }

    // Track in backup history
    const history = (await kv.get(BACKUP_HISTORY_KEY)) || [];
    history.unshift({
      id: `auto-export-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "success",
      sizeKB,
      format: "json",
      recipients,
      contentTypes: ["all"],
      backupType: "auto-export",
    });
    await kvSet(BACKUP_HISTORY_KEY, history.slice(0, 100), "auto-export-history");

    // Track last auto-export time
    await kvSet("crm:last_auto_export", new Date().toISOString(), "auto-export-timestamp");

    console.log(`Auto-export sent to ${recipients.join(", ")} (${sizeKB} KB)`);
    return c.json({ success: true, sizeKB, timestamp: new Date().toISOString() });
  } catch (err) {
    console.log("Auto-export error:", err);
    return c.json({ success: false, error: `Auto-export error: ${err}` }, 500);
  }
});

// ============================================================
// PASSPORT TRACKING
// ============================================================
app.get("/make-server-5cdc87b7/passport-tracking", async (c) => {
  try {
    const data = await kv.get(KEY.passportTracking);
    return c.json({ success: true, data: trimArray(data, MAX_PASSPORT_TRACKING) || [] });
  } catch (err) {
    console.log("Error fetching passport tracking:", err);
    return c.json({ success: false, error: `Error fetching passport tracking: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/passport-tracking", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.passportTracking, body.trackings, "save-passport-tracking");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving passport tracking:", err);
    return c.json({ success: false, error: `Error saving passport tracking: ${err}` }, 500);
  }
});

// ============================================================
// AUDIT LOG
// ============================================================
app.get("/make-server-5cdc87b7/audit-log", async (c) => {
  try {
    const data = await kv.get(KEY.auditLog);
    return c.json({ success: true, data: trimArray(data, MAX_AUDIT_LOG) || [] });
  } catch (err) {
    console.log("Error fetching audit log:", err);
    return c.json({ success: false, error: `Error fetching audit log: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/audit-log", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.auditLog, trimArray(body.entries, MAX_AUDIT_LOG), "save-audit-log");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving audit log:", err);
    return c.json({ success: false, error: `Error saving audit log: ${err}` }, 500);
  }
});

// ============================================================
// DOCUMENT FILES (metadata index, not binary data)
// ============================================================
app.get("/make-server-5cdc87b7/document-files", async (c) => {
  try {
    const data = await kv.get(KEY.documentFiles);
    return c.json({ success: true, data: data || {} });
  } catch (err) {
    console.log("Error fetching document files:", err);
    return c.json({ success: false, error: `Error fetching document files: ${err}` }, 500);
  }
});

app.post("/make-server-5cdc87b7/document-files", async (c) => {
  try {
    const body = await c.req.json();
    await kvSet(KEY.documentFiles, body.files, "save-document-files");
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving document files:", err);
    return c.json({ success: false, error: `Error saving document files: ${err}` }, 500);
  }
});

// ============================================================
// DOCUMENT STORAGE (Supabase Storage for large files > 500KB)
// ============================================================

// Upload a document file to Supabase Storage
app.post("/make-server-5cdc87b7/storage/documents/upload", async (c) => {
  try {
    const body = await c.req.json();
    const { docId, fileName, mimeType, base64Data } = body;

    if (!docId || !fileName || !base64Data) {
      return c.json({ success: false, error: "Missing required fields: docId, fileName, base64Data" }, 400);
    }

    // Decode base64 to binary
    const dataUrlMatch = base64Data.match(/^data:[^;]+;base64,(.+)$/);
    const rawBase64 = dataUrlMatch ? dataUrlMatch[1] : base64Data;
    const binaryStr = atob(rawBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const storagePath = `${docId}/${fileName}`;

    const { error } = await supabase.storage
      .from(DOC_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mimeType || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      console.log("Storage upload error:", error);
      return c.json({ success: false, error: `Storage upload failed: ${error.message}` }, 500);
    }

    console.log(`Uploaded document ${docId}/${fileName} (${bytes.length} bytes)`);
    return c.json({ success: true, data: { path: storagePath, storagePath, size: bytes.length } });
  } catch (err) {
    console.log("Error uploading document to storage:", err);
    return c.json({ success: false, error: `Document upload error: ${err}` }, 500);
  }
});

// Get a signed URL for downloading a document
app.get("/make-server-5cdc87b7/storage/documents/:docId/:fileName", async (c) => {
  try {
    const docId = decodeURIComponent(c.req.param("docId"));
    const fileName = decodeURIComponent(c.req.param("fileName"));
    const storagePath = `${docId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(DOC_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
      console.log("Storage signed URL error:", error);
      return c.json({ success: false, error: `Could not create signed URL: ${error.message}` }, 500);
    }

    return c.json({ success: true, data: { signedUrl: data.signedUrl } });
  } catch (err) {
    console.log("Error creating signed URL:", err);
    return c.json({ success: false, error: `Signed URL error: ${err}` }, 500);
  }
});

// Delete a document from storage
app.delete("/make-server-5cdc87b7/storage/documents/:docId/:fileName", async (c) => {
  try {
    const docId = decodeURIComponent(c.req.param("docId"));
    const fileName = decodeURIComponent(c.req.param("fileName"));
    const storagePath = `${docId}/${fileName}`;

    const { error } = await supabase.storage
      .from(DOC_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.log("Storage delete error:", error);
      return c.json({ success: false, error: `Storage delete failed: ${error.message}` }, 500);
    }

    return c.json({ success: true });
  } catch (err) {
    console.log("Error deleting document from storage:", err);
    return c.json({ success: false, error: `Document delete error: ${err}` }, 500);
  }
});

// ============================================================
// AI CHAT (via StepFun/OpenRouter) - Dynamic LLM conversations for visa consultancy
// ============================================================
const MAX_AI_HISTORY = 20;

app.post("/make-server-5cdc87b7/ai/chat", async (c) => {
  try {
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return c.json({ success: false, error: "OPENROUTER_API_KEY not configured. Please set your OpenRouter API key in secrets." }, 400);
    }

    console.log(`OpenRouter API: key loaded (prefix: ${openrouterKey.substring(0, 10)}..., length: ${openrouterKey.length})`);

    const body = await c.req.json();
    const { message, role, language, conversationHistory, crmContext } = body;

    if (!message || !role) {
      return c.json({ success: false, error: "message and role are required fields for AI chat" }, 400);
    }

    // Improvement #3: Sanitize user input to mitigate prompt injection
    const sanitizedMessage = sanitizeAIInput(message);

    const lang = language || "ur";

    const roleDescriptions: Record<string, string> = {
      admin: `آپ ایمرالڈ ویزا کنسلٹنسی سروس کے ایڈمن کے AI اسسٹنٹ ہیں۔
آپ کا نام "ایمرالڈ AI" (Emerald AI) ہے۔ آپ ہمیشہ اردو میں جواب دیں گے (اردو رسم الخط میں)۔

🎯 صلاحیتیں:
✅ سوالات کے جوابات: ورک فلو رہنمائی، پالیسی، CRM نیویگیشن
✅ CRM ایکشنز: کیسز تلاش، اسٹیٹس اپڈیٹ، ادائیگی ریکارڈ، نوٹ شامل، نیا کیس
✅ ڈیٹا تجزیہ: کیس پیٹرن، تاخیر کی نشاندہی، بہتری کی تجاویز
✅ پیشن گوئی: خطرات، اگلے بہترین اقدامات، ٹائم لائن اندازہ
✅ مواد تخلیق: واٹس ایپ پیغامات، رپورٹس، خلاصے
✅ ایسکیلیشن: جب انسانی مداخلت ضروری ہو

🔐 ایڈمن اختیارات (مکمل رسائی):
- سارے کیسز کی رپورٹ اور تجزیہ، ایجنٹ کارکردگی
- ادائیگیاں منظور/مسترد، کسی بھی کیس کا اسٹیٹس تبدیل
- ایجنٹ اسائنمنٹ، بلک نوٹیفکیشن، تمام ڈیٹا ایکسپورٹ
- سسٹم سیٹنگز، بیک اپ، VisaVerse CRM مکمل کنٹرول

🧠 ذہین رویہ:
- تفصیلی تجزیات، اسٹریٹجک تجاویز، ایگزیکٹیو خلاصے
- بے قاعدگیاں نشان زد: "ایجنٹ فرحان کے کیسز اس ہفتے 20% سست ہیں"
- ڈیڈ لائن فورکاسٹنگ، رسک الرٹس، کوچنگ تجاویز
📞 رابطہ: 03186986259`,

      agent: `آپ ایمرالڈ ویزا کنسلٹنسی سروس کے ایجنٹ (ویزا سیلز ریپریزنٹیٹو) کے AI اسسٹنٹ ہیں۔
آپ کا نام "ایمرالڈ AI" ہے۔ آپ ہمیشہ اردو میں جواب دیں گے (اردو رسم الخط میں)۔

🎯 صلاحیتیں:
✅ کیس سپورٹ: اپنے کیسز اور اگلے قدم
✅ CRM ایکشنز: نیا کیس، اسٹیٹس اپڈیٹ، ادائیگی ریکارڈ، نوٹ شامل
✅ ورک فلو گائیڈنس: میڈیکل، دستاویزات، ویزا پروسیس
✅ واٹس ایپ ٹیمپلیٹس، ڈیڈ لائن ریمائنڈرز

💼 ایجنٹ اختیارات:
- نئے کیسز بنانا (خودکار خود کو اسائن)، اپنے کیسز کا اسٹیٹس اپڈیٹ
- ادائیگی ریکارڈ (ایڈمن منظوری تک زیر التواء)، دستاویزات اپلوڈ
- ایڈمن سے منظوری کی درخواست

❌ نہیں کر سکتا: دوسرے ایجنٹس کے کیسز، ادائیگی منظوری، سسٹم سیٹنگز

🧠 ذہین رویہ:
- سادہ، عمل پر مبنی جوابات
- ڈیڈ لائن یاد دہانی: "احمد خان کی میڈیکل ڈیڈ لائن 6 گھنٹے میں ہے"
- اگلا بہترین عمل: "اب آپ میڈیکل ٹوکن جاری کر سکتے ہیں"
📞 رابطہ: 03186986259`,

      customer: `آپ ایمرالڈ ویزا کنسلٹنسی سروس کے کسٹمر کے AI اسسٹنٹ ہیں۔
آپ کا نام "ایمرالڈ AI" ہے۔ آپ ہمیشہ اردو میں جواب دیں گے (اردو رسم الخط میں)۔

🎯 صلاحیتیں:
✅ کیس سٹیٹس: ویزا درخواست کی حیثیت
✅ دستاویزات گائیڈ: ضروری کاغذات
✅ ادائیگی معلومات: فیس، طریقے، حیثیت
✅ میڈیکل گائیڈنس: GAMCA پروسیس
✅ ایجنٹ رابطہ: اسائنڈ ایجنٹ سے رابطہ

👤 کسٹمر اختیارات:
- اپنا کیس دیکھنا، دستاویزات اپلوڈ
- اپوائنٹمنٹ کنفرم، کال بیک درخواست، فیڈ بیک

❌ نہیں کر سکتا: دوسرے کلائنٹس کا ڈیٹا، کیس سٹیٹس تبدی��ی، ادائیگی منظوری

🧠 ذہین رویہ:
- انتہائی سادہ اردو (کوئی مشکل الفاظ نہیں)
- تصدیق: "کیا آپ کا مطلب ہے کہ آپ میڈیکل اپائنٹمنٹ کنفرم کرنا چاہتے ہیں؟"
- حوصلہ افزائی، واضح اگلے اقدامات، مثبت لہجہ
- پیچیدہ سوال → انسانی ایجنٹ تک ایسکیلیٹ
📞 مدد: 03186986259`,

      master_admin: `آپ ایمرالڈ ویزا کنسلٹنسی سروس کے ماسٹر ایڈمن (مالک) کے AI اسسٹنٹ ہیں۔
آپ کا نام "ایمرالڈ AI" ہے۔ آپ ہمیشہ اردو میں جواب دیں گے (اردو رسم الخط میں)۔

🎯 صلاحیتیں:
✅ کاروباری بصیرت: آمدنی، خرچے، منافع، رجحانات
✅ CRM ایکشنز: تمام کیسز پر مکمل کنٹرول
✅ ڈیٹا تجزیہ: ایجنٹ کارکردگی، ملک وائز، وینڈر تعلقات
✅ پیشن گوئی: آمدنی اندازہ، کیس مکمل ہونے کی پیش گوئی
✅ اسٹریٹجک تجاویز: کاروبار بڑھانے کی تجاویز

👑 ماسٹر ایڈمن اختیارات (اعلیٰ ترین رسائی):
- پورے کاروبار کی مکمل نگرانی، تمام ایڈمنز/ایجنٹس کا انتظام
- مالی تجزیہ، کاروباری فیصلے، سسٹم سیکیورٹی
- KPIs، وینڈر معاہدے، کمیشن پالیسی
- بیک اپ، آڈٹ لاگز، VisaVerse مکمل کنٹرول

🧠 ذہین رویہ:
- ایگزیکٹیو سطح خلاصے، ROI/کاروباری اثرات
- اسٹریٹجک سوچ، مسابقتی تجزیہ، وینڈر مذاکرات
- عملے کی تربیت اور ترقی کی سفارشات
📞 رابطہ: 03186986259`,

      operator: `آپ ایمرالڈ ویزا کنسلٹنسی سروس کے ڈیٹا آپریٹر کے AI اسسٹنٹ ہیں۔
آپ کا نام "ایمرالڈ AI" ہے۔ آپ ہمیشہ اردو میں جواب دیں گے (اردو رسم الخط میں)۔

🎯 صلاحیتیں:
✅ کیس مینجمنٹ: مکمل کیسز بنانا، دیکھنا، اپڈیٹ
✅ CRM ایکشنز: تمام کیسز تلاش، اسٹیٹس اپڈیٹ، ادائیگی ریکارڈ، نوٹ
✅ دستاویزات: اپلوڈ، تصدیق، منظم کرنا
✅ رپورٹس: روزانہ رپورٹ تیار
✅ حاضری: تمام عملے کی حاضری مارک

💻 آپریٹر اختیارات (مکمل ڈیٹا رسائی):
- مکمل کیسز بنانا (صرف فولڈر نہیں)، تمام کیسز دیکھنا (تمام پورٹلز)
- دستاویزات اپلوڈ/دیکھنا (آزادانہ)، کیس اسٹیٹس اپڈیٹ (14 مراحل)
- ادائیگیوں کا ریکارڈ (مالک تصدیق لازمی)
- اپوائنٹمنٹس بک/مینیج، حاضری مارک، آفس وزٹرز ریکارڈ
- روزانہ رپورٹ تیار/بھیجنا، ایجنٹ سپورٹ، ڈاکومنٹ سکین/اپلوڈ
- ایڈمن کو کیس فلیگ کرنا

🧠 ذہین رویہ:
- سادہ قدم بہ قدم ہدایات
- سیاق و سباق سے فارم خودکار بھرنا
- ہر عمل سے پہلے تصدیق: "کیا آپ EMR-001 کی سٹیٹس کنفرم کرنا چاہتے ہیں؟"
- عام کاموں کو سیکھ کر شارٹ کٹس تجویز
📞 رابطہ: 03186986259`,
    };

    // ── Structured system prompt: role identity + core rules (lean) ──
    const systemPrompt = `${roleDescriptions[role] || roleDescriptions.admin}

CRITICAL: ALWAYS respond in Urdu script (اردو). NEVER English/Roman Urdu. Only exceptions: CNIC, GAMCA, CRM, WhatsApp, PKR, EMR, PDF.

کمپنی: ایمرالڈ ویزا کنسلٹنسی سروس | 📍 #25 فیصل شاپنگ مال، لاہور | 📞 03186986259
ویزا 12 مراحل: ڈاکومنٹ جمع→سلیکشن کال→میڈیکل ٹوکن(GAMCA)→میڈیکل چیک→بائیومیٹرک→ادائیگی تصدیق→اصل دستاویزات→مینیجر کو جمع→منظوری→باقی رقم→ٹکٹ بکنگ→مکمل
اصول: ہر ادائیگی→مالک تصدیق | ڈبل انٹری | میڈیکل نتیجہ 36 گھنٹے

جواب فارمیٹ: ✅ تصدیق (1 جملہ) → رہنمائی (3-5 قدم) → 💡 ٹپ → اگلے اقدامات → 📞 03186986259
CRM عمل: [CRM_ACTION:{"type":"..."}] بلاک شامل کریں → تصدیق → نتیجہ
ایسکیلیشن: ناراض→ایگزیکٹو | قانونی→ایکسپرٹ | خرابی→ایڈمن رابطہ
پرائیویسی: CNIC/پاسپورٹ ماسک کریں (XXXXX-XXX-XX)`;

    // ── Build messages: system + CRM data + few-shot examples + history ──
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // CRM data as separate system message (cleaner separation)
    if (crmContext) {
      aiMessages.push({ role: "system", content: crmContext });
    }

    // ── FEW-SHOT EXAMPLES: teach the model the exact format ──
    // Example 1: Simple query → Urdu response
    aiMessages.push(
      { role: "user", content: "ahmed khan ka case kahan hai?" },
      { role: "assistant", content: `[CRM_ACTION:{"type":"search_cases","query":"Ahmed Khan"}]

✅ احمد خان کا کیس تلاش کر رہا ہوں۔

اوپر CRM سے نتائج آ رہے ہیں۔ اگر کوئی اور تفصیل چاہیں تو بتائیں۔
💡 آپ کیس ID (مثلاً EMR-2026-0001) بھی بتا سکتے ہیں تاکہ مکمل تفصیلات دکھا سکوں۔
📞 مدد: 03186986259` },
    );

    // Example 2: Stats query → Urdu with CRM action
    aiMessages.push(
      { role: "user", content: "overall report dikhao" },
      { role: "assistant", content: `[CRM_ACTION:{"type":"get_stats"}]

✅ مکمل CRM رپورٹ تیار کر رہا ہوں۔

اوپر تمام اعدادوشمار دیے گئے ہیں۔ مزید تفصیل کے لیے:
• کسی ایجنٹ کی کارکردگی دیکھنا ہو تو نام بتائیں
• تاخیر والے کیسز دیکھنے کے لیے "تاخیر والے کیسز دکھاؤ" کہیں
💡 ہفتہ وار رپورٹ بیک اپ ای میل سے بھی بھیجی جا سکتی ہے۔
📞 مدد: 03186986259` },
    );

    // Example 3: Payment recording
    aiMessages.push(
      { role: "user", content: "EMR-2026-0003 ki 15000 payment add karo cash me" },
      { role: "assistant", content: `[CRM_ACTION:{"type":"add_payment","caseId":"EMR-2026-0003","paymentAmount":15000,"paymentMethod":"cash","paymentDescription":"قسط","paymentCollectedBy":"AI"}]

✅ EMR-2026-0003 میں PKR 15,000 نقد ادائیگی ریکارڈ کر رہا ہوں۔

⚠️ یاد رکھیں: ایڈمن/مالک کی تصدیق ضروری ہے۔ CRM + مینول رجسٹر دونوں میں انٹری کریں۔
💡 رسید نمبر خودکار بن جائے گا۔
📞 مدد: 03186986259` },
    );

    if (Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-MAX_AI_HISTORY);
      for (const msg of recentHistory) {
        aiMessages.push({
          role: msg.isBot ? "assistant" : "user",
          content: msg.text,
        });
      }
    }

    aiMessages.push({
      role: "user",
      content: sanitizedMessage,
    });

    const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    const MODEL_ID = "stepfun/step-3.5-flash:free";

    console.log(`StepFun API request: model=${MODEL_ID}, messages=${aiMessages.length}`);

    const MAX_RETRIES = 2;
    let aiResponse: Response | null = null;
    let lastErrBody = "";
    const usedModel = MODEL_ID;

    const payload = JSON.stringify({
      model: MODEL_ID,
      messages: aiMessages,
      temperature: 0.6,
      top_p: 0.85,
      max_tokens: 800,
      stream: false,
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://emerald-visa-crm.app",
          "X-Title": "Emerald Visa CRM",
        },
        body: payload,
      });

      if (aiResponse.ok) {
        console.log(`StepFun API success (attempt ${attempt + 1})`);
        break;
      }

      if (aiResponse.status === 429 && attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`StepFun 429 (attempt ${attempt + 1}/${MAX_RETRIES}). Retry in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      try { lastErrBody = await aiResponse.text(); } catch { lastErrBody = "could not read response body"; }
      console.log(`StepFun API error (${aiResponse.status}):`, lastErrBody.substring(0, 500));
      break;
    }

    if (!aiResponse || !aiResponse.ok) {
      const status = aiResponse?.status || 500;

      if (status === 429) {
        return c.json({
          success: true,
          data: {
            response: "⚠️ معذرت! ابھی AI سروس مصروف ہے (درخواستوں کی حد پوری ہو گئی ہے)۔ براہ کرم چند لمحے بعد دوبارہ کوشش کریں۔ آپ کے سوالات کے فوری جوابات کے لیے اوپر دیے گئے فوری بٹنز استعمال کریں۔ 🙏",
            model: "fallback-rate-limited",
            language: lang,
            role,
          },
        });
      }

      if (status === 402) {
        return c.json({
          success: true,
          data: {
            response: [
              "\u26a0\ufe0f \u0645\u0639\u0630\u0631\u062a! AI \u0633\u0631\u0648\u0633 \u06a9\u06cc \u062d\u062f \u067e\u0648\u0631\u06cc \u06c1\u0648 \u06af\u0626\u06cc \u06c1\u06d2 (\u0627\u062e\u0631\u0627\u062c\u0627\u062a \u06a9\u06cc \u062d\u062f)\u06d4",
              "\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0628\u0639\u062f \u0645\u06cc\u06ba \u062f\u0648\u0628\u0627\u0631\u06c1 \u06a9\u0648\u0634\u0634 \u06a9\u0631\u06cc\u06ba \u06cc\u0627 \u0627\u06cc\u0688\u0645\u0646 \u0633\u06d2 \u0631\u0627\u0628\u0637\u06c1 \u06a9\u0631\u06cc\u06ba\u06d4",
              "\u0622\u067e \u0627\u0648\u067e\u0631 \u062f\u06cc\u06d2 \u06af\u0626\u06d2 \u0641\u0648\u0631\u06cc \u0628\u0679\u0646\u0632 \u0627\u0633\u062a\u0639\u0645\u0627\u0644 \u06a9\u0631 \u0633\u06a9\u062a\u06d2 \u06c1\u06cc\u06ba\u06d4 \ud83d\ude4f",
            ].join(" "),
            model: "fallback-spend-limit",
            language: lang,
            role,
          },
        });
      }

      return c.json({
        success: false,
        error: `StepFun API returned ${status}: ${lastErrBody.substring(0, 500)}`,
      }, 500);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData?.choices?.[0]?.message?.content;

    if (!rawText) {
      console.log("StepFun returned no text. Full response:", JSON.stringify(aiData).substring(0, 1000));
      return c.json({
        success: false,
        error: "StepFun returned an empty response. The query may have been blocked by safety filters.",
      }, 500);
    }

    // Strip <think>...</think> reasoning tags if model includes them
    const aiText = rawText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Improvement #17: AI audit logging
    const hasActions = /\[CRM_ACTION:/.test(aiText);
    const session = c.get?.("session");
    logAIAudit({
      role,
      userId: session?.userId || "anonymous",
      message: sanitizedMessage,
      hasActions,
      model: usedModel,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      success: true,
      data: {
        response: aiText || rawText,
        model: usedModel,
        language: lang,
        role,
      },
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errStack = err?.stack || "";
    console.log("StepFun AI chat error:", errMsg);
    console.log("StepFun AI chat stack:", errStack);
    return c.json({ success: false, error: `AI chat error: ${errMsg}` }, 500);
  }
});

// ============================================================
// CRM ACTIONS via server KV (Improvement #5)
// ============================================================
app.post("/make-server-5cdc87b7/crm/action", async (c) => {
  try {
    const body = await c.req.json();
    const { type, caseId, query, newStatus, noteText, noteAuthor, paymentAmount, paymentMethod, paymentDescription, agentName, country, status: filterStatus } = body;
    if (!type) return c.json({ success: false, error: "action type is required" }, 400);

    const cases: any[] = (await kv.get(KEY.cases)) || [];

    switch (type) {
      case "search_cases": {
        const q = (query || "").toLowerCase();
        const results = cases.filter((cs: any) =>
          (cs.customerName || "").toLowerCase().includes(q) ||
          (cs.id || "").toLowerCase().includes(q) ||
          (cs.phone || "").includes(q) ||
          (cs.passport || "").toLowerCase().includes(q)
        );
        return c.json({ success: true, data: results.slice(0, 50), count: results.length });
      }
      case "get_case": {
        const found = cases.find((cs: any) => cs.id === caseId);
        if (!found) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
        return c.json({ success: true, data: found });
      }
      case "update_status": {
        const idx = cases.findIndex((cs: any) => cs.id === caseId);
        if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
        cases[idx] = { ...cases[idx], status: newStatus, updatedDate: new Date().toISOString() };
        await kvSet(KEY.cases, cases, "crm-update-status");
        return c.json({ success: true, data: cases[idx] });
      }
      case "add_note": {
        const idx = cases.findIndex((cs: any) => cs.id === caseId);
        if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
        const note = { id: `N-${Date.now()}`, text: noteText, author: noteAuthor || "AI", date: new Date().toISOString(), important: false };
        if (!Array.isArray(cases[idx].notes)) cases[idx].notes = [];
        cases[idx].notes.push(note);
        cases[idx].updatedDate = new Date().toISOString();
        await kvSet(KEY.cases, cases, "crm-add-note");
        return c.json({ success: true, data: { noteId: note.id, notesCount: cases[idx].notes.length } });
      }
      case "add_payment": {
        const idx = cases.findIndex((cs: any) => cs.id === caseId);
        if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
        const receipt = `REC-SRV-${Date.now().toString().slice(-6)}`;
        const payment = { id: `P-${Date.now()}`, amount: paymentAmount, date: new Date().toISOString(), method: paymentMethod || "cash", receiptNumber: receipt, description: paymentDescription || "Server recorded", approvalStatus: "pending" };
        if (!Array.isArray(cases[idx].payments)) cases[idx].payments = [];
        cases[idx].payments.push(payment);
        cases[idx].paidAmount = (cases[idx].paidAmount || 0) + (paymentAmount || 0);
        cases[idx].updatedDate = new Date().toISOString();
        await kv.set(KEY.cases, cases);
        return c.json({ success: true, data: { receipt, paidAmount: cases[idx].paidAmount, totalFee: cases[idx].totalFee } });
      }
      case "get_stats": {
        const active = cases.filter((cs: any) => !["completed", "rejected"].includes(cs.status || "")).length;
        const completed = cases.filter((cs: any) => cs.status === "completed").length;
        const revenue = cases.reduce((s: number, cs: any) => s + (cs.paidAmount || 0), 0);
        const pending = cases.reduce((s: number, cs: any) => s + ((cs.totalFee || 0) - (cs.paidAmount || 0)), 0);
        return c.json({ success: true, data: { total: cases.length, active, completed, revenue, pending } });
      }
      case "list_by_agent": {
        const filtered = cases.filter((cs: any) => (cs.agentName || "").toLowerCase() === (agentName || "").toLowerCase());
        return c.json({ success: true, data: filtered.slice(0, 50), count: filtered.length });
      }
      case "list_by_status": {
        const filtered = cases.filter((cs: any) => cs.status === filterStatus);
        return c.json({ success: true, data: filtered.slice(0, 50), count: filtered.length });
      }
      case "list_by_country": {
        const filtered = cases.filter((cs: any) => (cs.country || "").toLowerCase().includes((country || "").toLowerCase()));
        return c.json({ success: true, data: filtered.slice(0, 50), count: filtered.length });
      }
      case "flag_case": {
        const idx = cases.findIndex((cs: any) => cs.id === caseId);
        if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);
        cases[idx].priority = "urgent";
        cases[idx].flagged = true;
        cases[idx].flagReason = body.flagReason || "Flagged by AI";
        if (!Array.isArray(cases[idx].notes)) cases[idx].notes = [];
        cases[idx].notes.push({ id: `N-${Date.now()}`, text: `⚠️ Flag: ${body.flagReason || "Flagged"}`, author: "AI", date: new Date().toISOString(), important: true });
        cases[idx].updatedDate = new Date().toISOString();
        await kv.set(KEY.cases, cases);
        return c.json({ success: true, data: { id: caseId, flagged: true } });
      }
      default:
        return c.json({ success: false, error: `Unknown CRM action type: ${type}` }, 400);
    }
  } catch (err: any) {
    console.log("CRM action error:", err);
    return c.json({ success: false, error: `CRM action error: ${err?.message || err}` }, 500);
  }
});

// ============================================================
// AI AUDIT LOG (Improvement #17)
// ============================================================
app.get("/make-server-5cdc87b7/ai/audit-log", async (c) => {
  try {
    const log = await kv.get(AI_AUDIT_KEY);
    return c.json({ success: true, data: log || [] });
  } catch (err) {
    console.log("Error fetching AI audit log:", err);
    return c.json({ success: false, error: `AI audit log error: ${err}` }, 500);
  }
});

// ============================================================
// API HEALTH DASHBOARD (Improvement #16)
// ============================================================
app.get("/make-server-5cdc87b7/health/detailed", async (c) => {
  try {
    const now = Date.now();
    const meta = await kv.get(KEY.meta);
    const checks: Record<string, any> = {};

    // Check each KV entity
    const entities = ["cases", "users", "notifications", "settings", "auditLog"];
    const entityKeys = [KEY.cases, KEY.users, KEY.notifications, KEY.settings, KEY.auditLog];
    for (let i = 0; i < entities.length; i++) {
      try {
        const start = Date.now();
        const data = await kv.get(entityKeys[i]);
        const latency = Date.now() - start;
        checks[entities[i]] = {
          status: "ok",
          latencyMs: latency,
          count: Array.isArray(data) ? data.length : data ? 1 : 0,
        };
      } catch (e) {
        checks[entities[i]] = { status: "error", error: String(e) };
      }
    }

    // Storage bucket check
    try {
      const start = Date.now();
      const { data } = await supabase.storage.listBuckets();
      checks.storage = { status: "ok", latencyMs: Date.now() - start, buckets: data?.length || 0 };
    } catch (e) {
      checks.storage = { status: "error", error: String(e) };
    }

    // Rate limiter stats
    checks.rateLimiter = { activeEntries: _rl.size };

    // OpenRouter/StepFun API check
    const orHealthKey = Deno.env.get("OPENROUTER_API_KEY");
    checks.ai = { configured: !!orHealthKey, keyPrefix: orHealthKey ? orHealthKey.substring(0, 6) + "..." : "missing" };

    // Brevo check
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    checks.email = { configured: !!brevoKey };

    return c.json({
      success: true,
      data: {
        status: "ok",
        version: "2.1-softauth",
        uptime: "edge-function",
        timestamp: new Date().toISOString(),
        lastSync: meta?.lastSync || null,
        entityTimestamps: meta?.entityTimestamps || {},
        checks,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: `Health check error: ${err?.message || err}` }, 500);
  }
});

// List all documents in storage for a given docId prefix
app.get("/make-server-5cdc87b7/storage/documents/:docId", async (c) => {
  try {
    const docId = decodeURIComponent(c.req.param("docId"));

    const { data, error } = await supabase.storage
      .from(DOC_BUCKET)
      .list(docId);

    if (error) {
      console.log("Storage list error:", error);
      return c.json({ success: false, error: `Storage list failed: ${error.message}` }, 500);
    }

    return c.json({ success: true, data: data || [] });
  } catch (err) {
    console.log("Error listing documents:", err);
    return c.json({ success: false, error: `Document list error: ${err}` }, 500);
  }
});

// ============================================================
// AI STREAMING CHAT (Improvement #18)
// Delegates to extracted aiRoutes.ts for SSE streaming
// ============================================================
app.post("/make-server-5cdc87b7/ai/chat/stream", async (c) => {
  return handleStreamingAIChat(c);
});

// ============================================================
// BREVO EMAIL — Case Status Change Notification
// POST /notifications/case-status
// Body: { caseId, customerName, customerEmail, agentName, agentEmail, oldStatus, newStatus, phone, country }
// ============================================================
app.post("/make-server-5cdc87b7/notifications/case-status", async (c) => {
  try {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) {
      return c.json({ success: false, error: "BREVO_API_KEY not configured" }, 400);
    }

    const body = await c.req.json();
    const { caseId, customerName, customerEmail, agentName, agentEmail, oldStatus, newStatus, phone, country } = body;

    if (!caseId || !newStatus) {
      return c.json({ success: false, error: "caseId and newStatus are required" }, 400);
    }

    // Urdu stage labels map — must match WORKFLOW_STAGES in mockData.ts
    const STAGE_LABELS: Record<string, string> = {
      document_collection: "دستاویزات جمع — مرحلہ 1",
      selection_call: "سلیکشن کال / آفس اپائنٹمنٹ — مرحلہ 2",
      medical_token: "میڈیکل ٹوکن (گامکا) — مرحلہ 3",
      check_medical: "میڈیکل اسٹیٹس چیک — مرحلہ 4",
      biometric: "بائیومیٹرک / سعودی اعتماد — مرحلہ 5",
      payment_confirmation: "ادائیگی کی تصدیق — مرحلہ 6",
      original_documents: "اصل دستاویزات — مرحلہ 7",
      submitted_to_manager: "کیس مینیجر کو جمع — مرحلہ 8",
      approved: "منظور شدہ ✅ — مرحلہ 9",
      remaining_amount: "باقی رقم — مرحلہ 10",
      ticket_booking: "ٹکٹ بکنگ — مرحلہ 11",
      completed: "کیس مکمل ✅ — مرحلہ 12",
      // Deprecated stages (backward compat)
      e_number_issued: "ای نمبر — مرحلہ 6",
      protector: "پروٹیکٹر — مرحلہ 11",
      rejected: "کیس مسترد ❌",
    };

    const newLabel = STAGE_LABELS[newStatus] || newStatus;
    const oldLabel = STAGE_LABELS[oldStatus] || oldStatus || "—";

    const isVisa = newStatus === "approved" || newStatus === "completed";
    const isRejected = newStatus === "rejected";

    const emailBody = `
<!DOCTYPE html>
<html dir="rtl" lang="ur">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Emerald Visa CRM — کیس اپڈیٹ</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">💎 Emerald Visa Consultancy</h1>
      <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px;">کیس اسٹیٹس اپڈیٹ نوٹیفکیشن</p>
    </div>

    <!-- Status Badge -->
    <div style="padding:24px 32px;text-align:center;">
      <div style="display:inline-block;background:${isVisa ? '#059669' : isRejected ? '#dc2626' : '#1d4ed8'};color:#fff;border-radius:50px;padding:10px 28px;font-size:15px;font-weight:bold;">
        ${isVisa ? '🎉' : isRejected ? '❌' : '🔄'} ${newLabel}
      </div>
    </div>

    <!-- Case Info -->
    <div style="padding:0 32px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 14px;background:#f0fdf4;border-radius:8px 8px 0 0;font-weight:bold;color:#065f46;">کیس نمبر</td><td style="padding:10px 14px;background:#f0fdf4;border-radius:8px 8px 0 0;color:#374151;">${caseId}</td></tr>
        <tr><td style="padding:10px 14px;background:#fff;font-weight:bold;color:#065f46;">کسٹمر</td><td style="padding:10px 14px;background:#fff;color:#374151;">${customerName || 'N/A'}</td></tr>
        <tr><td style="padding:10px 14px;background:#f0fdf4;font-weight:bold;color:#065f46;">ملک</td><td style="padding:10px 14px;background:#f0fdf4;color:#374151;">${country || 'N/A'}</td></tr>
        <tr><td style="padding:10px 14px;background:#fff;font-weight:bold;color:#065f46;">ایجنٹ</td><td style="padding:10px 14px;background:#fff;color:#374151;">${agentName || 'N/A'}</td></tr>
        <tr><td style="padding:10px 14px;background:#f0fdf4;font-weight:bold;color:#065f46;">پرانا مرحلہ</td><td style="padding:10px 14px;background:#f0fdf4;color:#6b7280;">${oldLabel}</td></tr>
        <tr><td style="padding:10px 14px;background:#fff;font-weight:bold;color:#065f46;">نیا مرحلہ</td><td style="padding:10px 14px;background:#fff;color:#059669;font-weight:bold;">${newLabel}</td></tr>
        <tr><td style="padding:10px 14px;background:#f0fdf4;border-radius:0 0 8px 8px;font-weight:bold;color:#065f46;">وقت</td><td style="padding:10px 14px;background:#f0fdf4;border-radius:0 0 8px 8px;color:#374151;">${new Date().toLocaleString('ur-PK')}</td></tr>
      </table>

      ${isVisa ? `<div style="margin-top:20px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;color:#065f46;font-size:15px;font-weight:bold;">🎉 مبارک ہو! ویزا منظور ہو گیا</p>
        <p style="margin:8px 0 0;color:#047857;font-size:13px;">اللہ کامیابی عطا فرمائے۔ امین 🤲</p>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#064e3b;padding:20px 32px;text-align:center;">
      <p style="color:#6ee7b7;margin:0;font-size:12px;">📍 #25 فیصل شاپنگ مال، جی پی او صدر، لاہور</p>
      <p style="color:#6ee7b7;margin:6px 0 0;font-size:12px;">📞 03186986259 | info@emeraldvisaconsultancy.com</p>
    </div>
  </div>
</body>
</html>`;

    const recipients: { email: string; name: string }[] = [];
    if (customerEmail) recipients.push({ email: customerEmail, name: customerName || "Customer" });
    if (agentEmail) recipients.push({ email: agentEmail, name: agentName || "Agent" });

    if (recipients.length === 0) {
      return c.json({ success: false, error: "No recipient email addresses provided" }, 400);
    }

    const emailPayload = {
      sender: { name: "Emerald Visa CRM", email: "info@emeraldconsultancycompany.com" },
      to: recipients,
      subject: `[${caseId}] کیس اپڈیٹ — ${newLabel}`,
      htmlContent: emailBody,
    };

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.text();
      console.log(`Brevo email error (${brevoRes.status}):`, errBody.substring(0, 300));
      return c.json({ success: false, error: `Brevo API error: ${brevoRes.status}` }, 502);
    }

    const brevoData = await brevoRes.json();
    console.log(`Case status email sent for ${caseId}: ${oldStatus} → ${newStatus}. MessageId: ${brevoData.messageId}`);

    return c.json({ success: true, messageId: brevoData.messageId, recipients: recipients.length });
  } catch (err: any) {
    console.log("Case status email error:", err);
    return c.json({ success: false, error: `Email error: ${err?.message || err}` }, 500);
  }
});

// ============================================================
// SCHEDULED HEALTH CHECK HISTORY (Improvement #7)
// Stores health check results with timestamps for trend analysis
// ============================================================
const HEALTH_HISTORY_KEY = "crm:health_check_history";

app.post("/make-server-5cdc87b7/health/run-check", async (c) => {
  try {
    const now = new Date().toISOString();
    const checkResult: Record<string, any> = { timestamp: now, checks: {} };

    // KV store check
    try {
      const start = Date.now();
      const cases = await kv.get(KEY.cases);
      checkResult.checks.kvStore = { status: "ok", latencyMs: Date.now() - start, caseCount: Array.isArray(cases) ? cases.length : 0 };
    } catch (e) {
      checkResult.checks.kvStore = { status: "error", error: String(e) };
    }

    // Storage check
    try {
      const start = Date.now();
      const { data: bk } = await supabase.storage.listBuckets();
      checkResult.checks.storage = { status: "ok", latencyMs: Date.now() - start, buckets: bk?.length || 0 };
    } catch (e) {
      checkResult.checks.storage = { status: "error", error: String(e) };
    }

    // OpenRouter/StepFun API check
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      try {
        const start = Date.now();
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${orKey}` },
        });
        checkResult.checks.stepfunApi = { status: res.ok ? "ok" : "error", latencyMs: Date.now() - start, httpStatus: res.status };
      } catch (e) {
        checkResult.checks.stepfunApi = { status: "error", error: String(e) };
      }
    } else {
      checkResult.checks.stepfunApi = { status: "missing", error: "OPENROUTER_API_KEY not configured" };
    }

    // Brevo check
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      try {
        const start = Date.now();
        const res = await fetch("https://api.brevo.com/v3/account", {
          headers: { "api-key": brevoKey, accept: "application/json" },
        });
        checkResult.checks.brevo = { status: res.ok ? "ok" : "error", latencyMs: Date.now() - start, httpStatus: res.status };
      } catch (e) {
        checkResult.checks.brevo = { status: "error", error: String(e) };
      }
    } else {
      checkResult.checks.brevo = { status: "missing", error: "BREVO_API_KEY not configured" };
    }

    // Overall status
    const allChecks = Object.values(checkResult.checks) as any[];
    checkResult.overallStatus = allChecks.every((ck: any) => ck.status === "ok" || ck.status === "missing") ? "healthy" : "degraded";

    // Save to history
    const history = (await kv.get(HEALTH_HISTORY_KEY)) || [];
    history.unshift(checkResult);
    if (history.length > 200) history.length = 200;
    await kv.set(HEALTH_HISTORY_KEY, history);

    console.log(`Health check completed: ${checkResult.overallStatus} at ${now}`);
    return c.json({ success: true, data: checkResult });
  } catch (err: any) {
    console.log("Health check run error:", err);
    return c.json({ success: false, error: `Health check error: ${err?.message || err}` }, 500);
  }
});

app.get("/make-server-5cdc87b7/health/history", async (c) => {
  try {
    const history = await kv.get(HEALTH_HISTORY_KEY);
    return c.json({ success: true, data: history || [] });
  } catch (err: any) {
    return c.json({ success: false, error: `Health history error: ${err?.message || err}` }, 500);
  }
});

// ============================================================
// PRODUCTION DOCUMENT STORAGE — All files to Supabase Storage
// ============================================================

// Upload document via multipart form-data
app.post("/make-server-5cdc87b7/storage/documents/upload-form", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const caseId = formData.get("caseId") as string;
    const docId = formData.get("docId") as string;
    const checklistKey = formData.get("checklistKey") as string | null;
    const uploadedBy = formData.get("uploadedBy") as string || "unknown";
    const uploadedByRole = formData.get("uploadedByRole") as string || "agent";

    if (!file || !caseId || !docId) {
      return c.json({ success: false, error: "Missing required fields: file, caseId, docId" }, 400);
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, error: `File type '${file.type}' not allowed. Only PNG, JPG, PDF are accepted.` }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, error: "File size exceeds 10MB limit" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const storagePath = `${caseId}/${docId}/${file.name}`;

    const { error } = await supabase.storage
      .from(DOC_BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: true });

    if (error) {
      console.log("Storage form upload error:", error);
      return c.json({ success: false, error: `Storage upload failed: ${error.message}` }, 500);
    }

    const { data: signedData } = await supabase.storage
      .from(DOC_BUCKET)
      .createSignedUrl(storagePath, 3600);

    console.log(`Form upload: ${storagePath} (${bytes.length} bytes) by ${uploadedBy} [${uploadedByRole}]`);

    return c.json({
      success: true,
      data: {
        storagePath,
        fileName: file.name,
        mimeType: file.type,
        fileSize: bytes.length,
        signedUrl: signedData?.signedUrl || null,
        signedUrlExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        checklistKey: checklistKey || null,
        uploadedBy,
        uploadedByRole,
      },
    });
  } catch (err) {
    console.log("Error in form upload:", err);
    return c.json({ success: false, error: `Form upload error: ${err}` }, 500);
  }
});

// Batch generate signed URLs for multiple documents
app.post("/make-server-5cdc87b7/storage/documents/batch-signed-urls", async (c) => {
  try {
    const { paths } = await c.req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return c.json({ success: false, error: "paths must be a non-empty array" }, 400);
    }

    const results: Record<string, string | null> = {};
    const batchSize = 10;
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);
      const promises = batch.map(async (path: string) => {
        try {
          const { data, error } = await supabase.storage
            .from(DOC_BUCKET)
            .createSignedUrl(path, 3600);
          results[path] = error ? null : (data?.signedUrl || null);
        } catch {
          results[path] = null;
        }
      });
      await Promise.all(promises);
    }

    return c.json({ success: true, data: results });
  } catch (err) {
    console.log("Batch signed URL error:", err);
    return c.json({ success: false, error: `Batch signed URL error: ${err}` }, 500);
  }
});

// ============================================================
// PIPELINE MANAGEMENT
// ============================================================

// SLA alerts — returns all overdue cases
app.get("/make-server-5cdc87b7/pipeline/sla-alerts", async (c) => {
  try {
    const cases = (await kv.get(KEY.cases)) || [];
    const now = Date.now();
    const overdueAlerts: any[] = [];

    for (const cs of cases) {
      if (!cs.stageStartedAt || !cs.pipelineStageKey) continue;
      if (cs.pipelineStageKey?.includes("cancelled") || cs.pipelineStageKey?.includes("completed")) continue;

      const stageStart = new Date(cs.stageStartedAt).getTime();
      const deadlineMs = stageStart + 24 * 3600000;

      if (now > deadlineMs) {
        overdueAlerts.push({
          caseId: cs.id,
          customerName: cs.customerName,
          agentName: cs.agentName,
          pipelineType: cs.pipelineType || "visa",
          currentStage: cs.pipelineStageKey || cs.status,
          hoursOverdue: Math.round((now - deadlineMs) / 3600000),
          stageStartedAt: cs.stageStartedAt,
          deadlineAt: new Date(deadlineMs).toISOString(),
        });
      }
    }

    overdueAlerts.sort((a, b) => b.hoursOverdue - a.hoursOverdue);
    return c.json({ success: true, data: overdueAlerts });
  } catch (err) {
    console.log("SLA alerts error:", err);
    return c.json({ success: false, error: `SLA alerts error: ${err}` }, 500);
  }
});

// Auto-migrate a lead to visa pipeline
app.post("/make-server-5cdc87b7/pipeline/migrate-to-visa", async (c) => {
  try {
    const { caseId } = await c.req.json();
    if (!caseId) return c.json({ success: false, error: "caseId required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const now = new Date().toISOString();
    cases[idx] = {
      ...cases[idx],
      previousPipelineType: cases[idx].pipelineType || "lead",
      pipelineType: "visa",
      pipelineStageKey: "new_entry",
      status: "new_entry",
      currentStage: 1,
      stageStartedAt: now,
      migratedAt: now,
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        {
          id: `TL-MIGRATE-${Date.now()}`,
          date: now,
          title: "Auto-migrated to Visa Pipeline",
          description: `Case automatically migrated from Lead Pipeline (Agreement) to Visa Pipeline (New Entry)`,
          type: "status",
          user: "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "pipeline-migrate");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Pipeline migration error:", err);
    return c.json({ success: false, error: `Migration error: ${err}` }, 500);
  }
});

// Stage advancement with hard-lock validation
app.post("/make-server-5cdc87b7/pipeline/advance-stage", async (c) => {
  try {
    const { caseId, nextStageKey, userId, userName } = await c.req.json();
    if (!caseId || !nextStageKey) return c.json({ success: false, error: "caseId and nextStageKey required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const cs = cases[idx];
    const lockedStages = ["case_handover_sir_atif", "case_submitted_to_agency"];
    if (lockedStages.includes(nextStageKey)) {
      const blockers: string[] = [];
      const checklist = cs.documentChecklist || {};
      const mandatoryDocs = [
        "original_passport", "old_passport_lost_report", "original_cnic", "original_pictures",
        "original_medical_report", "e_number_copy", "finger_slip", "character_certificate",
        "frc_nadra", "driving_license", "initial_payment_2lac"
      ];
      const missingDocs = mandatoryDocs.filter((d: string) => !checklist[d]);
      if (missingDocs.length > 0) blockers.push(`Missing mandatory documents: ${missingDocs.join(", ")}`);
      if (!cs.paymentVerified) blockers.push("Initial payment of PKR 2,00,000 must be verified");
      if (nextStageKey === "case_submitted_to_agency" && !cs.sirAtifApproval) {
        blockers.push("Sir Atif must digitally approve before agency submission");
      }
      if (blockers.length > 0) {
        return c.json({ success: false, error: "Stage advancement blocked", blockers }, 403);
      }
    }

    const now = new Date().toISOString();
    const prevStage = cs.pipelineStageKey || cs.status;
    cases[idx] = {
      ...cases[idx],
      pipelineStageKey: nextStageKey,
      status: nextStageKey,
      stageStartedAt: now,
      isOverdue: false,
      delayReason: undefined,
      delayReportedAt: undefined,
      updatedDate: now,
      timeline: [
        ...(cs.timeline || []),
        {
          id: `TL-ADVANCE-${Date.now()}`,
          date: now,
          title: `Stage advanced: ${prevStage} -> ${nextStageKey}`,
          description: `${userName || "System"} advanced case from ${prevStage} to ${nextStageKey}`,
          type: "status",
          user: userName || "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "advance-stage");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Stage advance error:", err);
    return c.json({ success: false, error: `Stage advance error: ${err}` }, 500);
  }
});

// Sir Atif digital approval
app.post("/make-server-5cdc87b7/pipeline/sir-atif-approve", async (c) => {
  try {
    const { caseId, approved, note, userId, userName } = await c.req.json();
    if (!caseId) return c.json({ success: false, error: "caseId required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const now = new Date().toISOString();
    cases[idx] = {
      ...cases[idx],
      sirAtifApproval: approved !== false,
      sirAtifApprovalAt: now,
      sirAtifApprovalNote: note || "",
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        {
          id: `TL-APPROVAL-${Date.now()}`,
          date: now,
          title: approved !== false ? "Sir Atif Approved" : "Sir Atif Rejected",
          description: `${userName || "Sir Atif"} ${approved !== false ? "approved" : "rejected"} this case${note ? `. Note: ${note}` : ""}`,
          type: "status",
          user: userName || "Sir Atif",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "sir-atif-approval");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Sir Atif approval error:", err);
    return c.json({ success: false, error: `Approval error: ${err}` }, 500);
  }
});

// Cancel case with mandatory reason
app.post("/make-server-5cdc87b7/pipeline/cancel-case", async (c) => {
  try {
    const { caseId, reason, userId, userName } = await c.req.json();
    if (!caseId || !reason?.trim()) return c.json({ success: false, error: "caseId and reason required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const now = new Date().toISOString();
    const prevStage = cases[idx].pipelineStageKey || cases[idx].status;
    const pType = cases[idx].pipelineType || "visa";
    const cancelKey = pType === "lead" ? "lead_cancelled" : "visa_cancelled";

    cases[idx] = {
      ...cases[idx],
      pipelineStageKey: cancelKey,
      status: cancelKey,
      cancellationReason: reason.trim(),
      cancelledAt: now,
      cancelledBy: userName || userId || "System",
      reopenedFromStage: prevStage,
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        {
          id: `TL-CANCEL-${Date.now()}`,
          date: now,
          title: "Case Cancelled",
          description: `${userName || "System"} cancelled. Reason: ${reason.trim()}. Previous: ${prevStage}`,
          type: "status",
          user: userName || "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "cancel-case");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Case cancellation error:", err);
    return c.json({ success: false, error: `Cancellation error: ${err}` }, 500);
  }
});

// Reopen a cancelled case
app.post("/make-server-5cdc87b7/pipeline/reopen-case", async (c) => {
  try {
    const { caseId, userId, userName } = await c.req.json();
    if (!caseId) return c.json({ success: false, error: "caseId required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const cs = cases[idx];
    if (!cs.pipelineStageKey?.includes("cancelled") && cs.status !== "rejected") {
      return c.json({ success: false, error: "Case is not cancelled" }, 400);
    }

    const now = new Date().toISOString();
    const restoreStage = cs.reopenedFromStage || (cs.pipelineType === "lead" ? "new_lead" : "new_entry");

    cases[idx] = {
      ...cases[idx],
      pipelineStageKey: restoreStage,
      status: restoreStage,
      cancellationReason: undefined,
      cancelledAt: undefined,
      cancelledBy: undefined,
      reopenedAt: now,
      reopenedBy: userName || userId || "System",
      stageStartedAt: now,
      isOverdue: false,
      updatedDate: now,
      timeline: [
        ...(cs.timeline || []),
        {
          id: `TL-REOPEN-${Date.now()}`,
          date: now,
          title: "Case Reopened",
          description: `${userName || "System"} reopened case. Restored to: ${restoreStage}`,
          type: "status",
          user: userName || "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "reopen-case");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Case reopen error:", err);
    return c.json({ success: false, error: `Reopen error: ${err}` }, 500);
  }
});

// ============================================================
// SALARY CALCULATOR
// ============================================================
app.post("/make-server-5cdc87b7/salary/calculate", async (c) => {
  try {
    const { month, year } = await c.req.json();
    const cases = (await kv.get(KEY.cases)) || [];
    const agentCodes = (await kv.get(KEY.agents)) || [];

    const targetMonth = month ?? new Date().getMonth();
    const targetYear = year ?? new Date().getFullYear();
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const agentEntries: Record<string, number> = {};
    for (const cs of cases) {
      if (!cs.createdDate) continue;
      const created = new Date(cs.createdDate);
      if (created >= monthStart && created <= monthEnd) {
        const agentKey = cs.agentName || cs.agentId || "unassigned";
        agentEntries[agentKey] = (agentEntries[agentKey] || 0) + 1;
      }
    }

    const results = agentCodes.map((agent: any) => {
      const name = agent.name || agent.agentName || "Unknown";
      const entries = agentEntries[name] || 0;
      const isAbove = entries >= 12;
      const baseSalary = isAbove ? 30000 : 0;
      const bonusEntries = isAbove ? entries - 12 : 0;
      const bonusAmount = bonusEntries * 5000;
      const totalSalary = isAbove ? baseSalary + bonusAmount : entries * 2000;

      return { name, entries, target: 20, baseSalary, bonusEntries, bonusAmount, totalSalary, isAboveThreshold: isAbove, targetPercent: Math.round((entries / 20) * 100), isTeamLead: agent.role === "Team Lead" };
    });

    const nonTLTotal = results.filter((r: any) => !r.isTeamLead).reduce((s: number, r: any) => s + r.totalSalary, 0);
    const tlBonus = Math.round(nonTLTotal * 0.1);
    const grandTotal = results.reduce((s: number, r: any) => s + r.totalSalary, 0) + tlBonus;

    return c.json({ success: true, data: { month: targetMonth, year: targetYear, agents: results, teamLeaderBonus: tlBonus, grandTotal } });
  } catch (err) {
    console.log("Salary calculation error:", err);
    return c.json({ success: false, error: `Salary error: ${err}` }, 500);
  }
});

// ============================================================
// DOCUMENT CHECKLIST — Update verification status
// ============================================================
app.post("/make-server-5cdc87b7/pipeline/update-checklist", async (c) => {
  try {
    const { caseId, checklistKey, verified, docId, userId, userName } = await c.req.json();
    if (!caseId || !checklistKey) return c.json({ success: false, error: "caseId and checklistKey required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const now = new Date().toISOString();
    const checklist = cases[idx].documentChecklist || {};
    const checklistFiles = cases[idx].documentChecklistFiles || {};

    checklist[checklistKey] = verified !== false;
    if (docId) checklistFiles[checklistKey] = docId;

    cases[idx] = {
      ...cases[idx],
      documentChecklist: checklist,
      documentChecklistFiles: checklistFiles,
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        {
          id: `TL-CHECKLIST-${Date.now()}`,
          date: now,
          title: `Checklist: ${checklistKey} ${verified !== false ? "verified" : "unverified"}`,
          description: `${userName || "System"} ${verified !== false ? "verified" : "unverified"} mandatory document: ${checklistKey}`,
          type: "document",
          user: userName || "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "update-checklist");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Checklist update error:", err);
    return c.json({ success: false, error: `Checklist error: ${err}` }, 500);
  }
});

// Verify 2 Lac payment
app.post("/make-server-5cdc87b7/pipeline/verify-payment", async (c) => {
  try {
    const { caseId, verified, userId, userName } = await c.req.json();
    if (!caseId) return c.json({ success: false, error: "caseId required" }, 400);

    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: `Case ${caseId} not found` }, 404);

    const now = new Date().toISOString();
    cases[idx] = {
      ...cases[idx],
      paymentVerified: verified !== false,
      paymentVerifiedAt: now,
      paymentVerifiedBy: userName || userId || "System",
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        {
          id: `TL-PAYVERIFY-${Date.now()}`,
          date: now,
          title: verified !== false ? "2 Lac Payment Verified" : "2 Lac Payment Unverified",
          description: `${userName || "System"} ${verified !== false ? "confirmed" : "revoked"} initial payment (PKR 2,00,000)`,
          type: "payment",
          user: userName || "System",
        },
      ],
    };

    await kvSet(KEY.cases, cases, "verify-payment");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    console.log("Payment verify error:", err);
    return c.json({ success: false, error: `Payment verify error: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);