// Sync Service - bridges localStorage with Supabase KV via the server
// Strategy: Write locally first, then immediately push to server.
// On app start: download from server -> merge into localStorage
// On writes: write to localStorage immediately, then push to server in background
// If server is unavailable, everything works locally without errors.
// TENANT ISOLATION: All localStorage keys are scoped by tenant_id

import { syncApi, casesApi, agentCodesApi, codeHistoryApi, adminProfileApi, agentProfileApi, settingsApi, notificationsApi, usersApi, attendanceApi, leaveRequestsApi, healthCheck, agentAvatarApi, passportTrackingApi, auditLogApi, documentFilesApi, backupApi, setServerAvailable } from "./api";
import { getCachedTenantId, getTenantScopedKey } from "./tenantContext";

// Base keys - will be suffixed with tenant_id for isolation
const SYNC_STATUS_BASE = "crm_sync_status";
const SYNC_QUEUE_BASE = "crm_sync_queue";
const LOCAL_TIMESTAMPS_BASE = "crm_local_entity_timestamps";
const CONFLICT_LOG_BASE = "crm_sync_conflict_log";
const CONFLICT_HISTORY_BASE = "crm_sync_conflict_history";
const LAST_AUTO_EXPORT_BASE = "crm_last_auto_export";
const CONFLICT_AUTO_RESOLVE_BASE = "crm_conflict_auto_resolve";
const SYNC_INTERVAL_BASE = "crm_sync_interval";

// Entity base keys
const CASES_BASE = "crm_cases";
const NOTIFICATIONS_BASE = "crm_notifications";
const ALERTS_BASE = "crm_alerts";
const ATTENDANCE_BASE = "crm_attendance";
const LEAVE_REQUESTS_BASE = "crm_leave_requests";
const AUDIT_LOG_BASE = "crm_audit_log";
const PASSPORT_TRACKING_BASE = "crm_passport_tracking";
const DOCUMENT_FILES_BASE = "crm_document_files";
const AGENT_CODES_BASE = "emerald-agent-codes";
const CODE_HISTORY_BASE = "emerald-code-history";
const ADMIN_PROFILE_BASE = "crm_admin_profile";
const AGENT_PROFILE_BASE = "crm_agent_profile";
const SETTINGS_BASE = "crm_settings";
const USERS_DB_BASE = "crm_users_db";
const PENDING_CONFLICTS_BASE = "crm_pending_conflicts";

// Helper to get tenant-scoped keys
function getSyncStatusKey(): string { return getTenantScopedKey(SYNC_STATUS_BASE); }
function getSyncQueueKey(): string { return getTenantScopedKey(SYNC_QUEUE_BASE); }
function getLocalTimestampsKey(): string { return getTenantScopedKey(LOCAL_TIMESTAMPS_BASE); }
function getConflictLogKey(): string { return getTenantScopedKey(CONFLICT_LOG_BASE); }
function getConflictHistoryKey(): string { return getTenantScopedKey(CONFLICT_HISTORY_BASE); }
function getLastAutoExportKey(): string { return getTenantScopedKey(LAST_AUTO_EXPORT_BASE); }
function getConflictAutoResolveKey(): string { return getTenantScopedKey(CONFLICT_AUTO_RESOLVE_BASE); }
function getSyncIntervalKey(): string { return getTenantScopedKey(SYNC_INTERVAL_BASE); }
function getCasesKey(): string { return getTenantScopedKey(CASES_BASE); }
function getNotificationsKey(): string { return getTenantScopedKey(NOTIFICATIONS_BASE); }
function getAlertsKey(): string { return getTenantScopedKey(ALERTS_BASE); }
function getAttendanceKey(): string { return getTenantScopedKey(ATTENDANCE_BASE); }
function getLeaveRequestsKey(): string { return getTenantScopedKey(LEAVE_REQUESTS_BASE); }
function getAuditLogKey(): string { return getTenantScopedKey(AUDIT_LOG_BASE); }
function getPassportTrackingKey(): string { return getTenantScopedKey(PASSPORT_TRACKING_BASE); }
function getDocumentFilesKey(): string { return getTenantScopedKey(DOCUMENT_FILES_BASE); }
function getAgentCodesKey(): string { return getTenantScopedKey(AGENT_CODES_BASE); }
function getCodeHistoryKey(): string { return getTenantScopedKey(CODE_HISTORY_BASE); }
function getAdminProfileKey(): string { return getTenantScopedKey(ADMIN_PROFILE_BASE); }
function getAgentProfileKey(name: string): string { return getTenantScopedKey(`${AGENT_PROFILE_BASE}_${name}`); }
function getSettingsKey(): string { return getTenantScopedKey(SETTINGS_BASE); }
function getUsersDbKey(): string { return getTenantScopedKey(USERS_DB_BASE); }
function getPendingConflictsKey(): string { return getTenantScopedKey(PENDING_CONFLICTS_BASE); }

// ============================================================
// Cross-tab sync via BroadcastChannel - scoped by tenant
// ============================================================
function getSyncChannelName(): string {
  const tid = getCachedTenantId();
  return `emerald-crm-sync${tid ? `-${tid}` : ''}`;
}

let broadcastChannel: BroadcastChannel | null = null;

export function initCrossTabSync() {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    // Close existing channel if tenant changed
    if (broadcastChannel) {
      broadcastChannel.close();
    }
    broadcastChannel = new BroadcastChannel(getSyncChannelName());
    broadcastChannel.onmessage = (event) => {
      const { type, entityKey, timestamp } = event.data || {};
      if (type === "entity-updated" && entityKey) {
        // Another tab modified data — reload from localStorage
        window.dispatchEvent(new CustomEvent("crm-cross-tab-update", { detail: { entityKey, timestamp } }));
      } else if (type === "sync-completed") {
        // Another tab completed sync — update status
        syncState.status = "synced";
        syncState.lastSyncAt = timestamp || new Date().toISOString();
        notifyListeners();
      } else if (type === "conflict-resolved") {
        // Another tab resolved a conflict — dispatch event for UI toast
        window.dispatchEvent(new CustomEvent("crm-conflict-resolved", { detail: event.data }));
      }
    };
  } catch { /* BroadcastChannel not supported */ }
}

export function notifyCrossTab(entityKey: string) {
  try {
    // Ensure we're on the right channel
    if (broadcastChannel?.name !== getSyncChannelName()) {
      initCrossTabSync();
    }
    broadcastChannel?.postMessage({ type: "entity-updated", entityKey, timestamp: new Date().toISOString() });
  } catch { /* ignore */ }
}

