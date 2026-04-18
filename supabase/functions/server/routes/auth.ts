/**
 * Authentication Routes - PostgreSQL Version
 * Migrated from KV store to proper relational tables
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { db } from "../lib/db.ts";
import { SESSION_PREFIX } from "../lib/constants.ts";
import { hashPw, createSession, validateSession, destroySession } from "../lib/auth.ts";
import { rateLimiter } from "../lib/utils.ts";
import { logAIAudit } from "../lib/supabase.ts";

const auth = new Hono();
const RESET_PREFIX = "crm:pw_reset:";
const RESET_TTL = 10 * 60 * 1000; // 10 minutes

// POST /auth/login - Authenticate user and create session
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, role: requestedRole } = body;
    
    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }

    // Find user by email using PostgreSQL
    const user = await db.users.findByEmail(email);
    
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 401);
    }
    
    if (user.status !== "active") {
      return c.json({ success: false, error: `Account is ${user.status}` }, 403);
    }
    
    // Verify password
    const hashedInput = await hashPw(password);
    if (user.password_hash !== hashedInput) {
      // Log failed login attempt
      await logAIAudit({
        role: "system",
        userId: user.id,
        message: `Failed login attempt for ${email}`,
        hasActions: false,
        model: "auth",
        timestamp: new Date().toISOString()
      });
      return c.json({ success: false, error: "Invalid password" }, 401);
    }
    
    // Role verification
    if (requestedRole && user.role !== requestedRole) {
      if (!(requestedRole === "admin" && user.role === "master_admin")) {
        return c.json({ success: false, error: `Not a ${requestedRole} account` }, 403);
      }
    }
    
    // Create session
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const session = await createSession(user.id, user.full_name, user.email, user.role, ip);
    
    // Update last login
    await db.users.updateLastLogin(user.id);
    
    // Log successful login
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "user_login",
      entity_type: "user",
      entity_id: user.id,
      details: { ip_address: ip, role: user.role },
      ip_address: ip,
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({
      success: true,
      data: { 
        token: session.token, 
        userId: session.user_id, 
        fullName: session.full_name, 
        email: session.email, 
        role: session.role, 
        expiresAt: session.expires_at 
      },
    });
  } catch (err: any) {
    console.error("Auth login error:", err);
    return c.json({ success: false, error: `Login error: ${err?.message || err}` }, 500);
  }
});

// POST /auth/validate - Validate session token
auth.post("/validate", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) return c.json({ success: false, valid: false });
    
    const session = await validateSession(token);
    if (!session) return c.json({ success: true, valid: false });
    
    return c.json({ 
      success: true, 
      valid: true, 
      data: { 
        userId: session.user_id, 
        fullName: session.full_name, 
        email: session.email, 
        role: session.role, 
        expiresAt: session.expires_at 
      } 
    });
  } catch (err: any) {
    console.error("Auth validate error:", err);
    return c.json({ success: false, valid: false, error: `Validation error: ${err?.message || err}` }, 500);
  }
});

// POST /auth/logout - Destroy session
auth.post("/logout", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (token) {
      // Get session before destroying for audit log
      const session = await db.sessions.findByToken(token);
      await destroySession(token);
      
      if (session) {
        await db.auditLog.create({
          user_id: session.user_id,
          user_email: session.email,
          action: "user_logout",
          entity_type: "session",
          entity_id: session.token,
          details: { ip_address: c.req.header("x-forwarded-for") },
          ip_address: c.req.header("x-forwarded-for"),
          user_agent: c.req.header("user-agent")
        });
      }
    }
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Auth logout error:", err);
    return c.json({ success: false, error: `Logout error: ${err?.message || err}` }, 500);
  }
});

// POST /auth/forgot-password - Send password reset code
auth.post("/forgot-password", rateLimiter(5), async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ success: false, error: "Email is required" }, 400);
    
    // Find user
    const user = await db.users.findByEmail(email);
    
    if (!user) {
      // Return success even if user not found (security best practice)
      return c.json({ success: true, message: "If this email exists, a code was sent." });
    }
    
    // Generate reset code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + RESET_TTL;
    
    // Store in settings table (temporary storage)
    await db.settings.set(`${RESET_PREFIX}${email.toLowerCase()}`, { 
      code, 
      expiresAt, 
      used: false,
      userId: user.id 
    }, { 
      description: "Password reset code",
      tenant_id: user.tenant_id 
    });
    
    // Send email via Brevo
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { 
            "accept": "application/json", 
            "content-type": "application/json", 
            "api-key": brevoKey 
          },
          body: JSON.stringify({
            sender: { name: "Emerald Tech Partner", email: "noreply@emeraldvisa.com" },
            to: [{ email: user.email, name: user.full_name }],
            subject: "Password Reset Code - Emerald Tech Partner",
            htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#f8f9fa;border-radius:12px;"><div style="text-align:center;padding:20px 0;"><h2 style="color:#059669;margin:0;">Emerald Tech Partner</h2><p style="color:#6b7280;font-size:14px;">Password Reset Request</p></div><div style="background:white;padding:30px;border-radius:8px;text-align:center;"><p style="color:#374151;font-size:16px;">Hello <strong>${user.full_name}</strong>,</p><p style="color:#6b7280;font-size:14px;">Use this code to reset your password:</p><div style="background:#059669;color:white;font-size:32px;letter-spacing:8px;padding:20px;border-radius:8px;margin:20px 0;font-family:monospace;font-weight:bold;">${code}</div><p style="color:#9ca3af;font-size:12px;">This code expires in 10 minutes.</p></div><p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:20px;">Emerald Tech Partner | Lahore, Pakistan</p></div>`,
          }),
        });
      } catch (e) {
        console.error("Email send error:", e);
      }
    }
    
    // Log password reset request
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "password_reset_requested",
      entity_type: "user",
      entity_id: user.id,
      details: { ip_address: c.req.header("x-forwarded-for") },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({ success: true, message: "Reset code sent" });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /auth/reset-password - Reset password with code
auth.post("/reset-password", rateLimiter(3), async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    
    if (!email || !code || !newPassword) {
      return c.json({ success: false, error: "Email, code, and new password are required" }, 400);
    }
    
    // Get reset code from settings
    const resetData = await db.settings.get(`${RESET_PREFIX}${email.toLowerCase()}`);
    
    if (!resetData || resetData.used || resetData.code !== code || Date.now() > resetData.expiresAt) {
      return c.json({ success: false, error: "Invalid or expired reset code" }, 400);
    }
    
    // Find user
    const user = await db.users.findByEmail(email);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Hash new password
    const newPasswordHash = await hashPw(newPassword);
    
    // Update password
    await db.users.update(user.id, { password_hash: newPasswordHash });
    
    // Mark reset code as used
    await db.settings.set(`${RESET_PREFIX}${email.toLowerCase()}`, { 
      ...resetData, 
      used: true 
    });
    
    // Invalidate all sessions for this user
    await db.sessions.deleteByUser(user.id);
    
    // Log password change
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "password_reset_completed",
      entity_type: "user",
      entity_id: user.id,
      details: { ip_address: c.req.header("x-forwarded-for") },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({ success: true, message: "Password reset successful" });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /auth/change-password - Change password (authenticated)
auth.post("/change-password", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }
    
    const session = await validateSession(token);
    if (!session) {
      return c.json({ success: false, error: "Invalid session" }, 401);
    }
    
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) {
      return c.json({ success: false, error: "Current and new password are required" }, 400);
    }
    
    // Get user
    const user = await db.users.findById(session.user_id);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Verify current password
    const currentHash = await hashPw(currentPassword);
    if (user.password_hash !== currentHash) {
      return c.json({ success: false, error: "Current password is incorrect" }, 401);
    }
    
    // Hash and update new password
    const newHash = await hashPw(newPassword);
    await db.users.update(user.id, { password_hash: newHash });
    
    // Log password change
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "password_changed",
      entity_type: "user",
      entity_id: user.id,
      details: { ip_address: c.req.header("x-forwarded-for") },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({ success: true, message: "Password changed successfully" });
  } catch (err: any) {
    console.error("Change password error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /auth/me - Get current user info
auth.get("/me", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }
    
    const session = await validateSession(token);
    if (!session) {
      return c.json({ success: false, error: "Invalid session" }, 401);
    }
    
    // Get full user data
    const user = await db.users.findById(session.user_id);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Return user without sensitive data
    const { password_hash, ...userWithoutPassword } = user;
    
    return c.json({ 
      success: true, 
      data: {
        ...userWithoutPassword,
        session: {
          token: session.token,
          expiresAt: session.expires_at
        }
      }
    });
  } catch (err: any) {
    console.error("Get user error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default auth;
