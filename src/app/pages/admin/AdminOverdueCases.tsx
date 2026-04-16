import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { CRMDataStore, Case, WORKFLOW_STAGES, DELAY_REASONS, getStageLabel, getOverdueInfo, getDelayReasonLabel, reportDelay } from "../../lib/mockData";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem } from "../../lib/animations";
import {
  AlertTriangle, Clock, TrendingDown, Users,
  ChevronRight, Search, Download, Phone,
  MessageCircle, X, CheckCircle2, MessageSquare, BarChart3,
  PieChart as PieChartIcon, RefreshCw, Eye, Send
} from "lucide-react";
import { OverdueNotificationTemplates } from "../../components/OverdueNotificationTemplates";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { SimpleDonutChart, SimpleHBarChart, SimpleAreaChart } from "../../components/SimpleCharts";

export function AdminOverdueCases() {
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedDelayReason, setSelectedDelayReason] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayStep, setDelayStep] = useState<"reason" | "note">("reason");
  const [isLoading, setIsLoading] = useState(false);
  const [, setTick] = useState(0);
  const [showTemplatesFor, setShowTemplatesFor] = useState<Case | null>(null);

  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;

  useEffect(() => {
    loadCases();
    const interval = setInterval(loadCases, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadCases = () => setCases(CRMDataStore.getCases());

  // ===== COMPUTED ANALYTICS =====
  const overdueCases = useMemo(() =>
    cases.filter(c => getOverdueInfo(c).isOverdue),
    [cases]
  );

  const filteredOverdue = useMemo(() => {
    let filtered = [...overdueCases];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.agentName.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== "all") filtered = filtered.filter(c => c.status === stageFilter);
    if (reasonFilter !== "all") filtered = filtered.filter(c => c.delayReason === reasonFilter);
    if (agentFilter !== "all") filtered = filtered.filter(c => c.agentName === agentFilter);
    return filtered;
  }, [overdueCases, searchTerm, stageFilter, reasonFilter, agentFilter]);

  // Delay reason breakdown
  const reasonBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    overdueCases.forEach(c => {
      const key = c.delayReason || "unreported";
      counts[key] = (counts[key] || 0) + 1;
    });
    const colors = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#6B7280"];
    return Object.entries(counts).map(([key, value], i) => ({
      name: key === "unreported" ? (isUrdu ? "غیر رپورٹ شدہ" : "Unreported") : getDelayReasonLabel(key, isUrdu),
      value,
      color: colors[i % colors.length],
      key,
    }));
  }, [overdueCases, isUrdu]);

  // Stage-wise overdue
  const stageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    overdueCases.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return WORKFLOW_STAGES
      .filter(s => counts[s.key])
      .map(s => ({
        stage: isUrdu ? s.labelUrdu : s.label,
        stageShort: (isUrdu ? s.labelUrdu : s.label).split(" ").slice(0, 2).join(" "),
        count: counts[s.key] || 0,
        key: s.key,
      }));
  }, [overdueCases, isUrdu]);

  // Agent-wise overdue
  const agentBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; reported: number }> = {};
    overdueCases.forEach(c => {
      if (!counts[c.agentName]) counts[c.agentName] = { total: 0, reported: 0 };
      counts[c.agentName].total += 1;
      if (c.delayReason) counts[c.agentName].reported += 1;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data, unreported: data.total - data.reported }))
      .sort((a, b) => b.total - a.total);
  }, [overdueCases]);

  // Severity breakdown
  const severityBreakdown = useMemo(() => {
    let critical = 0, high = 0, medium = 0;
    overdueCases.forEach(c => {
      const oi = getOverdueInfo(c);
      if (oi.hoursOverdue && oi.hoursOverdue > 48) critical++;
      else if (oi.hoursOverdue && oi.hoursOverdue > 12) high++;
      else medium++;
    });
    return [
      { name: isUrdu ? "اہم" : "Critical (>48h)", value: critical, color: "#DC2626" },
      { name: isUrdu ? "زیادہ" : "High (12-48h)", value: high, color: "#F59E0B" },
      { name: isUrdu ? "معتدل" : "Medium (<12h)", value: medium, color: "#3B82F6" },
    ].filter(s => s.value > 0);
  }, [overdueCases, isUrdu]);

  const uniqueAgents = useMemo(() => [...new Set(overdueCases.map(c => c.agentName))], [overdueCases]);
  const overdueStages = useMemo(() => [...new Set(overdueCases.map(c => c.status))], [overdueCases]);

  // Average overdue hours
  const avgOverdueHours = useMemo(() => {
    if (overdueCases.length === 0) return 0;
    const total = overdueCases.reduce((sum, c) => {
      const oi = getOverdueInfo(c);
      return sum + (oi.hoursOverdue || 0);
    }, 0);
    return Math.round(total / overdueCases.length);
  }, [overdueCases]);

  const overdueRate = cases.length > 0 ? Math.round((overdueCases.length / cases.length) * 100) : 0;
  const unreportedCount = overdueCases.filter(c => !c.delayReason).length;

  // 30-day overdue trend (simulated from case data)
  const trendData = useMemo(() => {
    const data: { day: string; overdue: number; total: number; rate: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      // Cases that existed by that date
      const casesAtDate = cases.filter(c => new Date(c.createdDate || c.updatedDate) <= d);
      const total = casesAtDate.length || 1;
      // Simulate overdue count based on current overdue proportionally + variance
      const baseOverdue = overdueCases.length;
      const seed = (i * 7 + d.getDate()) % 13;
      const variance = Math.sin(i * 0.4) * 3 + (seed % 5) - 2;
      const dayOverdue = Math.max(0, Math.round(baseOverdue * (0.6 + (i / 60)) + variance));
      const rate = total > 0 ? Math.round((dayOverdue / total) * 100) : 0;
      data.push({ day: dayStr, overdue: dayOverdue, total, rate: Math.min(rate, 100) });
    }
    return data;
  }, [cases, overdueCases]);

  // ===== HANDLERS =====
  const openDelayModal = (c: Case) => {
    setSelectedCase(c);
    setSelectedDelayReason(c.delayReason || "");
    setDelayNote("");
    setDelayStep("reason");
    setShowDelayModal(true);
  };

  const handleReportDelay = () => {
    if (!selectedCase || !selectedDelayReason) {
      toast.error(isUrdu ? "وجہ منتخب کریں" : "Select a reason first");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const updated = reportDelay(selectedCase.id, selectedDelayReason, delayNote || undefined);
      if (updated) {
        toast.success(isUrdu ? "تاخیر کی وجہ محفوظ!" : `Delay reported for ${selectedCase.id}`);
        setShowDelayModal(false);
        loadCases();
      }
      setIsLoading(false);
    }, 600);
  };

  const handleExportCSV = () => {
    const headers = "Case ID,Customer,Agent,Stage,Overdue Time,Delay Reason,Reported At\n";
    const rows = filteredOverdue.map(c => {
      const oi = getOverdueInfo(c);
      return `${c.id},${c.customerName},${c.agentName},${getStageLabel(c.status)},${oi.timeLabel},${c.delayReason ? getDelayReasonLabel(c.delayReason) : "Unreported"},${c.delayReportedAt || "N/A"}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overdue-cases-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isUrdu ? "CSV ڈاؤن لوڈ!" : `${filteredOverdue.length} overdue cases exported`);
  };

  const getStatusColor = (status: Case["status"]) => {
    const colors: Record<string, string> = {
      document_collection: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      biometric: dc ? "bg-cyan-900/30 text-cyan-400" : "bg-cyan-100 text-cyan-700",
      e_number_issued: dc ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700",
      payment_confirmation: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700",
      original_documents: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      submitted_to_manager: dc ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700",
      remaining_amount: dc ? "bg-pink-900/30 text-pink-400" : "bg-pink-100 text-pink-700",
    };
    return colors[status] || (dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700");
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6 space-y-6">
          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold flex items-center gap-3 ${txt}`}>
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 5 }}
                  className="p-2 bg-red-500/20 rounded-xl"
                >
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </motion.div>
                {isUrdu ? "تاخیر شدہ کیسز رپورٹ" : "Overdue Cases Report"}
              </h1>
              <p className={`text-sm mt-1 ${sub}`}>
                {isUrdu ? `${overdueCases.length} کیسز ڈیڈ لائن سے تجاوز کر چکے ہیں` : `${overdueCases.length} cases have exceeded their stage deadlines`}
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { loadCases(); toast.success("Data refreshed"); }} className={`flex items-center gap-2 px-4 py-2 border rounded-xl ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                <RefreshCw className="w-4 h-4" /> {isUrdu ? "تازہ" : "Refresh"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/20">
                <Download className="w-4 h-4" /> {isUrdu ? "CSV ایکسپورٹ" : "Export CSV"}
              </motion.button>
            </div>
          </motion.div>

          {/* ===== SUMMARY CARDS ===== */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: AlertTriangle, label: isUrdu ? "کل تاخیر شدہ" : "Total Overdue", value: overdueCases.length, color: "red", extra: `${overdueRate}% ${isUrdu ? "شرح" : "of all"}` },
              { icon: Clock, label: isUrdu ? "اوسط تاخیر" : "Avg Overdue", value: `${avgOverdueHours}h`, color: "orange", extra: isUrdu ? "اوسط گھنٹے" : "avg hours late" },
              { icon: MessageSquare, label: isUrdu ? "غیر رپورٹ شدہ" : "Unreported", value: unreportedCount, color: "amber", extra: isUrdu ? "وجہ درج نہیں" : "no reason filed" },
              { icon: TrendingDown, label: isUrdu ? "سب سے زیادہ" : "Most Delayed", value: stageBreakdown.length > 0 ? stageBreakdown[0].count : 0, color: "purple", extra: stageBreakdown.length > 0 ? stageBreakdown[0].stageShort : "N/A" },
            ].map((c, idx) => {
              const Icon = c.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -3 }} className={`${card} rounded-2xl p-4 md:p-5 border ${brd} shadow-lg hover:shadow-xl transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl bg-${c.color}-500/15`}>
                      <Icon className={`w-5 h-5 text-${c.color}-500`} />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-${c.color}-500/15 text-${c.color}-500`}>{c.extra}</span>
                  </div>
                  <p className={`text-2xl md:text-3xl font-bold ${txt}`}>{c.value}</p>
                  <p className={`text-xs mt-1 ${sub}`}>{c.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ===== CHARTS ROW ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Delay Reason Pie Chart */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className={`${card} rounded-2xl shadow-lg p-5 border ${brd}`}>
              <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${txt}`}>
                <PieChartIcon className="w-4 h-4 text-red-500" />
                {isUrdu ? "تاخیر کی وجوہات" : "Delay Reason Breakdown"}
              </h3>
              {reasonBreakdown.length > 0 ? (
                <>
                  <SimpleDonutChart data={reasonBreakdown} height={200} darkMode={dc} />
                  <div className="space-y-1.5 mt-2">
                    {reasonBreakdown.map((r, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className={`text-xs ${sub}`}>{r.name}</span>
                        </div>
                        <span className={`text-xs font-bold ${txt}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className={`text-sm text-center py-12 ${sub}`}>{isUrdu ? "کوئی تاخیر شدہ کیس نہیں" : "No overdue cases"}</p>
              )}
            </motion.div>

            {/* Stage-wise Overdue Bar Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={`${card} rounded-2xl shadow-lg p-5 border ${brd}`}>
              <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${txt}`}>
                <BarChart3 className="w-4 h-4 text-orange-500" />
                {isUrdu ? "مرحلہ وار تاخیر" : "Stage-wise Overdue"}
              </h3>
              {stageBreakdown.length > 0 ? (
                <SimpleHBarChart data={stageBreakdown} labelKey="stageShort" valueKey="count" color="#EF4444" height={250} darkMode={dc} />
              ) : (
                <p className={`text-sm text-center py-12 ${sub}`}>{isUrdu ? "ڈیٹا نہیں" : "No data"}</p>
              )}
            </motion.div>

            {/* Agent Performance + Severity */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className={`${card} rounded-2xl shadow-lg p-5 border ${brd} space-y-5`}>
              {/* Agent Breakdown */}
              <div>
                <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
                  <Users className="w-4 h-4 text-purple-500" />
                  {isUrdu ? "ایجنٹ کی کارکردگی" : "Agent Overdue Count"}
                </h3>
                <div className="space-y-2">
                  {agentBreakdown.slice(0, 5).map((a, i) => (
                    <motion.div key={a.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-medium truncate ${txt}`}>{a.name}</span>
                          <span className="text-xs font-bold text-red-500">{a.total}</span>
                        </div>
                        <div className={`w-full h-1.5 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                          <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${agentBreakdown.length > 0 ? (a.total / agentBreakdown[0].total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Severity Breakdown */}
              <div>
                <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {isUrdu ? "شدت" : "Severity"}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {severityBreakdown.map(s => (
                    <div key={s.name} className={`p-2.5 rounded-xl text-center ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className={`text-[10px] ${sub}`}>{s.name}</p>
                    </div>
                  ))}
                  {severityBreakdown.length === 0 && (
                    <p className={`col-span-3 text-xs text-center py-3 ${sub}`}>None</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ===== 30-DAY OVERDUE TREND ===== */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className={`${card} rounded-2xl shadow-lg p-5 border ${brd}`}>
              <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${txt}`}>
                <TrendingDown className="w-4 h-4 text-red-500" />
                {isUrdu ? "30 دن کا تاخیر رجحان" : "30-Day Overdue Trend"}
              </h3>
              <SimpleAreaChart data={trendData} xKey="day" yKey="overdue" y2Key="rate" color="#EF4444" color2="#F59E0B" height={200} darkMode={dc} xInterval={4} />
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-red-500 rounded" />
                  <span className={`text-[10px] ${sub}`}>{isUrdu ? "تاخیر شدہ کیسز" : "Overdue Cases"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-amber-500 rounded" style={{ borderTop: "1px dashed" }} />
                  <span className={`text-[10px] ${sub}`}>{isUrdu ? "شرح %" : "Rate %"}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ===== FILTERS + TABLE ===== */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className={`${card} rounded-2xl shadow-lg border ${brd} overflow-hidden`}>
            {/* Filter Bar */}
            <div className={`p-4 border-b ${brd}`}>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={isUrdu ? "تلاش..." : "Search cases..."} className={`${inputCls} pl-10 text-sm`} />
                </div>
                <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className={`${inputCls} text-sm max-w-[180px]`}>
                  <option value="all">{isUrdu ? "تمام مراحل" : "All Stages"}</option>
                  {overdueStages.map(s => (
                    <option key={s} value={s}>{getStageLabel(s, isUrdu)}</option>
                  ))}
                </select>
                <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} className={`${inputCls} text-sm max-w-[180px]`}>
                  <option value="all">{isUrdu ? "تمام وجوہات" : "All Reasons"}</option>
                  <option value="unreported">{isUrdu ? "غیر رپورٹ شدہ" : "Unreported"}</option>
                  {DELAY_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{isUrdu ? r.labelUrdu : r.label}</option>
                  ))}
                </select>
                <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className={`${inputCls} text-sm max-w-[160px]`}>
                  <option value="all">{isUrdu ? "تمام ایجنٹس" : "All Agents"}</option>
                  {uniqueAgents.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className={`text-xs ${sub}`}>
                  {isUrdu ? `${filteredOverdue.length} کیسز دکھائے جا رہے ہیں` : `Showing ${filteredOverdue.length} of ${overdueCases.length} overdue cases`}
                </p>
                {(stageFilter !== "all" || reasonFilter !== "all" || agentFilter !== "all" || searchTerm) && (
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setStageFilter("all"); setReasonFilter("all"); setAgentFilter("all"); setSearchTerm(""); }} className="text-xs text-red-500 font-semibold hover:text-red-600">
                    {isUrdu ? "فلٹر صاف" : "Clear Filters"}
                  </motion.button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${brd}`}>
                    {[
                      isUrdu ? "کیس" : "Case",
                      isUrdu ? "کسٹمر" : "Customer",
                      isUrdu ? "مرحلہ" : "Stage",
                      isUrdu ? "تاخیر" : "Overdue",
                      isUrdu ? "وجہ" : "Reason",
                      isUrdu ? "ایجنٹ" : "Agent",
                      isUrdu ? "ایکشن" : "Action",
                    ].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOverdue.length > 0 ? filteredOverdue.slice(0, 50).map((c, idx) => {
                    const oi = getOverdueInfo(c);
                    const isCritical = oi.hoursOverdue && oi.hoursOverdue > 48;
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={`border-b cursor-pointer transition-colors ${isCritical ? (dc ? "border-red-900/30 bg-red-950/10 hover:bg-red-950/20" : "border-red-100 bg-red-50/50 hover:bg-red-50") : (dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50")}`}
                        onClick={() => navigate(`${prefix}/cases/${c.id}`)}
                      >
                        <td className="py-3 px-4">
                          <span className="text-sm font-mono text-blue-600 font-semibold">{c.id}</span>
                        </td>
                        <td className="py-3 px-4">
                          <p className={`text-sm font-semibold ${txt}`}>{c.customerName}</p>
                          <p className={`text-xs ${sub}`}>{c.phone}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(c.status)}`}>
                            {getStageLabel(c.status, isUrdu)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <motion.div
                              animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 1, repeat: isCritical ? Infinity : 0, repeatDelay: 2 }}
                            >
                              <AlertTriangle className={`w-3.5 h-3.5 ${isCritical ? "text-red-500" : "text-orange-500"}`} />
                            </motion.div>
                            <span className={`text-xs font-bold ${isCritical ? "text-red-500" : "text-orange-500"}`}>{oi.timeLabel}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {c.delayReason ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dc ? "text-orange-400" : "text-orange-600"}`}>
                              <MessageSquare className="w-3 h-3" />
                              {getDelayReasonLabel(c.delayReason, isUrdu)}
                            </span>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => { e.stopPropagation(); openDelayModal(c); }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {isUrdu ? "وجہ درج" : "Report"}
                            </motion.button>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-xs ${sub}`}>{c.agentName}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setShowTemplatesFor(c); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title={isUrdu ? "یاد دہانی بھیجیں" : "Send Reminder"}>
                              <Send className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`tel:${c.phone}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                              <Phone className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`); }} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); openDelayModal(c); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                              <Eye className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-blue-500" : "text-blue-400"}`} />
                        <p className={`text-sm font-semibold ${txt}`}>{isUrdu ? "کوئی تاخیر شدہ کیس نہیں!" : "No overdue cases found!"}</p>
                        <p className={`text-xs mt-1 ${sub}`}>{isUrdu ? "سب بروقت ہے" : "All cases are on track"}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </main>
      </div>

      {/* ===== DELAY MODAL ===== */}
      <AnimatePresence>
        {showDelayModal && selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowDelayModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden`}
            >
              {/* Header */}
              <div className="relative overflow-hidden">
                <motion.div animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10" style={{ backgroundSize: "200% 100%" }} />
                <div className={`relative flex items-center justify-between p-5 border-b ${brd}`}>
                  <div className="flex items-center gap-3">
                    <motion.div animate={{ rotate: [0, -15, 15, -15, 0] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 4 }} className="p-2 bg-red-500/20 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </motion.div>
                    <div>
                      <h2 className={`text-lg font-bold ${txt}`}>{isUrdu ? "تاخیر کی اطلاع" : "Report Delay"}</h2>
                      <p className={`text-xs ${sub}`}>{selectedCase.id} — {selectedCase.customerName}</p>
                    </div>
                  </div>
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowDelayModal(false)} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Info bar */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mx-5 mt-4 p-3 rounded-xl flex items-center justify-between ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                <div>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "مرحلہ" : "Stage"}</p>
                  <p className={`text-sm font-bold ${txt}`}>{getStageLabel(selectedCase.status, isUrdu)}</p>
                </div>
                <p className="text-sm font-bold text-red-500">{getOverdueInfo(selectedCase).timeLabel}</p>
              </motion.div>

              {/* Steps */}
              <div className="flex items-center gap-2 px-5 mt-4">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${delayStep === "reason" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}>
                  {delayStep === "note" ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">1</span>}
                  {isUrdu ? "وجہ" : "Reason"}
                </div>
                <ChevronRight className={`w-4 h-4 ${sub}`} />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${delayStep === "note" ? "bg-red-500 text-white" : dc ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                  <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">2</span>
                  {isUrdu ? "تفصیل" : "Details"}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {delayStep === "reason" ? (
                    <motion.div key="r" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <p className={`text-sm font-semibold mb-3 ${txt}`}>{isUrdu ? "وجہ منتخب کریں:" : "Select delay reason:"}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {DELAY_REASONS.map((reason, idx) => (
                          <motion.button key={reason.value} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }} whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} onClick={() => { setSelectedDelayReason(reason.value); setTimeout(() => setDelayStep("note"), 200); }}
                            className={`flex items-center gap-3 p-3 rounded-xl text-left border-2 transition-all ${selectedDelayReason === reason.value ? "border-red-500 " + (dc ? "bg-red-950/30" : "bg-red-50") : dc ? "border-gray-700 bg-gray-700/30 hover:border-gray-600" : "border-gray-200 hover:border-gray-300"}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedDelayReason === reason.value ? "border-red-500 bg-red-500" : dc ? "border-gray-500" : "border-gray-300"}`}>
                              {selectedDelayReason === reason.value && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className={`text-sm font-semibold flex-1 ${selectedDelayReason === reason.value ? "text-red-600 dark:text-red-400" : txt}`}>{isUrdu ? reason.labelUrdu : reason.label}</span>
                            <ChevronRight className={`w-4 h-4 ${selectedDelayReason === reason.value ? "text-red-500" : sub}`} />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="n" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${dc ? "bg-red-950/30 border border-red-900/50" : "bg-red-50 border border-red-200"}`}>
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className={`text-xs ${sub}`}>{isUrdu ? "وجہ:" : "Reason:"}</p>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">{getDelayReasonLabel(selectedDelayReason, isUrdu)}</p>
                        </div>
                        <button onClick={() => setDelayStep("reason")} className={`text-xs px-2 py-1 rounded-lg ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}`}>{isUrdu ? "تبدیل" : "Change"}</button>
                      </div>
                      <p className={`text-sm font-semibold mb-2 ${txt}`}>{isUrdu ? "تفصیل (اختیاری):" : "Notes (optional):"}</p>
                      <textarea value={delayNote} onChange={e => setDelayNote(e.target.value)} rows={3} placeholder={isUrdu ? "تفصیلات..." : "Describe the delay..."} className={`${inputCls} resize-none`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className={`flex gap-3 p-5 border-t ${brd}`}>
                {delayStep === "note" && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDelayStep("reason")} className={`px-4 py-2.5 rounded-xl border text-sm ${dc ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-700"}`}>{isUrdu ? "واپس" : "Back"}</motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowDelayModal(false)} className={`flex-1 py-2.5 rounded-xl border text-sm ${dc ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-700"}`}>{isUrdu ? "منسوخ" : "Cancel"}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={delayStep === "reason" ? () => { if (selectedDelayReason) setDelayStep("note"); else toast.error("Select a reason"); } : handleReportDelay}
                  disabled={delayStep === "note" && (isLoading || !selectedDelayReason)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20">
                  {delayStep === "reason" ? (<>{isUrdu ? "اگلا" : "Next"} <ChevronRight className="w-4 h-4" /></>) : isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (<>{isUrdu ? "محفوظ" : "Submit"}</>)}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TEMPLATE MODAL ===== */}
      <AnimatePresence>
        {showTemplatesFor && (
          <OverdueNotificationTemplates caseData={showTemplatesFor} onClose={() => setShowTemplatesFor(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}