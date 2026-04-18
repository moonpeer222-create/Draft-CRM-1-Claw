import { supabase } from "./supabase";
import { AccessCodeService } from "./accessCode";

const TOTP_WINDOW_MS = 6 * 60 * 60 * 1000;
const TOTP_MASTER_SECRET = "EMERALD-VISA-CRM-2024-SECURE-KEY";

function getAgentSeed(agentId: string): string {
  return `EMERALD-${agentId}-VISA-TOTP-SEED`;
}

function getCurrentTimeWindow(): number {
  return Math.floor(Date.now() / TOTP_WINDOW_MS);
}

function getWindowStart(window: number): number {
  return window * TOTP_WINDOW_MS;
}

function getWindowExpiry(window: number): number {
  return (window + 1) * TOTP_WINDOW_MS;
}

function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  return hash;
}

function computeTOTP(agentId: string, timeWindow: number): string {
  const seed = getAgentSeed(agentId);
  const payload = `${seed}:${timeWindow}:${TOTP_MASTER_SECRET}`;
  const hash = djb2Hash(payload);
  return String(hash % 1000000).padStart(6, "0");
}

/**
 * Derive a deterministic password from agent_id so agents can obtain
 * a real Supabase JWT after TOTP validation.
 */
export function getAgentPassword(agentId: string): string {
  const payload = `AGENT-AUTH-${agentId}-${TOTP_MASTER_SECRET}`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  const num = hash % 100000000;
  return `Agent${String(num).padStart(8, "0")}!`;
}

export interface AgentAuthResult {
  valid: boolean;
  agentId?: string;
  agentName?: string;
  profile?: any;
  error?: string;
}

export interface AgentCodeInfo {
  agentId: string;
  agentName: string;
  code: string;
  generatedAt: number;
  expiresAt: number;
  active: boolean;
}

/**
 * Fetch all active agents from Supabase and compute their current TOTP codes.
 * Used by the Admin panel to display shareable 6-digit codes.
 */
export async function getAgentCodesFromSupabase(): Promise<AgentCodeInfo[]> {
  const { data: agents, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "agent")
    .not("agent_id", "is", null)
    .order("agent_id", { ascending: true });

  if (error || !agents) {
    return [];
  }

  const window = getCurrentTimeWindow();
  const start = getWindowStart(window);
  const expiry = getWindowExpiry(window);

  return agents.map((agent: any) => ({
    agentId: agent.agent_id,
    agentName: agent.agent_name || agent.full_name || "Agent",
    code: computeTOTP(agent.agent_id, window),
    generatedAt: start,
    expiresAt: expiry,
    active: agent.status !== "inactive" && agent.status !== "suspended",
  }));
}

/**
 * Validate a 6-digit agent access code against active agents in Supabase.
 * Fetches agent profiles with agent_id from the cloud, then computes
 * the expected TOTP locally (same algorithm as the admin panel).
 */
export async function validateAgentCodeAsync(inputCode: string): Promise<AgentAuthResult> {
  if (!inputCode || inputCode.length !== 6) {
    return { valid: false, error: "Code must be 6 digits" };
  }

  const { data: agents, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "agent")
    .not("agent_id", "is", null);

  if (error || !agents || agents.length === 0) {
    // Fallback to legacy localStorage registry (admin device only)
    const legacy = AccessCodeService.validateCode(inputCode);
    if (legacy.valid) {
      return {
        valid: true,
        agentId: legacy.agentId,
        agentName: legacy.agentName,
      };
    }
    return { valid: false, error: "Invalid or expired access code" };
  }

  const window = getCurrentTimeWindow();

  for (const agent of agents) {
    const expected = computeTOTP(agent.agent_id, window);
    if (expected === inputCode) {
      return {
        valid: true,
        agentId: agent.agent_id,
        agentName: agent.agent_name || agent.full_name || "Agent",
        profile: agent,
      };
    }
  }

  // Grace period: previous window (5 min overlap)
  const prevWindow = window - 1;
  const prevWindowExpiry = getWindowExpiry(prevWindow);
  const gracePeriodMs = 5 * 60 * 1000;
  if (Date.now() - prevWindowExpiry < gracePeriodMs) {
    for (const agent of agents) {
      const expected = computeTOTP(agent.agent_id, prevWindow);
      if (expected === inputCode) {
        return {
          valid: true,
          agentId: agent.agent_id,
          agentName: agent.agent_name || agent.full_name || "Agent",
          profile: agent,
        };
      }
    }
  }

  return { valid: false, error: "Invalid or expired access code" };
}

/**
 * Format milliseconds into HH:MM:SS
 */
export function formatTimeRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
