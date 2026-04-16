import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useTheme } from "../../lib/ThemeContext";
import { AuditLogService, type AuditEntry } from "../../lib/auditLog";
import { toast } from "../../lib/toast";
import {
  Search, Filter, RefreshCw, Shield, Clock, User, Wifi, Globe,
  FileText, CreditCard, Upload, LogIn, LogOut, CheckCircle2, XCircle,
  Calendar, Download, Trash2, ChevronDown, ChevronUp, Eye
} from "lucide-react";

export function AdminAuditLog() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "agent" | "customer">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditEntry["category"]>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(new Date());

  const loadEntries = () => {
    setEntries(AuditLogService.getAll());
    setLastSync(new Date());
  };

  useEffect(() => {
    loadEntries();
    const interval = setInterval(loadEntries, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = entries.filter(e => {
    if (roleFilter !== "all" && e.role !== roleFilter) return false;
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.ipAddress.includes(q)
      );
    }
    return true;
  });

  const getActionIcon = (action: AuditEntry["action"]) => {
    const map: Record<string, JSX.Element> = {
      login: <LogIn className="w-3.5 h-3.5 text-blue-500" />,
      logout: <LogOut className="w-3.5 h-3.5 text-gray-500" />,
      case_created: <FileText className="w-3.5 h-3.5 text-blue-500" />,
      case_updated: <FileText className="w-3.5 h-3.5 text-blue-500" />,
      case_stage_changed: <FileText className="w-3.5 h-3.5 text-purple-500" />,
      payment_added: <CreditCard className="w-3.5 h-3.5 text-orange-500" />,
      payment_approved: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
      payment_rejected: <XCircle className="w-3.5 h-3.5 text-red-500" />,
      document_uploaded: <Upload className="w-3.5 h-3.5 text-blue-500" />,
      document_verified: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
      document_rejected: <XCircle className="w-3.5 h-3.5 text-red-500" />,
      approval_granted: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
      approval_denied: <XCircle className="w-3.5 h-3.5 text-red-500" />,
      broadcast_sent: <Globe className="w-3.5 h-3.5 text-blue-500" />,
      passport_checkout: <Eye className="w-3.5 h-3.5 text-orange-500" />,
      passport_returned: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
      attendance_checkin: <Clock className="w-3.5 h-3.5 text-teal-500" />,
      attendance_checkout: <Clock className="w-3.5 h-3.5 text-gray-500" />,
    };
    return map[action] || <Shield className="w-3.5 h-3.5 text-gray-400" />;
  };

  const getRoleBadge = (role: AuditEntry["role"]) => {
    const styles: Record<string, string> = {
      admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
      agent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
      customer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/40",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${styles[role]}`}>
        {role}
      </span>
    );
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  };

  const getTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const handleExport = () => {
    const csv = [
      "Timestamp,User,Role,Action,Category,Description,IP Address",
      ...filtered.map(e =>
        `"${e.timestamp}","${e.userName}","${e.role}","${e.action}","${e.category}","${e.description}","${e.ipAddress}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isUrdu ? "CSV ڈاؤن لوڈ ہو گیا" : "Audit log exported as CSV");
  };

  const handleClear = () => {
    if (confirm(isUrdu ? "کیا آپ واقعی تمام لاگ صاف کرنا چاہتے ہیں؟" : "Are you sure you want to clear all audit logs?")) {
      AuditLogService.clearAll();
      loadEntries();
      toast.success(isUrdu ? "لاگ صاف ہو گئے" : "Audit log cleared");
    }
  };

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className={`text-2xl md:text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <Shield className="w-7 h-7 inline-block mr-2 text-blue-500" />
                  {isUrdu ? "آڈٹ لاگ" : "Audit Log"}
                </h1>
                <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? "تمام صارف سرگرمیوں کا ریکارڈ" : "Complete record of all user activities — Admin only"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${darkMode ? "bg-blue-900/20 text-blue-400 border border-blue-800/30" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <Wifi className="w-3 h-3" />
                  {isUrdu ? "لائیو" : "Live"}
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExport}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border ${darkMode ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  <Download className="w-3.5 h-3.5" /> {isUrdu ? "برآمد" : "Export CSV"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { loadEntries(); toast.success(isUrdu ? "ریفریش" : "Refreshed"); }}
                  className={`p-2 rounded-xl border ${darkMode ? "border-gray-700 text-gray-400 hover:bg-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  <RefreshCw className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`p-4 rounded-2xl mb-6 ${darkMode ? "bg-gray-800" : "bg-white"} shadow-lg`}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isUrdu ? "تلاش: صارف، عمل، IP..." : "Search: user, action, IP address..."}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "admin", "agent", "customer"] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${roleFilter === r
                      ? "bg-blue-600 text-white"
                      : darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {r === "all" ? (isUrdu ? "سب" : "All Roles") : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${darkMode ? "bg-gray-700 border-gray-600 text-gray-300" : "border-gray-300 text-gray-600"}`}>
                <option value="all">{isUrdu ? "تمام" : "All Categories"}</option>
                <option value="case">{isUrdu ? "کیس" : "Case"}</option>
                <option value="payment">{isUrdu ? "ادائیگی" : "Payment"}</option>
                <option value="document">{isUrdu ? "دستاویز" : "Document"}</option>
                <option value="auth">{isUrdu ? "تصدیق" : "Auth"}</option>
                <option value="approval">{isUrdu ? "منظوری" : "Approval"}</option>
                <option value="attendance">{isUrdu ? "حاضری" : "Attendance"}</option>
                <option value="system">{isUrdu ? "سسٹم" : "System"}</option>
              </select>
            </div>
          </motion.div>

          {/* Audit Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={`rounded-2xl overflow-hidden shadow-lg ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gray-50"}`}>
                    {[
                      isUrdu ? "وقت" : "Timestamp",
                      isUrdu ? "صارف" : "User",
                      isUrdu ? "کردار" : "Role",
                      isUrdu ? "عمل" : "Action",
                      isUrdu ? "تفصیل" : "Description",
                      "IP",
                    ].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`py-12 text-center ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                        <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{isUrdu ? "کوئی ریکارڈ نہیں" : "No audit entries found"}</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 50).map((entry, idx) => (
                      <motion.tr key={entry.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        className={`border-b cursor-pointer transition-colors ${
                          darkMode ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"
                        } ${entry.role === "admin" ? (darkMode ? "border-l-2 border-l-blue-500/50" : "border-l-2 border-l-blue-400") : ""}`}
                      >
                        <td className={`py-3 px-4 text-xs whitespace-nowrap ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          <div>{formatTimestamp(entry.timestamp)}</div>
                          <div className={`text-[10px] ${darkMode ? "text-gray-600" : "text-gray-400"}`}>{getTimeAgo(entry.timestamp)} ago</div>
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                          <div className="flex items-center gap-2">
                            <User className={`w-3.5 h-3.5 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                            {entry.userName}
                          </div>
                        </td>
                        <td className="py-3 px-4">{getRoleBadge(entry.role)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {getActionIcon(entry.action)}
                            <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                              {entry.action.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-xs max-w-xs truncate ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                          {entry.description}
                        </td>
                        <td className={`py-3 px-4 text-xs font-mono ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {entry.ipAddress}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.slice(0, 30).map((entry, idx) => (
                <motion.div key={entry.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className={`p-4 ${darkMode ? "hover:bg-gray-700/30" : "hover:bg-gray-50"} cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>{entry.userName}</span>
                        {getRoleBadge(entry.role)}
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{entry.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{getTimeAgo(entry.timestamp)} ago</span>
                        <span className={`text-[10px] font-mono ${darkMode ? "text-gray-600" : "text-gray-400"}`}>{entry.ipAddress}</span>
                      </div>
                      {expandedId === entry.id && entry.metadata && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                          className={`mt-2 p-2 rounded-lg text-[10px] font-mono ${darkMode ? "bg-gray-900 text-gray-400" : "bg-gray-100 text-gray-500"}`}
                        >
                          {JSON.stringify(entry.metadata, null, 2)}
                        </motion.div>
                      )}
                    </div>
                    {entry.metadata && (
                      expandedId === entry.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Summary */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className={`mt-4 flex items-center justify-between px-4 py-3 rounded-xl ${darkMode ? "bg-gray-800/50" : "bg-gray-50"}`}
          >
            <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              {isUrdu ? `${filtered.length} میں سے ${entries.length} ریکارڈ` : `Showing ${filtered.length} of ${entries.length} entries`}
            </span>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                {isUrdu ? "آخری اپ ڈیٹ:" : "Last sync:"} {lastSync.toLocaleTimeString()}
              </span>
              <button onClick={handleClear}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg ${darkMode ? "text-red-400 hover:bg-red-900/20" : "text-red-500 hover:bg-red-50"}`}>
                <Trash2 className="w-3 h-3" /> {isUrdu ? "صاف" : "Clear"}
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}