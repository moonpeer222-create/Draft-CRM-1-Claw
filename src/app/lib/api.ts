// API Client for Supabase Edge Function server
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

// ── Session token management (Improvement #1) ─────────────
const SESSION_TOKEN_KEY = "emerald-session-token";

export function getSessionToken(): string | null {
  try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; }
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

const headers = () => {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${publicAnonKey}`,
  };
  const token = getSessionToken();
  if (token) h["x-session-token"] = token;
  return h;
};

// Track server availability globally to avoid unnecessary fetch calls
let _serverAvailable = false;
let _lastServerCheck = 0;
const SERVER_CHECK_COOLDOWN = 10000; // 10s cooldown between re-checks when server is down

export function setServerAvailable(available: boolean) {
  _serverAvailable = available;
  if (available) _lastServerCheck = Date.now();
}

export function isServerAvailable() {
  return _serverAvailable;
}

// Check if an error is transient and worth retrying
function isTransientError(err: any): boolean {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes("connection reset") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("aborted") ||
    msg.includes("error sending request") ||
    msg.includes("os error 104");
}

// Check if an HTTP error response is a server-side transient error
function isTransientStatus(status: number, errorMsg: string): boolean {
  // 502/503/504 are always transient — gateway/server temporarily down
  if (status === 502 || status === 503 || status === 504) return true;
  if (status === 500) {
    const msg = errorMsg.toLowerCase();
    return msg.includes("connection reset") ||
      msg.includes("error sending request") ||
      msg.includes("os error 104") ||
      msg.includes("broken pipe") ||
      msg.includes("bad gateway") ||
      msg.includes("internal server error");
  }
  return false;
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
  silent = false
): Promise<{ success: boolean; data?: T; error?: string }> {
  // Skip fetch entirely if server is known to be unavailable (except health checks)
  if (!_serverAvailable && path !== "/health") {
    // Allow retry after cooldown
    if (Date.now() - _lastServerCheck < SERVER_CHECK_COOLDOWN) {
      return { success: false, error: "Server unavailable (offline mode)" };
    }
  }

  const maxRetries = 2; // Up to 2 retries (3 total attempts) for transient errors
  let lastError: string = "";
  let hadRetries = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers(), ...(options.headers || {}) },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK HTTP status before parsing JSON
      if (!res.ok) {
        let errorMsg = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          errorMsg = errJson.error || errJson.message || errorMsg;
        } catch {
          // Response isn't JSON, use status text
        }
        // Retry on transient server errors
        if (attempt < maxRetries && isTransientStatus(res.status, errorMsg)) {
          hadRetries = true;
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
          lastError = errorMsg;
          continue;
        }
        if (!silent) console.error(`API Error [${path}]:`, errorMsg);
        return { success: false, error: errorMsg };
      }

      let json: any;
      try {
        json = await res.json();
      } catch {
        if (!silent) console.error(`API Error [${path}]: Invalid JSON response`);
        return { success: false, error: "Invalid JSON response from server" };
      }

      // Log successful retry recovery
      if (hadRetries && !silent) {
      }

      if (!json.success && !silent) {
      }
      return json;
    } catch (err) {
      // Retry on transient network errors
      if (attempt < maxRetries && isTransientError(err)) {
        hadRetries = true;
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        lastError = `Network error: ${err}`;
        continue;
      }
      _serverAvailable = false;
      _lastServerCheck = Date.now();
      if (!silent) console.error(`[API ${path}] Network error:`, err);
      return { success: false, error: `Network error: ${err}` };
    }
  }

  // Should not reach here, but safety fallback
  return { success: false, error: lastError || "Request failed after retries" };
}

// ============================================================
// Cases
// ============================================================
export const casesApi = {
  getAll: () => request<any[]>("/cases"),

  saveAll: (cases: any[]) =>
    request("/cases", {
      method: "POST",
      body: JSON.stringify({ cases }),
    }),

  update: (caseId: string, updates: any) =>
    request(`/cases/${encodeURIComponent(caseId)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  remove: (caseId: string) =>
    request(`/cases/${encodeURIComponent(caseId)}`, { method: "DELETE" }),
};

// ============================================================
// Agent Access Codes
// ============================================================
export const agentCodesApi = {
  getAll: () => request<any[]>("/agent-codes"),

  saveAll: (codes: any[]) =>
    request("/agent-codes", {
      method: "POST",
      body: JSON.stringify({ codes }),
    }),
};

// ============================================================
// Code History
// ============================================================
export const codeHistoryApi = {
  get: () => request<any[]>("/code-history"),

  save: (history: any[]) =>
    request("/code-history", {
      method: "POST",
      body: JSON.stringify({ history }),
    }),
};

// ============================================================
// Admin Profile
// ============================================================
export const adminProfileApi = {
  get: () => request<any>("/admin-profile"),

  save: (profile: any) =>
    request("/admin-profile", {
      method: "POST",
      body: JSON.stringify({ profile }),
    }),
};

// ============================================================
// Agent Profile
// ============================================================
export const agentProfileApi = {
  get: (name: string) =>
    request<any>(`/agent-profile/${encodeURIComponent(name)}`),

  save: (name: string, profile: any) =>
    request(`/agent-profile/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ profile }),
    }),
};

// ============================================================
// Agent Avatar (synced to cloud)
// ============================================================
export const agentAvatarApi = {
  get: (name: string) =>
    request<string | null>(`/agent-avatar/${encodeURIComponent(name)}`),

  save: (name: string, avatar: string | null) =>
    request(`/agent-avatar/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ avatar }),
    }),
};