/** Broadcast that a conflict was resolved (for cross-tab toast notifications) */
export function notifyCrossTabConflictResolved(entity: string, recordId: string, method: "local" | "server" | "cherry-pick") {
  try {
    if (broadcastChannel?.name !== getSyncChannelName()) {
      initCrossTabSync();
    }
    broadcastChannel?.postMessage({ type: "conflict-resolved", entity, recordId, method, timestamp: new Date().toISOString() });
  } catch { /* ignore */ }
}

function notifyCrossTabSyncCompleted() {
  try {
    if (broadcastChannel?.name !== getSyncChannelName()) {
      initCrossTabSync();
    }
    broadcastChannel?.postMessage({ type: "sync-completed", timestamp: new Date().toISOString() });
  } catch { /* ignore */ }
}

export type SyncStatus = "idle" | "syncing" | "error" | "offline" | "synced" | "local";

interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingOps: number;
  error: string | null;
  serverAvailable: boolean;
  tenantId: string | null;
}

let syncState: SyncState = {
  status: "local",
  lastSyncAt: null,
  pendingOps: 0,
  error: null,
  serverAvailable: false,
  tenantId: null,
};

// Listeners for UI updates
type SyncListener = (state: SyncState) => void;
const listeners: Set<SyncListener> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...syncState }));
}

export function onSyncStateChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSyncState(): SyncState {
  return { ...syncState };
}

/** Update sync state with current tenant */
function updateTenantContext() {
  const currentTenant = getCachedTenantId();
  if (currentTenant !== syncState.tenantId) {
    syncState.tenantId = currentTenant;
    // Re-initialize cross-tab sync for new tenant
    initCrossTabSync();
  }
}

// ============================================================
// Check server availability (silent - no console errors)
// ============================================================
export async function checkServer(): Promise<boolean> {
  updateTenantContext();
  try {
    const res = await healthCheck();
    syncState.serverAvailable = res.success === true;
    setServerAvailable(res.success === true);
    return res.success === true;
  } catch {
    syncState.serverAvailable = false;
    setServerAvailable(false);
    return false;
  }
}

