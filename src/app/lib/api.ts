// API Client for Supabase Edge Functions (Individual Functions)
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

// Edge Function URLs (deployed to nsglpnxboaxkrgtmlsps)
const EDGE_URLS = {
  auth: `https://${projectId}.supabase.co/functions/v1/auth_pg`,
  cases: `https://${projectId}.supabase.co/functions/v1/cases`,
  sync: `https://${projectId}.supabase.co/functions/v1/sync_pg`,
  system: `https://${projectId}.supabase.co/functions/v1/system_pg`,
  admin: `https://${projectId}.supabase.co/functions/v1/admin_pg`,
  ai: `https://${projectId}.supabase.co/functions/v1/ai_pg`,
};

// Route paths to correct edge function
function getEdgeUrl(path: string): string {
  // Auth endpoints
  if (path.startsWith('/auth/') || path === '/health') {
    return EDGE_URLS.auth;
  }
  // Cases endpoints
  if (path.startsWith('/cases') || path.startsWith('/case/')) {
    return EDGE_URLS.cases;
  }
  // Admin endpoints
  if (path.startsWith('/admin/') || path.startsWith('/dashboard') || path.startsWith('/stats')) {
    return EDGE_URLS.admin;
  }
  // System endpoints
  if (path.startsWith('/system/') || path.startsWith('/health') || path.startsWith('/backup')) {
    return EDGE_URLS.system;
  }
  // Sync endpoints
  if (path.startsWith('/sync') || path.startsWith('/sync/')) {
    return EDGE_URLS.sync;
  }
  // AI endpoints
  if (path.startsWith('/ai') || path.startsWith('/ai/')) {
    return EDGE_URLS.ai;
  }
  // Default to auth for unknown paths
  return EDGE_URLS.auth;
}

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
  let timeoutId: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(`${getEdgeUrl(path)}${path}`, {
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

        // Handle auth errors specifically
        if (res.status === 401) {
          return { success: false, error: "Unauthorized" };
        }
        if (res.status === 403) {
          return { success: false, error: "Forbidden" };
        }

        lastError = errorMsg;

        // Check if this is a transient error worth retrying
        if (isTransientStatus(res.status, errorMsg) && attempt < maxRetries) {
          hadRetries = true;
          const delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        return { success: false, error: errorMsg };
      }

      // Success — parse JSON response
      const data = await res.json();
      setServerAvailable(true);
      return { success: true, data };

    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const errorMsg = err?.message || String(err);
      lastError = errorMsg;

      // Check for transient network errors and retry
      if (isTransientError(err) && attempt < maxRetries) {
        hadRetries = true;
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Abort errors (timeout) — mark server as unavailable
      if (errorMsg.toLowerCase().includes("abort") || errorMsg.toLowerCase().includes("timeout")) {
        _serverAvailable = false;
        _lastServerCheck = Date.now();
        return { success: false, error: "Request timed out — server may be unavailable" };
      }

      return { success: false, error: errorMsg };
    }
  }

  // Exhausted all retries
  return { success: false, error: hadRetries ? `Failed after retries: ${lastError}` : lastError };
}

// ── Health Check ─────────────────────────────────────────────────
export async function healthCheck(silent = false): Promise<boolean> {
  const res = await request("/health", {}, silent);
  return res.success;
}