// ============================================================
// Settings
// ============================================================
export const settingsApi = {
  get: () => request<any>("/settings"),

  save: (settings: any) =>
    request("/settings", {
      method: "POST",
      body: JSON.stringify({ settings }),
    }),
};

// ============================================================
// Notifications
// ============================================================
export const notificationsApi = {
  get: () => request<any[]>("/notifications"),

  save: (notifications: any[]) =>
    request("/notifications", {
      method: "POST",
      body: JSON.stringify({ notifications }),
    }),
};

// ============================================================
// Attendance
// ============================================================
export const attendanceApi = {
  get: (date: string) => request<any[]>(`/attendance/${date}`),

  save: (date: string, records: any[]) =>
    request(`/attendance/${date}`, {
      method: "POST",
      body: JSON.stringify({ records }),
    }),

  // Bulk: all attendance records
  getAll: () => request<any[]>("/attendance-all"),

  saveAll: (records: any[]) =>
    request("/attendance-all", {
      method: "POST",
      body: JSON.stringify({ records }),
    }),
};

// ============================================================
// Leave Requests
// ============================================================
export const leaveRequestsApi = {
  getAll: () => request<any[]>("/leave-requests"),

  saveAll: (requests: any[]) =>
    request("/leave-requests", {
      method: "POST",
      body: JSON.stringify({ requests }),
    }),
};

// ============================================================
// Users Database
// ============================================================
export const usersApi = {
  getAll: () => request<any[]>("/users"),

  saveAll: (users: any[]) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify({ users }),
    }),
};

// ============================================================
// Bulk Sync
// ============================================================
export interface SyncData {
  cases?: any[] | null;
  agentCodes?: any[] | null;
  adminProfile?: any | null;
  codeHistory?: any[] | null;
  settings?: any | null;
  notifications?: any[] | null;
  users?: any[] | null;
  attendance?: any[] | null;
  leaveRequests?: any[] | null;
  passportTracking?: any[] | null;
  auditLog?: any[] | null;
  documentFiles?: any | null;
}

export interface SyncDownloadResponse {
  data: SyncData;
  entityTimestamps: Record<string, string> | null;
}

