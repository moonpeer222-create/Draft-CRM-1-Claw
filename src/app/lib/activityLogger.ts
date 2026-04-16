// Session Activity Logger — tracks user actions for security and analytics
// Stores last 200 activities per session in localStorage

export interface ActivityEntry {
  id: string;
  action: string;
  detail: string;
  role: string;
  userId?: string;
  timestamp: string;
  page: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = "emr-activity-log";
const MAX_ENTRIES = 200;

export const ActivityLogger = {
  log(
    action: string,
    detail: string,
    role: string,
    page?: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    try {
      const entries = this.getAll();
      const entry: ActivityEntry = {
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action,
        detail,
        role,
        userId,
        timestamp: new Date().toISOString(),
        page: page || window.location.pathname,
        metadata,
      };
      entries.unshift(entry);
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Ignore storage errors silently
    }
  },

  getAll(): ActivityEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getRecent(count = 20): ActivityEntry[] {
    return this.getAll().slice(0, count);
  },

  getByRole(role: string, count = 50): ActivityEntry[] {
    return this.getAll()
      .filter(e => e.role === role)
      .slice(0, count);
  },

  getByPage(page: string, count = 50): ActivityEntry[] {
    return this.getAll()
      .filter(e => e.page.includes(page))
      .slice(0, count);
  },

  getSessionSummary() {
    const all = this.getAll();
    if (all.length === 0) return null;

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recent = all.filter(e => new Date(e.timestamp).getTime() > oneHourAgo);

    const actionCounts: Record<string, number> = {};
    const pageCounts: Record<string, number> = {};
    recent.forEach(e => {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
      pageCounts[e.page] = (pageCounts[e.page] || 0) + 1;
    });

    return {
      totalActions: all.length,
      lastHourActions: recent.length,
      topActions: Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topPages: Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      firstActivity: all[all.length - 1]?.timestamp,
      lastActivity: all[0]?.timestamp,
    };
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Pre-defined action helpers
  navigation(role: string, from: string, to: string) {
    this.log("navigation", `${from} → ${to}`, role, to);
  },

  caseAction(role: string, caseId: string, action: string, userId?: string) {
    this.log("case_action", `${action}: ${caseId}`, role, undefined, userId, { caseId });
  },

  documentAction(role: string, action: string, docName: string, userId?: string) {
    this.log("document", `${action}: ${docName}`, role, undefined, userId, { docName });
  },

  paymentAction(role: string, action: string, amount?: number, caseId?: string) {
    this.log("payment", `${action}${amount ? ` PKR ${amount.toLocaleString()}` : ""}`, role, undefined, undefined, { amount, caseId });
  },

  authAction(role: string, action: "login" | "logout", userId?: string) {
    this.log("auth", action, role, undefined, userId);
  },

  searchAction(role: string, query: string) {
    this.log("search", `Searched: "${query}"`, role);
  },

  settingsAction(role: string, setting: string, value: string) {
    this.log("settings", `${setting}: ${value}`, role, undefined, undefined, { setting, value });
  },

  exportAction(role: string, type: string, filename?: string) {
    this.log("export", `${type}${filename ? `: ${filename}` : ""}`, role, undefined, undefined, { type, filename });
  },
};
