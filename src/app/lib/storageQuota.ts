/**
 * StorageQuotaMonitor — estimates localStorage usage and warns when nearing the ~5MB limit.
 * Also provides an "Export All Data" utility that bundles all CRM data into a downloadable JSON.
 */

import { documentStorageApi } from "./api";

// ============================================================
// Quota monitoring
// ============================================================

const QUOTA_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB browser limit (approximate)
const WARN_THRESHOLD = 0.80; // Warn at 80%
const CRITICAL_THRESHOLD = 0.92; // Critical at 92%

export interface QuotaInfo {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  status: "ok" | "warning" | "critical";
  formattedUsed: string;
  formattedLimit: string;
  topKeys: { key: string; sizeBytes: number; percent: number }[];
}

/** Calculate how many bytes are used in localStorage */
export function getStorageQuota(): QuotaInfo {
  let totalBytes = 0;
  const keySizes: { key: string; sizeBytes: number }[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || "";
      // UTF-16: each char = 2 bytes
      const size = (key.length + value.length) * 2;
      totalBytes += size;
      keySizes.push({ key, sizeBytes: size });
    }
  } catch {
    // If we can't enumerate, return minimal info
  }

  const usedPercent = totalBytes / QUOTA_LIMIT_BYTES;
  const status: QuotaInfo["status"] =
    usedPercent >= CRITICAL_THRESHOLD ? "critical" :
    usedPercent >= WARN_THRESHOLD ? "warning" : "ok";

  // Top 5 largest keys
  const topKeys = keySizes
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 5)
    .map(k => ({
      ...k,
      percent: totalBytes > 0 ? Math.round((k.sizeBytes / totalBytes) * 100) : 0,
    }));

  return {
    usedBytes: totalBytes,
    limitBytes: QUOTA_LIMIT_BYTES,
    usedPercent: Math.round(usedPercent * 100),
    status,
    formattedUsed: formatBytes(totalBytes),
    formattedLimit: formatBytes(QUOTA_LIMIT_BYTES),
    topKeys,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ============================================================
// Export All Data
// ============================================================

/** All CRM localStorage keys we track */
const CRM_KEYS = [
  { key: "crm_cases", label: "Cases" },
  { key: "emerald-agent-codes", label: "Agent Codes" },
  { key: "emerald-code-history", label: "Code History" },
  { key: "crm_admin_profile", label: "Admin Profile" },
  { key: "crm_settings", label: "Settings" },
  { key: "crm_notifications", label: "Notifications" },
  { key: "crm_users_db", label: "Users" },
  { key: "crm_attendance", label: "Attendance" },
  { key: "crm_leave_requests", label: "Leave Requests" },
  { key: "crm_passport_tracking", label: "Passport Tracking" },
  { key: "crm_audit_log", label: "Audit Log" },
  { key: "crm_document_files", label: "Document Files (metadata)" },
];

interface ExportResult {
  exportedAt: string;
  version: string;
  storageQuota: QuotaInfo;
  data: Record<string, any>;
  cloudFiles: { docId: string; fileName: string; signedUrl: string }[];
}

/**
 * Export all CRM data as a comprehensive JSON object.
 * For cloud-stored document files, generates signed URLs (valid 1 hour).
 */
export async function exportAllData(
  onProgress?: (step: string) => void
): Promise<ExportResult> {
  const result: ExportResult = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    storageQuota: getStorageQuota(),
    data: {},
    cloudFiles: [],
  };

  // 1. Export all CRM localStorage data
  onProgress?.("Collecting local data...");
  for (const { key, label } of CRM_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        result.data[label] = JSON.parse(raw);
      } catch {
        result.data[label] = raw;
      }
    }
  }

  // 2. Export agent profiles and avatars
  onProgress?.("Collecting agent profiles...");
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("crm_agent_profile_")) {
      const agentName = k.replace("crm_agent_profile_", "");
      try {
        result.data[`Agent Profile: ${agentName}`] = JSON.parse(localStorage.getItem(k) || "{}");
      } catch { /* skip */ }
    }
    // Skip avatar base64 data to keep export size manageable
  }

  // 3. Generate signed URLs for cloud-stored document files
  onProgress?.("Generating cloud file links...");
  try {
    const docFiles = result.data["Document Files (metadata)"];
    if (docFiles && typeof docFiles === "object") {
      const entries = Object.values(docFiles) as any[];
      const cloudFiles = entries.filter((f: any) => f.isCloudStored && f.storageRef);

      for (const file of cloudFiles) {
        try {
          const res = await (documentStorageApi as any).getSignedUrl(file.id, file.fileName);
          if (res.success && res.data?.signedUrl) {
            result.cloudFiles.push({
              docId: file.id,
              fileName: file.fileName,
              signedUrl: res.data.signedUrl,
            });
          }
        } catch { /* skip individual file errors */ }
      }
    }
  } catch { /* skip if no cloud files */ }

  return result;
}

