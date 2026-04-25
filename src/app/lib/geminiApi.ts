/**
 * AI API helper (via StepFun/OpenRouter)
 * Calls the server-side AI endpoint for dynamic LLM-powered conversations
 * beyond static KB responses.
 *
 * NOTE: Function names kept as callGeminiAI for backward compatibility
 * across all importing components. The actual backend now uses StepFun AI via OpenRouter.
 */
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

export interface ChatMessage {
  text: string;
  isBot: boolean;
}

export interface GeminiResponse {
  success: boolean;
  response?: string;
  error?: string;
  model?: string;
}

/**
 * Urdu fallback messages built at runtime using the array-join pattern.
 * NEVER write Urdu as single-line string literals — esbuild corrupts them.
 * Each Unicode escape must use exactly 4 valid hex digits (0-9, A-F).
 * U+062A = ت (Arabic letter ta). Do NOT write \u062t or \u062T.
 */
function buildRateLimitMsg(): string {
  // معذرت! ابھی AI سروس مصروف ہے۔ براہ کرم چند لمحے بعد دوبارہ کوشش کریں۔
  // فوری جواب کے لیے اوپر دیے گئے فوری بٹنز استعمال کریں۔ 🙏
  const parts = [
    "\u26A0\uFE0F ",           // ⚠️
    "\u0645\u0639\u0630\u0631", // معذر
    "\u062A",                   // ت  (U+062A — Arabic letter ta)
    "! ",
    "\u0627\u0628\u06BE\u06CC AI ", // ابھی AI
    "\u0633\u0631\u0648\u0633 ",    // سروس
    "\u0645\u0635\u0631\u0648\u0641 ", // مصروف
    "\u06C1\u06D2\u06D4 ",      // ہے۔
    "\u0628\u0631\u0627\u06C1 ", // براہ
    "\u06A9\u0631\u0645 ",       // کرم
    "\u0686\u0646\u062F ",       // چند
    "\u0644\u0645\u062D\u06D2 ", // لمحے
    "\u0628\u0639\u062F ",       // بعد
    "\u062F\u0648\u0628\u0627\u0631\u06C1 ", // دوبارہ
    "\u06A9\u0648\u0634\u0634 ", // کوشش
    "\u06A9\u0631\u06CC\u06BA\u06D4 ", // کریں۔
    "\u0641\u0648\u0631\u06CC ", // فوری
    "\u062C\u0648\u0627\u0628 ", // جواب
    "\u06A9\u06D2 ",             // کے
    "\u0644\u06CC\u06D2 ",       // لیے
    "\u0627\u0648\u067E\u0631 ", // اوپر
    "\u062F\u06CC\u06D2 ",       // دیے
    "\u06AF\u0626\u06D2 ",       // گئے
    "\u0641\u0648\u0631\u06CC ", // فوری
    "\u0628\u0679\u0646\u0632 ", // بٹنز
    "\u0627\u0633",              // اس
    "\u062A",                   // ت  (U+062A — Arabic letter ta)
    "\u0639\u0645\u0627\u0644 ", // عمال
    "\u06A9\u0631\u06CC\u06BA\u06D4 ", // کریں۔
    "\uD83D\uDE4F",              // 🙏
  ];
  return parts.join("");
}

function buildNetworkErrorMsg(): string {
  // معذرت! AI سروس سے رابطہ نہیں ہو سکا۔ براہ کرم اپنا انٹرنیٹ کنکشن چیک کریں اور دوبارہ کوشش کریں۔ 🌐
  const parts = [
    "\u26A0\uFE0F ",            // ⚠️
    "\u0645\u0639\u0630\u0631", // معذر
    "\u062A",                   // ت  (U+062A — Arabic letter ta)
    "! AI ",
    "\u0633\u0631\u0648\u0633 ", // سروس
    "\u0633\u06D2 ",             // سے
    "\u0631\u0627\u0628\u0637\u06C1 ", // رابطہ
    "\u0646\u06C1\u06CC\u06BA ", // نہیں
    "\u06C1\u0648 ",             // ہو
    "\u0633\u06A9\u0627\u06D4 ", // سکا۔
    "\u0628\u0631\u0627\u06C1 ", // براہ
    "\u06A9\u0631\u0645 ",       // کرم
    "\u0627\u067E\u0646\u0627 ", // اپنا
    "\u0627\u0646\u0679\u0631\u0646\u06CC\u0679 ", // انٹرنیٹ
    "\u06A9\u0646\u06A9\u0634\u0646 ", // کنکشن
    "\u0686\u06CC\u06A9 ",       // چیک
    "\u06A9\u0631\u06CC\u06BA ", // کریں
    "\u0627\u0648\u0631 ",       // اور
    "\u062F\u0648\u0628\u0627\u0631\u06C1 ", // دوبارہ
    "\u06A9\u0648\u0634\u0634 ", // کوشش
    "\u06A9\u0631\u06CC\u06BA\u06D4 ", // کریں۔
    "\uD83C\uDF10",              // 🌐
  ];
  return parts.join("");
}