// ============================================================
// Initial Sync: pull from server, merge with local
// Falls back to local-only mode silently if server unavailable
// ============================================================
export async function initialSync(): Promise<boolean> {
  updateTenantContext();
  syncState.status = "syncing";
  notifyListeners();

  const tenantId = getCachedTenantId();
  if (!tenantId) {
    syncState.status = "error";
    syncState.error = "No tenant context available";
    notifyListeners();
    return false;
  }

  try {
    // ── Version-reset guard (definitive zombie-data fix) ───────────
    //
    // PROBLEM: When the data version bumps (v8 → v9), CRMDataStore.getCases()
    // clears only `crm_cases`. But the sync service pulls ALL entities from the
    // server (notifications, attendance, audit, etc.) into localStorage BEFORE
    // getCases() runs — re-infecting every entity except cases.
    //
    // FIX: We MUST:
    //  1. Detect version mismatch and wipe ALL localStorage entity keys
    //  2. Push empty data to the server to prevent re-infection from other devices
    //  3. Skip the normal download/merge entirely on this cycle
    //
    const VERSION_KEY = getTenantScopedKey("crm_data_version");
    const SYNC_VERSION_KEY = getTenantScopedKey("crm_sync_data_version");
    const EXPECTED_VERSION = "v10-zombie-kill";

    // Step 1: Ensure version key is correct. If getCases() hasn't run yet,
    // the version might be stale or missing. Force-wipe ALL entity keys now.
    const storedVersion = localStorage.getItem(VERSION_KEY) || "";
    if (storedVersion !== EXPECTED_VERSION) {
      const ENTITY_KEYS = [
        getCasesKey(), getNotificationsKey(), getAlertsKey(),
        getAttendanceKey(), getLeaveRequestsKey(),
        getAuditLogKey(), getPassportTrackingKey(),
        getDocumentFilesKey(), getAgentCodesKey(),
        getCodeHistoryKey(), getConflictLogKey(),
        getConflictHistoryKey(), getPendingConflictsKey(),
        getLocalTimestampsKey(), getSyncQueueKey(),
      ];
      for (const key of ENTITY_KEYS) {
        localStorage.removeItem(key);
      }
      // Write clean state
      localStorage.setItem(getCasesKey(), "[]");
      localStorage.setItem(VERSION_KEY, EXPECTED_VERSION);
    }

    const currentLocalVersion = localStorage.getItem(VERSION_KEY) || "";
    const lastSyncedVersion = localStorage.getItem(SYNC_VERSION_KEY) || "";

    if (currentLocalVersion !== lastSyncedVersion) {
      // Mark synced BEFORE pushing so periodic sync doesn't re-enter
      localStorage.setItem(SYNC_VERSION_KEY, currentLocalVersion);
      const isUp = await checkServer();
      if (isUp) {
        try {
          const emptyPayload: Record<string, any> = {
            cases: [],
            agentCodes: [],
            codeHistory: [],
            notifications: [],
            attendance: [],
            leaveRequests: [],
            passportTracking: [],
            auditLog: [],
            documentFiles: [],
          };
          await syncApi.upload(emptyPayload);
        } catch (err) {
        }
      }
      syncState.status = "synced";
      syncState.lastSyncAt = new Date().toISOString();
      syncState.error = null;
      notifyListeners();
      return true;
    }

    const isUp = await checkServer();
    if (!isUp) {
      syncState.status = "local";
      syncState.error = null;
      notifyListeners();
      return false;
    }

    const res = await syncApi.download();
    if (!res.success || !res.data) {
      // Server is up but no data yet - push local data to server
      await pushLocalToServer();
      syncState.status = "synced";
      syncState.lastSyncAt = new Date().toISOString();
      syncState.error = null;
      notifyListeners();
      return true;
    }

    const data = res.data;

    // Server entity timestamps for conflict detection
    const serverTimestamps: Record<string, string> = (res as any).entityTimestamps || {};
    const localTimestamps: Record<string, string> = getLocalEntityTimestamps();
    const conflictEntries: ConflictEntry[] = [];

    // Helper: check if local entity is newer than server version
    const isLocalNewer = (entityKey: string): boolean => {
      const localTs = localTimestamps[entityKey];
      const serverTs = serverTimestamps[entityKey];
      if (!localTs) return false;  // No local timestamp = server wins
      if (!serverTs) return true;  // No server timestamp = local wins
      return new Date(localTs).getTime() > new Date(serverTs).getTime();
    };

    // Conflict-aware merge: server wins unless local is newer (edited offline)
    const mergeArray = async (entityKey: string, serverData: any, localKey: string, pushFn?: (data: any) => Promise<any>) => {
      const hasServer = serverData && Array.isArray(serverData) && serverData.length > 0;
      const hasLocal = !!localStorage.getItem(localKey);

      if (isLocalNewer(entityKey) && hasLocal) {
        // Local is newer — push to server instead of overwriting
        const local = localStorage.getItem(localKey);
        if (local && pushFn) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) pushFn(parsed);
          } catch { /* ignore */ }
        }
        conflictEntries.push({ entity: entityKey, winner: "local", localTs: localTimestamps[entityKey] || null, serverTs: serverTimestamps[entityKey] || null, detail: `Local newer, pushed to server` });
      } else if (hasServer) {
        localStorage.setItem(localKey, JSON.stringify(serverData));
        conflictEntries.push({ entity: entityKey, winner: "server", localTs: localTimestamps[entityKey] || null, serverTs: serverTimestamps[entityKey] || null, detail: `Server data applied (${serverData.length} items)` });
      } else if (hasLocal && pushFn) {
        const local = localStorage.getItem(localKey);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) pushFn(parsed);
          } catch { /* ignore */ }
        }
        conflictEntries.push({ entity: entityKey, winner: "local", localTs: localTimestamps[entityKey] || null, serverTs: null, detail: `Server empty, pushed local` });
      } else {
        conflictEntries.push({ entity: entityKey, winner: "empty", localTs: null, serverTs: null });
      }
    };

    const mergeObject = async (entityKey: string, serverData: any, localKey: string, pushFn?: (data: any) => Promise<any>) => {
      const hasLocal = !!localStorage.getItem(localKey);

      if (isLocalNewer(entityKey) && hasLocal) {
        // Local is newer — push to server
        const local = localStorage.getItem(localKey);
        if (local && pushFn) {
          try { pushFn(JSON.parse(local)); } catch { /* ignore */ }
        }
        conflictEntries.push({ entity: entityKey, winner: "local", localTs: localTimestamps[entityKey] || null, serverTs: serverTimestamps[entityKey] || null, detail: `Local newer, pushed to server` });
      } else if (serverData) {
        localStorage.setItem(localKey, JSON.stringify(serverData));
        conflictEntries.push({ entity: entityKey, winner: "server", localTs: localTimestamps[entityKey] || null, serverTs: serverTimestamps[entityKey] || null, detail: `Server data applied` });
      } else if (hasLocal && pushFn) {
        const local = localStorage.getItem(localKey);
        if (local) {
          try { pushFn(JSON.parse(local)); } catch { /* ignore */ }
        }
        conflictEntries.push({ entity: entityKey, winner: "local", localTs: localTimestamps[entityKey] || null, serverTs: null, detail: `Server empty, pushed local` });
      } else {
        conflictEntries.push({ entity: entityKey, winner: "empty", localTs: null, serverTs: null });
      }
    };

    // Helper function to merge cases per record
    const CONFLICT_THRESHOLD_MS = 60_000; // 60 seconds — if both sides edited within this window, flag for manual review

    async function mergeCasesPerRecord(serverCases: any[] | null, localTimestamps: Record<string, string>, serverTimestamps: Record<string, string>, conflictEntries: ConflictEntry[]) {
      let localCases: any[] = [];
      try { localCases = JSON.parse(localStorage.getItem(getCasesKey()) || "[]"); } catch { /* ignore */ }

      const hasServer = serverCases && Array.isArray(serverCases) && serverCases.length > 0;
      const hasLocal = localCases.length > 0;

      // If only one side has data, simple resolution
      if (!hasServer && !hasLocal) {
        conflictEntries.push({ entity: "cases", winner: "empty", localTs: null, serverTs: null });
        return;
      }
      if (!hasServer) {
        // Only local — push to server
        try { await casesApi.saveAll(localCases); } catch { /* ignore */ }
        conflictEntries.push({ entity: "cases", winner: "local", localTs: localTimestamps.cases || null, serverTs: null, detail: `Server empty, pushed ${localCases.length} local cases` });
        return;
      }
      if (!hasLocal) {
        localStorage.setItem(getCasesKey(), JSON.stringify(serverCases));
        conflictEntries.push({ entity: "cases", winner: "server", localTs: null, serverTs: serverTimestamps.cases || null, detail: `Applied ${serverCases!.length} server cases` });
        return;
      }

      // Both sides have data — per-record merge using updatedDate + deep field merge
      const localMap: Record<string, any> = {};
      const serverMap: Record<string, any> = {};
      localCases.forEach((c: any) => { if (c.id) localMap[c.id] = c; });
      serverCases!.forEach((c: any) => { if (c.id) serverMap[c.id] = c; });

      const allIds = new Set([...Object.keys(localMap), ...Object.keys(serverMap)]);
      const merged: any[] = [];
      let localWins = 0, serverWins = 0, localOnly = 0, serverOnly = 0, deepMerged = 0;

      allIds.forEach((id) => {
        const lc = localMap[id];
        const sc = serverMap[id];

        if (lc && sc) {
          // Both have this case — deep field merge
          const localUpdated = new Date(lc.updatedDate || lc.createdDate || 0).getTime();
          const serverUpdated = new Date(sc.updatedDate || sc.createdDate || 0).getTime();

          // Pick the newer version as base, then merge array fields from both
          const base = localUpdated > serverUpdated ? { ...lc } : { ...sc };
          const other = localUpdated > serverUpdated ? sc : lc;

          // Deep merge array fields by ID: payments, notes, timeline, documents
          const arrayFields = ["payments", "notes", "timeline", "documents"];
          let fieldsMerged = false;
          for (const field of arrayFields) {
            const baseArr: any[] = Array.isArray(base[field]) ? base[field] : [];
            const otherArr: any[] = Array.isArray(other[field]) ? other[field] : [];
            if (otherArr.length > 0) {
              const baseIds = new Set(baseArr.map((item: any) => item.id));
              const uniqueFromOther = otherArr.filter((item: any) => item.id && !baseIds.has(item.id));
              if (uniqueFromOther.length > 0) {
                base[field] = [...baseArr, ...uniqueFromOther];
                fieldsMerged = true;
              }
            }
          }

          // Recalculate paidAmount from merged payments
          if (Array.isArray(base.payments) && base.payments.length > 0) {
            base.paidAmount = base.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          }

          // Use the most recent updatedDate
          base.updatedDate = new Date(Math.max(localUpdated, serverUpdated)).toISOString();

          // Conflict detection: if both sides edited within 60s AND scalar fields differ,
          // queue for manual review instead of silently auto-merging
          const timeDiff = Math.abs(localUpdated - serverUpdated);
          const scalarFields = ["status", "currentStage", "paidAmount", "totalFee", "agentId", "agentName", "priority", "customerName"];
          const hasScalarConflict = timeDiff <= CONFLICT_THRESHOLD_MS && scalarFields.some(f =>
            lc[f] !== undefined && sc[f] !== undefined && JSON.stringify(lc[f]) !== JSON.stringify(sc[f])
          );

          if (hasScalarConflict) {
            addPendingConflict({
              entity: "cases",
              recordId: id,
              localVersion: lc,
              serverVersion: sc,
              localTimestamp: lc.updatedDate || lc.createdDate || new Date().toISOString(),
              serverTimestamp: sc.updatedDate || sc.createdDate || new Date().toISOString(),
            });
          }

          merged.push(base);
          if (fieldsMerged) {
            deepMerged++;
          } else if (localUpdated > serverUpdated) {
            localWins++;
          } else {
            serverWins++;
          }
        } else if (lc) {
          merged.push(lc);
          localOnly++;
        } else {
          merged.push(sc);
          serverOnly++;
        }
      });

      // Save merged result locally and push to server
      localStorage.setItem(getCasesKey(), JSON.stringify(merged));
      try { await casesApi.saveAll(merged); } catch { /* ignore */ }

      const parts: string[] = [];
      if (deepMerged > 0) parts.push(`${deepMerged} deep-merged`);
      if (localWins > 0) parts.push(`${localWins} local wins`);
      if (serverWins > 0) parts.push(`${serverWins} server wins`);
      if (localOnly > 0) parts.push(`${localOnly} local-only`);
      if (serverOnly > 0) parts.push(`${serverOnly} server-only`);

      conflictEntries.push({
        entity: "cases",
        winner: "merged",
        localTs: localTimestamps.cases || null,
        serverTs: serverTimestamps.cases || null,
        detail: `${merged.length} cases merged: ${parts.join(", ")}`,
      });
    }

    // Helper function to merge records by ID with a timestamp function
    async function mergeRecordsById(entityKey: string, serverData: any[] | null, localKey: string, timestampFn: (record: any) => string, pushFn: (data: any) => Promise<any>, localTimestamps: Record<string, string>, serverTimestamps: Record<string, string>, conflictEntries: ConflictEntry[]) {
      let localData: any[] = [];
      try { localData = JSON.parse(localStorage.getItem(localKey) || "[]"); } catch { /* ignore */ }

      const hasServer = serverData && Array.isArray(serverData) && serverData.length > 0;
      const hasLocal = localData.length > 0;

      // If only one side has data, simple resolution
      if (!hasServer && !hasLocal) {
        conflictEntries.push({ entity: entityKey, winner: "empty", localTs: null, serverTs: null });
        return;
      }
      if (!hasServer) {
        // Only local — push to server
        try { await pushFn(localData); } catch { /* ignore */ }
        conflictEntries.push({ entity: entityKey, winner: "local", localTs: localTimestamps[entityKey] || null, serverTs: null, detail: `Server empty, pushed ${localData.length} local records` });
        return;
      }
      if (!hasLocal) {
        localStorage.setItem(localKey, JSON.stringify(serverData));
        conflictEntries.push({ entity: entityKey, winner: "server", localTs: null, serverTs: serverTimestamps[entityKey] || null, detail: `Applied ${serverData!.length} server records` });
        return;
      }

      // Both sides have data — per-record merge using timestamp function
      const localMap: Record<string, any> = {};
      const serverMap: Record<string, any> = {};
      localData.forEach((c: any) => { if (c.id) localMap[c.id] = c; });
      serverData!.forEach((c: any) => { if (c.id) serverMap[c.id] = c; });

      const allIds = new Set([...Object.keys(localMap), ...Object.keys(serverMap)]);
      const merged: any[] = [];
      let localWins = 0, serverWins = 0, localOnly = 0, serverOnly = 0;

      allIds.forEach((id) => {
        const lc = localMap[id];
        const sc = serverMap[id];

        if (lc && sc) {
          // Both have this record — compare timestamps
          const localUpdated = new Date(timestampFn(lc) || "1970-01-01").getTime();
          const serverUpdated = new Date(timestampFn(sc) || "1970-01-01").getTime();

          // Conflict detection: if both sides edited within 60s, flag for manual review
          const timeDiff = Math.abs(localUpdated - serverUpdated);
          if (timeDiff <= CONFLICT_THRESHOLD_MS && timeDiff > 0 && JSON.stringify(lc) !== JSON.stringify(sc)) {
            addPendingConflict({
              entity: entityKey,
              recordId: id,
              localVersion: lc,
              serverVersion: sc,
              localTimestamp: timestampFn(lc) || new Date().toISOString(),
              serverTimestamp: timestampFn(sc) || new Date().toISOString(),
            });
          }

          if (localUpdated > serverUpdated) {
            merged.push(lc);
            localWins++;
          } else {
            merged.push(sc);
            serverWins++;
          }
        } else if (lc) {
          merged.push(lc);
          localOnly++;
        } else {
          merged.push(sc);
          serverOnly++;
        }
      });

      // Save merged result locally and push to server
      localStorage.setItem(localKey, JSON.stringify(merged));
      try { await pushFn(merged); } catch { /* ignore */ }

      const parts: string[] = [];
      if (localWins > 0) parts.push(`${localWins} local wins`);
      if (serverWins > 0) parts.push(`${serverWins} server wins`);
      if (localOnly > 0) parts.push(`${localOnly} local-only`);
      if (serverOnly > 0) parts.push(`${serverOnly} server-only`);

      conflictEntries.push({
        entity: entityKey,
        winner: "merged",
        localTs: localTimestamps[entityKey] || null,
        serverTs: serverTimestamps[entityKey] || null,
        detail: `${merged.length} records merged: ${parts.join(", ")}`,
      });
    }

    // Per-record merge for cases: merge by case ID using updatedDate as tiebreaker
    await mergeCasesPerRecord(data.cases, localTimestamps, serverTimestamps, conflictEntries);

    await mergeArray("agentCodes", data.agentCodes, getAgentCodesKey(), (d) => agentCodesApi.saveAll(d));
    await mergeArray("codeHistory", data.codeHistory, getCodeHistoryKey(), (d) => codeHistoryApi.save(d));

    // Per-record merge for notifications (by id, using timestamp)
    await mergeRecordsById("notifications", data.notifications, getNotificationsKey(),
      (r) => r.timestamp || "1970-01-01",
      (d) => notificationsApi.save(d), localTimestamps, serverTimestamps, conflictEntries);

    // Per-record merge for users (by id, using updatedAt)
    await mergeRecordsById("users", data.users, getUsersDbKey(),
      (r) => r.updatedAt || r.createdAt || "1970-01-01",
      (d) => usersApi.saveAll(d), localTimestamps, serverTimestamps, conflictEntries);

    await mergeObject("adminProfile", data.adminProfile, getAdminProfileKey(), (d) => adminProfileApi.save(d));
    await mergeObject("settings", data.settings, getSettingsKey(), (d) => settingsApi.save(d));

    // Restore theme preferences from synced settings (cross-device)
    restoreThemeFromSettings();

    // Per-record merge for attendance (by id, using checkOut/checkIn as timestamp)
    await mergeRecordsById("attendance", data.attendance, getAttendanceKey(),
      (r) => r.checkOut || r.checkIn || r.date || "1970-01-01",
      (d) => attendanceApi.saveAll(d), localTimestamps, serverTimestamps, conflictEntries);

    // Per-record merge for leave requests (by id, using reviewedAt/submittedAt)
    await mergeRecordsById("leaveRequests", data.leaveRequests, getLeaveRequestsKey(),
      (r) => r.reviewedAt || r.submittedAt || "1970-01-01",
      (d) => leaveRequestsApi.saveAll(d), localTimestamps, serverTimestamps, conflictEntries);

    // Per-record merge for passport tracking (by id, using latest history entry or checkedOutAt)
    await mergeRecordsById("passportTracking", data.passportTracking, getPassportTrackingKey(),
      (r) => {
        const hist = r.history;
        if (hist && Array.isArray(hist) && hist.length > 0) return hist[hist.length - 1].movedAt || r.checkedOutAt || "1970-01-01";
        return r.actualReturnAt || r.checkedOutAt || "1970-01-01";
      },
      (d) => passportTrackingApi.saveAll(d), localTimestamps, serverTimestamps, conflictEntries);

    await mergeArray("auditLog", data.auditLog, getAuditLogKey(), (d) => auditLogApi.saveAll(d));
    await mergeArray("documentFiles", data.documentFiles, getDocumentFilesKey(), (d) => documentFilesApi.saveAll(d));

    // Save conflict log
    saveConflictLog({ syncedAt: new Date().toISOString(), entries: conflictEntries });

    // Save server timestamps locally for future conflict comparisons
    saveLocalEntityTimestamps(serverTimestamps);

    syncState.status = "synced";
    syncState.lastSyncAt = new Date().toISOString();
    syncState.error = null;
    localStorage.setItem(getSyncStatusKey(), JSON.stringify(syncState));
    notifyListeners();
    notifyCrossTabSyncCompleted();
    return true;
  } catch {
    syncState.status = "local";
    syncState.error = null;
    notifyListeners();
    return false;
  }
}

