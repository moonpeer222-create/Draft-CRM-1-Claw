/**
 * Improvement #20 — Consolidated error patterns.
 * Shared error handling utilities for all server routes.
 */

/** Wrap a Hono handler with consistent try/catch error handling */
export function safeHandler(label: string, handler: (c: any) => Promise<any>) {
  return async (c: any) => {
    try {
      return await handler(c);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errStack = err?.stack || "";
      console.log(`[${label}] Error:`, errMsg);
      if (errStack) console.log(`[${label}] Stack:`, errStack.substring(0, 500));
      return c.json({
        success: false,
        error: `${label}: ${errMsg}`,
        _errorCode: label.replace(/\s+/g, "_").toUpperCase(),
      }, 500);
    }
  };
}

/** Format a validation error response */
export function validationError(c: any, field: string, message: string) {
  return c.json({
    success: false,
    error: `Validation error — ${field}: ${message}`,
    _errorCode: "VALIDATION_ERROR",
    _field: field,
  }, 400);
}

/** Format a not-found error response */
export function notFoundError(c: any, entity: string, id: string) {
  return c.json({
    success: false,
    error: `${entity} "${id}" not found`,
    _errorCode: "NOT_FOUND",
    _entity: entity,
    _id: id,
  }, 404);
}

/** Format a rate-limit error response */
export function rateLimitError(c: any) {
  return c.json({
    success: false,
    error: "Too many requests. Please slow down.",
    _errorCode: "RATE_LIMITED",
  }, 429);
}

/** Format a missing config error (e.g. missing API key) */
export function configError(c: any, configName: string, hint: string) {
  return c.json({
    success: false,
    error: `${configName} not configured. ${hint}`,
    _errorCode: "CONFIG_MISSING",
    _config: configName,
  }, 400);
}

/** Safely extract and log error from fetch Response */
export async function extractFetchError(res: Response, label: string): Promise<string> {
  let errMsg = `HTTP ${res.status} ${res.statusText}`;
  try {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      errMsg = json.error?.message || json.message || json.error || errMsg;
    } catch {
      if (body.length < 500) errMsg = body || errMsg;
    }
  } catch { /* ignore */ }
  console.log(`[${label}] Fetch error:`, errMsg);
  return errMsg;
}

/** Retry an async operation with exponential backoff for transient errors */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 300,
): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const isTransient =
        msg.includes("Connection reset") ||
        msg.includes("connection reset") ||
        msg.includes("os error 104") ||
        msg.includes("ECONNRESET") ||
        msg.includes("broken pipe") ||
        msg.includes("Broken pipe") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("error sending request");
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      console.log(`[${label}] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms: ${msg.substring(0, 120)}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}