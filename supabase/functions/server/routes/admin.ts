/**
 * Admin Routes - PostgreSQL Version
 * Administrative functions and system management
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { db } from "../lib/db.ts";
import * as kv from "../kv_store.tsx";
import { KEY } from "../lib/constants.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { ServerSession } from "../lib/auth.ts";
import { rateLimiter } from "../lib/utils.ts";

const admin = new Hono();

// ==================== PIPELINE MANAGEMENT ====================

// GET /admin/pipeline/sla-alerts - Get overdue cases
admin.get("/pipeline/sla-alerts", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const now = Date.now();
    
    // Get overdue cases from PostgreSQL
    const overdueCases = await db.cases.getOverdue(session.tenantId || undefined);
    
    const alerts = overdueCases
      .filter((cs: any) => {
        if (!cs.stage_started_at || !cs.current_stage) return false;
        if (cs.status === 'cancelled' || cs.status === 'completed') return false;
        const stageStart = new Date(cs.stage_started_at).getTime();
        return now > (stageStart + 24 * 3600000); // 24hr SLA
      })
      .map((cs: any) => ({
        case_id: cs.id,
        case_number: cs.case_number,
        customer_name: cs.customer_name,
        current_stage: cs.current_stage,
        hours_overdue: Math.round((now - (new Date(cs.stage_started_at).getTime() + 24 * 3600000)) / 3600000),
        stage_started_at: cs.stage_started_at
      }));
    
    return c.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    console.error("SLA alerts error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /admin/pipeline/advance-stage - Advance case stage
admin.post("/pipeline/advance-stage", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const { case_id, next_stage_key, user_name } = await c.req.json();
    
    if (!case_id || !next_stage_key) {
      return c.json({ success: false, error: "case_id and next_stage_key are required" }, 400);
    }
    
    // Get existing case
    const caseData = await db.cases.getById(case_id);
    if (!caseData) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    // Verify tenant access
    if (caseData.tenant_id && caseData.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    const now = new Date().toISOString();
    const timelineEntry = {
      id: `TL-${Date.now()}`,
      date: now,
      title: `Stage advanced to ${next_stage_key}`,
      user: user_name || session.fullName,
      previous_stage: caseData.current_stage
    };
    
    const updated = await db.cases.update(case_id, {
      current_stage: next_stage_key,
      status: next_stage_key,
      stage_started_at: now,
      timeline: [...(caseData.timeline || []), timelineEntry]
    });
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "stage_advanced",
      entity_type: "case",
      entity_id: case_id,
      details: { 
        previous_stage: caseData.current_stage,
        new_stage: next_stage_key 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error("Advance stage error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /admin/pipeline/stages - Get all pipeline stages with counts
admin.get("/pipeline/stages", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    
    // Get all cases for this tenant
    const cases = await db.cases.getAll({ 
      tenant_id: session.tenantId || undefined,
      limit: 10000 // Get all
    });
    
    // Group by stage
    const stages: Record<string, { count: number; cases: any[] }> = {};
    for (const cs of cases) {
      const stage = cs.current_stage || 'intake';
      if (!stages[stage]) {
        stages[stage] = { count: 0, cases: [] };
      }
      stages[stage].count++;
      if (stages[stage].cases.length < 5) {
        stages[stage].cases.push({
          id: cs.id,
          case_number: cs.case_number,
          customer_name: cs.customer_name,
          country: cs.country
        });
      }
    }
    
    return c.json({ success: true, data: stages });
  } catch (err) {
    console.error("Pipeline stages error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== USER MANAGEMENT ====================

// GET /admin/users - Get all users
admin.get("/users", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const query = c.req.query();
    
    const options: any = {
      tenant_id: session.tenantId || undefined,
      limit: query.limit ? parseInt(query.limit) : 100
    };
    
    if (query.role) options.role = query.role;
    if (query.status) options.status = query.status;
    
    const users = await db.users.findAll(options);
    
    // Remove sensitive data
    const sanitized = users.map((u: any) => {
      const { password_hash, ...safe } = u;
      return safe;
    });
    
    return c.json({ success: true, data: sanitized, count: sanitized.length });
  } catch (err) {
    console.error("Get users error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /admin/users - Create new user
admin.post("/users", authMiddleware(["master_admin", "admin"]), rateLimiter(10), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    
    // Validate required fields
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return c.json({ success: false, error: "email, password, full_name, and role are required" }, 400);
    }
    
    // Check if email exists
    const existing = await db.users.findByEmail(body.email);
    if (existing) {
      return c.json({ success: false, error: "Email already exists" }, 409);
    }
    
    // Hash password
    const { hashPw } = await import("../lib/auth.ts");
    const password_hash = await hashPw(body.password);
    
    // Create user
    const user = await db.users.create({
      email: body.email,
      password_hash,
      full_name: body.full_name,
      role: body.role,
      status: body.status || 'active',
      phone: body.phone,
      department: body.department,
      employee_id: body.employee_id,
      tenant_id: session.tenantId,
      metadata: body.metadata || {}
    });
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "user_created",
      entity_type: "user",
      entity_id: user.id,
      details: { 
        new_user_email: body.email,
        new_user_role: body.role 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    // Return without password
    const { password_hash: _, ...safeUser } = user;
    
    return c.json({ success: true, data: safeUser });
  } catch (err) {
    console.error("Create user error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PUT /admin/users/:userId - Update user
admin.put("/users/:userId", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const userId = c.req.param("userId");
    const updates = await c.req.json();
    
    // Get existing user
    const existing = await db.users.findById(userId);
    if (!existing) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Verify tenant access
    if (existing.tenant_id && existing.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    // Don't allow role changes unless master_admin
    if (updates.role && session.role !== 'master_admin' && existing.role !== updates.role) {
      return c.json({ success: false, error: "Only master admin can change roles" }, 403);
    }
    
    // Handle password update
    if (updates.password) {
      const { hashPw } = await import("../lib/auth.ts");
      updates.password_hash = await hashPw(updates.password);
      delete updates.password;
    }
    
    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.email; // Email changes need special handling
    
    const updated = await db.users.update(userId, updates);
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "user_updated",
      entity_type: "user",
      entity_id: userId,
      details: { 
        updated_fields: Object.keys(updates),
        target_user_email: existing.email 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    // Return without password
    const { password_hash, ...safeUser } = updated;
    
    return c.json({ success: true, data: safeUser });
  } catch (err) {
    console.error("Update user error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /admin/users/:userId - Delete/disable user
admin.delete("/users/:userId", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const userId = c.req.param("userId");
    
    // Get existing user
    const existing = await db.users.findById(userId);
    if (!existing) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Verify tenant access
    if (existing.tenant_id && existing.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    // Soft delete - just mark as inactive
    await db.users.update(userId, { status: 'inactive' });
    
    // Invalidate all sessions
    await db.sessions.deleteByUser(userId);
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "user_deactivated",
      entity_type: "user",
      entity_id: userId,
      details: { 
        target_user_email: existing.email,
        target_user_role: existing.role 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, message: "User deactivated" });
  } catch (err) {
    console.error("Delete user error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== AGENT CODES ====================

// GET /admin/agent-codes - Get all agent codes
admin.get("/agent-codes", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const codes = await db.agentCodes.getAll({ 
      tenant_id: session.tenantId || undefined 
    });
    
    return c.json({ success: true, data: codes });
  } catch (err) {
    console.error("Get agent codes error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /admin/agent-codes - Create new agent code
admin.post("/agent-codes", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    
    if (!body.code) {
      return c.json({ success: false, error: "code is required" }, 400);
    }
    
    // Check if code exists
    const existing = await db.agentCodes.findByCode(body.code);
    if (existing) {
      return c.json({ success: false, error: "Code already exists" }, 409);
    }
    
    const code = await db.agentCodes.create({
      code: body.code,
      agent_id: body.agent_id,
      agent_name: body.agent_name,
      description: body.description,
      max_uses: body.max_uses,
      expires_at: body.expires_at,
      created_by: session.userId,
      tenant_id: session.tenantId
    });
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "agent_code_created",
      entity_type: "agent_code",
      entity_id: code.id,
      details: { code: body.code },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, data: code });
  } catch (err) {
    console.error("Create agent code error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== AUDIT LOG ====================

// GET /admin/audit-log - Get audit log entries
admin.get("/audit-log", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const query = c.req.query();
    
    const options: any = {
      tenant_id: session.tenantId || undefined,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0
    };
    
    if (query.user_id) options.user_id = query.user_id;
    if (query.entity_type) options.entity_type = query.entity_type;
    if (query.action) options.action = query.action;
    
    const logs = await db.auditLog.getAll(options);
    
    return c.json({ success: true, data: logs, count: logs.length });
  } catch (err) {
    console.error("Get audit log error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== SYSTEM SETTINGS ====================

// GET /admin/settings - Get all settings
admin.get("/settings", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const settings = await db.settings.getAll(session.tenantId || undefined);
    
    return c.json({ success: true, data: settings });
  } catch (err) {
    console.error("Get settings error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PUT /admin/settings/:key - Update setting
admin.put("/settings/:key", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const key = c.req.param("key");
    const body = await c.req.json();
    
    const setting = await db.settings.set(key, body.value, {
      description: body.description,
      updated_by: session.userId,
      tenant_id: session.tenantId
    });
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "setting_updated",
      entity_type: "setting",
      entity_id: key,
      details: { key, value: body.value },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, data: setting });
  } catch (err) {
    console.error("Update setting error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== REPORTS ====================

// GET /admin/reports/summary - Get system summary report
admin.get("/reports/summary", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const tenantId = session.tenantId || undefined;
    
    const [
      totalUsers,
      totalCases,
      activeCases,
      completedCases,
      pendingLeaveRequests
    ] = await Promise.all([
      db.users.count({ tenant_id: tenantId, status: 'active' }),
      db.cases.count({ tenant_id: tenantId }),
      db.cases.count({ tenant_id: tenantId, status: 'in_progress' }),
      db.cases.count({ tenant_id: tenantId, status: 'completed' }),
      db.leaveRequests.getPending(tenantId).then(r => r.length)
    ]);
    
    return c.json({
      success: true,
      data: {
        users: { total: totalUsers },
        cases: {
          total: totalCases,
          active: activeCases,
          completed: completedCases,
          completion_rate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
        },
        hr: {
          pending_leave_requests: pendingLeaveRequests
        },
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Summary report error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== PANIC MODE ====================

const PANIC_KEY = "crm:panic_mode";

admin.post("/panic/trigger", authMiddleware(["master_admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    
    // Store in KV for immediate system-wide effect
    await kv.set(PANIC_KEY, { 
      active: true, 
      triggered_by: session.userId,
      triggered_at: new Date().toISOString()
    });
    
    // Also store in settings for persistence
    await db.settings.set(PANIC_KEY, {
      active: true,
      triggered_by: session.userId,
      triggered_at: new Date().toISOString()
    }, {
      description: "Emergency panic mode - locks system",
      updated_by: session.userId,
      tenant_id: session.tenantId
    });
    
    // Log the panic
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "panic_triggered",
      entity_type: "system",
      entity_id: "panic_mode",
      details: { reason: "Manual trigger by admin" },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, message: "Panic mode activated" });
  } catch (err) {
    console.error("Panic trigger error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

admin.post("/panic/clear", authMiddleware(["master_admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    
    await kv.set(PANIC_KEY, { active: false, cleared_at: new Date().toISOString() });
    await db.settings.set(PANIC_KEY, { active: false }, {
      description: "Emergency panic mode - locks system",
      updated_by: session.userId,
      tenant_id: session.tenantId
    });
    
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "panic_cleared",
      entity_type: "system",
      entity_id: "panic_mode",
      details: {},
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, message: "Panic mode cleared" });
  } catch (err) {
    console.error("Panic clear error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

admin.get("/panic/status", async (c) => {
  try {
    // Check KV first (faster)
    const kvPanic = await kv.get(PANIC_KEY);
    
    if (kvPanic) {
      return c.json({ success: true, active: !!kvPanic.active });
    }
    
    // Fallback to settings
    const settingsPanic = await db.settings.get(PANIC_KEY);
    
    return c.json({ success: true, active: !!(settingsPanic?.active) });
  } catch (err) {
    console.error("Panic status error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== SALARY CALCULATION ====================

admin.post("/salary/calculate", authMiddleware(["master_admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const { month, year, agent_id } = await c.req.json();
    
    if (!month || !year) {
      return c.json({ success: false, error: "month and year are required" }, 400);
    }
    
    // Get cases for the period
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const cases = await db.cases.getAll({
      tenant_id: session.tenantId || undefined,
      agent_id: agent_id || undefined,
      limit: 10000
    });
    
    // Filter by completion date in the month
    const monthCases = cases.filter((cs: any) => {
      if (!cs.completed_at) return false;
      const completed = new Date(cs.completed_at);
      return completed.getMonth() + 1 === parseInt(month) && 
             completed.getFullYear() === parseInt(year);
    });
    
    // Calculate commissions
    const calculations = monthCases.map((cs: any) => ({
      case_id: cs.id,
      case_number: cs.case_number,
      customer_name: cs.customer_name,
      country: cs.country,
      total_fee: cs.total_fee || 0,
      paid_amount: cs.paid_amount || 0,
      commission_rate: 0.1, // 10% default
      commission: (cs.total_fee || 0) * 0.1
    }));
    
    const totalCommission = calculations.reduce((sum: number, c: any) => sum + c.commission, 0);
    
    return c.json({
      success: true,
      data: {
        month,
        year,
        agent_id,
        total_cases: monthCases.length,
        total_commission: totalCommission,
        calculations
      }
    });
  } catch (err) {
    console.error("Salary calculation error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

export default admin;