export const syncApi = {
  download: () => request<SyncData>("/sync"),

  upload: (data: SyncData) =>
    request("/sync", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ============================================================
// Generic KV
// ============================================================
export const kvApi = {
  get: (key: string) =>
    request<any>(`/kv/${encodeURIComponent(key)}`),

  set: (key: string, value: any) =>
    request(`/kv/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
};

// ============================================================
// Passport Tracking
// ============================================================
export const passportTrackingApi = {
  getAll: () => request<any[]>("/passport-tracking"),

  saveAll: (trackings: any[]) =>
    request("/passport-tracking", {
      method: "POST",
      body: JSON.stringify({ trackings }),
    }),
};

// ============================================================
// Audit Log
// ============================================================
export const auditLogApi = {
  getAll: () => request<any[]>("/audit-log"),

  saveAll: (entries: any[]) =>
    request("/audit-log", {
      method: "POST",
      body: JSON.stringify({ entries }),
    }),
};

// ============================================================
// Document Files (metadata sync)
// ============================================================
export const documentFilesApi = {
  getAll: () => request<any>("/document-files"),

  saveAll: (files: any) =>
    request("/document-files", {
      method: "POST",
      body: JSON.stringify({ files }),
    }),
};

// ============================================================
// Document Storage (Supabase Storage for large files)
// ============================================================
export const documentStorageApi = {
  upload: (docId: string, fileName: string, mimeType: string, base64Data: string) =>
    request<{ path: string; size: number }>("/storage/documents/upload", {
      method: "POST",
      body: JSON.stringify({ docId, fileName, mimeType, base64Data }),
    }),

  getSignedUrl: (docId: string, fileName: string) =>
    request<{ signedUrl: string }>(`/storage/documents/${encodeURIComponent(docId)}/${encodeURIComponent(fileName)}`),

  remove: (docId: string, fileName: string) =>
    request(`/storage/documents/${encodeURIComponent(docId)}/${encodeURIComponent(fileName)}`, {
      method: "DELETE",
    }),

  list: (docId: string) =>
    request<any[]>(`/storage/documents/${encodeURIComponent(docId)}`),
};

// ============================================================
// VisaVerse Analytics
// ============================================================
export const visaverseApi = {
  getAnalytics: () => request<any>("/visaverse/analytics", {}, true),

  trackEvent: (event: {
    featureKey: string;
    action: string;
    userId?: string;
    userRole?: string;
    caseId?: string;
    metadata?: Record<string, any>;
  }) =>
    request("/visaverse/analytics/event", {
      method: "POST",
      body: JSON.stringify(event),
    }, true),

  syncState: (state: {
    userId: string;
    xp: number;
    badges: string[];
    features: Record<string, boolean>;
    classicMode: boolean;
    satisfaction: number[];
  }) =>
    request("/visaverse/sync", {
      method: "POST",
      body: JSON.stringify(state),
    }, true),

  getState: (userId: string) =>
    request<any>(`/visaverse/sync/${encodeURIComponent(userId)}`, {}, true),

  saveMoodFeedback: (feedback: {
    caseId: string;
    stage: string;
    rating: number;
    userId?: string;
    userRole?: string;
  }) =>
    request("/visaverse/mood", {
      method: "POST",
      body: JSON.stringify(feedback),
    }, true),

  getMoodFeedback: (caseId: string) =>
    request<any>(`/visaverse/mood/${encodeURIComponent(caseId)}`, {}, true),
};

// ============================================================
// Health Check
// ============================================================
export const healthCheck = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for health check

    const res = await fetch(`${BASE_URL}/health`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      _serverAvailable = false;
      _lastServerCheck = Date.now();
      return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    // Accept any 2xx JSON response as healthy — don't require { success: true }
    try {
      const json = await res.json();
      // Check for explicit success field, or status "ok", or just treat 200 as healthy
      if (json.success === true || json.status === "ok") {
        _serverAvailable = true;
        _lastServerCheck = Date.now();
        return { success: true };
      }
      // If the response is a Supabase-level error wrapper
      if (json.error) {
        _serverAvailable = false;
        _lastServerCheck = Date.now();
        return { success: false, error: `Server error: ${json.error}` };
      }
      // 200 response with unknown shape — still treat as healthy
      _serverAvailable = true;
      _lastServerCheck = Date.now();
      return { success: true };
    } catch {
      // 200 but not JSON — still treat as healthy
      _serverAvailable = true;
      _lastServerCheck = Date.now();
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: `Network error: ${err}` };
  }
};

// ============================================================
// Backup (Brevo Integration)
// ============================================================
export const backupApi = {
  getSettings: () => request<any>("/backup/settings"),

  saveSettings: (settings: any) =>
    request("/backup/settings", {
      method: "POST",
      body: JSON.stringify({ settings }),
    }),

  getHistory: () => request<any[]>("/backup/history"),

  sendNow: (payload: {
    recipients: string[];
    selectedContent: string[];
    format: string;
    backupType?: "daily" | "weekly" | "monthly" | "auto";
  }) =>
    request("/backup/send-now", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteHistoryEntry: (id: string) =>
    request(`/backup/history/${encodeURIComponent(id)}`, { method: "DELETE" }),

  cleanup: () =>
    request("/backup/cleanup", { method: "POST" }),

  autoExport: (recipients: string[]) =>
    request("/backup/auto-export", {
      method: "POST",
      body: JSON.stringify({ recipients }),
    }),

  testBrevo: (testEmail?: string) =>
    request<any>("/backup/test-brevo", {
      method: "POST",
      body: JSON.stringify({ testEmail: testEmail || "" }),
    }),
};

// ============================================================
// CRM Actions via Server KV (Improvement #5)
// ============================================================
export const crmActionsApi = {
  execute: (action: { type: string; [key: string]: any }) =>
    request<any>("/crm/action", {
      method: "POST",
      body: JSON.stringify(action),
    }),
};

// ============================================================
// Pipeline Management — Dual pipeline, SLA, approvals
// ============================================================
export const pipelineApi = {
  getSLAAlerts: () =>
    request<any[]>("/pipeline/sla-alerts"),

  migrateToVisa: (caseId: string) =>
    request<any>("/pipeline/migrate-to-visa", {
      method: "POST",
      body: JSON.stringify({ caseId }),
    }),

  advanceStage: (caseId: string, nextStageKey: string, userId?: string, userName?: string) =>
    request<any>("/pipeline/advance-stage", {
      method: "POST",
      body: JSON.stringify({ caseId, nextStageKey, userId, userName }),
    }),

  sirAtifApprove: (caseId: string, approved: boolean, note?: string, userId?: string, userName?: string) =>
    request<any>("/pipeline/sir-atif-approve", {
      method: "POST",
      body: JSON.stringify({ caseId, approved, note, userId, userName }),
    }),

  cancelCase: (caseId: string, reason: string, userId?: string, userName?: string) =>
    request<any>("/pipeline/cancel-case", {
      method: "POST",
      body: JSON.stringify({ caseId, reason, userId, userName }),
    }),

  reopenCase: (caseId: string, userId?: string, userName?: string) =>
    request<any>("/pipeline/reopen-case", {
      method: "POST",
      body: JSON.stringify({ caseId, userId, userName }),
    }),

  updateChecklist: (caseId: string, checklistKey: string, verified: boolean, docId?: string, userId?: string, userName?: string) =>
    request<any>("/pipeline/update-checklist", {
      method: "POST",
      body: JSON.stringify({ caseId, checklistKey, verified, docId, userId, userName }),
    }),

  verifyPayment: (caseId: string, verified: boolean, userId?: string, userName?: string) =>
    request<any>("/pipeline/verify-payment", {
      method: "POST",
      body: JSON.stringify({ caseId, verified, userId, userName }),
    }),
};

// ============================================================
// Production Document Upload — Direct to Supabase Storage
// ============================================================
export const documentUploadApi = {
  uploadForm: async (file: File, caseId: string, docId: string, opts?: {
    checklistKey?: string;
    uploadedBy?: string;
    uploadedByRole?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", caseId);
      formData.append("docId", docId);
      if (opts?.checklistKey) formData.append("checklistKey", opts.checklistKey);
      if (opts?.uploadedBy) formData.append("uploadedBy", opts.uploadedBy);
      if (opts?.uploadedByRole) formData.append("uploadedByRole", opts.uploadedByRole);

      const token = getSessionToken();
      const hdrs: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) hdrs["x-session-token"] = token;

      const res = await fetch(`${BASE_URL}/storage/documents/upload-form`, {
        method: "POST",
        headers: hdrs,
        body: formData,
      });

      const json = await res.json();
      return json;
    } catch (err) {
      return { success: false, error: `Upload error: ${err}` };
    }
  },

  batchSignedUrls: (paths: string[]) =>
    request<Record<string, string | null>>("/storage/documents/batch-signed-urls", {
      method: "POST",
      body: JSON.stringify({ paths }),
    }),
};

// ============================================================
// Salary Calculator
// ============================================================
export const salaryApi = {
  calculate: (month?: number, year?: number) =>
    request<any>("/salary/calculate", {
      method: "POST",
      body: JSON.stringify({ month, year }),
    }),
};

// ============================================================
// Auth - Session validation
// ============================================================
export const authApi = {
  validate: () =>
    request<{ valid: boolean; data?: { userId: string; fullName: string; email: string; role: string; expiresAt: string } }>("/auth/validate", {
      method: "POST",
    }, true),

  logout: () =>
    request("/auth/logout", { method: "POST" }, true),
};

// ============================================================
// AI Chat
// ============================================================
export const aiChatApi = {
  send: (payload: {
    message: string;
    role: string;
    language?: string;
    conversationHistory?: any[];
    crmContext?: string;
  }) =>
    request<any>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /** Improvement #18: Streaming AI chat via SSE */
  sendStream: async (
    payload: {
      message: string;
      role: string;
      language?: string;
      conversationHistory?: any[];
      crmContext?: string;
      systemPrompt?: string;
    },
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
  ): Promise<void> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for streaming

      const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
        method: "POST",
        headers: { ...headers() },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try { const j = await res.json(); errMsg = j.error || errMsg; } catch { /* */ }
        // If non-streaming fallback was returned (rate limit)
        if (res.headers.get("content-type")?.includes("application/json")) {
          try {
            const json = await res.json();
            if (json.success && json.data?.response) {
              onToken(json.data.response);
              onDone();
              return;
            }
          } catch { /* */ }
        }
        onError(errMsg);
        return;
      }

      // Check if response is JSON (non-streaming fallback)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (json.success && json.data?.response) {
          onToken(json.data.response);
          onDone();
        } else {
          onError(json.error || "Unknown error");
        }
        return;
      }

      // SSE stream
      const reader = res.body?.getReader();
      if (!reader) { onError("No response body"); return; }

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
            if (parsed.content) onToken(parsed.content);
          } catch { /* skip */ }
        }
      }

      onDone();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        onError("Request timed out");
      } else {
        onError(`Stream error: ${err?.message || err}`);
      }
    }
  },
};

// ============================================================
// Operator Data
// ============================================================
export const operatorDataApi = {
  get: () => request<any>("/operator-data"),
  save: (data: any) =>
    request("/operator-data", {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
};

// ============================================================
// AI Audit Log (Improvement #17)
// ============================================================
export const aiAuditApi = {
  getLog: () => request<any[]>("/ai/audit-log"),
};

// ============================================================
// Detailed Health (Improvement #16)
// ============================================================
export const healthDetailedApi = {
  get: () => request<any>("/health/detailed"),
  runCheck: () => request<any>("/health/run-check", { method: "POST" }),
  getHistory: () => request<any[]>("/health/history"),
};