/**
 * API Health Dashboard — Improvement #16
 * Shows real-time server health, KV entity status, AI/email configuration, and latency.
 */
import { useState, useEffect, useCallback } from "react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminMobileMenu } from "../../components/AdminMobileMenu";
import { useTheme } from "../../lib/ThemeContext";
import { healthDetailedApi, aiAuditApi, healthCheck } from "../../lib/api";
import {
  Activity, Server, Database, Cloud, Brain, Mail, Shield, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Clock, Wifi, WifiOff, Loader2, Zap, HardDrive
} from "lucide-react";

import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function AdminHealthDashboard() {
  const { darkMode } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [basicHealth, setBasicHealth] = useState<boolean | null>(null);
  const [aiAuditCount, setAiAuditCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, basicRes, auditRes] = await Promise.all([
        healthDetailedApi.get(),
        healthCheck(),
        aiAuditApi.getLog(),
      ]);
      if (healthRes.success && healthRes.data) {
        setHealth(healthRes.data);
      }
      setBasicHealth(basicRes.success);
      if (auditRes.success && Array.isArray(auditRes.data)) {
        setAiAuditCount(auditRes.data.length);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Health fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const StatusBadge = ({ ok, label }: { ok: boolean | null; label: string }) => (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      ok === null ? "bg-gray-100 text-gray-500" : ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
    }`}>
      {ok === null ? <Loader2 className="w-3 h-3 animate-spin" /> : ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );

  const checks = health?.checks || {};

  return (
    <div className={`${insideUnifiedLayout ? "" : "min-h-screen flex"} ${darkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className="flex-1 lg:ml-0">
        {!insideUnifiedLayout && <AdminHeader />}
        <AdminMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main className="p-4 lg:p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-emerald-500" />
                API Health Dashboard
              </h1>
              <p className={`text-sm mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Real-time server, KV, AI, and email service status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-emerald-500" />
                Auto-refresh (30s)
              </label>
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Overall Status */}
          <div className={`rounded-xl border p-5 mb-6 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex flex-wrap items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${basicHealth ? "bg-emerald-100" : basicHealth === false ? "bg-red-100" : "bg-gray-100"}`}>
                {basicHealth === null ? <Loader2 className="w-7 h-7 text-gray-400 animate-spin" /> :
                  basicHealth ? <Server className="w-7 h-7 text-emerald-600" /> : <WifiOff className="w-7 h-7 text-red-500" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">Server: {basicHealth ? "Online" : basicHealth === false ? "Offline" : "Checking..."}</h2>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Version: {health?.version || "—"} | Last sync: {health?.lastSync ? new Date(health.lastSync).toLocaleString() : "Never"}
                </p>
              </div>
              <div className="ml-auto flex gap-2 flex-wrap">
                <StatusBadge ok={basicHealth} label="Edge Function" />
                <StatusBadge ok={checks.ai?.configured ?? null} label="AI (Qwen)" />
                <StatusBadge ok={checks.email?.configured ?? null} label="Email (Brevo)" />
              </div>
            </div>
          </div>

          {/* KV Entity Health Grid */}
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" /> KV Store Entities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {["cases", "users", "notifications", "settings", "auditLog"].map(entity => {
              const check = checks[entity];
              return (
                <div key={entity} className={`rounded-lg border p-4 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm capitalize">{entity}</span>
                    {check ? (
                      check.status === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                    ) : <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  </div>
                  {check && (
                    <div className={`text-xs space-y-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <div className="flex justify-between"><span>Records:</span><span className="font-mono">{check.count ?? "—"}</span></div>
                      <div className="flex justify-between"><span>Latency:</span><span className="font-mono">{check.latencyMs ?? "—"}ms</span></div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Storage */}
            <div className={`rounded-lg border p-4 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Storage Buckets</span>
                {checks.storage?.status === "ok" ? <Cloud className="w-4 h-4 text-blue-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>
              <div className={`text-xs space-y-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <div className="flex justify-between"><span>Buckets:</span><span className="font-mono">{checks.storage?.buckets ?? "—"}</span></div>
                <div className="flex justify-between"><span>Latency:</span><span className="font-mono">{checks.storage?.latencyMs ?? "—"}ms</span></div>
              </div>
            </div>
          </div>

          {/* Services Grid */}
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> External Services
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {/* AI */}
            <div className={`rounded-lg border p-4 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-purple-500" />
                <span className="font-medium text-sm">AI (Qwen)</span>
              </div>
              <div className={`text-xs space-y-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <div className="flex justify-between"><span>Configured:</span><span>{checks.ai?.configured ? "✅ Yes" : "❌ No"}</span></div>
                <div className="flex justify-between"><span>Key:</span><span className="font-mono">{checks.ai?.keyPrefix || "—"}</span></div>
                <div className="flex justify-between"><span>Audit entries:</span><span className="font-mono">{aiAuditCount}</span></div>
              </div>
            </div>

            {/* Email */}
            <div className={`rounded-lg border p-4 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-sm">Email (Brevo)</span>
              </div>
              <div className={`text-xs space-y-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <div className="flex justify-between"><span>Configured:</span><span>{checks.email?.configured ? "✅ Yes" : "❌ No"}</span></div>
              </div>
            </div>

            {/* Rate Limiter */}
            <div className={`rounded-lg border p-4 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-sm">Rate Limiter</span>
              </div>
              <div className={`text-xs space-y-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <div className="flex justify-between"><span>Active entries:</span><span className="font-mono">{checks.rateLimiter?.activeEntries ?? "—"}</span></div>
              </div>
            </div>
          </div>

          {/* Entity Timestamps */}
          {health?.entityTimestamps && Object.keys(health.entityTimestamps).length > 0 && (
            <>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Last Entity Sync Timestamps
              </h3>
              <div className={`rounded-lg border overflow-hidden mb-6 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={darkMode ? "bg-slate-700" : "bg-slate-50"}>
                      <th className="text-left px-4 py-2 font-medium">Entity</th>
                      <th className="text-left px-4 py-2 font-medium">Last Synced</th>
                      <th className="text-left px-4 py-2 font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health.entityTimestamps).map(([key, ts]: [string, any]) => {
                      const date = new Date(ts);
                      const ageMs = Date.now() - date.getTime();
                      const ageMin = Math.floor(ageMs / 60000);
                      const ageLabel = ageMin < 1 ? "< 1m" : ageMin < 60 ? `${ageMin}m` : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m`;
                      return (
                        <tr key={key} className={`border-t ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                          <td className="px-4 py-2 font-medium capitalize">{key}</td>
                          <td className="px-4 py-2 font-mono">{date.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              ageMin < 5 ? "bg-emerald-100 text-emerald-700" : ageMin < 30 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            }`}>{ageLabel} ago</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Footer */}
          <div className={`text-center text-xs py-4 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
            {lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
          </div>
        </main>
      </div>
    </div>
  );
}