/** Download the exported data as a JSON file */
export function downloadExport(data: ExportResult): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().split("T")[0];
  a.download = `emerald-crm-full-export-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Import Data — reads an exported JSON file back into localStorage
// ============================================================

/** Reverse mapping: label -> localStorage key */
const LABEL_TO_KEY: Record<string, string> = {};
CRM_KEYS.forEach(({ key, label }) => { LABEL_TO_KEY[label] = key; });

export interface ImportResult {
  success: boolean;
  restoredEntities: string[];
  skippedEntities: string[];
  error?: string;
}

/**
 * Import data from an exported JSON file.
 * Overwrites local data for each entity found in the export.
 */
export function importData(exportJson: ExportResult): ImportResult {
  const result: ImportResult = {
    success: false,
    restoredEntities: [],
    skippedEntities: [],
  };

  try {
    if (!exportJson || !exportJson.data || typeof exportJson.data !== "object") {
      result.error = "Invalid export file: missing 'data' object";
      return result;
    }

    for (const [label, value] of Object.entries(exportJson.data)) {
      const key = LABEL_TO_KEY[label];

      // Handle agent profiles (dynamic keys)
      if (!key && label.startsWith("Agent Profile: ")) {
        const agentName = label.replace("Agent Profile: ", "");
        try {
          localStorage.setItem(`crm_agent_profile_${agentName}`, JSON.stringify(value));
          result.restoredEntities.push(label);
        } catch {
          result.skippedEntities.push(label);
        }
        continue;
      }

      if (!key) {
        result.skippedEntities.push(label);
        continue;
      }

      try {
        localStorage.setItem(key, JSON.stringify(value));
        result.restoredEntities.push(label);
      } catch {
        result.skippedEntities.push(label);
      }
    }

    result.success = true;
  } catch (err) {
    result.error = `Import failed: ${err}`;
  }

  return result;
}

/**
 * Read a File object as JSON and validate it's an Emerald CRM export.
 */
export function readExportFile(file: File): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!json.exportedAt || !json.data) {
          reject(new Error("Invalid export file format"));
          return;
        }
        resolve(json as ExportResult);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${err}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ============================================================
// Import Diff Preview — compares import file against current local data
// ============================================================

export interface DiffEntry {
  label: string;
  currentCount: number;
  importCount: number;
  action: "overwrite" | "new" | "unchanged" | "remove";
}

export interface ImportDiffPreview {
  exportedAt: string;
  totalEntities: number;
  entries: DiffEntry[];
}

/**
 * Generate a diff preview comparing the import file against current localStorage.
 */
export function generateImportDiff(exportJson: ExportResult): ImportDiffPreview {
  const entries: DiffEntry[] = [];

  for (const { key, label } of CRM_KEYS) {
    const importData = exportJson.data[label];
    const currentRaw = localStorage.getItem(key);

    let currentCount = 0;
    let importCount = 0;

    try {
      if (currentRaw) {
        const parsed = JSON.parse(currentRaw);
        currentCount = Array.isArray(parsed) ? parsed.length : (typeof parsed === "object" && parsed !== null ? 1 : 0);
      }
    } catch { /* ignore */ }

    if (importData !== undefined && importData !== null) {
      importCount = Array.isArray(importData) ? importData.length : (typeof importData === "object" ? 1 : 0);
    }

    let action: DiffEntry["action"] = "unchanged";
    if (importData !== undefined && importData !== null) {
      if (currentCount === 0 && importCount > 0) {
        action = "new";
      } else if (importCount > 0 || currentCount > 0) {
        action = "overwrite";
      }
    } else if (currentCount > 0) {
      action = "unchanged"; // Import doesn't include this entity, keep current
    }

    entries.push({ label, currentCount, importCount, action });
  }

  // Count agent profiles in import
  const agentProfiles = Object.keys(exportJson.data).filter(k => k.startsWith("Agent Profile: "));
  if (agentProfiles.length > 0) {
    entries.push({
      label: `Agent Profiles (${agentProfiles.length})`,
      currentCount: 0,
      importCount: agentProfiles.length,
      action: "overwrite",
    });
  }

  return {
    exportedAt: exportJson.exportedAt,
    totalEntities: entries.filter(e => e.action !== "unchanged").length,
    entries,
  };
}