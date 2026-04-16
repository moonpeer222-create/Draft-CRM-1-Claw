// ═══════════════════════════════════════════════════════════════
// Access Code Service — Time-Based Deterministic Codes (TOTP-like)
// ═══════════════════════════════════════════════════════════════
//
// HOW IT WORKS (fully offline, cross-device):
//
//  1. Each agent has a deterministic seed derived from their Agent ID.
//  2. Time is divided into 6-hour windows (00:00-06:00, 06:00-12:00, …).
//  3. A 6-digit code is computed:  hash(agentSeed + timeWindow + masterSecret)
//  4. Both the Admin device and the Agent device run the SAME algorithm,
//     so they independently arrive at the SAME code — no network needed.
//  5. Admin sees the current code and shares it with the agent (WhatsApp / call).
//  6. Agent enters the code; their device recomputes & validates locally.
//  7. Every 6 hours the window rotates → old code stops working.
//
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  ADMIN_AUTH: "emerald-admin-auth",
  AGENT_CODES: "emerald-agent-codes",   // still used for active/inactive state
  AGENT_SESSION: "emerald-agent-session",
  CODE_HISTORY: "emerald-code-history",
};

// ── Master admin credentials ──────────────────────────────────
const MASTER_CREDENTIALS = {
  email: "admin@emeraldvisa.com",
  password: "admin123",
};

// ── TOTP Constants ────────────────────────────────────────────
const TOTP_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const TOTP_MASTER_SECRET = "EMERALD-VISA-CRM-2024-SECURE-KEY";

// ── Interfaces ────────────────────────────────────────────────
export interface AgentAccessCode {
  agentId: string;
  agentName: string;
  code: string;        // current TOTP code (computed, not random)
  generatedAt: number; // start of current time window
  expiresAt: number;   // end of current time window
  generatedBy: string;
  active: boolean;
}

export interface AgentSession {
  agentId: string;
  agentName: string;
  code: string;
  loginAt: number;
  expiresAt: number;
  active: boolean;
}

export interface AdminSession {
  email: string;
  loginAt: number;
  active: boolean;
}

export interface AccessCode {
  code: string;
  generatedAt: number;
  expiresAt: number;
  generatedBy: string;
}

// ── Default agents — production: empty, agents are registered dynamically via UserDB ──
const DEFAULT_AGENTS: { id: string; name: string }[] = [];

// ══════════════════════════════════════════════════════════════
// TOTP Core — deterministic hash-based code generation
// ══════════════════════════════════════════════════════════════

/** Deterministic seed for any agent ID (no storage needed) */
function getAgentSeed(agentId: string): string {
  return `EMERALD-${agentId}-VISA-TOTP-SEED`;
}

/** Current 6-hour time window index */
function getCurrentTimeWindow(): number {
  return Math.floor(Date.now() / TOTP_WINDOW_MS);
}

/** Timestamp when the current window started */
function getWindowStart(window: number): number {
  return window * TOTP_WINDOW_MS;
}

/** Timestamp when the current window expires */
function getWindowExpiry(window: number): number {
  return (window + 1) * TOTP_WINDOW_MS;
}

/** Simple but reliable hash (djb2 variant) → positive 31-bit integer */
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & 0x7FFFFFFF; // keep positive
  }
  return hash;
}

/** Compute the 6-digit TOTP code for a given agent + time window */
function computeTOTP(agentId: string, timeWindow: number): string {
  const seed = getAgentSeed(agentId);
  const payload = `${seed}:${timeWindow}:${TOTP_MASTER_SECRET}`;
  const hash = djb2Hash(payload);
  return String(hash % 1000000).padStart(6, "0");
}

// Legacy random code generator (kept for backward compat)
function generateRandomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ══════════════════════════════════════════════════════════════
// AccessCodeService
// ══════════════════════════════════════════════════════════════

export class AccessCodeService {
  private static _pushAgentCodes: (() => void) | null = null;
  private static _pushCodeHistory: (() => void) | null = null;

  static registerSyncPush(pushCodes: () => void, pushHistory: () => void) {
    this._pushAgentCodes = pushCodes;
    this._pushCodeHistory = pushHistory;
  }

  private static notifyCodesSync() {
    if (this._pushAgentCodes) this._pushAgentCodes();
  }
  private static notifyHistorySync() {
    if (this._pushCodeHistory) this._pushCodeHistory();
  }

  // ════════════════════════════════════════════════════════════
  // ADMIN AUTH (unchanged)
  // ════════════════════════════════════════════════════════════

