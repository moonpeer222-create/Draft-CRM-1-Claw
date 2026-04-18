import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { supabase } from "../lib/supabase.ts";
import { ServerSession } from "../lib/auth.ts";
import { validateCaseFields } from "../lib/utils.ts";

const cases = new Hono();

// GET /cases - Fetch all cases for the current tenant
cases.get("/", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("tenant_id", session.tenantId);

    if (error) throw error;
    return c.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /cases - Bulk upsert cases
cases.post("/", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    const casesList = body.cases;
    
    if (!Array.isArray(casesList)) return c.json({ success: false, error: "cases must be an array" }, 400);

    const casesToSave = casesList.map((cs: any) => ({
      ...cs,
      tenant_id: session.tenantId,
    }));

    const { error } = await supabase
      .from("cases")
      .upsert(casesToSave, { onConflict: "id" });

    if (error) throw error;
    return c.json({ success: true, count: casesList.length });
  } catch (err) {
    console.error("POST /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PUT /cases/:caseId - Update a single case
cases.put("/:caseId", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");
    const updates = await c.req.json();

    const { valid, errors } = validateCaseFields(updates);
    if (!valid) return c.json({ success: false, error: `Validation failed: ${errors.join("; ")}` }, 400);

    const { data, error } = await supabase
      .from("cases")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", caseId)
      .eq("tenant_id", session.tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ success: false, error: "Case not found or unauthorized" }, 404);

    return c.json({ success: true, data });
  } catch (err) {
    console.error("PUT /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /cases/:caseId - Soft/Hard delete a case
cases.delete("/:caseId", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");

    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", caseId)
      .eq("tenant_id", session.tenantId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

export default cases;