const URDU_RATE_LIMIT_MSG = buildRateLimitMsg();
const URDU_NETWORK_ERROR_MSG = buildNetworkErrorMsg();

/**
 * Call StepFun AI through the server endpoint (non-streaming).
 * Exported as callGeminiAI for backward compatibility with all consumers.
 */
export async function callGeminiAI(
  message: string,
  role: string,
  language: "en" | "ur" = "ur",
  conversationHistory?: ChatMessage[],
  crmContext?: string
): Promise<GeminiResponse> {
  try {
    const res = await fetch(`${SERVER_BASE}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        message,
        role,
        language,
        conversationHistory: conversationHistory?.slice(-16) || [],
        crmContext: crmContext || "",
      }),
    });

    if (!res.ok) {
      let errorBody = "";
      try {
        const errData = await res.json();
        errorBody = errData?.error || JSON.stringify(errData);
      } catch {
        try { errorBody = await res.text(); } catch { /* ignore */ }
      }
      return {
        success: true,
        response: res.status === 429 ? URDU_RATE_LIMIT_MSG : URDU_NETWORK_ERROR_MSG,
        model: "fallback-error",
      };
    }

    const data = await res.json();

    if (!data.success) {
      const errStr = (data.error || "").toLowerCase();
      if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("rate")) {
        return { success: true, response: URDU_RATE_LIMIT_MSG, model: "fallback-rate-limited" };
      }
      return { success: false, error: data.error || "AI request failed" };
    }

    return {
      success: true,
      response: data.data.response,
      model: data.data.model,
    };
  } catch (err: any) {
    return {
      success: true,
      response: URDU_NETWORK_ERROR_MSG,
      model: "fallback-network-error",
    };
  }
}

/**
 * Stream StepFun AI tokens via SSE from the server.
 * Calls `/ai/chat/stream` and invokes onToken for each chunk,
 * onDone when the stream ends, onError on failure.
 * Returns the full accumulated text.
 */
export async function streamQwenAI(
  message: string,
  role: string,
  language: "en" | "ur" = "ur",
  conversationHistory?: ChatMessage[],
  crmContext?: string,
  onToken?: (token: string) => void,
  onDone?: (fullText: string) => void,
  onError?: (err: string) => void,
  systemPrompt?: string,
): Promise<string> {
  let fullText = "";
  try {
    const res = await fetch(`${SERVER_BASE}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        message,
        role,
        language,
        conversationHistory: conversationHistory?.slice(-16) || [],
        crmContext: crmContext || "",
        systemPrompt: systemPrompt || "",
      }),
    });

    if (!res.ok) {
      const errMsg = `AI stream HTTP error ${res.status}`;
      onError?.(errMsg);
      return fullText;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError?.("No response body from streaming endpoint");
      return fullText;
    }

    const decoder = new TextDecoder();
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
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullText += parsed.content;
            onToken?.(parsed.content);
          }
        } catch { /* skip malformed JSON chunks */ }
      }
    }

    onDone?.(fullText);
    return fullText;
  } catch (err: any) {
    onError?.(err?.message || "Stream error");
    return fullText;
  }
}

/** Detect if a response is a SmartNLP fallback (not a real AI answer) */
export function isFallbackResponse(text: string): boolean {
  const fallbackMarkers = [
    "I'm not quite sure what you're asking",
    "Did you mean one of these?",
    "Try rephrasing or pick a topic above",
  ];
  return fallbackMarkers.some(marker => text.includes(marker));
}

/**
 * Legacy alias — some older components import isGeminiThinking.
 * Always returns false since thinking tags are stripped server-side.
 */
export function isGeminiThinking(_text: string): boolean {
  return false;
}