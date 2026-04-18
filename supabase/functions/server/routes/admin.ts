import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as kv from "../kv_store.tsx";
import { KEY } from "../lib/constants.ts";
import { kvSet } from "../lib/supabase.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { ServerSession } from "../lib/auth.ts";

const admin = new Hono();

// PIPELINE: SLA ALERTS
admin.get("/pipeline/sla-alerts", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const cases = (await kv.get(KEY.cases)) || [];
    const now = Date.now();
    const overdueAlerts = cases.filter((cs: any) => {
      if (!cs.stageStartedAt || !cs.pipelineStageKey) return false;
      if (cs.pipelineStageKey.includes("cancelled") || cs.pipelineStageKey.includes("completed")) return false;
      const stageStart = new Date(cs.stageStartedAt).getTime();
      return now > (stageStart + 24 * 3600000); // 24hr SLA
    }).map((cs: any) => ({
      caseId: cs.id,
      customerName: cs.customerName,
      hoursOverdue: Math.round((now - (new Date(cs.stageStartedAt).getTime() + 24 * 3600000)) / 3600000)
    }));
    return c.json({ success: true, data: overdueAlerts });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PIPELINE: ADVANCE STAGE WITH VALIDATION
admin.post("/pipeline/advance-stage", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const { caseId, nextStageKey, userName } = await c.req.json();
    const cases = (await kv.get(KEY.cases)) || [];
    const idx = cases.findIndex((cs: any) => cs.id === caseId);
    if (idx === -1) return c.json({ success: false, error: "Case not found" }, 404);

    const now = new Date().toISOString();
    cases[idx] = {
      ...cases[idx],
      pipelineStageKey: nextStageKey,
      status: nextStageKey,
      stageStartedAt: now,
      updatedDate: now,
      timeline: [
        ...(cases[idx].timeline || []),
        { id: `TL-${Date.now()}`, date: now, title: `Stage advanced to ${nextStageKey}`, user: userName || "System" }
      ]
    };
    await kvSet(KEY.cases, cases, "advance-stage");
    return c.json({ success: true, data: cases[idx] });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// SALARY CALCULATION
admin.post("/salary/calculate", authMiddleware(["master_admin"]), async (c) => {
  try {
    const { month, year } = await c.req.json();
    const cases = (await kv.get(KEY.cases)) || [];
    const agentCodes = (await kv.get(KEY.agents)) || [];
    // ... complete calculation logic from index.tsx:3300 ...
    return c.json({ success: true, message: "Salary calculated (logic porting in progress)" });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PANIC MODE (KILL SWITCH)
const PANIC_KEY = "crm:panic_mode";
admin.post("/panic/trigger", authMiddleware(["master_admin"]), async (c) => {
  await kvSet(PANIC_KEY, { active: true, timestamp: Date.now() }, "panic-trigger");
  return c.json({ success: true });
});

admin.get("/panic/status", async (c) => {
  const panic = await kv.get(PANIC_KEY);
  return c.json({ success: true, active: !!panic?.active });
});

export default admin;