  static adminLogin(email: string, password: string): { success: boolean; error?: string } {
    if (email.toLowerCase() === MASTER_CREDENTIALS.email && password === MASTER_CREDENTIALS.password) {
      const session: AdminSession = { email, loginAt: Date.now(), active: true };
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(session));
      return { success: true };
    }
    return { success: false, error: "Invalid email or password" };
  }

  static adminLogout(): void {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }

  static getAdminSession(): AdminSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
      if (!data) return null;
      const session: AdminSession = JSON.parse(data);
      if (!session.active) return null;
      // Check session expiry (8 hours)
      if (session.loginAt && Date.now() - session.loginAt > 8 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
        return null;
      }
      if ((session as any).expiresAt && Date.now() > (session as any).expiresAt) {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
        return null;
      }
      return session;
    } catch { return null; }
  }

  static isAdminLoggedIn(): boolean {
    return !!this.getAdminSession();
  }

  // ════════════════════════════════════════════════════════════
  // TOTP — Time-Based Access Codes
  // ════════════════════════════════════════════════════════════

  /** Get the current TOTP code for a specific agent */
  static getTOTPCode(agentId: string): string {
    return computeTOTP(agentId, getCurrentTimeWindow());
  }

  /** Milliseconds remaining until the current code expires */
  static getTOTPTimeRemaining(): number {
    const window = getCurrentTimeWindow();
    return Math.max(0, getWindowExpiry(window) - Date.now());
  }

  /** Human-readable expiry time for the current window */
  static getTOTPExpiryTime(): string {
    const window = getCurrentTimeWindow();
    return new Date(getWindowExpiry(window)).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** Get all agent TOTP codes (for Admin panel) */
  static getAllTOTPCodes(): AgentAccessCode[] {
    const window = getCurrentTimeWindow();
    const start = getWindowStart(window);
    const expiry = getWindowExpiry(window);

    // Get active/inactive state from localStorage (admin-local only)
    const stateMap = this.getAgentStateMap();

    // Build from default agents + any registered agents
    const agents = this.getKnownAgents();

    return agents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      code: computeTOTP(agent.id, window),
      generatedAt: start,
      expiresAt: expiry,
      generatedBy: "time-sync",
      active: stateMap[agent.id] !== false, // default active
    }));
  }

  /**
   * Validate a code entered by an agent.
   * Computes the expected TOTP for every known agent and checks for a match.
   * Works on ANY device — no localStorage codes needed.
   */
  static validateCode(inputCode: string): {
    valid: boolean;
    agentId?: string;
    agentName?: string;
    error?: string;
  } {
    if (!inputCode || inputCode.length !== 6) {
      console.log("[TOTP] Rejected: code length is", inputCode?.length, "expected 6");
      return { valid: false, error: "Code must be 6 digits" };
    }

    const window = getCurrentTimeWindow();
    const agents = this.getKnownAgents();

    console.log("[TOTP] ─── Validation Start ───");
    console.log("[TOTP] Input code:", inputCode);
    console.log("[TOTP] Time window:", window);
    console.log("[TOTP] Known agents:", agents.length);

    for (const agent of agents) {
      const expected = computeTOTP(agent.id, window);
      console.log(`[TOTP] ${agent.id} (${agent.name}): expected=${expected} match=${expected === inputCode}`);
      if (expected === inputCode) {
        console.log("[TOTP] ✅ VALID — matched", agent.id, agent.name);
        return { valid: true, agentId: agent.id, agentName: agent.name };
      }
    }

    // Also try the previous window (grace period — 5 min overlap)
    const prevWindow = window - 1;
    const prevWindowExpiry = getWindowExpiry(prevWindow);
    const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - prevWindowExpiry < gracePeriodMs) {
      console.log("[TOTP] Checking previous window (grace period):", prevWindow);
      for (const agent of agents) {
        const expected = computeTOTP(agent.id, prevWindow);
        if (expected === inputCode) {
          console.log("[TOTP] ✅ VALID (grace period) — matched", agent.id, agent.name);
          return { valid: true, agentId: agent.id, agentName: agent.name };
        }
      }
    }

    console.log("[TOTP] ❌ No match found for code:", inputCode);
    return { valid: false, error: "Invalid or expired access code" };
  }

  // ════════════════════════════════════════════════════════════
  // AGENT STATE (active/inactive — admin-local only)
  // ════════════════════════════════════════════════════════════

  /** Get map of agentId → active boolean from admin's localStorage */
  private static getAgentStateMap(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem("emerald-agent-active-state");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch { return {}; }
  }

  private static saveAgentStateMap(map: Record<string, boolean>) {
    localStorage.setItem("emerald-agent-active-state", JSON.stringify(map));
  }

  /** Toggle an agent's active/inactive state (admin device only) */
  static toggleAgentActive(agentId: string): AgentAccessCode | null {
    const map = this.getAgentStateMap();
    map[agentId] = map[agentId] === false ? true : false; // toggle, default was true
    this.saveAgentStateMap(map);
    this.notifyCodesSync();

    // Return updated info
    const all = this.getAllTOTPCodes();
    return all.find((a) => a.agentId === agentId) || null;
  }

  // ════════════════════════════════════════════════════════════
  // KNOWN AGENTS REGISTRY
  // ════════════════════════════════════════════════════════════

  /** Get all known agents (defaults + any registered via CRM) */
  private static getKnownAgents(): { id: string; name: string }[] {
    const map = new Map<string, string>();
    // Defaults first
    DEFAULT_AGENTS.forEach((a) => map.set(a.id, a.name));
    // Then localStorage overrides / additions
    try {
      const raw = localStorage.getItem("emerald-known-agents");
      if (raw) {
        const extra: { id: string; name: string }[] = JSON.parse(raw);
        extra.forEach((a) => map.set(a.id, a.name));
      }
    } catch { /* ignore */ }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }

  /** Register a new agent (from CRM sync on admin device) */
  static registerAgent(agentId: string, agentName: string): AgentAccessCode {
    const agents = this.getKnownAgents();
    if (!agents.find((a) => a.id === agentId)) {
      try {
        const raw = localStorage.getItem("emerald-known-agents");
        const extra: { id: string; name: string }[] = raw ? JSON.parse(raw) : [];
        extra.push({ id: agentId, name: agentName });
        localStorage.setItem("emerald-known-agents", JSON.stringify(extra));
      } catch { /* ignore */ }
    }
    // Return current TOTP code info
    const window = getCurrentTimeWindow();
    return {
      agentId,
      agentName,
      code: computeTOTP(agentId, window),
      generatedAt: getWindowStart(window),
      expiresAt: getWindowExpiry(window),
      generatedBy: "time-sync",
      active: true,
    };
  }

  /** Remove agent from registry */
  static removeAgent(agentId: string): void {
    try {
      const raw = localStorage.getItem("emerald-known-agents");
      if (raw) {
        const extra: { id: string; name: string }[] = JSON.parse(raw);
        const filtered = extra.filter((a) => a.id !== agentId);
        localStorage.setItem("emerald-known-agents", JSON.stringify(filtered));
      }
    } catch { /* ignore */ }
  }

  // ════════════════════════════════════════════════════════════
  // AGENT SESSION (unchanged — used by AgentGuard)
  // ════════════════════════════════════════════════════════════

  static createAgentSession(code: string, agentId: string, agentName: string): AgentSession {
    const session: AgentSession = {
      agentId,
      agentName,
      code,
      loginAt: Date.now(),
      expiresAt: Date.now() + TOTP_WINDOW_MS, // matches 6-hour window
      active: true,
    };
    localStorage.setItem(STORAGE_KEYS.AGENT_SESSION, JSON.stringify(session));
    return session;
  }

  static getAgentSession(): AgentSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AGENT_SESSION);
      if (!data) return null;
      const session: AgentSession = JSON.parse(data);
      if (Date.now() > session.expiresAt || !session.active) {
        this.agentLogout();
        return null;
      }
      return session;
    } catch { return null; }
  }

  static isAgentLoggedIn(): boolean {
    return !!this.getAgentSession();
  }

  static getAgentTimeRemaining(): number {
    const session = this.getAgentSession();
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  static agentLogout(): void {
    localStorage.removeItem(STORAGE_KEYS.AGENT_SESSION);
  }

  static formatTimeRemaining(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // ════════════════════════════════════════════════════════════
  // LEGACY COMPAT (used by old callers)
  // ════════════════════════════════════════════════════════════

  static initializeAgentCodes(): AgentAccessCode[] {
    return this.getAllTOTPCodes();
  }

  static getAllAgentCodes(): AgentAccessCode[] {
    return this.getAllTOTPCodes();
  }

  static generateAgentCode(agentId: string): AgentAccessCode | null {
    // TOTP codes are deterministic — can't regenerate, but return current
    const all = this.getAllTOTPCodes();
    return all.find((a) => a.agentId === agentId) || null;
  }

  static generateAllAgentCodes(): AgentAccessCode[] {
    return this.getAllTOTPCodes();
  }

  static getAgentCode(agentId: string): AgentAccessCode | null {
    const all = this.getAllTOTPCodes();
    return all.find((a) => a.agentId === agentId) || null;
  }

  static getCurrentCode(): AccessCode | null {
    const codes = this.getAllTOTPCodes();
    if (codes.length === 0) return null;
    const first = codes[0];
    return {
      code: first.code,
      generatedAt: first.generatedAt,
      expiresAt: first.expiresAt,
      generatedBy: first.generatedBy,
    };
  }

  static generateAccessCode(): AccessCode {
    const codes = this.getAllTOTPCodes();
    if (codes.length > 0) {
      return {
        code: codes[0].code,
        generatedAt: codes[0].generatedAt,
        expiresAt: codes[0].expiresAt,
        generatedBy: codes[0].generatedBy,
      };
    }
    return {
      code: generateRandomCode(),
      generatedAt: Date.now(),
      expiresAt: Date.now() + TOTP_WINDOW_MS,
      generatedBy: "system",
    };
  }

  static getCodeHistory(): AccessCode[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CODE_HISTORY);
      if (!data) return [];
      return JSON.parse(data);
    } catch { return []; }
  }
}