// ============================================================
// Push all local data to server
// ============================================================
export async function pushLocalToServer(): Promise<boolean> {
  updateTenantContext();
  const tenantId = getCachedTenantId();
  if (!tenantId) {
    return false;
  }

  try {
    const payload: Record<string, any> = {};

    const tryParse = (key: string, maxItems?: number) => {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw);
        if (maxItems && Array.isArray(parsed) && parsed.length > maxItems) {
          return parsed.slice(0, maxItems);
        }
        return parsed;
      } catch { return undefined; }
    };

    payload.cases = tryParse(getCasesKey(), 500);
    payload.agentCodes = tryParse(getAgentCodesKey());
    payload.adminProfile = tryParse(getAdminProfileKey());
    payload.codeHistory = tryParse(getCodeHistoryKey(), 200);
    payload.settings = tryParse(getSettingsKey());
    payload.notifications = tryParse(getNotificationsKey(), 100);
    payload.users = tryParse(getUsersDbKey());
    payload.attendance = tryParse(getAttendanceKey(), 500);
    payload.leaveRequests = tryParse(getLeaveRequestsKey(), 200);
    payload.passportTracking = tryParse(getPassportTrackingKey(), 300);
    payload.auditLog = tryParse(getAuditLogKey(), 300);
    payload.documentFiles = tryParse(getDocumentFilesKey());

    // Remove undefined keys
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

    if (Object.keys(payload).length === 0) return true;

    // Add tenant context to payload metadata
    (payload as any)._tenantId = tenantId;

    const res = await syncApi.upload(payload);
    return res.success;
  } catch (err) {
    return false;
  }
}

