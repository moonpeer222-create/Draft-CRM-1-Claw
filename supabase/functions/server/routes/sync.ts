/**
 * Sync Routes - PostgreSQL Version
 * Handles bulk data sync between frontend and backend
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { db } from "../lib/db.ts";
import * as kv from "../kv_store.tsx";
import { ServerSession } from "../lib/auth.ts";
import { trimArray, trimCases } from "../lib/utils.ts";
import { 
  MAX_AUDIT_LOG, 
  MAX_NOTIFICATIONS, 
  MAX_ATTENDANCE, 
  MAX_CODE_HISTORY, 
  MAX_LEAVE_REQUESTS, 
  MAX_PASSPORT_TRACKING,
  MAX_CASES
} from "../lib/constants.ts";

const sync = new Hono();

// GET /sync - Secure bulk data download for the current tenant
sync.get("/", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const tenantId = session.tenantId;
    
    // Fetch all data in parallel
    const [
      casesRes,
      usersRes,
      notificationsRes,
      attendanceRes,
      documentsRes,
      leaveRequestsRes,
      passportTrackingRes,
      auditLogRes,
      agentCodesRes,
      settingsRes
    ] = await Promise.all([
      db.cases.getAll({ tenant_id: tenantId, limit: MAX_CASES }),
      db.users.findAll({ tenant_id: tenantId, status: 'active' }),
      db.notifications.getByUser(session.userId, { limit: MAX_NOTIFICATIONS }),
      db.attendance.getByUser(session.userId, { startDate: getDaysAgo(30) }),
      db.documents.getByCase('all'), // Will be filtered by case_ids
      db.leaveRequests.getByUser(session.userId),
      db.passportTracking.getAll({ tenant_id: tenantId, limit: MAX_PASSPORT_TRACKING }),
      db.auditLog.getRecent(Math.min(MAX_AUDIT_LOG, 100), tenantId),
      db.agentCodes.getAll({ tenant_id: tenantId, is_active: true }),
      db.settings.getAll(tenantId)
    ]);

    // Remove sensitive user data
    const sanitizedUsers = usersRes.map((u: any) => {
      const { id, email, full_name, role, status, phone, avatar_url, department, employee_id, tenant_id, organization_id, created_at, updated_at } = u;
      return { id, email, full_name, role, status, phone, avatar_url, department, employee_id, tenant_id, organization_id, created_at, updated_at };
    });

    return c.json({
      success: true,
      data: {
        cases: trimCases(casesRes) || [],
        users: sanitizedUsers || [],
        notifications: trimArray(notificationsRes, MAX_NOTIFICATIONS) || [],
        attendance: trimArray(attendanceRes, MAX_ATTENDANCE) || [],
        documents: documentsRes || [],
        leave_requests: trimArray(leaveRequestsRes, MAX_LEAVE_REQUESTS) || [],
        passport_tracking: trimArray(passportTrackingRes, MAX_PASSPORT_TRACKING) || [],
        audit_log: trimArray(auditLogRes, MAX_AUDIT_LOG) || [],
        agent_codes: agentCodesRes || [],
        settings: settingsRes || {},
        meta: {
          last_sync: new Date().toISOString(),
          tenant_id: tenantId,
          user_id: session.userId
        }
      },
    });
  } catch (err: any) {
    console.error("Sync download error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /sync/cases - Sync cases only (lighter endpoint)
sync.get("/cases", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const tenantId = session.tenantId;
    const since = c.req.query("since"); // ISO date string for incremental sync
    
    const options: any = { 
      tenant_id: tenantId, 
      limit: MAX_CASES,
      orderBy: 'updated_at',
      order: 'desc'
    };
    
    // Note: For proper incremental sync, we'd add a filter
    // but Supabase JS client doesn't support gt on timestamp easily
    // So we fetch recent and let client filter
    
    const cases = await db.cases.getAll(options);
    
    return c.json({
      success: true,
      data: {
        cases: trimCases(cases) || [],
        meta: {
          last_sync: new Date().toISOString(),
          count: cases.length
        }
      }
    });
  } catch (err: any) {
    console.error("Sync cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /sync - Legacy bulk upload (backward compatibility)
// This now writes to PostgreSQL tables instead of KV
sync.post("/", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    const results: Record<string, any> = {};
    
    // Process cases
    if (body.cases !== undefined && Array.isArray(body.cases)) {
      const trimmed = trimCases(body.cases);
      // Upsert to PostgreSQL
      try {
        const saved = await db.cases.upsert(
          trimmed.map((cs: any) => ({ ...cs, tenant_id: session.tenantId })),
          'id'
        );
        results.cases = { count: saved.length, status: 'saved' };
      } catch (e) {
        results.cases = { error: String(e), status: 'failed' };
      }
    }
    
    // Process users (admin only)
    if (body.users !== undefined && Array.isArray(body.users) && session.role === 'master_admin') {
      try {
        // Users need careful handling - we don't bulk overwrite sensitive fields
        for (const user of body.users) {
          if (user.id) {
            // Update existing, but don't overwrite password
            const { password, ...safeUpdates } = user;
            await db.users.update(user.id, safeUpdates);
          }
        }
        results.users = { count: body.users.length, status: 'saved' };
      } catch (e) {
        results.users = { error: String(e), status: 'failed' };
      }
    }
    
    // Process agent codes
    if (body.agent_codes !== undefined && Array.isArray(body.agent_codes)) {
      try {
        // Agent codes stored in settings for now (simple approach)
        await db.settings.set(`agent_codes:${session.tenantId}`, body.agent_codes, {
          updated_by: session.userId,
          tenant_id: session.tenantId
        });
        results.agent_codes = { count: body.agent_codes.length, status: 'saved' };
      } catch (e) {
        results.agent_codes = { error: String(e), status: 'failed' };
      }
    }
    
    // Process notifications
    if (body.notifications !== undefined && Array.isArray(body.notifications)) {
      try {
        const trimmed = trimArray(body.notifications, MAX_NOTIFICATIONS);
        for (const notif of trimmed) {
          if (!notif.id) {
            await db.notifications.create({
              ...notif,
              user_id: session.userId,
              tenant_id: session.tenantId
            });
          }
        }
        results.notifications = { count: trimmed.length, status: 'saved' };
      } catch (e) {
        results.notifications = { error: String(e), status: 'failed' };
      }
    }
    
    // Process attendance
    if (body.attendance !== undefined && Array.isArray(body.attendance)) {
      try {
        const trimmed = trimArray(body.attendance, MAX_ATTENDANCE);
        for (const record of trimmed) {
          if (!record.id) {
            await db.attendance.create({
              ...record,
              user_id: session.userId,
              tenant_id: session.tenantId
            });
          }
        }
        results.attendance = { count: trimmed.length, status: 'saved' };
      } catch (e) {
        results.attendance = { error: String(e), status: 'failed' };
      }
    }
    
    // Process leave requests
    if (body.leave_requests !== undefined && Array.isArray(body.leave_requests)) {
      try {
        const trimmed = trimArray(body.leave_requests, MAX_LEAVE_REQUESTS);
        for (const request of trimmed) {
          if (!request.id) {
            await db.leaveRequests.create({
              ...request,
              user_id: session.userId,
              tenant_id: session.tenantId
            });
          }
        }
        results.leave_requests = { count: trimmed.length, status: 'saved' };
      } catch (e) {
        results.leave_requests = { error: String(e), status: 'failed' };
      }
    }
    
    // Process settings
    if (body.settings !== undefined && typeof body.settings === 'object') {
      try {
        for (const [key, value] of Object.entries(body.settings)) {
          await db.settings.set(key, value, {
            updated_by: session.userId,
            tenant_id: session.tenantId
          });
        }
        results.settings = { keys: Object.keys(body.settings).length, status: 'saved' };
      } catch (e) {
        results.settings = { error: String(e), status: 'failed' };
      }
    }
    
    // Keep backward compatibility - still save to KV for migration period
    // This allows gradual migration of frontend
    if (body.cases !== undefined) {
      await kv.set('crm:cases', { 
        data: body.cases, 
        synced_at: new Date().toISOString(),
        source: 'frontend_backup'
      });
    }

    // Log sync event
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_upload",
      entity_type: "sync",
      entity_id: "bulk",
      details: { 
        results,
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });

    return c.json({ 
      success: true, 
      synced: Object.keys(results).length,
      results,
      meta: {
        last_sync: new Date().toISOString(),
        source: "frontend"
      }
    });
  } catch (err: any) {
    console.error("Error during sync upload:", err);
    return c.json({ success: false, error: `Sync upload error: ${err.message || err}` }, 500);
  }
});

// POST /sync/verify - Verify data integrity after sync
sync.post("/verify", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    const { checksums } = body; // Expected format: { cases_count: number, users_count: number, ... }
    
    const results: Record<string, any> = {};
    
    if (checksums.cases_count !== undefined) {
      const actualCount = await db.cases.count({ tenant_id: session.tenantId });
      results.cases = {
        expected: checksums.cases_count,
        actual: actualCount,
        match: checksums.cases_count === actualCount
      };
    }
    
    if (checksums.users_count !== undefined) {
      const actualCount = await db.users.count({ tenant_id: session.tenantId, status: 'active' });
      results.users = {
        expected: checksums.users_count,
        actual: actualCount,
        match: checksums.users_count === actualCount
      };
    }
    
    const allMatch = Object.values(results).every((r: any) => r.match);
    
    return c.json({
      success: true,
      verified: allMatch,
      results
    });
  } catch (err: any) {
    console.error("Sync verify error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Helper function
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export default sync;
