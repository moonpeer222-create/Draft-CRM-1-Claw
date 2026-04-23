import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as db from "../lib/db.ts";
import { hashPw, createSession, validateSession, destroySession } from "../lib/auth.ts";
import { rateLimiter } from "../lib/utils.ts";

const auth = new Hono();

const RESET_TTL = 10 * 60 * 1000; // 10 minutes

// Login with PostgreSQL
// LEGACY: Frontend should use supabase.auth.signInWithPassword() directly
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
        await db.auditLog.create({
          user_id: session.user_id,
          user_email: session.email,
          action: "logout",
          entity_type: "session",
          entity_id: token,
          ip_address: c.req.header("x-forwarded-for") || "unknown",
          user_agent: c.req.header("user-agent"),
          tenant_id: session.tenant_id
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
    
    const user = await db.users.findByEmail(email);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetExpires = new Date(Date.now() + RESET_TTL).toISOString();
    
    await db.users.update(user.id, {
      reset_token: resetToken,
      reset_expires: resetExpires
    });
    
    // Log audit
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "forgot_password",
      entity_type: "user",
      entity_id: user.id,
      ip_address: c.req.header("x-forwarded-for") || "unknown",
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({ success: true, data: { resetToken } });
  } catch (err: any) {
    return c.json({ success: false, error: `Forgot password error: ${err?.message || err}` }, 500);
  }
});