// ============================================================
// Background push helpers - call these after local writes
// Immediate push (no debounce) for live Supabase mode
// ============================================================
export function schedulePush() {
  updateTenantContext();
  const tenantId = getCachedTenantId();
  if (!tenantId) return;

  syncState.pendingOps++;
  notifyListeners();

  // Immediate push for live mode
  (async () => {
    if (!syncState.serverAvailable) {
      addToQueue("full_sync");
      return;
    }
    await pushLocalToServer();
    syncState.pendingOps = Math.max(0, syncState.pendingOps - 1);
    syncState.lastSyncAt = new Date().toISOString();
    syncState.status = "synced";
    notifyListeners();
  })();
}

// Push specific entity immediately
export async function pushCases() {
  updateTenantContext();
  const tenantId = getCachedTenantId();
  if (!tenantId) return;

  markEntityModified("cases");
  notifyCrossTab("cases");
  if (!syncState.serverAvailable) return;
  const localCases = localStorage.getItem(getCasesKey());
  try {
    // Always push — even empty array — so server data gets wiped too
    const parsed = localCases ? JSON.parse(localCases) : [];
    await casesApi.saveAll(parsed);
  } catch (err) {
  }
}

export async function pushAgentCodes() {
  updateTenantContext();
  markEntityModified("agentCodes");
  notifyCrossTab("agentCodes");
  if (!syncState.serverAvailable) return;
  const localCodes = localStorage.getItem(getAgentCodesKey());
  if (localCodes) {
    try {
      await agentCodesApi.saveAll(JSON.parse(localCodes));
    } catch (err) {
    }
  }
}

