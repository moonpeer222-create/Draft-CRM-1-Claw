/**
 * Audit Log System
 * Tracks every user action with timestamps, role, and details.
 * Persisted in localStorage. Admin-only visibility.
 */

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: "master_admin" | "admin" | "agent" | "customer";
  action: AuditAction;
  category: "case" | "payment" | "document" | "auth" | "system" | "attendance" | "approval" | "user";
  description: string;
  descriptionUrdu?: string;
  metadata?: Record<string, any>;
  ipAddress: string;
}

export type AuditAction =
  | "login"
  | "logout"
  | "case_created"
  | "case_updated"
  | "case_stage_changed"
  | "payment_added"
  | "payment_approved"
  | "payment_rejected"
  | "document_uploaded"
  | "document_verified"
  | "document_rejected"
  | "broadcast_sent"
  | "meeting_scheduled"
  | "user_created"
  | "user_updated"
  | "user_status_changed"
  | "settings_changed"
  | "approval_granted"
  | "approval_denied"
  | "passport_checkout"
  | "passport_returned"
  | "attendance_checkin"
  | "attendance_checkout"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "note_added"
  | "report_generated"
  | "data_exported"
  | "case_cancelled"
  | "case_reopened"
  | "sir_atif_approved"
  | "sir_atif_revoked";

const STORAGE_KEY = "crm_audit_log";
const MAX_ENTRIES = 500;

// Simulated IP for prototype
function getSimulatedIP(): string {
  const octets = [
    192,
    168,
    Math.floor(Math.random() * 10) + 1,
    Math.floor(Math.random() * 254) + 1,
  ];
  return octets.join(".");
}

export class AuditLogService {
  private static _pushSync: (() => void) | null = null;
  private static _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static DEBOUNCE_MS = 5000; // 5-second trailing debounce

  static registerSyncPush(pushFn: () => void) {
    this._pushSync = pushFn;
  }

  private static notifySync() {
    // Debounce audit log sync — fires frequently, batch into 5s windows
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      if (this._pushSync) this._pushSync();
      this._debounceTimer = null;
    }, this.DEBOUNCE_MS);
  }

  static getAll(): AuditEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* fall through */ }
    // Production: start with empty audit log — no seed data
    return [];
  }

  private static save(entries: AuditEntry[]): void {
    // Keep only latest MAX_ENTRIES
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    this.notifySync();
  }

  static log(entry: Omit<AuditEntry, "id" | "timestamp" | "ipAddress">): AuditEntry {
    const entries = this.getAll();
    const newEntry: AuditEntry = {
      ...entry,
      id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ipAddress: getSimulatedIP(),
    };
    entries.unshift(newEntry);
    this.save(entries);
    return newEntry;
  }

  static getByRole(role: string): AuditEntry[] {
    return this.getAll().filter(e => e.role === role);
  }

  static getByUser(userId: string): AuditEntry[] {
    return this.getAll().filter(e => e.userId === userId);
  }

  static getByCategory(category: AuditEntry["category"]): AuditEntry[] {
    return this.getAll().filter(e => e.category === category);
  }

  static getRecent(count: number = 20): AuditEntry[] {
    return this.getAll().slice(0, count);
  }

  static search(query: string): AuditEntry[] {
    const q = query.toLowerCase();
    return this.getAll().filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.userName.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(q))
    );
  }

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Convenience loggers
  static logCaseCreated(userName: string, role: AuditEntry["role"], caseId: string, customerName: string) {
    return this.log({
      userId: userName, userName, role,
      action: "case_created", category: "case",
      description: `Created case ${caseId} for ${customerName}`,
      descriptionUrdu: `کیس ${caseId} بنایا - ${customerName}`,
      metadata: { caseId, customerName },
    });
  }

  static logCaseStageChanged(userName: string, role: AuditEntry["role"], caseId: string, oldStage: string, newStage: string) {
    return this.log({
      userId: userName, userName, role,
      action: "case_stage_changed", category: "case",
      description: `Changed case ${caseId} from "${oldStage}" to "${newStage}"`,
      descriptionUrdu: `کیس ${caseId} کی حیثیت ${oldStage} سے ${newStage} تبدیل کی`,
      metadata: { caseId, oldStage, newStage },
    });
  }

  static logPaymentAction(userName: string, role: AuditEntry["role"], action: "payment_added" | "payment_approved" | "payment_rejected", caseId: string, amount?: number) {
    const labels: Record<string, string> = {
      payment_added: `Recorded payment of PKR ${amount?.toLocaleString()} for case ${caseId}`,
      payment_approved: `Approved payment for case ${caseId}`,
      payment_rejected: `Rejected payment for case ${caseId}`,
    };
    return this.log({
      userId: userName, userName, role,
      action, category: "payment",
      description: labels[action],
      metadata: { caseId, amount },
    });
  }

  static logDocumentAction(userName: string, role: AuditEntry["role"], action: "document_uploaded" | "document_verified" | "document_rejected", caseId: string, docName: string) {
    const labels: Record<string, string> = {
      document_uploaded: `Uploaded "${docName}" for case ${caseId}`,
      document_verified: `Verified "${docName}" for case ${caseId}`,
      document_rejected: `Rejected "${docName}" for case ${caseId}`,
    };
    return this.log({
      userId: userName, userName, role,
      action, category: "document",
      description: labels[action],
      metadata: { caseId, docName },
    });
  }

  static logAuth(userName: string, role: AuditEntry["role"], action: "login" | "logout") {
    return this.log({
      userId: userName, userName, role,
      action, category: "auth",
      description: `${userName} ${action === "login" ? "logged in" : "logged out"} as ${role}`,
    });
  }

  static logApproval(userName: string, action: "approval_granted" | "approval_denied", targetItem: string, details?: string) {
    return this.log({
      userId: userName, userName, role: "admin",
      action, category: "approval",
      description: `${action === "approval_granted" ? "Approved" : "Denied"}: ${targetItem}${details ? ` — ${details}` : ""}`,
      metadata: { targetItem },
    });
  }

  // Production: no seed data — all audit entries are created by real user actions
  private static generateSeedEntries(): AuditEntry[] {
    return [];
  }
}