// ── Auth API ─────────────────────────────────────────────────────
export const authApi = {
  async validate(): Promise<{ success: boolean; data?: any; error?: string }> {
    return request("/auth/validate", {}, true);
  },

  async login(email: string, password: string, role: string) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
  },

  async register(email: string, password: string, fullName: string, role: string, tenantCode?: string) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName, role, tenantCode }),
    });
  },

  async logout() {
    return request("/auth/logout", { method: "POST" });
  },

  async refreshToken() {
    return request("/auth/refresh", { method: "POST" });
  },

  async forgotPassword(email: string) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, newPassword: string) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  async createAgentCode(code: string, email?: string) {
    return request("/admin/agent-codes", {
      method: "POST",
      body: JSON.stringify({ code, email }),
    });
  },

  async verifyAgentCode(code: string) {
    return request("/auth/verify-agent-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  async agentCodeLogin(code: string) {
    return request("/auth/agent-code-login", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
};

// ── Cases API ────────────────────────────────────────────────────
export const casesApi = {
  async getAll(filters?: Record<string, any>) {
    const query = filters ? "?" + new URLSearchParams(filters).toString() : "";
    return request(`/cases${query}`);
  },

  async getById(id: string) {
    return request(`/cases/${id}`);
  },

  async create(data: any) {
    return request("/cases", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return request(`/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return request(`/cases/${id}`, { method: "DELETE" });
  },

  async search(query: string) {
    return request(`/cases/search?q=${encodeURIComponent(query)}`);
  },

  async getOverdue() {
    return request("/cases/overdue");
  },

  async updateStatus(id: string, status: string) {
    return request(`/cases/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async addPayment(caseId: string, payment: any) {
    return request(`/cases/${caseId}/payments`, {
      method: "POST",
      body: JSON.stringify(payment),
    });
  },

  async getPayments(caseId: string) {
    return request(`/cases/${caseId}/payments`);
  },

  async addNote(caseId: string, note: any) {
    return request(`/cases/${caseId}/notes`, {
      method: "POST",
      body: JSON.stringify(note),
    });
  },

  async getNotes(caseId: string) {
    return request(`/cases/${caseId}/notes`);
  },

  async uploadDocument(caseId: string, fileData: any) {
    return request(`/cases/${caseId}/documents`, {
      method: "POST",
      body: JSON.stringify(fileData),
    });
  },

  async getDocuments(caseId: string) {
    return request(`/cases/${caseId}/documents`);
  },

  async cancel(id: string, reason: string) {
    return request(`/cases/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async reopen(id: string) {
    return request(`/cases/${id}/reopen`, { method: "POST" });
  },
};

// ── Admin API ───────────────────────────────────────────────────
export const adminApi = {
  async getDashboardStats() {
    return request("/admin/stats");
  },

  async getAllUsers() {
    return request("/admin/users");
  },

  async getUserById(id: string) {
    return request(`/admin/users/${id}`);
  },

  async createUser(data: any) {
    return request("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: any) {
    return request(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string) {
    return request(`/admin/users/${id}`, { method: "DELETE" });
  },

  async getAgentCodes() {
    return request("/admin/agent-codes");
  },

  async revokeAgentCode(code: string) {
    return request(`/admin/agent-codes/${code}/revoke`, { method: "POST" });
  },

  async getAuditLog(options?: { limit?: number; offset?: number }) {
    const query = options ? "?" + new URLSearchParams(options as any).toString() : "";
    return request(`/admin/audit-log${query}`);
  },

  async getSystemHealth() {
    return request("/system/health");
  },

  async triggerBackup() {
    return request("/system/backup", { method: "POST" });
  },

  async getSettings() {
    return request("/admin/settings");
  },

  async updateSettings(settings: any) {
    return request("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  },

  async enablePanicMode() {
    return request("/admin/panic/enable", { method: "POST" });
  },

  async disablePanicMode() {
    return request("/admin/panic/disable", { method: "POST" });
  },

  async getPanicStatus() {
    return request("/admin/panic/status");
  },
};

// ── Sync API ─────────────────────────────────────────────────────
export const syncApi = {
  async fullSync() {
    return request("/sync/full", { method: "POST" });
  },

  async syncCases() {
    return request("/sync/cases", { method: "POST" });
  },

  async syncUsers() {
    return request("/sync/users", { method: "POST" });
  },

  async getSyncStatus() {
    return request("/sync/status");
  },

  async resolveConflict(table: string, id: string, resolution: "local" | "remote") {
    return request("/sync/resolve", {
      method: "POST",
      body: JSON.stringify({ table, id, resolution }),
    });
  },
};

// ── AI API ───────────────────────────────────────────────────────
export const aiApi = {
  async chat(message: string, options?: { role?: string; conversationId?: string }) {
    return request("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, ...options }),
    });
  },

  async getConversations() {
    return request("/ai/conversations");
  },

  async getConversation(id: string) {
    return request(`/ai/conversations/${id}`);
  },

  async deleteConversation(id: string) {
    return request(`/ai/conversations/${id}`, { method: "DELETE" });
  },

  async action(action: string, params?: any) {
    return request("/ai/action", {
      method: "POST",
      body: JSON.stringify({ action, params }),
    });
  },

  async getAuditLog(options?: { limit?: number }) {
    const query = options ? "?" + new URLSearchParams(options as any).toString() : "";
    return request(`/ai/audit-log${query}`);
  },

  async getStats() {
    return request("/ai/stats");
  },
};

// ── Notifications API ────────────────────────────────────────────
export const notificationsApi = {
  async getAll() {
    return request("/notifications");
  },

  async markAsRead(id: string) {
    return request(`/notifications/${id}/read`, { method: "POST" });
  },

  async markAllAsRead() {
    return request("/notifications/read-all", { method: "POST" });
  },

  async delete(id: string) {
    return request(`/notifications/${id}`, { method: "DELETE" });
  },
};

// ── Attendance API ───────────────────────────────────────────────
export const attendanceApi = {
  async checkIn(location?: { lat: number; lng: number }) {
    return request("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify(location ? { location } : {}),
    });
  },

  async checkOut() {
    return request("/attendance/check-out", { method: "POST" });
  },

  async getMyAttendance() {
    return request("/attendance/my");
  },

  async getTeamAttendance() {
    return request("/attendance/team");
  },

  async getAllAttendance(options?: { date?: string; agentId?: string }) {
    const query = options ? "?" + new URLSearchParams(options as any).toString() : "";
    return request(`/attendance${query}`);
  },
};

// ── Stubs for legacy compatibility ─────────────────────────────────
// These are placeholders to prevent build errors from syncService.ts imports
// They route to appropriate functions or return empty data for now

export const agentCodesApi = {
  async getAll() { return request("/admin/agent-codes"); },
  async create(data: any) { return request("/admin/agent-codes", { method: "POST", body: JSON.stringify(data) }); },
  async revoke(code: string) { return request(`/admin/agent-codes/${code}/revoke`, { method: "POST" }); },
};

export const codeHistoryApi = {
  async getAll() { return { success: true, data: [] }; },
};

export const adminProfileApi = {
  async get() { return request("/admin/profile"); },
  async update(data: any) { return request("/admin/profile", { method: "PATCH", body: JSON.stringify(data) }); },
};

export const agentProfileApi = {
  async get() { return request("/auth/profile"); },
  async update(data: any) { return request("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }); },
};

export const settingsApi = {
  async get() { return request("/admin/settings"); },
  async update(data: any) { return request("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }); },
};

export const usersApi = {
  async getAll() { return request("/admin/users"); },
  async getById(id: string) { return request(`/admin/users/${id}`); },
  async create(data: any) { return request("/admin/users", { method: "POST", body: JSON.stringify(data) }); },
  async update(id: string, data: any) { return request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }); },
  async delete(id: string) { return request(`/admin/users/${id}`, { method: "DELETE" }); },
};

export const leaveRequestsApi = {
  async getAll() { return { success: true, data: [] }; },
  async create(data: any) { return { success: true, data }; },
  async approve(id: string) { return { success: true }; },
  async reject(id: string) { return { success: true }; },
};

export const agentAvatarApi = {
  async upload(file: File) { 
    const formData = new FormData();
    formData.append("file", file);
    return request("/auth/avatar", { method: "POST", body: formData }); 
  },
};

export const passportTrackingApi = {
  async getAll() { return request("/admin/passports"); },
  async getById(id: string) { return request(`/admin/passports/${id}`); },
  async create(data: any) { return request("/admin/passports", { method: "POST", body: JSON.stringify(data) }); },
  async update(id: string, data: any) { return request(`/admin/passports/${id}`, { method: "PATCH", body: JSON.stringify(data) }); },
};

export const auditLogApi = {
  async getAll(options?: any) {
    const query = options ? "?" + new URLSearchParams(options).toString() : "";
    return request(`/admin/audit-log${query}`);
  },
};

export const documentFilesApi = {
  async upload(caseId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/cases/${caseId}/documents`, { method: "POST", body: formData });
  },
  async getByCaseId(caseId: string) {
    return request(`/cases/${caseId}/documents`);
  },
};

export const backupApi = {
  async create() { return request("/system/backup", { method: "POST" }); },
  async restore(id: string) { return request(`/system/restore/${id}`, { method: "POST" }); },
  async getAll() { return request("/system/backups"); },
};

// ── Pipeline API (case stage management, checklist, approvals) ────
export const pipelineApi = {
  async advanceStage(caseId: string, status: string, agentId: string, agentName: string) {
    return request(`/case/${caseId}/advance`, {
      method: "POST",
      body: JSON.stringify({ status, agentId, agentName }),
    });
  },
  async updateChecklist(caseId: string, key: string, verified: boolean, fileRef?: string, userId?: string, userName?: string) {
    return request(`/case/${caseId}/checklist`, {
      method: "PATCH",
      body: JSON.stringify({ key, verified, fileRef, userId, userName }),
    });
  },
  async verifyPayment(caseId: string, verified: boolean, userId: string, userName: string) {
    return request(`/case/${caseId}/verify-payment`, {
      method: "POST",
      body: JSON.stringify({ verified, userId, userName }),
    });
  },
  async sirAtifApprove(caseId: string, approved: boolean, note?: string, userId?: string, userName?: string) {
    return request(`/case/${caseId}/sir-atif-approve`, {
      method: "POST",
      body: JSON.stringify({ approved, note, userId, userName }),
    });
  },
  async cancelCase(caseId: string, reason: string, userId: string, userName: string) {
    return request(`/case/${caseId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason, userId, userName }),
    });
  },
  async reopenCase(caseId: string, userId: string, userName: string) {
    return request(`/case/${caseId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ userId, userName }),
    });
  },
  async migrateToVisa(caseId: string) {
    return request(`/case/${caseId}/migrate-visa`, { method: "POST" });
  },
};

// ── Document Storage/Upload APIs (aliases for documentStore.ts) ────
export const documentUploadApi = {
  async upload(caseId: string, file: File, metadata?: any) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata) formData.append("metadata", JSON.stringify(metadata));
    return request(`/cases/${caseId}/documents/upload`, { method: "POST", body: formData });
  },
  async uploadForm(file: File, caseId: string, docId: string, metadata?: any) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docId", docId);
    if (metadata) formData.append("metadata", JSON.stringify(metadata));
    return request(`/cases/${caseId}/documents/upload`, { method: "POST", body: formData });
  },
  async getUrl(fileId: string) {
    return request(`/documents/${fileId}/url`);
  },
};