export async function pushAdminProfile() {
  updateTenantContext();
  markEntityModified("adminProfile");
  notifyCrossTab("adminProfile");
  if (!syncState.serverAvailable) return;
  const localProfile = localStorage.getItem(getAdminProfileKey());
  if (localProfile) {
    try {
      await adminProfileApi.save(JSON.parse(localProfile));
    } catch (err) {
    }
  }
}

export async function pushAgentProfile(name: string) {
  updateTenantContext();
  if (!syncState.serverAvailable) return;
  const key = getAgentProfileKey(name);
  const localProfile = localStorage.getItem(key);
  if (localProfile) {
    try {
      await agentProfileApi.save(name, JSON.parse(localProfile));
    } catch (err) {
    }
  }
}

export async function pushCodeHistory() {
  updateTenantContext();
  markEntityModified("codeHistory");
  if (!syncState.serverAvailable) return;
  const localHistory = localStorage.getItem(getCodeHistoryKey());
  if (localHistory) {
    try {
      await codeHistoryApi.save(JSON.parse(localHistory));
    } catch (err) {
    }
  }
}

export async function pushNotifications() {
  updateTenantContext();
  markEntityModified("notifications");
  if (!syncState.serverAvailable) return;
  const localNotifs = localStorage.getItem(getNotificationsKey());
  if (localNotifs) {
    try {
      let parsed = JSON.parse(localNotifs);
      // Trim to 100 before sending to avoid server payload limits
      if (Array.isArray(parsed) && parsed.length > 100) {
        parsed = parsed.slice(0, 100);
      }
      await notificationsApi.save(parsed);
    } catch (err) {
    }
  }
}

export async function pushUsers() {
  updateTenantContext();
  markEntityModified("users");
  if (!syncState.serverAvailable) return;
  const localUsers = localStorage.getItem(getUsersDbKey());
  if (localUsers) {
    try {
      await usersApi.saveAll(JSON.parse(localUsers));
    } catch (err) {
    }
  }
}

export async function pushAttendance() {
  updateTenantContext();
  markEntityModified("attendance");
  if (!syncState.serverAvailable) return;
  const localAttendance = localStorage.getItem(getAttendanceKey());
  if (localAttendance) {
    try {
      await attendanceApi.saveAll(JSON.parse(localAttendance));
    } catch (err) {
    }
  }
}

export async function pushLeaveRequests() {
  updateTenantContext();
  markEntityModified("leaveRequests");
  if (!syncState.serverAvailable) return;
  const localLeave = localStorage.getItem(getLeaveRequestsKey());
  if (localLeave) {
    try {
      await leaveRequestsApi.saveAll(JSON.parse(localLeave));
    } catch (err) {
    }
  }
}

// Push agent avatar (base64 data URL) to cloud
export async function pushAgentAvatar(name: string) {
  updateTenantContext();
  if (!syncState.serverAvailable) return;
  const avatarKey = getAgentProfileKey(name); // Use agent profile key pattern
  const localAvatar = localStorage.getItem(avatarKey);
  try {
    // Push the avatar string (or null to remove)
    await agentAvatarApi.save(name, localAvatar || null);
  } catch (err) {
  }
}

// Pull agent avatar from cloud into localStorage
export async function pullAgentAvatar(name: string): Promise<string | null> {
  updateTenantContext();
  try {
    const res = await agentAvatarApi.get(name);
    if (res.success && res.data) {
      const avatarKey = `crm_agent_avatar_${name}`;
      localStorage.setItem(getTenantScopedKey(avatarKey), res.data as string);
      return res.data as string;
    }
  } catch (err) {
  }
  return null;
}

// Push passport tracking data to cloud
export async function pushPassportTracking() {
  updateTenantContext();
  markEntityModified("passportTracking");
  if (!syncState.serverAvailable) return;
  const local = localStorage.getItem(getPassportTrackingKey());
  if (local) {
    try {
      await passportTrackingApi.saveAll(JSON.parse(local));
    } catch (err) {
    }
  }
}

// Push audit log to cloud
export async function pushAuditLog() {
  updateTenantContext();
  markEntityModified("auditLog");
  if (!syncState.serverAvailable) return;
  const local = localStorage.getItem(getAuditLogKey());
  if (local) {
    try {
      let parsed = JSON.parse(local);
      // Trim to 300 before sending to avoid payload limits
      if (Array.isArray(parsed) && parsed.length > 300) {
        parsed = parsed.slice(0, 300);
      }
      await auditLogApi.saveAll(parsed);
    } catch (err) {
    }
  }
}

// Push document files metadata to cloud
export async function pushDocumentFiles() {
  updateTenantContext();
  markEntityModified("documentFiles");
  if (!syncState.serverAvailable) return;
  const local = localStorage.getItem(getDocumentFilesKey());
  if (local) {
    try {
      await documentFilesApi.saveAll(JSON.parse(local));
    } catch (err) {
    }
  }
}

// Push settings to cloud
export async function pushSettings() {
  updateTenantContext();
  markEntityModified("settings");
  if (!syncState.serverAvailable) return;
  const local = localStorage.getItem(getSettingsKey());
  if (local) {
    try {
      await settingsApi.save(JSON.parse(local));
    } catch (err) {
    }
  }
}

// ============================================================
// Offline queue
// ============================================================
function addToQueue(operation: string) {
  try {
    const queue = JSON.parse(localStorage.getItem(getSyncQueueKey()) || "[]");
    queue.push({ operation, timestamp: Date.now() });
    localStorage.setItem(getSyncQueueKey(), JSON.stringify(queue));
  } catch { /* ignore */ }
}

export async function processQueue(): Promise<void> {
  try {
    const queue = JSON.parse(localStorage.getItem(getSyncQueueKey()) || "[]");
    if (queue.length === 0) return;

    if (!syncState.serverAvailable) return;

    // Just do a full sync to catch up
    await pushLocalToServer();
    localStorage.setItem(getSyncQueueKey(), "[]");
  } catch { /* ignore */ }
}

