/**
 * AI Routes - PostgreSQL Version
 * Migrated from KV store to PostgreSQL with full audit logging
 * Features: AI Chat, CRM Actions via AI, Audit Logging, Rate Limiting
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { db } from "../lib/db.ts";
import { ServerSession } from "../lib/auth.ts";
import { rateLimiter, sanitizeAIInput } from "../lib/utils.ts";
import { MAX_AI_HISTORY } from "../lib/constants.ts";

const ai = new Hono();

// Rate limiting: 20 AI requests per minute per user
const aiRateLimiter = rateLimiter(20, 60);

// OpenRouter API configuration
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// AI Model configuration
const AI_MODELS = {
  default: "anthropic/claude-3.5-sonnet",
  fast: "openai/gpt-4o-mini",
  cheap: "meta-llama/llama-3.1-8b-instruct"
};

// ==================== AI CHAT ====================

// POST /ai/chat - Main AI conversation endpoint
ai.post("/chat", authMiddleware(), aiRateLimiter, async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    const body = await c.req.json();
    const { 
      message, 
      role = "agent", 
      crmContext,
      model = "default",
      conversationId 
    } = body;

    // Validate input
    if (!message || typeof message !== "string") {
      await logAIRequest(session, "chat", false, "Invalid message", 0, 0);
      return c.json({ success: false, error: "Message is required" }, 400);
    }

    const sanitizedMessage = sanitizeAIInput(message);
    if (!sanitizedMessage) {
      await logAIRequest(session, "chat", false, "Message sanitized to empty", 0, 0);
      return c.json({ success: false, error: "Invalid message content" }, 400);
    }

    // Get API key
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      await logAIRequest(session, "chat", false, "AI API key missing", 0, 0);
      return c.json({ success: false, error: "AI service unavailable" }, 503);
    }

    // Get conversation history from PostgreSQL
    let conversationHistory: any[] = [];
    if (conversationId) {
      conversationHistory = await db.aiChatHistory.getMessages(conversationId, 10);
    }

    // Build system prompt based on role
    const systemPrompt = buildSystemPrompt(role, crmContext);

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: sanitizedMessage }
    ];

    // Call OpenRouter API
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("APP_URL") || "https://emerald-crm.app",
        "X-Title": "Emerald CRM AI Assistant"
      },
      body: JSON.stringify({
        model: AI_MODELS[model as keyof typeof AI_MODELS] || AI_MODELS.default,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      await logAIRequest(session, "chat", false, `AI API error: ${error}`, 0, 0);
      return c.json({ success: false, error: "AI service error" }, 502);
    }

    const aiResponse = await response.json();
    const aiMessage = aiResponse.choices?.[0]?.message?.content || "No response";
    const tokensUsed = aiResponse.usage?.total_tokens || 0;
    const latency = Date.now() - startTime;

    // Save conversation to PostgreSQL
    const savedConvId = conversationId || crypto.randomUUID();
    await db.aiChatHistory.addMessage({
      conversation_id: savedConvId,
      tenant_id: session.tenantId,
      user_id: session.userId,
      role: "user",
      content: sanitizedMessage,
      metadata: { model, latency_ms: latency }
    });

    await db.aiChatHistory.addMessage({
      conversation_id: savedConvId,
      tenant_id: session.tenantId,
      user_id: session.userId,
      role: "assistant",
      content: aiMessage,
      metadata: { tokens_used: tokensUsed, latency_ms: latency }
    });

    // Log successful AI request
    await logAIRequest(session, "chat", true, null, tokensUsed, latency);

    // Log to audit trail
    await db.auditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action: "ai_chat",
      category: "ai",
      description: `AI chat: ${sanitizedMessage.substring(0, 100)}...`,
      metadata: { conversation_id: savedConvId, tokens_used: tokensUsed, latency_ms: latency }
    });

    return c.json({
      success: true,
      data: {
        response: aiMessage,
        conversation_id: savedConvId,
        tokens_used: tokensUsed,
        latency_ms: latency,
        model: AI_MODELS[model as keyof typeof AI_MODELS] || AI_MODELS.default
      }
    });

  } catch (err: any) {
    console.error("AI chat error:", err);
    await logAIRequest(session, "chat", false, err.message, 0, Date.now() - startTime);
    return c.json({ success: false, error: "AI processing failed" }, 500);
  }
});

// ==================== AI AUDIT LOG ====================

// GET /ai/audit-log - Get AI usage history (admin only)
ai.get("/audit-log", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const query = c.req.query();
    
    const options = {
      tenant_id: session.tenantId,
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
      user_id: query.user_id,
      action_type: query.action_type,
      date_from: query.date_from,
      date_to: query.date_to
    };

    const logs = await db.aiAuditLog.getAll(options);
    const total = await db.aiAuditLog.count({ tenant_id: session.tenantId });

    return c.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: options.limit,
        offset: options.offset,
        has_more: total > (options.offset || 0) + logs.length
      }
    });
  } catch (err: any) {
    console.error("AI audit log error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /ai/stats - Get AI usage statistics (admin only)
ai.get("/stats", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const days = parseInt(c.req.query("days") || "30");
    
    const stats = await db.aiAuditLog.getStats({
      tenant_id: session.tenantId,
      days
    });

    return c.json({
      success: true,
      data: {
        total_requests: stats.total_requests,
        successful_requests: stats.successful,
        failed_requests: stats.failed,
        total_tokens: stats.total_tokens,
        avg_latency_ms: stats.avg_latency,
        top_users: stats.top_users,
        usage_by_day: stats.daily_usage,
        period_days: days
      }
    });
  } catch (err: any) {
    console.error("AI stats error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== CRM ACTIONS VIA AI ====================

// POST /ai/action - AI-powered CRM actions
ai.post("/action", authMiddleware(), aiRateLimiter, async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    const body = await c.req.json();
    const { action, params, natural_language_query } = body;

    if (!action) {
      return c.json({ success: false, error: "Action is required" }, 400);
    }

    let result: any = null;
    let actionDescription = "";

    switch (action) {
      case "search_cases":
        result = await handleSearchCases(session, params);
        actionDescription = `Searched cases: ${params?.query || natural_language_query}`;
        break;

      case "get_case_details":
        result = await handleGetCaseDetails(session, params?.case_id);
        actionDescription = `Retrieved case details: ${params?.case_id}`;
        break;

      case "update_case_status":
        result = await handleUpdateCaseStatus(session, params?.case_id, params?.status);
        actionDescription = `Updated case ${params?.case_id} to status ${params?.status}`;
        break;

      case "get_dashboard_summary":
        result = await handleDashboardSummary(session);
        actionDescription = "Retrieved dashboard summary";
        break;

      case "analyze_overdue":
        result = await handleAnalyzeOverdue(session);
        actionDescription = "Analyzed overdue cases";
        break;

      case "suggest_actions":
        result = await handleSuggestActions(session, params?.case_id);
        actionDescription = `Suggested actions for case ${params?.case_id}`;
        break;

      default:
        return c.json({ success: false, error: "Unknown action" }, 400);
    }

    const latency = Date.now() - startTime;

    // Log to AI audit
    await db.aiAuditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action: `ai_action_${action}`,
      action_type: "crm_action",
      success: true,
      latency_ms: latency,
      metadata: { action, params, result_summary: JSON.stringify(result).substring(0, 500) }
    });

    // Log to general audit
    await db.auditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action: "ai_crm_action",
      category: "ai",
      description: actionDescription,
      metadata: { action, ai_initiated: true }
    });

    return c.json({
      success: true,
      data: result,
      action,
      latency_ms: latency
    });

  } catch (err: any) {
    console.error("AI action error:", err);
    await db.aiAuditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action: "ai_action_failed",
      action_type: "crm_action",
      success: false,
      error_message: err.message,
      latency_ms: Date.now() - startTime
    });
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==================== AI CONVERSATIONS ====================

// GET /ai/conversations - Get user's conversation history
ai.get("/conversations", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const limit = parseInt(c.req.query("limit") || "20");
    
    const conversations = await db.aiChatHistory.getConversations({
      tenant_id: session.tenantId,
      user_id: session.userId,
      limit
    });

    return c.json({ success: true, data: conversations });
  } catch (err: any) {
    console.error("Get conversations error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /ai/conversations/:id - Get specific conversation messages
ai.get("/conversations/:id", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const conversationId = c.req.param("id");
    const limit = parseInt(c.req.query("limit") || "50");
    
    // Verify ownership
    const conversation = await db.aiChatHistory.getConversation(conversationId);
    if (!conversation || conversation.user_id !== session.userId) {
      return c.json({ success: false, error: "Conversation not found" }, 404);
    }

    const messages = await db.aiChatHistory.getMessages(conversationId, limit);

    return c.json({ success: true, data: messages });
  } catch (err: any) {
    console.error("Get conversation error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /ai/conversations/:id - Delete conversation
ai.delete("/conversations/:id", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const conversationId = c.req.param("id");
    
    await db.aiChatHistory.deleteConversation(conversationId, session.userId);

    await db.auditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action: "ai_conversation_deleted",
      category: "ai",
      description: `Deleted AI conversation ${conversationId}`,
      metadata: { conversation_id: conversationId }
    });

    return c.json({ success: true, message: "Conversation deleted" });
  } catch (err: any) {
    console.error("Delete conversation error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ==================== HELPER FUNCTIONS ====================

async function logAIRequest(
  session: ServerSession,
  action: string,
  success: boolean,
  errorMessage: string | null,
  tokensUsed: number,
  latencyMs: number
) {
  try {
    await db.aiAuditLog.create({
      tenant_id: session.tenantId,
      user_id: session.userId,
      user_name: session.userName || "Unknown",
      role: session.role,
      action,
      action_type: "chat",
      success,
      error_message: errorMessage,
      tokens_used: tokensUsed,
      latency_ms: latencyMs
    });
  } catch (err) {
    console.error("Failed to log AI request:", err);
  }
}

function buildSystemPrompt(role: string, crmContext?: any): string {
  const basePrompt = `You are an AI assistant for Emerald CRM, a recruitment and visa processing management system for Overseas Employment Promoters (OEPs) in Pakistan.

Your capabilities:
- Answer questions about CRM features and workflows
- Help agents manage candidate cases
- Explain visa processing stages
- Provide guidance on document requirements
- Analyze case data and suggest actions

Guidelines:
- Be professional and concise
- Use Urdu romanization when appropriate for Pakistani context
- Do not make up information about specific candidates unless provided in context
- Suggest using the CRM interface for sensitive operations
- Escalate to human admin for complex compliance questions`;

  const rolePrompts: Record<string, string> = {
    agent: `${basePrompt}

You are assisting a field agent who:
- Recruits candidates in various cities
- Collects documents
- Updates case status on mobile
- Needs quick, mobile-friendly answers

Focus on: Document checklists, status updates, candidate communication tips.`,

    admin: `${basePrompt}

You are assisting an admin who:
- Manages the entire CRM
- Reviews all cases and agents
- Handles compliance and reporting
- Needs comprehensive system access

Focus on: Dashboard metrics, compliance alerts, agent performance, system configuration.`,

    operator: `${basePrompt}

You are assisting an office operator who:
- Handles front-desk operations
- Manages appointments and visits
- Processes payments
- Confirms document completeness

Focus on: Payment recording, appointment scheduling, document verification, daily reports.`,

    master_admin: `${basePrompt}

You are assisting the Master Admin with full system access.
Provide comprehensive answers about all features including advanced configuration, multi-tenant setup, and system health.`
  };

  let prompt = rolePrompts[role] || basePrompt;

  if (crmContext) {
    prompt += `

Current CRM Context:
- Tenant: ${crmContext.tenant_name || "Unknown"}
- Active Cases: ${crmContext.active_cases || 0}
- Overdue Cases: ${crmContext.overdue_cases || 0}
- User: ${crmContext.user_name || "Unknown"}`;
  }

  return prompt;
}

// ==================== CRM ACTION HANDLERS ====================

async function handleSearchCases(session: ServerSession, params: any) {
  const { query, status, country, limit = 10 } = params || {};
  
  const searchOptions: any = {
    tenant_id: session.tenantId,
    limit
  };

  if (status) searchOptions.status = status;
  if (country) searchOptions.country = country;

  if (query) {
    return await db.cases.search(query, searchOptions);
  } else {
    return await db.cases.getAll(searchOptions);
  }
}

async function handleGetCaseDetails(session: ServerSession, caseId: string) {
  if (!caseId) throw new Error("Case ID is required");
  
  const caseData = await db.cases.getById(caseId, session.tenantId);
  if (!caseData) throw new Error("Case not found");
  
  // Get related data
  const [payments, notes] = await Promise.all([
    db.payments.getByCaseId(caseId, session.tenantId),
    db.notes.getByCaseId(caseId, session.tenantId)
  ]);

  return {
    ...caseData,
    payments,
    notes
  };
}

async function handleUpdateCaseStatus(session: ServerSession, caseId: string, status: string) {
  if (!caseId || !status) throw new Error("Case ID and status are required");
  
  // Validate status transition
  const validStatuses = [
    'document_collection', 'selection_call', 'medical_token', 'check_medical',
    'biometric', 'payment_confirmation', 'e_number_issued', 'original_documents',
    'protector', 'submitted_to_manager', 'approved', 'remaining_amount',
    'ticket_booking', 'completed', 'cancelled'
  ];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const stageMap: Record<string, number> = {
    document_collection: 1, selection_call: 2, medical_token: 3, check_medical: 4,
    biometric: 5, payment_confirmation: 6, e_number_issued: 7, original_documents: 8,
    protector: 9, submitted_to_manager: 10, approved: 11, remaining_amount: 12,
    ticket_booking: 13, completed: 14
  };

  const updated = await db.cases.update(caseId, {
    status,
    current_stage: stageMap[status] || 0,
    stage_started_at: new Date().toISOString(),
    stage_deadline_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    is_overdue: false,
    updated_at: new Date().toISOString()
  }, session.tenantId);

  // Log the change
  await db.auditLog.create({
    tenant_id: session.tenantId,
    user_id: session.userId,
    user_name: session.userName || "AI Assistant",
    role: session.role,
    action: "case_status_updated_via_ai",
    category: "case",
    description: `Case ${caseId} status updated to ${status} via AI`,
    metadata: { case_id: caseId, new_status: status, ai_initiated: true }
  });

  return updated;
}

async function handleDashboardSummary(session: ServerSession) {
  const [totalCases, activeCases, overdueCases, completedCases, recentActivity] = await Promise.all([
    db.cases.count({ tenant_id: session.tenantId }),
    db.cases.count({ tenant_id: session.tenantId, status: 'in_progress' }),
    db.cases.getOverdue(session.tenantId || undefined).then(c => c.length),
    db.cases.count({ tenant_id: session.tenantId, status: 'completed' }),
    db.auditLog.getAll({ tenant_id: session.tenantId, limit: 5 })
  ]);

  return {
    stats: {
      total_cases: totalCases,
      active_cases: activeCases,
      overdue_cases: overdueCases,
      completed_cases: completedCases,
      completion_rate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
    },
    recent_activity: recentActivity,
    generated_at: new Date().toISOString()
  };
}

async function handleAnalyzeOverdue(session: ServerSession) {
  const overdueCases = await db.cases.getOverdue(session.tenantId || undefined);
  
  const analysis = overdueCases.map((c: any) => {
    const hoursOverdue = c.stage_started_at 
      ? Math.round((Date.now() - new Date(c.stage_started_at).getTime()) / 3600000)
      : 0;
    
    return {
      case_id: c.id,
      case_number: c.case_number,
      customer_name: c.customer_name,
      current_stage: c.current_stage,
      hours_overdue: hoursOverdue,
      agent_name: c.agent_name,
      priority: c.priority
    };
  });

  return {
    total_overdue: analysis.length,
    high_priority: analysis.filter((a: any) => a.priority === 'high').length,
    cases: analysis.sort((a: any, b: any) => b.hours_overdue - a.hours_overdue)
  };
}

async function handleSuggestActions(session: ServerSession, caseId: string) {
  if (!caseId) throw new Error("Case ID is required");
  
  const caseData = await db.cases.getById(caseId, session.tenantId);
  if (!caseData) throw new Error("Case not found");

  const suggestions: string[] = [];
  
  // Analyze case and suggest actions
  if (!caseData.documents || caseData.documents.length === 0) {
    suggestions.push("Request candidate to submit required documents");
  }
  
  if (caseData.paid_amount < caseData.total_fee * 0.5) {
    suggestions.push("Follow up on pending payment (>50% remaining)");
  }
  
  if (caseData.is_overdue) {
    suggestions.push("Escalate overdue case to manager");
  }
  
  if (caseData.status === 'document_collection') {
    suggestions.push("Schedule document verification appointment");
  }
  
  if (caseData.status === 'medical_token' || caseData.status === 'check_medical') {
    suggestions.push("Verify medical test appointment date");
  }

  return {
    case_id: caseId,
    current_status: caseData.status,
    suggestions: suggestions.length > 0 ? suggestions : ["Case is on track, no immediate action needed"],
    generated_at: new Date().toISOString()
  };
}

export default ai;