export const documentStorageApi = {
  async upload(file: File, path?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (path) formData.append("path", path);
    return request("/storage/upload", { method: "POST", body: formData });
  },
  async getUrl(path: string) {
    return request(`/storage/url?path=${encodeURIComponent(path)}`);
  },
  async delete(path: string) {
    return request("/storage/delete", { method: "POST", body: JSON.stringify({ path }) });
  },
};

// ── Visaverse API (gamification, mood tracking, AR features) ────
export const visaverseApi = {
  async saveMoodFeedback(data: any) {
    return request("/ai/mood-feedback", { method: "POST", body: JSON.stringify(data) });
  },
  async trackEvent(data: any) {
    return request("/ai/track-event", { method: "POST", body: JSON.stringify(data) });
  },
};

// ── Health Detailed API ─────────────────────────────────────────
export const healthDetailedApi = {
  async getDetailed() {
    return request("/system/health/detailed");
  },
  async getServiceStatus() {
    return request("/system/health/services");
  },
};

// ── AI Audit API ────────────────────────────────────────────────
export const aiAuditApi = {
  async getLog(options?: { limit?: number; offset?: number }) {
    const query = options ? "?" + new URLSearchParams(options as any).toString() : "";
    return request(`/ai/audit-log${query}`);
  },
  async getStats() {
    return request("/ai/stats");
  },
};

// ── Exports ───────────────────────────────────────────────────────
export default {
  request,
  healthCheck,
  auth: authApi,
  cases: casesApi,
  admin: adminApi,
  sync: syncApi,
  ai: aiApi,
  notifications: notificationsApi,
  attendance: attendanceApi,
};