// ============================================================
// Periodic sync (every 30 seconds for live mode)
// ============================================================
let periodicInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs = 30000) {
  if (periodicInterval) clearInterval(periodicInterval);
  periodicInterval = setInterval(async () => {
    updateTenantContext();
    const isUp = await checkServer();
    if (isUp) {
      await processQueue();

      // Full conflict-aware merge cycle: pull from server, merge per-record,
      // detect conflicts, and push back — not just a blind push
      await initialSync();

      // Check if auto-export is due (runs silently in background)
      checkAutoExport();
    } else {
      if (syncState.status !== "local") {
        syncState.status = "local";
        notifyListeners();
      }
    }
  }, intervalMs);
}

export function stopPeriodicSync() {
  if (periodicInterval) {
    clearInterval(periodicInterval);
    periodicInterval = null;
  }
}

// ============================================================
// Force full sync (manual trigger)
// ============================================================
export async function forceSync(): Promise<boolean> {
  return initialSync();
}

// Helper function to restore theme from settings
function restoreThemeFromSettings() {
  try {
    const raw = localStorage.getItem(getSettingsKey());
    if (!raw) return;
    const settings = JSON.parse(raw);
    // Restore dark mode preference if present
    if (typeof settings.darkMode === "boolean") {
      const currentDark = localStorage.getItem("emerald-dark-mode");
      if (currentDark !== String(settings.darkMode)) {
        localStorage.setItem("emerald-dark-mode", String(settings.darkMode));
      }
    }
    // Restore language preference if present
    if (settings.language && (settings.language === "en" || settings.language === "ur")) {
      const currentLang = localStorage.getItem("emerald-language");
      if (currentLang !== settings.language) {
        localStorage.setItem("emerald-language", settings.language);
      }
    }
    // Dispatch a custom event so ThemeProvider can pick up the changes
    window.dispatchEvent(new CustomEvent("crm-settings-restored"));
  } catch { /* ignore */ }
}

// Helper functions for entity timestamps
function getLocalEntityTimestamps(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getLocalTimestampsKey());
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveLocalEntityTimestamps(timestamps: Record<string, string>) {
  try {
    localStorage.setItem(getLocalTimestampsKey(), JSON.stringify(timestamps));
  } catch { /* ignore */ }
}

/** Mark an entity as locally modified (for conflict detection) */
export function markEntityModified(entityKey: string) {
  try {
    const ts = getLocalEntityTimestamps();
    ts[entityKey] = new Date().toISOString();
    saveLocalEntityTimestamps(ts);
  } catch { /* ignore */ }
}

// ============================================================
// Conflict log — records which side won per-entity on last sync
// ============================================================
export interface ConflictEntry {
  entity: string;
  winner: "local" | "server" | "merged" | "empty";
  localTs: string | null;
  serverTs: string | null;
  detail?: string;
}

export interface ConflictLog {
  syncedAt: string;
  entries: ConflictEntry[];
}

