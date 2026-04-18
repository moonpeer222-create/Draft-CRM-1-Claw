/**
 * Cases Routes - PostgreSQL Version
 * Migrated to use proper relational database
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { db } from "../lib/db.ts";
import { ServerSession } from "../lib/auth.ts";
import { validateCaseFields, trimArray } from "../lib/utils.ts";
import { MAX_NOTIFICATIONS } from "../lib/constants.ts";

const cases = new Hono();

// GET /cases - Fetch all cases for the current tenant
// Supports query params: status, agent_id, country, flagged, search, limit, offset
cases.get("/", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const query = c.req.query();
    
    // Build filter options from query params
    const options: any = {
      tenant_id: session.tenantId || undefined,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : undefined,
      orderBy: query.orderBy || 'created_at',
      order: (query.order as 'asc' | 'desc') || 'desc'
    };
    
    if (query.status) options.status = query.status;
    if (query.agent_id) options.agent_id = query.agent_id;
    if (query.country) options.country = query.country;
    if (query.flagged !== undefined) options.flagged = query.flagged === 'true';
    
    let data: any[];
    
    // Handle search separately
    if (query.search) {
      data = await db.cases.search(query.search, { 
        tenant_id: session.tenantId || undefined,
        limit: options.limit 
      });
    } else {
      data = await db.cases.getAll(options);
    }
    
    // Get total count for pagination
    const totalCount = await db.cases.count({ tenant_id: session.tenantId || undefined });
    
    return c.json({ 
      success: true, 
      data,
      meta: {
        total: totalCount,
        limit: options.limit,
        offset: options.offset || 0
      }
    });
  } catch (err) {
    console.error("GET /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /cases/:caseId - Get a single case by ID
cases.get("/:caseId", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");
    
    const caseData = await db.cases.getById(caseId);
    
    if (!caseData) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    // Verify tenant access
    if (caseData.tenant_id && caseData.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    // Get associated documents
    const documents = await db.documents.getByCase(caseId);
    
    // Get passport tracking info
    const passportTracking = await db.passportTracking.getByCase(caseId);
    
    return c.json({ 
      success: true, 
      data: {
        ...caseData,
        documents,
        passport_tracking: passportTracking
      }
    });
  } catch (err) {
    console.error("GET /cases/:caseId error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /cases - Create or bulk upsert cases
cases.post("/", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const body = await c.req.json();
    
    // Handle single case creation
    if (!body.cases && body.customer_name) {
      const { valid, errors } = validateCaseFields(body);
      if (!valid) return c.json({ success: false, error: `Validation failed: ${errors.join("; ")}` }, 400);
      
      const caseData = {
        ...body,
        tenant_id: session.tenantId,
        created_by: session.userId,
        agent_id: body.agent_id || session.userId,
        agent_name: body.agent_name || session.fullName
      };
      
      const data = await db.cases.create(caseData);
      
      // Create audit log
      await db.auditLog.create({
        user_id: session.userId,
        user_email: session.email,
        action: "case_created",
        entity_type: "case",
        entity_id: data.id,
        details: { customer_name: data.customer_name, country: data.country },
        ip_address: c.req.header("x-forwarded-for"),
        user_agent: c.req.header("user-agent"),
        tenant_id: session.tenantId
      });
      
      // Create notification for admin
      await db.notifications.create({
        user_id: session.userId,
        title: "New Case Created",
        message: `Case for ${data.customer_name} (${data.country}) has been created`,
        type: "success",
        action_url: `/cases/${data.id}`,
        tenant_id: session.tenantId
      });
      
      return c.json({ success: true, data });
    }
    
    // Handle bulk upsert
    const casesList = body.cases;
    if (!Array.isArray(casesList)) {
      return c.json({ success: false, error: "cases must be an array when using bulk upsert" }, 400);
    }

    const casesToSave = casesList.map((cs: any) => ({
      ...cs,
      tenant_id: session.tenantId,
      updated_at: new Date().toISOString()
    }));

    const data = await db.cases.upsert(casesToSave, 'id');
    
    // Bulk audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "cases_bulk_upsert",
      entity_type: "case",
      entity_id: "bulk",
      details: { count: casesList.length },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, count: casesList.length, data });
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

    // Validate case fields
    const { valid, errors } = validateCaseFields(updates);
    if (!valid) return c.json({ success: false, error: `Validation failed: ${errors.join("; ")}` }, 400);

    // Get existing case to verify access
    const existingCase = await db.cases.getById(caseId);
    if (!existingCase) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    // Verify tenant access
    if (existingCase.tenant_id && existingCase.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    // Add timeline entry if status changed
    if (updates.status && updates.status !== existingCase.status) {
      const timelineEntry = {
        id: `TL-${Date.now()}`,
        date: new Date().toISOString(),
        title: `Status changed to ${updates.status}`,
        user: session.fullName,
        previous_status: existingCase.status
      };
      updates.timeline = [...(existingCase.timeline || []), timelineEntry];
    }

    const data = await db.cases.update(caseId, updates);
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "case_updated",
      entity_type: "case",
      entity_id: caseId,
      details: { 
        updated_fields: Object.keys(updates),
        customer_name: data.customer_name 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });

    return c.json({ success: true, data });
  } catch (err) {
    console.error("PUT /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PATCH /cases/:caseId - Partial update (stage advancement, flagging, etc.)
cases.patch("/:caseId", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");
    const updates = await c.req.json();

    // Get existing case
    const existingCase = await db.cases.getById(caseId);
    if (!existingCase) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    // Verify tenant access
    if (existingCase.tenant_id && existingCase.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    // Handle stage advancement with timeline
    if (updates.current_stage && updates.current_stage !== existingCase.current_stage) {
      const timelineEntry = {
        id: `TL-${Date.now()}`,
        date: new Date().toISOString(),
        title: `Stage advanced to ${updates.current_stage}`,
        user: session.fullName,
        previous_stage: existingCase.current_stage
      };
      updates.timeline = [...(existingCase.timeline || []), timelineEntry];
      updates.stage_started_at = new Date().toISOString();
    }
    
    // Handle flagging
    if (updates.flagged !== undefined && updates.flagged !== existingCase.flagged) {
      updates.flagged_by = updates.flagged ? session.userId : null;
      updates.flagged_at = updates.flagged ? new Date().toISOString() : null;
    }

    const data = await db.cases.update(caseId, updates);
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "case_patched",
      entity_type: "case",
      entity_id: caseId,
      details: { 
        updated_fields: Object.keys(updates),
        customer_name: data.customer_name 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });

    return c.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /cases/:caseId - Delete a case
cases.delete("/:caseId", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");

    // Get existing case to verify access and get info for audit
    const existingCase = await db.cases.getById(caseId);
    if (!existingCase) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    // Verify tenant access
    if (existingCase.tenant_id && existingCase.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }

    await db.cases.delete(caseId);
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "case_deleted",
      entity_type: "case",
      entity_id: caseId,
      details: { 
        customer_name: existingCase.customer_name,
        country: existingCase.country 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /cases error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /cases/:caseId/documents - Add a document to a case
cases.post("/:caseId/documents", authMiddleware(["master_admin", "admin", "agent"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const caseId = c.req.param("caseId");
    const body = await c.req.json();
    
    // Verify case exists and user has access
    const caseData = await db.cases.getById(caseId);
    if (!caseData) {
      return c.json({ success: false, error: "Case not found" }, 404);
    }
    
    if (caseData.tenant_id && caseData.tenant_id !== session.tenantId) {
      return c.json({ success: false, error: "Unauthorized" }, 403);
    }
    
    const document = await db.documents.create({
      case_id: caseId,
      file_name: body.file_name,
      file_url: body.file_url,
      file_type: body.file_type,
      file_size: body.file_size,
      uploaded_by: session.userId,
      uploader_name: session.fullName,
      description: body.description,
      tenant_id: session.tenantId,
      metadata: body.metadata
    });
    
    // Add to case documents JSONB as well for backward compatibility
    const updatedDocs = [...(caseData.documents || []), {
      id: document.id,
      file_name: document.file_name,
      file_url: document.file_url,
      uploaded_at: document.created_at
    }];
    await db.cases.update(caseId, { documents: updatedDocs });
    
    // Create audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "document_added",
      entity_type: "document",
      entity_id: document.id,
      details: { 
        case_id: caseId,
        file_name: body.file_name 
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true, data: document });
  } catch (err) {
    console.error("POST /cases/:caseId/documents error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /cases/stats/overdue - Get overdue cases count
cases.get("/stats/overdue", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const overdueCases = await db.cases.getOverdue(session.tenantId || undefined);
    
    return c.json({ 
      success: true, 
      data: {
        count: overdueCases.length,
        cases: overdueCases.slice(0, 10) // Limit to 10 for overview
      }
    });
  } catch (err) {
    console.error("GET /cases/stats/overdue error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /cases/stats/summary - Get case statistics summary
cases.get("/stats/summary", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const tenantId = session.tenantId || undefined;
    
    // Get counts by status
    const [total, new_count, in_progress, pending, completed] = await Promise.all([
      db.cases.count({ tenant_id: tenantId }),
      db.cases.count({ tenant_id: tenantId, status: 'new' }),
      db.cases.count({ tenant_id: tenantId, status: 'in_progress' }),
      db.cases.count({ tenant_id: tenantId, status: 'pending' }),
      db.cases.count({ tenant_id: tenantId, status: 'completed' })
    ]);
    
    return c.json({
      success: true,
      data: {
        total,
        by_status: {
          new: new_count,
          in_progress,
          pending,
          completed,
          other: total - new_count - in_progress - pending - completed
        }
      }
    });
  } catch (err) {
    console.error("GET /cases/stats/summary error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

export default cases;