// Reset password with PostgreSQL
auth.post("/reset-password", async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    
    if (!token || !newPassword) {
      return c.json({ success: false, error: "Token and new password are required" }, 400);
    }
    
    // Find user by reset token
    const client = db.getClient();
    const { data: profiles, error } = await client
      .from('profiles')
      .select('*')
      .eq('reset_token', token)
      .single();
    
    if (error || !profiles) {
      return c.json({ success: false, error: "Invalid or expired token" }, 400);
    }
    
    // Check if token expired
    if (new Date(profiles.reset_expires) < new Date()) {
      return c.json({ success: false, error: "Token expired" }, 400);
    }
    
    // Update password via Supabase Auth admin API
    const { error: authError } = await client.auth.admin.updateUserById(profiles.id, {
      password: newPassword
    });
    
    if (authError) {
      return c.json({ success: false, error: `Password update failed: ${authError.message}` }, 500);
    }
    
    // Clear reset token
    await db.users.update(profiles.id, {
      reset_token: null,
      reset_expires: null
    });
    
    // Log audit
    await db.auditLog.create({
      user_id: profiles.id,
      user_email: profiles.email,
      action: "reset_password",
      entity_type: "user",
      entity_id: profiles.id,
      ip_address: c.req.header("x-forwarded-for") || "unknown",
      user_agent: c.req.header("user-agent"),
      tenant_id: profiles.tenant_id
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Reset password error: ${err?.message || err}` }, 500);
  }
});

// Register new user
auth.post("/register", async (c) => {
  try {
    const { email, password, fullName, role, tenantCode } = await c.req.json();
    
    if (!email || !password || !fullName) {
      return c.json({ success: false, error: "Email, password, and full name are required" }, 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, error: "Invalid email format" }, 400);
    }
    
    // Check if user exists in profiles
    const existingUser = await db.users.findByEmail(email);
    if (existingUser) {
      return c.json({ success: false, error: "User already exists" }, 409);
    }
    
    // Create user in Supabase Auth
    const adminClient = db.getClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    
    if (authError) {
      return c.json({ success: false, error: `Auth creation failed: ${authError.message}` }, 400);
    }
    
    const userId = authData.user.id;
    
    // Update the auto-created profile with CRM fields
    const user = await db.users.update(userId, {
      full_name: fullName,
      role: role || "customer",
      status: "active",
      tenant_id: tenantCode || null
    });
    
    // Log audit
    await db.auditLog.create({
      user_id: userId,
      user_email: email,
      action: "register",
      entity_type: "user",
      entity_id: userId,
      ip_address: c.req.header("x-forwarded-for") || "unknown",
      user_agent: c.req.header("user-agent"),
      tenant_id: tenantCode || null
    });
    
    return c.json({ success: true, data: { userId } });
  } catch (err: any) {
    return c.json({ success: false, error: `Registration error: ${err?.message || err}` }, 500);
  }
});

// Refresh token
auth.post("/refresh", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, error: "No token provided" }, 400);
    }
    
    const session = await db.sessions.findByToken(token);
    if (!session) {
      return c.json({ success: false, error: "Invalid session" }, 401);
    }
    
    // Create new session
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const newSession = await createSession(session.user_id, session.full_name, session.email, session.role, ip);
    
    // Delete old session
    await db.sessions.delete(token);
    
    return c.json({
      success: true,
      data: {
        token: newSession.token,
        expiresAt: newSession.expiresAt
      }
    });
  } catch (err: any) {
    return c.json({ success: false, error: `Refresh error: ${err?.message || err}` }, 500);
  }
});

// Verify agent code
auth.post("/verify-agent-code", async (c) => {
  try {
    const { code } = await c.req.json();
    
    if (!code) {
      return c.json({ success: false, error: "Code is required" }, 400);
    }
    
    const agentCode = await db.agentCodes.findByCode(code);
    if (!agentCode || !agentCode.is_active) {
      return c.json({ success: false, error: "Invalid or inactive code" }, 400);
    }
    
    return c.json({ success: true, data: { valid: true, code: agentCode } });
  } catch (err: any) {
    return c.json({ success: false, error: `Verify code error: ${err?.message || err}` }, 500);
  }
});

// Login with agent code
auth.post("/agent-code-login", async (c) => {
  try {
    const { code } = await c.req.json();
    
    if (!code) {
      return c.json({ success: false, error: "Code is required" }, 400);
    }
    
    const agentCode = await db.agentCodes.findByCode(code);
    if (!agentCode || !agentCode.is_active) {
      return c.json({ success: false, error: "Invalid or inactive code" }, 400);
    }
    
    // Increment usage
    await db.agentCodes.incrementUsage(code);
    
    // Create session for agent
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const session = await createSession(
      agentCode.id,
      agentCode.agent_name || "Agent",
      agentCode.email || "agent@example.com",
      "agent",
      ip
    );
    
    return c.json({
      success: true,
      data: {
        token: session.token,
        userId: session.userId,
        fullName: session.fullName,
        email: session.email,
        role: "agent",
        expiresAt: session.expiresAt
      }
    });
  } catch (err: any) {
    return c.json({ success: false, error: `Agent code login error: ${err?.message || err}` }, 500);
  }
});

// Change password
auth.post("/change-password", async (c) => {
  try {
    const token = c.req.header("x-session-token");
    if (!token) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }
    
    const session = await db.sessions.findByToken(token);
    if (!session) {
      return c.json({ success: false, error: "Invalid session" }, 401);
    }
    
    const { oldPassword, newPassword } = await c.req.json();
    
    if (!oldPassword || !newPassword) {
      return c.json({ success: false, error: "Old and new passwords are required" }, 400);
    }
    
    // Verify user exists
    const user = await db.users.findById(session.user_id);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Update password via Supabase Auth admin API
    // Note: oldPassword is not verified server-side. The frontend should verify via Supabase Auth first.
    const adminClient = db.getClient();
    const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    
    if (authError) {
      return c.json({ success: false, error: `Password update failed: ${authError.message}` }, 500);
    }
    
    // Log audit
    await db.auditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "change_password",
      entity_type: "user",
      entity_id: user.id,
      ip_address: c.req.header("x-forwarded-for") || "unknown",
      user_agent: c.req.header("user-agent"),
      tenant_id: user.tenant_id
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: `Change password error: ${err?.message || err}` }, 500);
  }
});

export default auth;
