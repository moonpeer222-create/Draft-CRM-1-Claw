import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as kv from "../kv_store.tsx";
import { KEY, SESSION_PREFIX } from "../lib/constants.ts";
import { kvSet } from "../lib/supabase.ts";
import { hashPw, createSession, validateSession, destroySession } from "../lib/auth.ts";
import { rateLimiter } from "../lib/utils.ts";

const auth = new Hono();

const RESET_PREFIX = "crm:pw_reset:";
const RESET_TTL = 10 * 60 * 1000; // 10 minutes

auth.post("/login", async (c) => {
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

auth.post("/validate", async (c) => {
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

auth.post("/logout", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (token) await destroySession(token);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Logout error: ${err?.message || err}` }, 500);
  }
});

auth.post("/forgot-password", rateLimiter(5), async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ success: false, error: "Email is required" }, 400);
    const users = (await kv.get(KEY.users)) || [];
    const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return c.json({ success: true, message: "If this email exists, a code was sent." });
    }
    
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + RESET_TTL;
    await kvSet(`${RESET_PREFIX}${email.toLowerCase()}`, { code, expiresAt, used: false }, "pw-reset-store");
    
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "accept": "application/json", "content-type": "application/json", "api-key": brevoKey },
          body: JSON.stringify({
            sender: { name: "Emerald Tech Partner", email: "noreply@emeraldvisa.com" },
            to: [{ email: user.email, name: user.fullName }],
            subject: "Password Reset Code - Emerald Tech Partner",
            htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#f8f9fa;border-radius:12px;"><div style="text-align:center;padding:20px 0;"><h2 style="color:#059669;margin:0;">Emerald Tech Partner</h2><p style="color:#6b7280;font-size:14px;">Password Reset Request</p></div><div style="background:white;padding:30px;border-radius:8px;text-align:center;"><p style="color:#374151;font-size:16px;">Hello <strong>${user.fullName}</strong>,</p><p style="color:#6b7280;font-size:14px;">Use this code to reset your password:</p><div style="background:#059669;color:white;font-size:32px;letter-spacing:8px;padding:20px;border-radius:8px;margin:20px 0;font-family:monospace;font-weight:bold;">${code}</div><p style="color:#9ca3af;font-size:12px;">This code expires in 10 minutes.</p></div><p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:20px;">Emerald Tech Partner | Lahore, Pakistan</p></div>`,
          }),
        });
      } catch (e) {
        console.log("Email send error:", e);
      }
    }
    
    return c.json({ success: true, message: "Reset code sent" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default auth;
