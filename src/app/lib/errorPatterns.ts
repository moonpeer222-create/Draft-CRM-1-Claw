/**
 * Improvement #20 — Consolidated error pattern utility.
 * Provides consistent error handling across all frontend components.
 */
import { toast } from "./toast";

/** Standard error categories */
export type ErrorCategory =
  | "network"
  | "auth"
  | "validation"
  | "not_found"
  | "rate_limit"
  | "server"
  | "storage"
  | "unknown";

interface ParsedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;      // Friendly message for toast
  urduMessage: string;      // Urdu translation
  retryable: boolean;
  httpStatus?: number;
}

/** Parse an error string or object into a standardized error */
export function parseError(error: unknown): ParsedError {
  const msg = typeof error === "string"
    ? error
    : error instanceof Error
    ? error.message
    : (error as any)?.error || (error as any)?.message || String(error);

  // Network errors
  if (/network|fetch|abort|timeout|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
    return {
      category: "network",
      message: msg,
      userMessage: "Network error — check your internet connection",
      urduMessage: "نیٹ ورک خرابی — اپنا انٹرنیٹ کنکشن چیک کریں",
      retryable: true,
    };
  }

  // Auth errors
  if (/auth|unauthorized|forbidden|401|403|login|session|token expired/i.test(msg)) {
    return {
      category: "auth",
      message: msg,
      userMessage: "Authentication error — please log in again",
      urduMessage: "تصدیق کی خرابی — براہ کرم دوبارہ لاگ ان کریں",
      retryable: false,
      httpStatus: msg.includes("403") ? 403 : 401,
    };
  }

  // Validation errors
  if (/validation|invalid|required|must be|cannot be empty/i.test(msg)) {
    return {
      category: "validation",
      message: msg,
      userMessage: `Validation error: ${msg}`,
      urduMessage: `توثیق کی خرابی: ${msg}`,
      retryable: false,
      httpStatus: 400,
    };
  }

  // Not found
  if (/not found|404|does not exist/i.test(msg)) {
    return {
      category: "not_found",
      message: msg,
      userMessage: "Item not found",
      urduMessage: "آئٹم نہیں ملا",
      retryable: false,
      httpStatus: 404,
    };
  }

  // Rate limit
  if (/rate limit|too many|429|throttl/i.test(msg)) {
    return {
      category: "rate_limit",
      message: msg,
      userMessage: "Too many requests — please wait a moment",
      urduMessage: "بہت زیادہ درخواستیں — براہ کرم ایک لمحے انتظار کریں",
      retryable: true,
      httpStatus: 429,
    };
  }

  // Storage errors
  if (/storage|quota|localStorage|disk|full/i.test(msg)) {
    return {
      category: "storage",
      message: msg,
      userMessage: "Storage error — try clearing some data",
      urduMessage: "اسٹوریج خرابی — کچھ ڈیٹا صاف کرنے کی کوشش کریں",
      retryable: false,
    };
  }

  // Server errors (5xx)
  if (/500|502|503|504|server error|internal error/i.test(msg)) {
    return {
      category: "server",
      message: msg,
      userMessage: "Server error — please try again later",
      urduMessage: "سرور خرابی — براہ کرم بعد میں دوبارہ کوشش کریں",
      retryable: true,
      httpStatus: 500,
    };
  }

  // Fallback
  return {
    category: "unknown",
    message: msg,
    userMessage: `Error: ${msg.substring(0, 100)}`,
    urduMessage: `خرابی: ${msg.substring(0, 100)}`,
    retryable: false,
  };
}

/** Show error toast with consistent formatting */
export function showError(error: unknown, context?: string, isUrdu = false): ParsedError {
  const parsed = parseError(error);
  const prefix = context ? `${context}: ` : "";
  const message = isUrdu
    ? `${prefix}${parsed.urduMessage}`
    : `${prefix}${parsed.userMessage}`;

  toast.error(message, {
    duration: parsed.retryable ? 5000 : 8000,
  });

  return parsed;
}

/** Wrap an async function with consistent error handling */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  isUrdu = false
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      showError(error, context, isUrdu);
      return null;
    }
  }) as T;
}

/** Check if an API response indicates an error and show toast if so */
export function handleApiResponse(
  res: { success: boolean; error?: string },
  context: string,
  isUrdu = false
): boolean {
  if (!res.success && res.error) {
    showError(res.error, context, isUrdu);
    return false;
  }
  return res.success;
}
