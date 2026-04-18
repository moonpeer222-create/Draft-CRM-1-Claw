// SyncProvider - initializes sync and provides sync status UI
// Works 100% locally when server is unavailable (no errors, no third-party deps)
import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  initialSync,
  startPeriodicSync,
  stopPeriodicSync,
  onSyncStateChange,
  getSyncState,
  forceSync,
  pushCases,
  pushAdminProfile,
  pushAgentProfile,
  pushNotifications,
  pushAttendance,
  pushLeaveRequests,
  pushPassportTracking,
  pushAuditLog,
  pushDocumentFiles,
  getConflictLog,
  getPendingConflicts,
  getAutoExportConfig,
  setAutoExportConfig,
  initCrossTabSync,
  getSyncInterval,
  type SyncStatus,
  type ConflictLog,
  type AutoExportConfig,
} from "../lib/syncService";
import { CRMDataStore } from "../lib/mockData";
import { NotificationService } from "../lib/notifications";
import { AttendanceService } from "../lib/attendanceService";
import { PassportTracker } from "../lib/passportTracker";
import { AuditLogService } from "../lib/auditLog";
import { DocumentFileStore } from "../lib/documentStore";
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Loader2, HardDrive, Download, Upload, ChevronDown, ChevronUp, GitMerge, Monitor, Server, Mail } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { toast } from "../lib/toast";
import { getStorageQuota, exportAllData, downloadExport, importData, readExportFile, type QuotaInfo } from "../lib/storageQuota";
import { ImportPreviewModal } from "./ImportPreviewModal";

interface SyncContextType {
  status: SyncStatus;
  lastSyncAt: string | null;
  serverAvailable: boolean;
  pendingOps: number;
  forceSync: () => Promise<boolean>;
}

const SyncContext = createContext<SyncContextType>({
  status: "local",
  lastSyncAt: null,
  serverAvailable: false,
  pendingOps: 0,
  forceSync: async () => false,
});

