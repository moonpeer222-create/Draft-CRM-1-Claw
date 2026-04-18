import { MAX_CASES } from "./constants.ts";

export function rateLimiter(max: number) {
  const _rl = new Map<string, { count: number; resetAt: number }>();
  return async (c: any, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    let e = _rl.get(`${ip}:${max}`);
    if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60000 }; _rl.set(`${ip}:${max}`, e); }
    e.count++;
    if (e.count > max) return c.json({ success: false, error: "Too many requests. Please slow down." }, 429);
    if (_rl.size > 1000) { for (const [k,v] of _rl.entries()) { if (now > v.resetAt) _rl.delete(k); } }
    await next();
  };
}

export function validateCaseFields(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data.customerName !== undefined && (typeof data.customerName !== "string" || data.customerName.length > 200)) {
    errors.push("customerName must be a string under 200 chars");
  }
  if (data.phone !== undefined && (typeof data.phone !== "string" || data.phone.length > 30)) {
    errors.push("phone must be a string under 30 chars");
  }
  if (data.totalFee !== undefined && (typeof data.totalFee !== "number" || data.totalFee < 0 || data.totalFee > 100000000)) {
    errors.push("totalFee must be a number between 0 and 100,000,000");
  }
  if (data.paidAmount !== undefined && (typeof data.paidAmount !== "number" || data.paidAmount < 0)) {
    errors.push("paidAmount must be a non-negative number");
  }
  if (data.priority !== undefined && !["low", "medium", "high", "urgent"].includes(data.priority)) {
    errors.push("priority must be one of: low, medium, high, urgent");
  }
  return { valid: errors.length === 0, errors };
}

export function sanitizeAIInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input
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
  if (sanitized.length > 4000) sanitized = sanitized.substring(0, 4000);
  return sanitized;
}

export function trimArray(data: any, max: number): any {
  if (!Array.isArray(data)) return data;
  return data.length > max ? data.slice(0, max) : data;
}

export function trimCases(cases: any): any {
  if (!Array.isArray(cases)) return cases;
  return cases.slice(0, MAX_CASES).map((c: any) => {
    const trimmed = { ...c };
    if (Array.isArray(trimmed.timeline) && trimmed.timeline.length > 50) {
      trimmed.timeline = trimmed.timeline.slice(-50);
    }
    if (Array.isArray(trimmed.notes) && trimmed.notes.length > 50) {
      trimmed.notes = trimmed.notes.slice(-50);
    }
    return trimmed;
  });
}
