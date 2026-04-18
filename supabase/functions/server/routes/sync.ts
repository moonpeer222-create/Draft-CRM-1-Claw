import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { supabase, kvSet } from "../lib/supabase.ts";
import * as kv from "../kv_store.tsx";
import { ServerSession } from "../lib/auth.ts";
import { trimArray, trimCases } from "../lib/utils.ts";
import { KEY, MAX_AUDIT_LOG, MAX_NOTIFICATIONS, MAX_ATTENDANCE, MAX_CODE_HISTORY, MAX_LEAVE_REQUESTS, MAX_PASSPORT_TRACKING } from "../lib/constants.ts";

const sync = new Hono();

// GET /sync - Secure bulk data download for the current tenant
sync.get("/", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const tid = session.tenantId;

    const [casesRes, usersRes, notifsRes, attendanceRes] = await Promise.all([
      supabase.from("cases").select("*").eq("tenant_id", tid),
      supabase.from("users").select("*").eq("tenant_id", tid),
      supabase.from("notifications").select("*").eq("tenant_id", tid),
      supabase.from("attendance").select("*").eq("tenant_id", tid),
    ]);

    const [agentCodes, settings, auditLog] = await Promise.all([
      kv.get(`${KEY.agents}:${tid}`),
      kv.get(`${KEY.settings}:${tid}`),
      kv.get(`${KEY.auditLog}:${tid}`),
    ]);

    return c.json({
      success: true,
      data: {
        cases: trimCases(casesRes.data) || [],
        users: usersRes.data || [],
        notifications: trimArray(notifsRes.data, MAX_NOTIFICATIONS) || [],
        attendance: trimArray(attendanceRes.data, MAX_ATTENDANCE) || [],
        agentCodes: agentCodes || null,
        settings: settings || null,
        auditLog: trimArray(auditLog, MAX_AUDIT_LOG) || null,
      },
    });
  } catch (err: any) {
    console.error("Sync download error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /sync - Legacy bulk upload (for compatibility while migrating tables)
sync.post("/", async (c) => {
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

    const now = new Date().toISOString();
    await kvSet(KEY.meta, { lastSync: now, source: "frontend" }, "sync-meta");

    return c.json({ success: true, synced: ops.length });
  } catch (err: any) {
    console.log("Error during sync upload:", err);
    return c.json({ success: false, error: `Sync upload error: ${err.message || err}` }, 500);
  }
});

export default sync;