export function useSyncStatus() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>("local");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Register sync push callbacks on CRMDataStore
    CRMDataStore.registerSyncPush(() => {
      pushCases();
    });

    // Register notification sync
    NotificationService.registerSyncPush(() => pushNotifications());

    // Register attendance sync (records + leave requests)
    AttendanceService.registerSyncPush(() => {
      pushAttendance();
      pushLeaveRequests();
    });

    // Register passport tracking sync
    PassportTracker.registerSyncPush(() => pushPassportTracking());

    // Register audit log sync
    AuditLogService.registerSyncPush(() => pushAuditLog());

    // Register document files sync
    DocumentFileStore.registerSyncPush(() => pushDocumentFiles());

    // Initialize cross-tab sync via BroadcastChannel
    initCrossTabSync();

    // Listen for cross-tab conflict resolution notifications
    const handleConflictResolved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { entity, recordId, method } = detail;
      const methodLabel = method === "cherry-pick" ? "cherry-pick merge" : `${method} version`;
      toast.info(`Conflict resolved in another tab: ${entity} #${recordId} (${methodLabel})`, { duration: 4000 });
    };
    window.addEventListener("crm-conflict-resolved", handleConflictResolved);

    // Improvement #14: Enhanced conflict detection UX
    let lastConflictCount = 0;
    const checkConflicts = () => {
      try {
        const conflicts = getPendingConflicts();
        if (conflicts && conflicts.length > lastConflictCount && conflicts.length > 0) {
          const newCount = conflicts.length - lastConflictCount;
          toast.warning(
            `${newCount} sync conflict${newCount > 1 ? "s" : ""} detected — open Data Storage panel to resolve`,
            { duration: 8000 }
          );
        }
        lastConflictCount = conflicts?.length || 0;
      } catch { /* non-fatal */ }
    };
    const conflictInterval = setInterval(checkConflicts, 30000);

    // Listen for sync state changes
    const unsub = onSyncStateChange((state) => {
      setStatus(state.status);
      setLastSyncAt(state.lastSyncAt);
      setServerAvailable(state.serverAvailable);
      setPendingOps(state.pendingOps);
      // Check for conflicts after each sync
      if (state.status === "synced") checkConflicts();
    });

    // Run initial sync (silently falls back to local mode if server unavailable)
    (async () => {
      await initialSync();
      setInitialized(true);
      // Start periodic sync every 60s (only syncs if server becomes available)
      startPeriodicSync(getSyncInterval());
    })();

    return () => {
      unsub();
      stopPeriodicSync();
      clearInterval(conflictInterval);
      window.removeEventListener("crm-conflict-resolved", handleConflictResolved);
    };
  }, []);

  return (
    <SyncContext.Provider
      value={{
        status,
        lastSyncAt,
        serverAvailable,
        pendingOps,
        forceSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

// Floating sync status indicator
export function SyncStatusBadge() {
  const { status, serverAvailable, lastSyncAt, pendingOps, forceSync } = useSyncStatus();
  const { darkMode, isUrdu } = useTheme();
  const [showDetail, setShowDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [showConflictLog, setShowConflictLog] = useState(false);
  const [conflictLog, setConflictLog] = useState<ConflictLog | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<any>(null);
  const [autoExportConfig, setAutoExportConfigState] = useState<AutoExportConfig | null>(null);
  const [showAutoExport, setShowAutoExport] = useState(false);
  const [autoExportEmail, setAutoExportEmail] = useState("");

  // Refresh quota and conflict log periodically when panel is open
  useEffect(() => {
    if (showDetail) {
      setQuota(getStorageQuota());
      setConflictLog(getConflictLog());
      setAutoExportConfigState(getAutoExportConfig());
      const interval = setInterval(() => setQuota(getStorageQuota()), 5000);
      return () => clearInterval(interval);
    }
  }, [showDetail]);

  const handleForceSync = async () => {
    setSyncing(true);
    await forceSync();
    setSyncing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      downloadExport(data);
    } catch (err) {
    }
    setExporting(false);
  };

  const getStatusColor = () => {
    switch (status) {
      case "synced":
        return "text-blue-500";
      case "syncing":
        return "text-blue-500";
      case "error":
        return "text-red-500";
      case "offline":
        return "text-orange-500";
      case "local":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = () => {
    if (syncing || status === "syncing") return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    if (status === "synced") return <Cloud className="w-3.5 h-3.5" />;
    if (status === "local") return <HardDrive className="w-3.5 h-3.5" />;
    if (status === "offline") return <CloudOff className="w-3.5 h-3.5" />;
    if (status === "error") return <AlertCircle className="w-3.5 h-3.5" />;
    return <HardDrive className="w-3.5 h-3.5" />;
  };

  const getStatusLabel = () => {
    if (syncing || status === "syncing") return isUrdu ? "ہم آہنگ ہو رہا ہے..." : "Syncing...";
    if (status === "synced") return isUrdu ? "کلاؤڈ ہم آہنگ" : "Cloud Synced";
    if (status === "local") return isUrdu ? "مقامی موڈ" : "Local Mode";
    if (status === "offline") return isUrdu ? "آف لائن" : "Offline";
    if (status === "error") return isUrdu ? "خرابی" : "Error";
    return isUrdu ? "جوڑ رہا ہے..." : "Connecting...";
  };

  return (
    <div className={`fixed bottom-36 lg:bottom-4 ${isUrdu ? "left-4" : "right-4"} z-[35] transition-all duration-300`}>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDetail(!showDetail)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border text-xs font-medium transition-colors ${getStatusColor()} ${
          darkMode
            ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
            : "bg-white border-gray-200 hover:bg-gray-50"
        }`}
      >
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusLabel()}</span>
      </motion.button>

      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute bottom-full mb-2 ${isUrdu ? "left-0" : "right-0"} w-64 rounded-xl shadow-2xl border p-4 ${
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "ڈیٹا اسٹوریج" : "Data Storage"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    serverAvailable
                      ? "bg-green-500/20 text-green-500"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${serverAvailable ? "bg-green-500" : "bg-gray-400"}`} />
                  {serverAvailable
                    ? (isUrdu ? "کلاؤڈ متصل" : "Cloud Connected")
                    : (isUrdu ? "مقامی اسٹوریج" : "Local Storage")}
                </span>
              </div>

              <div className={`text-xs space-y-1.5 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex justify-between">
                  <span>{isUrdu ? "موڈ" : "Mode"}</span>
                  <span className={getStatusColor()}>{getStatusLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isUrdu ? "آخری ہم آہنگی" : "Last Sync"}</span>
                  <span>{lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : (isUrdu ? "صرف مقامی" : "Local only")}</span>
                </div>
                {pendingOps > 0 && (
                  <div className="flex justify-between">
                    <span>{isUrdu ? "زیر التواء" : "Pending"}</span>
                    <span>{pendingOps} ops</span>
                  </div>
                )}
              </div>

              {/* Info about local mode */}
              {!serverAvailable && (
                <div className={`text-[10px] p-2 rounded-lg ${darkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-600"}`}>
                  {isUrdu
                    ? "تمام ڈیٹا آپ کے براؤزر میں مقامی طور پر محفوظ ہے۔ انٹرنیٹ کی ضرورت نہیں۔"
                    : "All data is stored locally in your browser. No internet required."}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleForceSync}
                disabled={syncing}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  syncing
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {syncing
                  ? isUrdu ? "چیک ہو رہا ہے..." : "Checking..."
                  : isUrdu ? "کلاؤڈ ہم آہنگی آزمائیں" : "Try Cloud Sync"}
              </motion.button>

              {/* localStorage Quota Meter */}
              {quota && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      {isUrdu ? "مقامی اسٹوریج" : "Local Storage"}
                    </span>
                    <span className={`text-[10px] font-semibold ${
                      quota.status === "critical" ? "text-red-500" :
                      quota.status === "warning" ? "text-orange-500" :
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {quota.formattedUsed} / {quota.formattedLimit}
                    </span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(quota.usedPercent, 100)}%` }}
                      className={`h-1.5 rounded-full transition-colors ${
                        quota.status === "critical" ? "bg-red-500" :
                        quota.status === "warning" ? "bg-orange-500" :
                        "bg-blue-500"
                      }`}
                    />
                  </div>
                  {quota.status !== "ok" && (
                    <p className={`text-[9px] ${quota.status === "critical" ? "text-red-400" : "text-orange-400"}`}>
                      {quota.status === "critical"
                        ? (isUrdu ? "اسٹوریج تقریباً بھر گئی! کلاؤڈ سنک کریں۔" : "Storage nearly full! Enable cloud sync.")
                        : (isUrdu ? "اسٹوریج 80% سے زیادہ۔" : "Storage over 80% used.")}
                    </p>
                  )}
                </div>
              )}

              {/* Export All Data button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExport}
                disabled={exporting}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  exporting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {exporting
                  ? isUrdu ? "ڈاؤنلوڈ ہو رہا ہے..." : "Exporting..."
                  : isUrdu ? "ڈیٹا ڈاؤنلوڈ کریں" : "Export Data"}
              </motion.button>

              {/* Import Data button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    try {
                      const exportJson = await readExportFile(file);
                      setImportPreviewData(exportJson);
                    } catch (err) {
                      alert(isUrdu ? `فائل پڑھنے میں خرابی: ${err}` : `File read error: ${err}`);
                    }
                  };
                  input.click();
                }}
                disabled={!!importPreviewData}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  importing
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : darkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {importing
                  ? isUrdu ? "درآمد ہو رہا ہے..." : "Importing..."
                  : isUrdu ? "ڈیٹا درآمد کریں" : "Import Data"}
              </motion.button>

              {/* Auto-Export Email Config */}
              {serverAvailable && (
                <div>
                  <button
                    onClick={() => setShowAutoExport(!showAutoExport)}
                    className={`w-full flex items-center justify-between py-1.5 text-[10px] font-medium ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {isUrdu ? "خودکار ایکسپورٹ ای میل" : "Auto-Export Email"}
                      {autoExportConfig?.enabled && (
                        <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-green-500/20 text-green-500">ON</span>
                      )}
                    </span>
                    {showAutoExport ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {showAutoExport && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`space-y-2 mt-1 p-2.5 rounded-lg ${darkMode ? "bg-gray-900/50" : "bg-gray-50"}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              {isUrdu ? "فعال" : "Enabled"}
                            </span>
                            <button
                              onClick={() => {
                                const cfg = autoExportConfig || { enabled: false, recipients: [], intervalHours: 24 };
                                const updated = { ...cfg, enabled: !cfg.enabled };
                                setAutoExportConfig(updated);
                                setAutoExportConfigState(updated);
                              }}
                              className={`relative w-8 h-4 rounded-full transition-colors ${
                                autoExportConfig?.enabled ? "bg-green-500" : darkMode ? "bg-gray-600" : "bg-gray-300"
                              }`}
                            >
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                autoExportConfig?.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                              }`} />
                            </button>
                          </div>
                          <div>
                            <label className={`text-[9px] mb-0.5 block ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                              {isUrdu ? "ای میل وصول کنندہ" : "Recipient Email"}
                            </label>
                            <input
                              type="email"
                              placeholder="admin@example.com"
                              value={autoExportEmail || (autoExportConfig?.recipients?.[0] || "")}
                              onChange={(e) => setAutoExportEmail(e.target.value)}
                              onBlur={() => {
                                if (autoExportEmail) {
                                  const cfg = autoExportConfig || { enabled: false, recipients: [], intervalHours: 24 };
                                  const updated = { ...cfg, recipients: [autoExportEmail] };
                                  setAutoExportConfig(updated);
                                  setAutoExportConfigState(updated);
                                }
                              }}
                              className={`w-full px-2 py-1 rounded text-[10px] border ${
                                darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-700"
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[9px] mb-0.5 block ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                              {isUrdu ? "وقفہ" : "Interval"}
                            </label>
                            <select
                              value={autoExportConfig?.intervalHours || 24}
                              onChange={(e) => {
                                const cfg = autoExportConfig || { enabled: false, recipients: [], intervalHours: 24 };
                                const updated = { ...cfg, intervalHours: Number(e.target.value) };
                                setAutoExportConfig(updated);
                                setAutoExportConfigState(updated);
                              }}
                              className={`w-full px-2 py-1 rounded text-[10px] border ${
                                darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-700"
                              }`}
                            >
                              <option value={24}>{isUrdu ? "روزانہ (24 گھنٹے)" : "Daily (24h)"}</option>
                              <option value={168}>{isUrdu ? "ہفتہ وار (7 دن)" : "Weekly (7 days)"}</option>
                              <option value={720}>{isUrdu ? "ماہانہ (30 دن)" : "Monthly (30 days)"}</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Conflict Log */}
              {conflictLog && conflictLog.entries.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowConflictLog(!showConflictLog)}
                    className={`w-full flex items-center justify-between py-1.5 text-[10px] font-medium ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <span className="flex items-center gap-1">
                      <GitMerge className="w-3 h-3" />
                      {isUrdu ? "آخری سنک لاگ" : "Last Sync Log"}
                      <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                        {conflictLog.entries.filter(e => e.winner !== "empty").length}
                      </span>
                    </span>
                    {showConflictLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {showConflictLog && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`space-y-1 max-h-32 overflow-y-auto text-[9px] mt-1 p-2 rounded-lg ${darkMode ? "bg-gray-900/50" : "bg-gray-50"}`}>
                          <p className={`text-[8px] mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                            {new Date(conflictLog.syncedAt).toLocaleString()}
                          </p>
                          {conflictLog.entries
                            .filter(e => e.winner !== "empty")
                            .map((entry, idx) => (
                            <div key={idx} className={`py-0.5 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              <div className="flex items-center gap-1.5">
                                {entry.winner === "local" ? (
                                  <Monitor className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                                ) : entry.winner === "server" ? (
                                  <Server className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
                                ) : (
                                  <GitMerge className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
                                )}
                                <span className="font-semibold capitalize">{entry.entity}</span>
                                <span className={`px-1 py-0.5 rounded font-bold text-[7px] ${
                                  entry.winner === "local"
                                    ? darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                                    : entry.winner === "merged"
                                    ? darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                                    : darkMode ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700"
                                }`}>
                                  {entry.winner}
                                </span>
                              </div>
                              {entry.detail && (
                                <p className={`ml-4 text-[8px] mt-0.5 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                                  {entry.detail}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Preview Modal */}
      {importPreviewData && (
        <ImportPreviewModal
          exportJson={importPreviewData}
          onClose={() => setImportPreviewData(null)}
          onImported={() => {
            setImportPreviewData(null);
            alert(isUrdu ? "ڈیٹا بحال ہو گیا۔ ایپ ریفریش ہو رہی ہے..." : "Data restored. Refreshing app...");
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}