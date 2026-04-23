import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as db from "../lib/db.ts";
import { hashPw, createSession, validateSession, destroySession } from "../lib/auth.ts";
import { rateLimiter } from "../lib/utils.ts";

const auth = new Hono();

const RESET_TTL = 10 * 60 * 1000; // 10 minutes

// Login with PostgreSQL
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, role: requestedRole } = body;
    
    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, error: "Invalid email format" }, 400);
    }
    
    // Find user in PostgreSQL
    const user = await db.users.findByEmail(email);
    if (!user) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }
    
    if (user.status !== "active") {
      return c.json({ success: false, error: `Account is ${user.status}` }, 403);
    }
    
    // LEGACY LOGIN DISABLED: Passwords are managed by Supabase Auth.
    // The frontend should use supabase.auth.signInWithPassword() instead.
    return c.json({ 
      success: false, 
      error: "Legacy login disabled. Use Supabase Auth.",
      code: "USE_SUPABASE_AUTH"
    }, 501);
  } catch (err: any) {
    return c.json({ success: false, error: `Login error: ${err?.message || err}` }, 500);
  }
});

// Validate session with PostgreSQL
auth.post("/validate", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, valid: false }, 400);
    }
    
    const session = await db.sessions.findByToken(token);
    if (!session) {
      return c.json({ success: true, valid: false });
    }
    
    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await db.sessions.delete(token);
      return c.json({ success: true, valid: false });
    }
    
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
    return c.json({ success: false, valid: false, error: `Validation error: ${err?.message || err}` }, 500);
  }
});

// Logout with PostgreSQL
auth.post("/logout", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (token) {
      const session = await db.sessions.findByToken(token);
      if (session) {
        await db.sessions.delete(token);
        await db.audit.create({
          user_id: session.user_id,
          user_email: session.email,
          user_role: session.role,
          action: "logout",
          entity_type: "session",
          entity_id: token,
          ip_address: c.req.header("x-forwarded-for") || "unknown"
        });
      }
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Logout error: ${err?.message || err}` }, 500);
  }
});

// Forgot password with PostgreSQL
auth.post("/forgot-password", rateLimiter(5), async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ success: false, error: "Email is required" }, 400);
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, error: "Invalid email format" }, 400);
    }
    
    // Find user
    const user = await db.users.findByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists
      return c.json({ success: true, message: "If this email exists, a reset code was sent." });
    }
    
    // Generate code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + RESET_TTL).toISOString();
    
    // Save reset token
    await db.passwordReset.create({
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt
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
            htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#f8f9fa;border-radius:12px;"><div style="text-align:center;padding:20px 0;"><h2 style="color:#059669;margin:0;">Emerald Tech Partner</h2><p style="color:#6b7280;font-size:14px;">Password Reset Request</p></div><div style="background:white;padding:30px;border-radius:8px;text-align:center;"><p style="color:#374151;font-size:16px;">Hello <strong>${user.full_name}</strong>,</p><p style="color:#6b7280;font-size:14px;">Use this code to reset your password:</p><div style="background:#059669;color:white;font-size:32px;letter-spacing:8px;padding:20px;border-radius:8px;margin:20px 0;font-family:monospace;font-weight:bold;">${code}</div><p style="color:#9ca3af;font-size:12px;">This code expires in 10 minutes.</p></div><p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:20px;">Emerald Tech Partner | Lahore, Pakistan</p></div>`
          })
        });
      } catch (e) {
        // Silent fail for email
      }
    }
    
    return c.json({ success: true, message: "Reset code sent" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Reset password
auth.post("/reset-password", async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    
    if (!email || !code || !newPassword) {
      return c.json({ success: false, error: "Email, code, and new password are required" }, 400);
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    }
    
    // Find and validate reset token
    const resetToken = await db.passwordReset.findValid(email.toLowerCase(), code);
    if (!resetToken) {
      return c.json({ success: false, error: "Invalid or expired reset code" }, 400);
    }
    
    // Find user
    const user = await db.users.findByEmail(email);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Update password via Supabase Auth admin API
    const adminClient = db.getDbClient();
    const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, { 
      password: newPassword 
    });
    if (authError) {
      return c.json({ success: false, error: "Failed to update password in auth system" }, 500);
    }
    
    // Mark token as used
    await db.passwordReset.markUsed(resetToken.id);
    
    // Log audit
    await db.audit.create({
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      action: "password_reset",
      entity_type: "user",
      entity_id: user.id,
      ip_address: c.req.header("x-forwarded-for") || "unknown"
    });
    
    return c.json({ success: true, message: "Password reset successful" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default auth;
