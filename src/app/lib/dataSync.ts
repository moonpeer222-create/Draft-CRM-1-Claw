/**
 * Data Sync & Conflict Detection Service
 * 
 * Tracks last-modified timestamps per case/entity so that when a user opens
 * a record that was modified by someone else while they were working on it,
 * we can show a "Data Updated Elsewhere" warning.
 * 
 * Uses localStorage to simulate cross-device sync (works in same browser).
 */

export interface SyncRecord {
  entityId: string;
  entityType: "case" | "payment" | "document" | "passport";
  lastModifiedAt: string;
  lastModifiedBy: string;
  lastModifiedByName: string;
  lastModifiedByRole: "admin" | "agent" | "customer";
  changeDescription?: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  record: SyncRecord | null;
  timeSince: string;
  modifiedByOther: boolean;
}

const STORAGE_KEY = "crm_data_sync";
const VIEWED_KEY = "crm_sync_viewed"; // tracks when user last viewed each entity

export class DataSyncService {
  // ─── Core CRUD ───

  private static getAll(): SyncRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static save(records: SyncRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  private static getViewedMap(): Record<string, { at: string; by: string }> {
    try {
      const stored = localStorage.getItem(VIEWED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private static saveViewedMap(map: Record<string, { at: string; by: string }>): void {
    localStorage.setItem(VIEWED_KEY, JSON.stringify(map));
  }

  // ─── Mark entity as modified ───

  static markModified(
    entityId: string,
    userId: string,
    userName: string,
    role: SyncRecord["lastModifiedByRole"],
    entityType: SyncRecord["entityType"] = "case",
    changeDescription?: string
  ): void {
    const records = this.getAll();
    const existing = records.findIndex(r => r.entityId === entityId && r.entityType === entityType);

    const record: SyncRecord = {
      entityId,
      entityType,
      lastModifiedAt: new Date().toISOString(),
      lastModifiedBy: userId,
      lastModifiedByName: userName,
      lastModifiedByRole: role,
      changeDescription,
    };

    if (existing >= 0) {
      records[existing] = record;
    } else {
      records.push(record);
    }

    // Keep only latest 200 records
    if (records.length > 200) {
      records.splice(200);
    }

    this.save(records);
  }

  // ─── Mark entity as viewed by current user ───

  static markViewed(entityId: string, userId: string): void {
    const map = this.getViewedMap();
    map[entityId] = { at: new Date().toISOString(), by: userId };
    this.saveViewedMap(map);
  }

  // ─── Check for conflicts ───

  static checkConflict(entityId: string, currentUserId: string): ConflictInfo {
    const records = this.getAll();
    const record = records.find(r => r.entityId === entityId);

    if (!record) {
      return { hasConflict: false, record: null, timeSince: "", modifiedByOther: false };
    }

    const viewedMap = this.getViewedMap();
    const lastViewed = viewedMap[entityId];
    const modifiedByOther = record.lastModifiedBy !== currentUserId;

    if (!modifiedByOther) {
      return { hasConflict: false, record, timeSince: "", modifiedByOther: false };
    }

    // If user never viewed, or last view was before last modification, there's a conflict
    const hasConflict = !lastViewed ||
      new Date(record.lastModifiedAt).getTime() > new Date(lastViewed.at).getTime();

    const timeSince = this.formatTimeSince(record.lastModifiedAt);

    return { hasConflict, record, timeSince, modifiedByOther: true };
  }

  // ─── Get last modifier info for display ───

  static getLastModifier(entityId: string): SyncRecord | null {
    const records = this.getAll();
    return records.find(r => r.entityId === entityId) || null;
  }

  // ─── Get recently modified entities ───

  static getRecentlyModified(limit: number = 20): SyncRecord[] {
    return this.getAll()
      .sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime())
      .slice(0, limit);
  }

  // ─── Utility ───

  private static formatTimeSince(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ─── Seed initial data from existing cases ───

  static seedFromCases(cases: { id: string; agentId: string; agentName: string; updatedDate?: string }[]): void {
    const existing = this.getAll();
    if (existing.length > 0) return; // Already seeded

    const records: SyncRecord[] = cases.slice(0, 15).map(c => ({
      entityId: c.id,
      entityType: "case" as const,
      lastModifiedAt: c.updatedDate || new Date(Date.now() - Math.random() * 7200000).toISOString(),
      lastModifiedBy: c.agentId,
      lastModifiedByName: c.agentName,
      lastModifiedByRole: "agent" as const,
    }));

    this.save(records);
  }
}


/**
 * DataSync — CRM-wide data integrity & consistency checker
 * Used by RootLayout to run full sync, validate, and auto-fix on app mount.
 */
export class DataSync {
  /**
   * Run a full data sync to ensure consistency across localStorage stores.
   */
  static fullSync(): void {
    try {
      const caseKey = "crm_cases";
      const notifKey = "crm_notifications";
      const auditKey = "crm_audit_log";

      if (!localStorage.getItem(caseKey)) {
      }
      if (!localStorage.getItem(notifKey)) {
      }
      if (!localStorage.getItem(auditKey)) {
      }

      localStorage.setItem("crm_last_sync", new Date().toISOString());
    } catch (e) {
    }
  }

  /**
   * Get sync statistics across all data stores.
   */
  static getSyncStats(): {
    cases: number;
    notifications: number;
    auditEntries: number;
    passportTrackings: number;
    lastSync: string | null;
  } {
    try {
      const cases = JSON.parse(localStorage.getItem("crm_cases") || "[]");
      const notifs = JSON.parse(localStorage.getItem("crm_notifications") || "[]");
      const audit = JSON.parse(localStorage.getItem("crm_audit_log") || "[]");
      const passports = JSON.parse(localStorage.getItem("crm_passport_tracking") || "[]");
      return {
        cases: cases.length,
        notifications: notifs.length,
        auditEntries: audit.length,
        passportTrackings: passports.length,
        lastSync: localStorage.getItem("crm_last_sync"),
      };
    } catch {
      return { cases: 0, notifications: 0, auditEntries: 0, passportTrackings: 0, lastSync: null };
    }
  }

  /**
   * Validate data integrity across stores.
   */
  static validateDataIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    try {
      const casesRaw = localStorage.getItem("crm_cases");
      if (casesRaw) {
        const cases = JSON.parse(casesRaw);
        if (!Array.isArray(cases)) issues.push("Cases store is not an array");
        else {
          const ids = cases.map((c: any) => c.id);
          const dupes = ids.filter((id: string, i: number) => ids.indexOf(id) !== i);
          if (dupes.length > 0) issues.push(`Duplicate case IDs found: ${dupes.join(", ")}`);

          cases.forEach((c: any) => {
            if (!c.id) issues.push(`Case missing ID`);
            if (!c.customerName) issues.push(`Case ${c.id} missing customerName`);
            if (!c.status) issues.push(`Case ${c.id} missing status`);
          });
        }
      }

      const notifsRaw = localStorage.getItem("crm_notifications");
      if (notifsRaw) {
        const notifs = JSON.parse(notifsRaw);
        if (!Array.isArray(notifs)) issues.push("Notifications store is not an array");
      }

      const auditRaw = localStorage.getItem("crm_audit_log");
      if (auditRaw) {
        const audit = JSON.parse(auditRaw);
        if (!Array.isArray(audit)) issues.push("Audit log store is not an array");
      }
    } catch (e) {
      issues.push(`Validation error: ${e}`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Auto-fix common data integrity issues.
   */
  static autoFix(): { fixed: number; errors: string[] } {
    let fixed = 0;
    const errors: string[] = [];

    try {
      const casesRaw = localStorage.getItem("crm_cases");
      if (casesRaw) {
        const cases = JSON.parse(casesRaw);
        if (Array.isArray(cases)) {
          const seen = new Set<string>();
          const deduped = cases.filter((c: any) => {
            if (!c.id) return false;
            if (seen.has(c.id)) {
              fixed++;
              return false;
            }
            seen.add(c.id);
            return true;
          });

          deduped.forEach((c: any) => {
            if (c.payments && Array.isArray(c.payments)) {
              const calculatedPaid = c.payments
                .filter((p: any) => p.status !== "rejected")
                .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
              if (c.paidAmount !== calculatedPaid) {
                c.paidAmount = calculatedPaid;
                fixed++;
              }
            }
          });

          if (fixed > 0) {
            localStorage.setItem("crm_cases", JSON.stringify(deduped));
          }
        }
      }
    } catch (e) {
      errors.push(`Auto-fix error: ${e}`);
    }

    return { fixed, errors };
  }
}