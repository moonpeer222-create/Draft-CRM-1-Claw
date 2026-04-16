/**
 * AdminSyncHistory — full conflict history browser
 * Shows all past sync conflict logs with filtering and search.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GitMerge, Monitor, Server, Clock, Trash2, RefreshCw, Filter,
  ChevronDown, ChevronUp, Search, History, ArrowLeftRight,
} from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import {
  getConflictHistory,
  clearConflictHistory,
  getPendingConflicts,
  type ConflictLog,
  type ConflictEntry,
} from "../../lib/syncService";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { SyncDiffViewer } from "../../components/SyncDiffViewer";

type WinnerFilter = "all" | "local" | "server" | "merged";

export function AdminSyncHistory() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const [history, setHistory] = useState<ConflictLog[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [winnerFilter, setWinnerFilter] = useState<WinnerFilter>("all");
  const [entitySearch, setEntitySearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30">("all");
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setHistory(getConflictHistory());
    setPendingCount(getPendingConflicts().filter(c => !c.resolved).length);
  }, []);

  const handleClearHistory = () => {
    if (confirm(isUrdu ? "تمام سنک تاریخ صاف کریں؟" : "Clear all sync conflict history?")) {
      clearConflictHistory();
      setHistory([]);
    }
  };

  // Filter history by date range
  const dateFiltered = history.filter((log) => {
    if (dateFilter === "all") return true;
    const days = parseInt(dateFilter);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(log.syncedAt).getTime() > cutoff;
  });

  // Filter entries within each log
  const filterEntries = (entries: ConflictEntry[]): ConflictEntry[] => {
    return entries.filter((e) => {
      if (e.winner === "empty") return false;
      if (winnerFilter !== "all" && e.winner !== winnerFilter) return false;
      if (entitySearch && !e.entity.toLowerCase().includes(entitySearch.toLowerCase())) return false;
      return true;
    });
  };

  // Stats
  const allEntries = history.flatMap((h) => h.entries.filter((e) => e.winner !== "empty"));
  const totalSyncs = history.length;
  const totalMerged = allEntries.filter((e) => e.winner === "merged").length;
  const totalLocalWins = allEntries.filter((e) => e.winner === "local").length;
  const totalServerWins = allEntries.filter((e) => e.winner === "server").length;

  const getWinnerIcon = (winner: string) => {
    switch (winner) {
      case "local": return <Monitor className="w-3 h-3 text-blue-400 flex-shrink-0" />;
      case "server": return <Server className="w-3 h-3 text-indigo-400 flex-shrink-0" />;
      case "merged": return <GitMerge className="w-3 h-3 text-green-400 flex-shrink-0" />;
      default: return <ArrowLeftRight className="w-3 h-3 text-gray-400 flex-shrink-0" />;
    }
  };

  const getWinnerBadge = (winner: string) => {
    switch (winner) {
      case "local": return dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700";
      case "server": return dc ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700";
      case "merged": return dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700";
      default: return dc ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-600";
    }
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div
      className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${
        dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"
      }`}
    >
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6 pb-6">
          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className={`text-xl md:text-2xl font-bold mb-1 flex items-center gap-2 ${txt}`}>
                  <History className="w-6 h-6 text-blue-600" />
                  {isUrdu ? "سنک تصادم تاریخ" : "Sync Conflict History"}
                </h1>
                <p className={sub}>
                  {isUrdu
                    ? "تمام ماضی کی ہم آہنگی کے تصادم لاگ دیکھیں"
                    : "Browse all past sync conflict resolution logs"}
                </p>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHistory(getConflictHistory())}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border min-h-[44px] ${
                    dc ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {isUrdu ? "تازہ" : "Refresh"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearHistory}
                  disabled={history.length === 0}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border min-h-[44px] ${
                    history.length === 0
                      ? "opacity-40 cursor-not-allowed border-gray-300 text-gray-400"
                      : dc ? "border-red-800/40 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {isUrdu ? "صاف کریں" : "Clear All"}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Pending Conflicts Banner */}
          {pendingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 p-4 rounded-xl border-2 ${
                dc ? "bg-orange-900/20 border-orange-700/40" : "bg-orange-50 border-orange-300"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <GitMerge className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${dc ? "text-orange-300" : "text-orange-800"}`}>
                      {pendingCount} {isUrdu ? "غیر حل شدہ تصادمات" : `Unresolved Conflict${pendingCount !== 1 ? "s" : ""}`}
                    </p>
                    <p className={`text-xs ${dc ? "text-orange-400/70" : "text-orange-600"}`}>
                      {isUrdu
                        ? "سرور اور مقامی ڈیٹا میں فرق ہے — دستی طور پر حل کریں"
                        : "Server and local data differ — resolve manually with side-by-side comparison"}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDiffViewer(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg min-h-[44px] w-full sm:w-auto justify-center"
                >
                  <GitMerge className="w-4 h-4" />
                  {isUrdu ? "تصادمات حل کریں" : "Resolve Conflicts"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Stats Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6"
          >
            {[
              { label: isUrdu ? "کل سنکس" : "Total Syncs", value: totalSyncs, icon: RefreshCw, color: "blue" },
              { label: isUrdu ? "ضم شدہ" : "Deep Merged", value: totalMerged, icon: GitMerge, color: "green" },
              { label: isUrdu ? "مقامی جیت" : "Local Wins", value: totalLocalWins, icon: Monitor, color: "blue" },
              { label: isUrdu ? "سرور جیت" : "Server Wins", value: totalServerWins, icon: Server, color: "indigo" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  className={`${card} rounded-xl shadow-lg p-3 sm:p-4 border ${dc ? "border-gray-700" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-5 h-5 text-${stat.color}-500`} />
                    <span className={`text-[10px] sm:text-xs font-medium ${sub}`}>{stat.label}</span>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${txt}`}>{stat.value}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Filters */}
          <div className={`${card} rounded-xl shadow-lg p-4 border ${dc ? "border-gray-700" : "border-gray-200"} mb-4`}>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Entity search */}
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type="text"
                  placeholder={isUrdu ? "ہستی تلاش کریں..." : "Search entity..."}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border min-h-[44px] ${
                    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                  }`}
                />
              </div>

              {/* Winner filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {([
                  { id: "all" as WinnerFilter, label: isUrdu ? "سب" : "All" },
                  { id: "merged" as WinnerFilter, label: isUrdu ? "ضم" : "Merged" },
                  { id: "local" as WinnerFilter, label: isUrdu ? "مقامی" : "Local" },
                  { id: "server" as WinnerFilter, label: isUrdu ? "سرور" : "Server" },
                ]).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setWinnerFilter(f.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap min-h-[36px] transition-all ${
                      winnerFilter === f.id
                        ? "bg-blue-600 text-white"
                        : dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Date filter */}
              <div className="flex gap-1.5">
                {([
                  { id: "7" as const, label: isUrdu ? "7 دن" : "7d" },
                  { id: "30" as const, label: isUrdu ? "30 دن" : "30d" },
                  { id: "all" as const, label: isUrdu ? "سب" : "All" },
                ]).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap min-h-[36px] transition-all ${
                      dateFilter === f.id
                        ? "bg-blue-600 text-white"
                        : dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conflict History List */}
          {dateFiltered.length === 0 ? (
            <div className={`${card} rounded-xl shadow-lg p-12 text-center border ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <History className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
              <p className={`text-sm font-medium ${txt}`}>
                {isUrdu ? "کوئی سنک تاریخ نہیں" : "No sync history yet"}
              </p>
              <p className={`text-xs mt-1 ${sub}`}>
                {isUrdu ? "سنک مکمل ہونے پر تاریخ یہاں نظر آئے گی" : "Conflict logs will appear here after syncs complete"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dateFiltered.map((log, logIdx) => {
                const filtered = filterEntries(log.entries);
                if (filtered.length === 0 && (winnerFilter !== "all" || entitySearch)) return null;
                const isExpanded = expandedIdx === logIdx;
                const nonEmptyEntries = log.entries.filter((e) => e.winner !== "empty");
                const mergedCount = nonEmptyEntries.filter((e) => e.winner === "merged").length;
                const localCount = nonEmptyEntries.filter((e) => e.winner === "local").length;
                const serverCount = nonEmptyEntries.filter((e) => e.winner === "server").length;

                return (
                  <motion.div
                    key={logIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: logIdx * 0.03 }}
                    className={`${card} rounded-xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-200"} overflow-hidden`}
                  >
                    {/* Log Header */}
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : logIdx)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${
                        dc ? "hover:bg-gray-750" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          dc ? "bg-blue-900/30" : "bg-blue-50"
                        }`}>
                          <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${txt}`}>
                            {new Date(log.syncedAt).toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric",
                            })}
                            <span className={`ml-2 text-xs font-normal ${sub}`}>
                              {new Date(log.syncedAt).toLocaleTimeString("en-US", {
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {mergedCount > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}>
                                {mergedCount} merged
                              </span>
                            )}
                            {localCount > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"}`}>
                                {localCount} local
                              </span>
                            )}
                            {serverCount > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${dc ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700"}`}>
                                {serverCount} server
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${sub}`}>
                          {nonEmptyEntries.length} {isUrdu ? "ہستیاں" : "entities"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className={`w-4 h-4 ${sub}`} />
                        ) : (
                          <ChevronDown className={`w-4 h-4 ${sub}`} />
                        )}
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={`border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                            {(filtered.length > 0 ? filtered : nonEmptyEntries).map((entry, entryIdx) => (
                              <div
                                key={entryIdx}
                                className={`flex items-start gap-3 px-4 py-3 ${
                                  entryIdx > 0 ? `border-t ${dc ? "border-gray-700/50" : "border-gray-100"}` : ""
                                }`}
                              >
                                {getWinnerIcon(entry.winner)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-semibold capitalize ${txt}`}>
                                      {entry.entity}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getWinnerBadge(entry.winner)}`}>
                                      {entry.winner}
                                    </span>
                                  </div>
                                  {entry.detail && (
                                    <p className={`text-xs mt-0.5 ${sub}`}>{entry.detail}</p>
                                  )}
                                  <div className={`flex items-center gap-3 mt-1 text-[10px] ${dc ? "text-gray-600" : "text-gray-400"}`}>
                                    {entry.localTs && (
                                      <span>Local: {new Date(entry.localTs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                    )}
                                    {entry.serverTs && (
                                      <span>Server: {new Date(entry.serverTs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Sync Diff Viewer Modal */}
      {showDiffViewer && (
        <SyncDiffViewer
          onClose={() => {
            setShowDiffViewer(false);
            setPendingCount(getPendingConflicts().filter(c => !c.resolved).length);
          }}
          onResolved={() => {
            setPendingCount(getPendingConflicts().filter(c => !c.resolved).length);
          }}
        />
      )}
    </div>
  );
}