function saveConflictLog(log: ConflictLog) {
  try {
    localStorage.setItem(getConflictLogKey(), JSON.stringify(log));
    // Also append to conflict history (keep last 50 syncs)
    const historyRaw = localStorage.getItem(getConflictHistoryKey());
    const history: ConflictLog[] = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift(log);
    localStorage.setItem(getConflictHistoryKey(), JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}

export function getConflictLog(): ConflictLog | null {
  try {
    const raw = localStorage.getItem(getConflictLogKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function getConflictHistory(): ConflictLog[] {
  try {
    const raw = localStorage.getItem(getConflictHistoryKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function clearConflictHistory(): void {
  localStorage.removeItem(getConflictHistoryKey());
}

// ============================================================
// Manual conflict resolution — stores conflicting record pairs
// for admin review when both sides modified the same record
// ============================================================
export interface PendingConflict {
  id: string;           // unique conflict ID
  entity: string;       // e.g. "cases"
  recordId: string;     // the record's own ID
  localVersion: any;    // full local record
  serverVersion: any;   // full server record
  localTimestamp: string;
  serverTimestamp: string;
  detectedAt: string;
  resolved: boolean;
}

export function getPendingConflicts(): PendingConflict[] {
  try {
    const raw = localStorage.getItem(getPendingConflictsKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function savePendingConflicts(conflicts: PendingConflict[]): void {
  localStorage.setItem(getPendingConflictsKey(), JSON.stringify(conflicts));
}

export function addPendingConflict(conflict: Omit<PendingConflict, "id" | "detectedAt" | "resolved">): void {
  // Check auto-resolve preference before queuing
  const autoMode = getConflictAutoResolveMode();
  if (autoMode === "prefer-local" || autoMode === "prefer-server") {
    // Auto-resolve: apply the preferred version to localStorage immediately
    const ENTITY_STORAGE: Record<string, string> = {
      cases: getCasesKey(),
      notifications: getNotificationsKey(),
      users: getUsersDbKey(),
      attendance: getAttendanceKey(),
      leaveRequests: getLeaveRequestsKey(),
      passportTracking: getPassportTrackingKey(),
    };
    const storageKey = ENTITY_STORAGE[conflict.entity];
    if (storageKey) {
      const chosen = autoMode === "prefer-local" ? conflict.localVersion : conflict.serverVersion;
      try {
        const currentData: any[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const updated = currentData.map((item: any) =>
          item.id === conflict.recordId ? chosen : item
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch { /* ignore */ }
    }
    // Still log the auto-resolved conflict to history but don't queue for review
    const all = getPendingConflicts();
    all.unshift({
      ...conflict,
      id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      detectedAt: new Date().toISOString(),
      resolved: true, // Mark immediately resolved
    });
    savePendingConflicts(all.slice(0, 100));
    notifyCrossTabConflictResolved(conflict.entity, conflict.recordId, autoMode === "prefer-local" ? "local" : "server");
    return;
  }

  const all = getPendingConflicts();
  // Don't add duplicate for same entity+recordId if already unresolved
  const exists = all.find(c => c.entity === conflict.entity && c.recordId === conflict.recordId && !c.resolved);
  if (exists) return;
  all.unshift({
    ...conflict,
    id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    detectedAt: new Date().toISOString(),
    resolved: false,
  });
  savePendingConflicts(all.slice(0, 100)); // Keep max 100
}

export function resolveConflict(conflictId: string, chosenVersion: "local" | "server", storageKey: string): void {
  const all = getPendingConflicts();
  const conflict = all.find(c => c.id === conflictId);
  if (!conflict) return;

  // Apply the chosen version to localStorage
  const chosen = chosenVersion === "local" ? conflict.localVersion : conflict.serverVersion;
  try {
    const currentData: any[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const updated = currentData.map((item: any) =>
      item.id === conflict.recordId ? chosen : item
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch { /* ignore */ }

  // Mark as resolved
  conflict.resolved = true;
  savePendingConflicts(all);

  // Notify cross-tab
  notifyCrossTabConflictResolved(conflict.entity, conflict.recordId, chosenVersion);
}

/** Resolve a conflict with a custom cherry-picked record (field-by-field merge) */
export function resolveConflictWithCustomMerge(conflictId: string, mergedRecord: any, storageKey: string): void {
  const all = getPendingConflicts();
  const conflict = all.find(c => c.id === conflictId);
  if (!conflict) return;

  try {
    const currentData: any[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const updated = currentData.map((item: any) =>
      item.id === conflict.recordId ? mergedRecord : item
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch { /* ignore */ }

  conflict.resolved = true;
  savePendingConflicts(all);

  // Notify cross-tab
  notifyCrossTabConflictResolved(conflict.entity, conflict.recordId, "cherry-pick");
}

export function dismissConflict(conflictId: string): void {
  const all = getPendingConflicts();
  savePendingConflicts(all.filter(c => c.id !== conflictId));
}

export function clearResolvedConflicts(): void {
  const all = getPendingConflicts();
  savePendingConflicts(all.filter(c => !c.resolved));
}

// ============================================================
// Auto-Export via Brevo (scheduled email of full data dump)
// ============================================================
const AUTO_EXPORT_CONFIG_BASE = "crm_auto_export_config";

function getAutoExportConfigKey(): string {
  return getTenantScopedKey(AUTO_EXPORT_CONFIG_BASE);
}

export interface AutoExportConfig {
  enabled: boolean;
  recipients: string[];
  intervalHours: number; // e.g. 24 = daily, 168 = weekly
}

export function getAutoExportConfig(): AutoExportConfig {
  try {
    const raw = localStorage.getItem(getAutoExportConfigKey());
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: false, recipients: [], intervalHours: 24 };
}

export function setAutoExportConfig(config: AutoExportConfig) {
  localStorage.setItem(getAutoExportConfigKey(), JSON.stringify(config));
}

async function checkAutoExport() {
  try {
    const config = getAutoExportConfig();
    if (!config.enabled || config.recipients.length === 0) return;
    if (!syncState.serverAvailable) return;

    const lastExport = localStorage.getItem(getLastAutoExportKey());
    const now = Date.now();
    const intervalMs = config.intervalHours * 60 * 60 * 1000;

    if (lastExport) {
      const elapsed = now - new Date(lastExport).getTime();
      if (elapsed < intervalMs) return; // Not due yet
    }

    // Trigger auto-export
    const res = await backupApi.autoExport(config.recipients);
    if (res.success) {
      localStorage.setItem(getLastAutoExportKey(), new Date().toISOString());
    } else {
    }
  } catch (err) {
  }
}

// ============================================================
// Conflict auto-resolution preference
// ============================================================
export type ConflictAutoResolveMode = "prompt" | "prefer-local" | "prefer-server";

export function getConflictAutoResolveMode(): ConflictAutoResolveMode {
  try {
    const raw = localStorage.getItem(getConflictAutoResolveKey());
    if (raw === "prefer-local" || raw === "prefer-server") return raw;
  } catch { /* ignore */ }
  return "prompt";
}

export function setConflictAutoResolveMode(mode: ConflictAutoResolveMode): void {
  localStorage.setItem(getConflictAutoResolveKey(), mode);
}

// ============================================================
// Sync interval configuration
// ============================================================
export type SyncIntervalOption = 30000 | 60000 | 120000 | 300000 | 900000 | 1800000 | 3600000;
const VALID_INTERVALS: SyncIntervalOption[] = [30000, 60000, 120000, 300000, 900000, 1800000, 3600000];

export function getSyncInterval(): SyncIntervalOption {
  try {
    const raw = localStorage.getItem(getSyncIntervalKey());
    if (raw) {
      const val = parseInt(raw, 10);
      if (VALID_INTERVALS.includes(val as SyncIntervalOption)) return val as SyncIntervalOption;
    }
  } catch { /* ignore */ }
  return 60000; // default 60s
}

export function setSyncInterval(intervalMs: SyncIntervalOption): void {
  localStorage.setItem(getSyncIntervalKey(), String(intervalMs));
  // Restart periodic sync with new interval
  startPeriodicSync(intervalMs);
}

// ============================================================
// Conflict stats helper (for admin dashboard widget)
// ============================================================
export interface ConflictStats {
  totalAll: number;
  resolvedAll: number;
  unresolvedAll: number;
  autoResolvedThisWeek: number;
  manualResolvedThisWeek: number;
  totalThisWeek: number;
  byEntity: Record<string, { total: number; resolved: number; unresolved: number }>;
}

export function getConflictStats(): ConflictStats {
  const all = getPendingConflicts();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const stats: ConflictStats = {
    totalAll: all.length,
    resolvedAll: 0,
    unresolvedAll: 0,
    autoResolvedThisWeek: 0,
    manualResolvedThisWeek: 0,
    totalThisWeek: 0,
    byEntity: {},
  };

  for (const c of all) {
    if (c.resolved) {
      stats.resolvedAll++;
    } else {
      stats.unresolvedAll++;
    }

    // Per-entity stats
    if (!stats.byEntity[c.entity]) {
      stats.byEntity[c.entity] = { total: 0, resolved: 0, unresolved: 0 };
    }
    stats.byEntity[c.entity].total++;
    if (c.resolved) stats.byEntity[c.entity].resolved++;
    else stats.byEntity[c.entity].unresolved++;

    // This week stats
    const detectedTime = new Date(c.detectedAt).getTime();
    if (detectedTime >= weekAgo) {
      stats.totalThisWeek++;
      if (c.resolved) {
        // Heuristic: if resolved === true and detectedAt is very close to the conflict creation,
        // it was likely auto-resolved. We check if auto-resolve mode is not "prompt".
        const mode = getConflictAutoResolveMode();
        if (mode !== "prompt") {
          stats.autoResolvedThisWeek++;
        } else {
          stats.manualResolvedThisWeek++;
        }
      }
    }
  }

  return stats;
}
