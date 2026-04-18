/**
 * Improvement #6 — AI routes extracted from index.tsx.
 * Provides streaming AI chat endpoint (Improvement #18).
 *
 * NOTE: Route registration still happens in index.tsx via registerAIRoutes().
 * This file only exports the streaming handler to keep index.tsx cleaner.
 */
import * as kv from "./kv_store.tsx";

const AI_AUDIT_KEY = "crm:ai_audit_log";

/** Log AI interaction for audit trail */
async function logAudit(entry: {
  role: string;
  userId?: string;
  message: string;
  hasActions: boolean;
  model: string;
  streaming: boolean;
  timestamp: string;
}) {
  try {
    const log = (await kv.get(AI_AUDIT_KEY)) || [];
    log.unshift({
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...entry,
      messagePreview: entry.message.substring(0, 100),
    });
    if (log.length > 500) log.length = 500;
    await kv.set(AI_AUDIT_KEY, log);
  } catch { /* non-fatal */ }
}

/** Sanitize user input to mitigate prompt injection */
function sanitize(input: string): string {
  if (!input || typeof input !== "string") return "";
  let s = input
    .replace(/\[SYSTEM\]/gi, "[filtered]")
    .replace(/\[INST\]/gi, "[filtered]")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/SYS>/gi, "")
    .replace(/\[\/INST\]/gi, "")
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "[filtered]")
    .replace(/forget\s+(all\s+)?previous\s+instructions/gi, "[filtered]")
    .replace(/you\s+are\s+now\s+/gi, "[filtered]")
    .replace(/new\s+system\s+prompt/gi, "[filtered]")
    .replace(/override\s+system/gi, "[filtered]")
    .replace(/disregard\s+(all\s+)?above/gi, "[filtered]");
  if (s.length > 4000) s = s.substring(0, 4000);
  return s;
}

/**
 * Improvement #18 — Streaming AI chat handler.
 * Uses StepFun step-3.5-flash:free via OpenRouter — streams SSE tokens to the frontend.
 */
export async function handleStreamingAIChat(c: any) {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return c.json({ success: false, error: "OPENROUTER_API_KEY not configured. Please set your OpenRouter API key in secrets." }, 400);
  }

  const body = await c.req.json();
  const { message, role, language, conversationHistory, crmContext, systemPrompt } = body;

  if (!message || !role) {
    return c.json({ success: false, error: "message and role are required" }, 400);
  }

  const sanitizedMessage = sanitize(message);
  const _lang = language || "ur";

  // Build messages array
  const aiMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    aiMessages.push({ role: "system", content: systemPrompt });
  }
  if (crmContext) {
    aiMessages.push({ role: "system", content: crmContext });
  }
  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory.slice(-20)) {
      aiMessages.push({
        role: msg.isBot ? "assistant" : "user",
        content: msg.text,
      });
    }
  }
  aiMessages.push({ role: "user", content: sanitizedMessage });

  // Single model — StepFun step-3.5-flash:free via OpenRouter
  const MODEL_ID = "stepfun/step-3.5-flash:free";
  const apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  console.log(`StepFun stream request: model=${MODEL_ID}, messages=${aiMessages.length}`);

  let aiResponse: Response | undefined;
  try {
    aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer": "https://emerald-visa-crm.app",
        "X-Title": "Emerald Tech Partner",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: aiMessages,
        temperature: 0.6,
        top_p: 0.85,
        max_tokens: 800,
        stream: true,
      }),
    });
  } catch (err: any) {
    console.log(`StepFun stream fetch error:`, err?.message);
    return c.json({ success: false, error: "Network error reaching StepFun API via OpenRouter." }, 502);
  }

  if (!aiResponse || !aiResponse.ok) {
    const status = aiResponse?.status;
    let errBody = "";
    try { errBody = await aiResponse.text(); } catch { /* ignore */ }
    console.log(`StepFun stream error (${status}):`, errBody.substring(0, 500));

    if (status === 402) {
      return c.json({
        success: true,
        data: {
          response: [
            "\u26a0\ufe0f \u0645\u0639\u0630\u0631\u062a! AI \u0633\u0631\u0648\u0633 \u06a9\u06cc \u062d\u062f \u067e\u0648\u0631\u06cc \u06c1\u0648 \u06af\u0626\u06cc \u06c1\u06d2 (\u0627\u062e\u0631\u0627\u062c\u0627\u062a \u06a9\u06cc \u062d\u062f)\u06d4",
            "\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0628\u0639\u062f \u0645\u06cc\u06ba \u062f\u0648\u0628\u0627\u0631\u06c1 \u06a9\u0648\u0634\u0634 \u06a9\u0631\u06cc\u06ba \u06cc\u0627 \u0627\u06cc\u0688\u0645\u0646 \u0633\u06d2 \u0631\u0627\u0628\u0637\u06c1 \u06a9\u0631\u06cc\u06ba\u06d4",
          ].join(" "),
          model: "fallback-spend-limit",
        },
      });
    }
    return c.json({ success: false, error: `StepFun API error (${status}). Please try again later.` }, 502);
  }

  // Audit log (async, non-blocking)
  const session = c.get?.("session");
  logAudit({
    role,
    userId: session?.userId || "anonymous",
    message: sanitizedMessage,
    hasActions: false,
    model: MODEL_ID,
    streaming: true,
    timestamp: new Date().toISOString(),
  });

  // Stream SSE back to client
  const reader = aiResponse.body?.getReader();
  if (!reader) {
    return c.json({ success: false, error: "No response body from StepFun API" }, 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // Strip any residual <think>...</think> blocks
                const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
                if (cleaned) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cleaned })}\n\n`));
                }
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err) {
        console.log("StepFun stream read error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-token",
    },
  });
}