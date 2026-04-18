import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { kv } from "https://deno.land/x/kv@v0.0.1/mod.ts";
import { withRetry } from "./retry.ts";
import { KEY } from "./constants.ts";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export const kvSet = (key: string, value: any, label = "kv-set") =>
  withRetry(() => kv.set(key, value), label);

export const kvDel = (key: string, label = "kv-del") =>
  withRetry(() => kv.del(key), label);

export async function logAIAudit(entry: { role: string; userId?: string; message: string; hasActions: boolean; model: string; timestamp: string }) {
  try {
    const log = (await kv.get(KEY.aiAudit)) || [];
    log.unshift({
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...entry,
      messagePreview: entry.message.substring(0, 100),
    });
    if (log.length > 500) log.length = 500;
    await kvSet(KEY.aiAudit, log, "ai-audit-log");
  } catch (e) {
    console.log("AI audit log error (non-fatal):", e);
  }
}
