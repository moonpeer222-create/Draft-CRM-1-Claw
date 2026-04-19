/**
 * AI Routes - PostgreSQL Version
 * Migrated from KV store to PostgreSQL with full audit logging
 * Features: AI Chat, CRM Actions via AI, Audit Logging, Rate Limiting
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware";
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

    // Sanitize input
    const sanitizedMessage = sanitizeAIInput(message);

    // Get API key
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      await logAIRequest(session, "chat", false, "AI API key missing", 0, 0);
      return c.json({ success: false, error: "AI service unavailable" }, 503);
    }

    // Build system prompt based on role
    const systemPrompt = buildSystemPrompt(role, crmContext);

    // Get conversation history
    const history = await getConversationHistory(
      session.userId,
      conversationId,
      MAX_AI_HISTORY
    );

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: sanitizedMessage }
    ];

    // Call OpenRouter API
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("APP_URL") || "https://emerald-crm.app",
        "X-Title": "Emerald CRM AI"
      },
      body: JSON.stringify({
        model: AI_MODELS[model as keyof typeof AI_MODELS] || AI_MODELS.default,
        messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter API error:", error);
      await logAIRequest(session, "chat", false, `API error: ${response.status}`, 0, Date.now() - startTime);
      return c.json({ success: false, error: "AI service error" }, 502);
    }

    const result = await response.json();
    const aiResponse = result.choices[0]?.message?.content || "I couldn't process that request.";
    const tokensUsed = result.usage?.total_tokens || 0;
    const latencyMs = Date.now() - startTime;

    // Save conversation
    await saveChatMessage(session, conversationId, "user", sanitizedMessage);
    const convId = await saveChatMessage(session, conversationId, "assistant", aiResponse);

    // Log success
    await logAIRequest(session, "chat", true, null, tokensUsed, latencyMs);

    return c.json({
      success: true,
      data: {
        response: aiResponse,
        conversationId: convId,
        tokensUsed,
        latencyMs
      }
    });

  } catch (err: any) {
    console.error("AI chat error:", err);
    await logAIRequest(session, "chat", false, err.message, 0, Date.now() - startTime);
    return c.json({ success: false, error: "AI chat failed" }, 500);
  }
});

// ==================== AI ACTIONS ====================

// POST /ai/action - AI-powered CRM actions
ai.post("/action", authMiddleware(), aiRateLimiter, async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    const body = await c.req.json();
    const { action, params } = body;

    if (!action) {
      await logAIRequest(session, "action", false, "Missing action", 0, 0);
      return c.json({ success: false, error: "Action is required" }, 400);
    }

    let result: any;
    
    switch (action) {
      case "create_case":
        result = await aiCreateCase(session, params);
        break;
      case "update_case_status":
        result = await aiUpdateCaseStatus(session, params);
        break;
      case "search_cases":
        result = await aiSearchCases(session, params);
        break;
      case "generate_summary":
        result = await aiGenerateSummary(session, params);
        break;
      default:
        await logAIRequest(session, "action", false, `Unknown action: ${action}`, 0, 0);
        return c.json({ success: false, error: "Unknown action" }, 400);
    }

    const latencyMs = Date.now() - startTime;
    await logAIRequest(session, `action:${action}`, result.success, result.error, 0, latencyMs);

    return c.json(result);

  } catch (err: any) {
    console.error("AI action error:", err);
    await logAIRequest(session, "action", false, err.message, 0, Date.now() - startTime);
    return c.json({ success: false, error: "AI action failed" }, 500);
  }
});

// ==================== CONVERSATION MANAGEMENT ====================

// GET /ai/conversations - List user's conversations
ai.get("/conversations", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    
    const conversations = await db.aiChatHistory.getConversations(session.userId);
    
    return c.json({
      success: true,
      data: conversations.map((conv: any) => ({
        id: conv.conversation_id,
        title: conv.title || "Untitled Conversation",
        lastMessage: conv.last_message,
        updatedAt: conv.updated_at
      }))
    });
  } catch (err: any) {
    console.error("Get conversations error:", err);
    return c.json({ success: false, error: "Failed to fetch conversations" }, 500);
  }
});

// GET /ai/conversations/:id - Get single conversation
ai.get("/conversations/:id", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const conversationId = c.req.param("id");
    
    const messages = await db.aiChatHistory.getByConversation(conversationId, session.userId);
    
    if (!messages || messages.length === 0) {
      return c.json({ success: false, error: "Conversation not found" }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        id: conversationId,
        messages: messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at
        }))
      }
    });
  } catch (err: any) {
    console.error("Get conversation error:", err);
    return c.json({ success: false, error: "Failed to fetch conversation" }, 500);
  }
});

// DELETE /ai/conversations/:id - Delete conversation
ai.delete("/conversations/:id", authMiddleware(), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const conversationId = c.req.param("id");
    
    await db.aiChatHistory.deleteConversation(conversationId, session.userId);
    
    // Log audit
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "delete_ai_conversation",
      entity_type: "ai_conversation",
      entity_id: conversationId,
      ip_address: c.req.header("x-forwarded-for") || "unknown",
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Delete conversation error:", err);
    return c.json({ success: false, error: "Failed to delete conversation" }, 500);
  }
});

// ==================== AUDIT & STATS ====================

// GET /ai/audit-log - Get AI audit log (admin only)
ai.get("/audit-log", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    const query = c.req.query();
    
    const options: any = {
      tenant_id: session.tenantId || undefined,
      limit: query.limit ? parseInt(query.limit) : 100
    };
    
    if (query.user_id) options.user_id = query.user_id;
    if (query.action) options.action = query.action;
    
    const logs = await db.aiAuditLog.getAll(options);
    
    return c.json({
      success: true,
      data: logs
    });
  } catch (err: any) {
    console.error("Get AI audit log error:", err);
    return c.json({ success: false, error: "Failed to fetch audit log" }, 500);
  }
});

// GET /ai/stats - Get AI usage stats
ai.get("/stats", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const session = c.get("session") as ServerSession;
    
    const stats = await db.aiAuditLog.getStats(session.tenantId);
    
    return c.json({
      success: true,
      data: stats
    });
  } catch (err: any) {
    console.error("Get AI stats error:", err);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
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
      user_name: session.fullName || "Unknown",
      role: session.role,
      action,
      action_type: "chat",
      success,
      error_message: errorMessage,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      metadata: {}
    });
  } catch (err) {
    console.error("Failed to log AI request:", err);
  }
}

function buildSystemPrompt(role: string, crmContext?: any): string {
  const basePrompt = `You are an AI assistant for Emerald CRM, a recruitment and visa processing management system.`;
  
  const rolePrompts: Record<string, string> = {
    agent: `You are helping a recruitment agent. Focus on: candidate management, case tracking, document collection, and visa processing workflows.`,
    admin: `You are helping an administrator. You can assist with: user management, system configuration, reporting, and overseeing operations.`,
    master_admin: `You are helping the platform owner. You have full access to: tenant management, system-wide settings, and advanced analytics.`,
    customer: `You are helping a visa applicant. Provide clear, helpful information about: application status, required documents, and processing timelines.`,
    operator: `You are helping a data entry operator. Assist with: case data entry, document processing, and quality checks.`
  };
  
  let prompt = `${basePrompt}\n\n${rolePrompts[role] || rolePrompts.agent}`;
  
  if (crmContext) {
    prompt += `\n\nCurrent CRM Context:\n${JSON.stringify(crmContext, null, 2)}`;
  }
  
  prompt += `\n\nBe professional, concise, and helpful. If you don't know something, say so clearly.`;
  
  return prompt;
}

async function getConversationHistory(
  userId: string,
  conversationId: string | undefined,
  limit: number
): Promise<Array<{role: string, content: string}>> {
  if (!conversationId) return [];
  
  try {
    const messages = await db.aiChatHistory.getByConversation(conversationId, userId);
    return messages
      .slice(-limit)
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));
  } catch (err) {
    console.error("Failed to get conversation history:", err);
    return [];
  }
}

async function saveChatMessage(
  session: ServerSession,
  conversationId: string | undefined,
  role: string,
  content: string
): Promise<string> {
  const convId = conversationId || crypto.randomUUID();
  
  await db.aiChatHistory.create({
    conversation_id: convId,
    tenant_id: session.tenantId,
    user_id: session.userId,
    role,
    content,
    metadata: {}
  });
  
  return convId;
}

// AI Action Implementations
async function aiCreateCase(session: ServerSession, params: any) {
  try {
    const caseData = {
      tenant_id: session.tenantId,
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      customer_phone: params.customer_phone,
      country: params.country,
      visa_type: params.visa_type,
      status: "new",
      agent_id: session.userId,
      notes: params.notes
    };
    
    const newCase = await db.cases.create(caseData);
    
    return { success: true, data: newCase };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function aiUpdateCaseStatus(session: ServerSession, params: any) {
  try {
    const { case_id, status, notes } = params;
    
    await db.cases.update(case_id, {
      status,
      notes,
      updated_at: new Date().toISOString()
    });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function aiSearchCases(session: ServerSession, params: any) {
  try {
    const { query } = params;
    
    const results = await db.cases.search(query, {
      tenant_id: session.tenantId || undefined,
      limit: 10
    });
    
    return { success: true, data: results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function aiGenerateSummary(session: ServerSession, params: any) {
  try {
    const { case_id } = params;
    
    const caseData = await db.cases.getById(case_id);
    if (!caseData) {
      return { success: false, error: "Case not found" };
    }
    
    // Get related data
    const [documents, payments, notes] = await Promise.all([
      db.documents.getByCase(case_id),
      db.payments.getByCase(case_id),
      db.notes.getByCase(case_id)
    ]);
    
    const summary = {
      case: caseData,
      documents_count: documents.length,
      payments_total: payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      notes_count: notes.length,
      summary_text: `Case ${caseData.case_number || case_id} for ${caseData.customer_name} is currently ${caseData.status}. ${documents.length} documents uploaded, ${payments.length} payments recorded.`
    };
    
    return { success: true, data: summary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export default ai;
