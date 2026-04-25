import { MasterSidebar } from "../../components/MasterSidebar";
import { MasterHeader } from "../../components/MasterHeader";
import { useTheme } from "../../lib/ThemeContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Activity, Clock, AlertTriangle, CheckCircle, RefreshCw,
  Server, Database, Mail, Brain, ChevronDown, ChevronUp, Filter,
  TrendingUp, Zap, Eye, FileText, Users, Loader2
} from "lucide-react";
import { healthDetailedApi, aiAuditApi } from "../../lib/api";
import { AuditLogService } from "../../lib/auditLog";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";
import { toast } from "../../lib/toast";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/admin_pg`;

export function MasterAuditDashboard() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const { insideUnifiedLayout } = useUnifiedLayout();
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const [activeTab, setActiveTab] = useState<"health" | "ai-audit" | "crm-audit" | "health-history">("health");
  const [loading, setLoading] = useState(false);

  // Health data
  const [healthData, setHealthData] = useState<any>(null);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);

  // AI Audit data
  const [aiAuditLog, setAiAuditLog] = useState<any[]>([]);

  // CRM Audit data
  const [crmAuditLog, setCrmAuditLog] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState("");

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await healthDetailedApi.getDetailed();
      if (res.success && res.data) setHealthData(res.data);
    } catch { /* */ }
    setLoading(false);
  }, []);

  const fetchHealthHistory = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/health/history`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const json = await res.json();
      if (json.success) setHealthHistory(json.data || []);
    } catch { /* */ }
  }, []);

  const runHealthCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/health/run-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Health check completed");
        setHealthData(json.data);
        fetchHealthHistory();
      }
    } catch {
      toast.error("Health check failed");
    }
    setLoading(false);
  }, [fetchHealthHistory]);

  const fetchAiAudit = useCallback(async () => {
    try {
      const res = await aiAuditApi.getLog();
      if (res.success && res.data) setAiAuditLog(res.data as any[]);
    } catch { /* */ }
  }, []);

  const fetchCrmAudit = useCallback(() => {
    const entries = AuditLogService.getAll();
    setCrmAuditLog(entries);
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchHealthHistory();
    fetchAiAudit();
    fetchCrmAudit();
  }, [fetchHealth, fetchHealthHistory, fetchAiAudit, fetchCrmAudit]);

  const filteredCrmAudit = useMemo(() => {
    if (!auditFilter) return crmAuditLog.slice(0, 100);
    const q = auditFilter.toLowerCase();
    return crmAuditLog.filter(e =>
      (e.action || "").toLowerCase().includes(q) ||
      (e.user || "").toLowerCase().includes(q) ||
      (e.details || "").toLowerCase().includes(q)
    ).slice(0, 100);
  }, [crmAuditLog, auditFilter]);

  const getStatusBadge = (status: string) => {
    if (status === "ok" || status === "healthy") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">OK</span>;
    if (status === "missing") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">N/A</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">ERROR</span>;
  };

  const tabs = [
    { key: "health", label: "System Health", icon: Activity },
    { key: "health-history", label: "Health History", icon: TrendingUp },
    { key: "ai-audit", label: "AI Audit Log", icon: Brain },
    { key: "crm-audit", label: "CRM Audit Trail", icon: Shield },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <MasterHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dc ? "bg-purple-500/20" : "bg-purple-100"}`}>
                <Shield className={`w-6 h-6 ${dc ? "text-purple-400" : "text-purple-600"}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${txt}`}>
                  {isUrdu ? "آڈٹ ڈیش بورڈ" : "Audit Dashboard"}
                </h1>
                <p className={`text-sm ${sub}`}>
                  {isUrdu ? "سسٹم ہیلتھ، AI لاگز، آڈٹ ٹریل" : "System health, AI logs, audit trail"}
                </p>
              </div>
            </div>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isUrdu ? "ہیلتھ چیک" : "Run Health Check"}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? dc ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-purple-100 text-purple-700"
                      : dc ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === "health" && (
            <div className="space-y-4">
              {/* Overall Status */}
              {healthData && (
                <div className={`${card} rounded-2xl p-6 shadow-lg border ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-bold ${txt}`}>System Status</h2>
                    {getStatusBadge(healthData.status || "ok")}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className={`text-xs ${sub}`}>Version</p>
                      <p className={`text-sm font-semibold ${txt}`}>{healthData.version || "N/A"}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${sub}`}>Last Sync</p>
                      <p className={`text-sm font-semibold ${txt}`}>{healthData.lastSync ? new Date(healthData.lastSync).toLocaleString() : "Never"}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${sub}`}>Checked At</p>
                      <p className={`text-sm font-semibold ${txt}`}>{healthData.timestamp ? new Date(healthData.timestamp).toLocaleString() : "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Checks */}
              {healthData?.checks && typeof healthData.checks === "object" && !Array.isArray(healthData.checks) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(healthData.checks).map(([key, check]: [string, any]) => (
                    <div key={key} className={`${card} rounded-xl p-4 shadow border ${dc ? "border-gray-700" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {key === "storage" ? <Database className="w-4 h-4 text-blue-500" /> :
                           key === "ai" ? <Brain className="w-4 h-4 text-purple-500" /> :
                           key === "email" ? <Mail className="w-4 h-4 text-green-500" /> :
                           key === "rateLimiter" ? <Zap className="w-4 h-4 text-amber-500" /> :
                           <Server className="w-4 h-4 text-gray-500" />}
                          <span className={`text-sm font-semibold capitalize ${txt}`}>{key}</span>
                        </div>
                        {getStatusBadge(check.status || "ok")}
                      </div>
                      <div className={`text-xs space-y-1 ${sub}`}>
                        {check.latencyMs !== undefined && <p>Latency: {check.latencyMs}ms</p>}
                        {check.count !== undefined && <p>Records: {check.count}</p>}
                        {check.buckets !== undefined && <p>Buckets: {check.buckets}</p>}
                        {check.configured !== undefined && <p>Configured: {check.configured ? "Yes" : "No"}</p>}
                        {check.activeEntries !== undefined && <p>Active entries: {check.activeEntries}</p>}
                        {check.error && <p className="text-red-500 text-[10px]">{check.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!healthData && (
                <div className={`${card} rounded-2xl p-12 text-center shadow-lg`}>
                  <Activity className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                  <p className={sub}>Click "Run Health Check" to see system status</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "health-history" && (
            <div className={`${card} rounded-2xl shadow-lg overflow-hidden border ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <div className={`px-6 py-4 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>Health Check History</h2>
                <p className={`text-xs ${sub}`}>{healthHistory.length} records</p>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {healthHistory.length === 0 ? (
                  <div className="p-12 text-center">
                    <TrendingUp className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                    <p className={sub}>No health checks recorded yet. Run a check above.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={dc ? "bg-gray-700" : "bg-gray-50"}>
                      <tr>
                        {["Time", "Status", "KV", "Storage", "Qwen", "Brevo"].map(h => (
                          <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {healthHistory.slice(0, 50).map((entry, i) => (
                        <tr key={i} className={`border-b ${dc ? "border-gray-700/50" : "border-gray-100"}`}>
                          <td className={`py-2.5 px-4 text-xs ${sub}`}>{new Date(entry.timestamp).toLocaleString()}</td>
                          <td className="py-2.5 px-4">{getStatusBadge(entry.overallStatus || "ok")}</td>
                          <td className="py-2.5 px-4">{getStatusBadge(entry.checks?.kvStore?.status || "ok")}</td>
                          <td className="py-2.5 px-4">{getStatusBadge(entry.checks?.storage?.status || "ok")}</td>
                          <td className="py-2.5 px-4">{getStatusBadge(entry.checks?.qwenApi?.status || "missing")}</td>
                          <td className="py-2.5 px-4">{getStatusBadge(entry.checks?.brevo?.status || "missing")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "ai-audit" && (
            <div className={`${card} rounded-2xl shadow-lg overflow-hidden border ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <div className={`px-6 py-4 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg font-bold ${txt}`}>AI Conversation Audit Log</h2>
                <p className={`text-xs ${sub}`}>{aiAuditLog.length} entries — tracks all AI interactions with CRM action flags</p>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {aiAuditLog.length === 0 ? (
                  <div className="p-12 text-center">
                    <Brain className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                    <p className={sub}>No AI interactions recorded yet.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={dc ? "bg-gray-700" : "bg-gray-50"}>
                      <tr>
                        {["Time", "Role", "Model", "Actions", "Preview"].map(h => (
                          <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aiAuditLog.slice(0, 100).map((entry, i) => (
                        <tr key={entry.id || i} className={`border-b ${dc ? "border-gray-700/50" : "border-gray-100"}`}>
                          <td className={`py-2.5 px-4 text-xs ${sub}`}>{new Date(entry.timestamp).toLocaleString()}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              entry.role === "admin" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" :
                              entry.role === "master_admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" :
                              entry.role === "agent" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" :
                              entry.role === "operator" ? "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400" :
                              "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400"
                            }`}>{entry.role}</span>
                          </td>
                          <td className={`py-2.5 px-4 text-xs font-mono ${sub}`}>{entry.model || "N/A"}</td>
                          <td className="py-2.5 px-4">
                            {entry.hasActions ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">CRM</span>
                            ) : (
                              <span className={`text-xs ${sub}`}>-</span>
                            )}
                          </td>
                          <td className={`py-2.5 px-4 text-xs ${sub} max-w-[300px] truncate`}>{entry.messagePreview || entry.message?.substring(0, 80) || "..."}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "crm-audit" && (
            <div className={`${card} rounded-2xl shadow-lg overflow-hidden border ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <div>
                  <h2 className={`text-lg font-bold ${txt}`}>CRM Audit Trail</h2>
                  <p className={`text-xs ${sub}`}>{crmAuditLog.length} entries — case changes, payments, document uploads</p>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    placeholder="Filter..."
                    className={`w-48 px-3 py-1.5 rounded-lg text-xs border ${dc ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900"}`}
                  />
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredCrmAudit.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                    <p className={sub}>No audit entries found.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={dc ? "bg-gray-700" : "bg-gray-50"}>
                      <tr>
                        {["Time", "User", "Action", "Details"].map(h => (
                          <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCrmAudit.map((entry, i) => (
                        <tr key={entry.id || i} className={`border-b ${dc ? "border-gray-700/50" : "border-gray-100"}`}>
                          <td className={`py-2.5 px-4 text-xs ${sub}`}>{new Date(entry.timestamp || entry.date).toLocaleString()}</td>
                          <td className={`py-2.5 px-4 text-xs font-medium ${txt}`}>{entry.user || entry.performedBy || "System"}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (entry.action || "").includes("create") ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" :
                              (entry.action || "").includes("delete") ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                              (entry.action || "").includes("update") || (entry.action || "").includes("status") ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" :
                              (entry.action || "").includes("payment") ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                              "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400"
                            }`}>{entry.action || "unknown"}</span>
                          </td>
                          <td className={`py-2.5 px-4 text-xs ${sub} max-w-[400px] truncate`}>{entry.details || entry.description || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}