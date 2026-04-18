// Operator Data Sync — pushes/pulls operator-specific localStorage data to Supabase KV
// Keys synced: folders, appointments, visits, payments, attendance, notifications,
//              confirmed IDs, doc checklist, report history, taken tasks

import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

const OPERATOR_KEYS = {
  folders: "emr-op-folders",
  appointments: "emr-op-appointments",
  visits: "emr-op-visits",
  payments: "emr-op-payments",
  attendance: "emr-op-attendance",
  notifications: "emr-op-notifications",
  confirmedIds: "emr-op-confirmed",
  docChecklist: "emr-op-doc-checklist",
  reportHistory: "emr-op-report-history",
  takenTasks: "emr-op-taken-tasks",
};

const LAST_SYNC_KEY = "emr-op-last-sync";

function loadLocal(key: string): any {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

function saveLocal(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore storage full */ }
}

/** Collect all operator data from localStorage into a single object */
function collectLocalData(): Record<string, any> {
  const data: Record<string, any> = {};
  for (const [field, storageKey] of Object.entries(OPERATOR_KEYS)) {
    data[field] = loadLocal(storageKey);
  }
  return data;
}

/** Push operator data to the server (non-blocking, fire-and-forget) */
export async function pushOperatorData(): Promise<boolean> {
  try {
    const data = collectLocalData();
    const res = await fetch(`${BASE_URL}/operator-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      saveLocal(LAST_SYNC_KEY, new Date().toISOString());
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/** Pull operator data from the server and merge into localStorage */
export async function pullOperatorData(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/operator-data`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.success || !json.data) return false;

    const serverData = json.data;
    const localLastSync = loadLocal(LAST_SYNC_KEY);
    const serverUpdatedAt = serverData.updatedAt;

    // If server is newer, restore server data into localStorage
    if (serverUpdatedAt && (!localLastSync || new Date(serverUpdatedAt) > new Date(localLastSync))) {
      for (const [field, storageKey] of Object.entries(OPERATOR_KEYS)) {
        if (serverData[field] !== undefined && serverData[field] !== null) {
          saveLocal(storageKey, serverData[field]);
        }
      }
      saveLocal(LAST_SYNC_KEY, serverUpdatedAt);
      return true; // data was restored
    }
    return false; // local is already up to date
  } catch (err) {
    return false;
  }
}

/** Debounced push — call after every save() to batch rapid writes */
let _pushTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedPush(delayMs = 2000) {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    pushOperatorData();
    _pushTimer = null;
  }, delayMs);
}

/** Get last sync timestamp */
export function getLastSyncTime(): string | null {
  return loadLocal(LAST_SYNC_KEY);
}
