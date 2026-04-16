/**
 * Server-side Session & Auth Middleware for Emerald Visa CRM
 * 
 * Improvement #1: Server routes are now protected with session-token validation.
 * Improvement #9: Rate limiting middleware is included.
 * Improvement #4: Input validation helpers are included.
 *
 * Session flow:
 *   1. Frontend calls POST /auth/login with credentials
 *   2. Server validates against users KV, creates session in KV, returns token
 *   3. Frontend stores token, sends it as `x-session-token` header on every request
 *   4. authMiddleware validates the token on protected routes
 */

import * as kv from "./kv_store.tsx";

// ── Types ──────────────────────────────────────────────────
export interface ServerSession {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  role: "master_admin" | "admin" | "agent" | "customer" | "operator";
  createdAt: string;
  expiresAt: string;
  ip?: string;
}

// ── Constants ──────────────────────────────────────────────
const SESSION_PREFIX = "crm:session:";
const SESSION_TTL: Record<string, number> = {
  master_admin: 12 * 60 * 60 * 1000, // 12 hours
  admin: 8 * 60 * 60 * 1000,         // 8 hours
  agent: 6 * 60 * 60 * 1000,         // 6 hours
  customer: 12 * 60 * 60 * 1000,     // 12 hours
  operator: 8 * 60 * 60 * 1000,      // 8 hours
};

// ── Session CRUD ───────────────────────────────────────────

/** Generate a cryptographically random session token */
function generateToken(): string {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

/** Create a new session and store in KV */
export async function createSession(
  userId: string,
  fullName: string,
  email: string,
  role: ServerSession["role"],
  ip?: string
): Promise<ServerSession> {
  const token = generateToken();
  const now = new Date();
  const ttl = SESSION_TTL[role] || 8 * 60 * 60 * 1000;
  const session: ServerSession = {
    token,
    userId,
    fullName,
    email,
    role,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    ip,
  };
  await kv.set(`${SESSION_PREFIX}${token}`, session);
  console.log(`Session created for ${fullName} (${role}) — token prefix: ${token.substring(0, 8)}...`);
  return session;
}

/** Validate a session token — returns session or null */
export async function validateSession(token: string): Promise<ServerSession | null> {
  if (!token || token.length < 10) return null;
  try {
    const session = await kv.get(`${SESSION_PREFIX}${token}`) as ServerSession | null;
    if (!session) return null;
    // Check expiry
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      // Expired — clean up
      await kv.del(`${SESSION_PREFIX}${token}`);
      console.log(`Session expired for ${session.fullName} (${session.role})`);
      return null;
    }
    return session;
  } catch (err) {
    console.log("Session validation error:", err);
    return null;
  }
}

/** Destroy a session (logout) */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await kv.del(`${SESSION_PREFIX}${token}`);
}

/** Destroy all sessions for a user (force logout everywhere) */
export async function destroyUserSessions(userId: string): Promise<number> {
  try {
    const allSessions = await kv.getByPrefix(SESSION_PREFIX);
    let count = 0;
    for (const session of allSessions) {
      if (session && typeof session === "object" && (session as any).userId === userId) {
        await kv.del(`${SESSION_PREFIX}${(session as any).token}`);
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// ── Hono Middleware ────────────────────────────────────────

/**
 * Strict auth middleware — blocks requests without a valid session.
 * Use ONLY on truly sensitive endpoints (panic, user management, backup).
 * @param allowedRoles - if specified, only these roles can access the route
 */
export function authMiddleware(allowedRoles?: ServerSession["role"][]) {
  return async (c: any, next: () => Promise<void>) => {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, error: "Authentication required. Please log in." }, 401);
    }
    const session = await validateSession(token);
    if (!session) {
      return c.json({ success: false, error: "Session expired or invalid. Please log in again." }, 401);
    }
    // Role check
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      return c.json({ success: false, error: `Access denied. Required role: ${allowedRoles.join(" or ")}` }, 403);
    }
    // Attach session to context for downstream handlers
    c.set("session", session);
    await next();
  };
}

/**
 * Soft auth middleware — attaches session info when available but NEVER blocks.
 * Use on data read/write routes that must work in offline-first mode (before login).
 * Downstream handlers can optionally read c.get("session") for audit logging.
 */
export function softAuth() {
  return async (c: any, next: () => Promise<void>) => {
    const token = c.req.header("x-session-token");
    if (token) {
      try {
        const session = await validateSession(token);
        if (session) {
          c.set("session", session);
        }
      } catch {
        // Non-fatal — continue without session
      }
    }
    await next();
  };
}

// ── Rate Limiter (Improvement #9) ──────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;        // 60 requests per minute per IP
const AI_RATE_LIMIT_MAX = 10;     // 10 AI requests per minute

export function rateLimiter(maxRequests = RATE_LIMIT_MAX) {
  return async (c: any, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "unknown";
    const key = `${ip}:${maxRequests}`;
    const now = Date.now();

    let entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
      rateLimitMap.set(key, entry);
    }

    entry.count++;
    if (entry.count > maxRequests) {
      console.log(`Rate limit exceeded for ${ip} (${entry.count}/${maxRequests})`);
      return c.json({ success: false, error: "Too many requests. Please slow down." }, 429);
    }

    // Clean up old entries periodically
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) rateLimitMap.delete(k);
      }
    }

    await next();
  };
}

export { AI_RATE_LIMIT_MAX };

// ── Input Validation Helpers (Improvement #4) ──────────────

export function validateRequired(obj: any, fields: string[]): string | null {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

export function validateCaseStatus(status: string, validStatuses: string[]): boolean {
  return validStatuses.includes(status);
}

export function sanitizeString(str: string, maxLength = 1000): string {
  if (typeof str !== "string") return "";
  return str.trim().substring(0, maxLength);
}

export function sanitizeCaseUpdate(updates: any): any {
  // Only allow known case fields to be updated — prevent arbitrary injection
  const ALLOWED_CASE_FIELDS = [
    "customerName", "fatherName", "phone", "email", "cnic", "passport",
    "country", "jobType", "jobDescription", "address", "city", "maritalStatus",
    "dateOfBirth", "emergencyContact", "education", "experience",
    "status", "agentId", "agentName", "priority", "totalFee", "paidAmount",
    "currentStage", "stageStartedAt", "stageDeadlineAt", "isOverdue",
    "timeline", "documents", "payments", "medical", "notes",
    "medicalToken", "biometricDate", "eNumber", "protectorDate",
    "ticketInfo", "departureDate", "completedAt",
    "flagged", "flagReason", "flaggedBy", "flaggedAt",
  ];
  const sanitized: any = {};
  for (const key of ALLOWED_CASE_FIELDS) {
    if (updates[key] !== undefined) {
      sanitized[key] = updates[key];
    }
  }
  return sanitized;
}