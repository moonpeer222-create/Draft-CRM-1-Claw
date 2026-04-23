import { Case, getStageLabel, getOverdueInfo, LEAD_PIPELINE_STAGES, VISA_PIPELINE_STAGES } from "../../lib/mockData";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { updateCaseStatus, bulkDeleteCases } from "../../lib/caseApi";
import { useState, useEffect } from "react";
import { useLocation, useParams, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ImageLightbox } from "../../components/ImageLightbox";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { useTheme } from "../../lib/ThemeContext";
import { PaymentConfirmationModal } from "../../components/PaymentConfirmationModal";
import { CancellationReopenModal } from "../../components/CancellationReopenModal";
import { AddStaffModal } from "../../components/AddStaffModal";
import {
  Search, Filter, Plus, Phone, MessageCircle, Download, ChevronDown,
  FileText, Clock, CheckCircle2, DollarSign, AlertCircle,
  Edit, X, Trash2, UserPlus
} from "lucide-react";
import { NewCaseModal } from "../../components/NewCaseModal";
import { CaseDetailModal } from "../../components/CaseDetailModal";
import { useCrossTabRefresh } from "../../lib/useCrossTabRefresh";
import { useOptimisticMutation } from "../../lib/optimisticMutation";
import { NotificationService } from "../../lib/notifications";
import { BulkStatusChangeModal } from "../../components/BulkStatusChangeModal";


export function AdminCaseManagement() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  // Get current admin name from session
  const adminName = (() => {
    try {
      const raw = localStorage.getItem("emerald-admin-auth");
      if (raw) {
        const session = JSON.parse(raw);
        return session.fullName || "Admin";
      }
    } catch {}
    return "Admin";
  })();

  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const { mutate: optimisticMutate } = useOptimisticMutation();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deepLinked, setDeepLinked] = useState(false);

  // Detect if master admin via URL path
  const isMasterAdmin = window.location.pathname.startsWith("/master");

  // Improvement #8: Bulk operations
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<Case["status"]>("document_collection");

  // Lightbox state for document previews
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    country: "all",
    agent: "all",
    priority: "all",
    dateRange: "all",
  });



  useEffect(() => {
    loadCases();
  }, []);

  // Deep-link: auto-open case from URL param (/admin/cases/:caseId?tab=payments&from=notification) or legacy location.state
  const location = useLocation();
  const { caseId: urlCaseId } = useParams<{ caseId?: string }>();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const state = location.state as { openCaseId?: string; openTab?: string; fromNotification?: boolean } | null;
    const targetCaseId = urlCaseId || state?.openCaseId;
    const tab = searchParams.get("tab") || state?.openTab;
    const fromNotification = searchParams.get("from") === "notification" || state?.fromNotification;
    if (targetCaseId) {
      (async () => {
        const { data, error } = await supabase.from('cases').select('*').eq('id', targetCaseId).single();
        if (!error && data) {
          const target = mapSupabaseCaseToLocal(data);
          setSelectedCase(target);
          setShowCaseDetail(true);
          setActiveTab(tab || "overview");
          if (fromNotification) {
            setDeepLinked(true);
            setTimeout(() => setDeepLinked(false), 3200);
            const tabLabel = tab ? ` → ${tab.charAt(0).toUpperCase() + tab.slice(1)}` : "";
            toast.success(`Opened ${target.id} (${target.customerName})${tabLabel}`);
          } else {
            toast.info(`Navigated to case ${target.id}`);
          }
        } else {
          toast.error(`Case ${targetCaseId} not found`);
        }
      })();
      // Clear query params and state so refresh doesn't re-open
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state, urlCaseId, searchParams]);

  // Live countdown timer - refresh overdue info every 60s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filters, cases, overdueFilter]);

  const loadCases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error("Failed to load cases from server");
    } else {
      const mapped = (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
      setCases(mapped);
      setFilteredCases(mapped);
    }
    setIsLoading(false);
  };

  // Auto-refresh when another tab modifies cases
  useCrossTabRefresh(["cases"], loadCases);

  const applyFilters = () => {
    let filtered = [...cases];
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm) ||
          c.passport.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.status !== "all") filtered = filtered.filter((c) => c.status === filters.status);
    if (filters.country !== "all") filtered = filtered.filter((c) => c.country === filters.country);
    if (filters.agent !== "all") filtered = filtered.filter((c) => c.agentName === filters.agent);
    if (filters.priority !== "all") filtered = filtered.filter((c) => c.priority === filters.priority);
    if (overdueFilter) filtered = filtered.filter((c) => getOverdueInfo(c).isOverdue);
    setFilteredCases(filtered);
  };


  const handleExport = () => {
    const lt = toast.loading("Exporting cases data...");
    setTimeout(() => {
      // Generate CSV
      const headers = "Case ID,Customer,Phone,Country,Job Type,Status,Priority,Agent,Total Fee,Paid,Created\n";
      const rows = filteredCases.map(c =>
        `${c.id},${c.customerName},${c.phone},${c.country},${c.jobType},${c.status},${c.priority},${c.agentName},${c.totalFee},${c.paidAmount},${new Date(c.createdDate).toLocaleDateString()}`
      ).join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-cases-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success(`${filteredCases.length} cases exported to CSV!`);
    }, 1000);
  };

  const getStatusColor = (status: Case["status"]) => {
    const colors: Record<string, string> = {
      document_collection: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      selection_call: dc ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700",
      medical_token: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      check_medical: dc ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700",
      biometric: dc ? "bg-cyan-900/30 text-cyan-400" : "bg-cyan-100 text-cyan-700",
      e_number_issued: dc ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-700",
      payment_confirmation: dc ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700",
      original_documents: dc ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700",
      submitted_to_manager: dc ? "bg-violet-900/30 text-violet-400" : "bg-violet-100 text-violet-700",
      approved: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
      remaining_amount: dc ? "bg-pink-900/30 text-pink-400" : "bg-pink-100 text-pink-700",
      protector: dc ? "bg-lime-900/30 text-lime-400" : "bg-lime-100 text-lime-700",
      ticket_booking: dc ? "bg-sky-900/30 text-sky-400" : "bg-sky-100 text-sky-700",
      completed: dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
      rejected: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
    };
    return colors[status] || colors.document_collection;
  };

  const getPriorityColor = (priority: Case["priority"]) => {
    const colors: Record<string, string> = {
      low: dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
      medium: dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700",
      high: dc ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700",
      urgent: dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
    };
    return colors[priority];
  };

  const stats = {
    total: filteredCases.length,
    active: filteredCases.filter((c) => !["completed", "rejected"].includes(c.status)).length,
    completed: filteredCases.filter((c) => c.status === "completed").length,
    revenue: filteredCases.reduce((sum, c) => sum + c.paidAmount, 0),
  };

  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  return (
    <div className={`${isUrdu ? fontClass : ""} min-h-full transition-colors duration-300`}>
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div className="mx-[0px] my-[10px]">
              <h1 className={`text-xl md:text-3xl font-bold mb-1 ${txt}`}>{t("cases.title")}</h1>
              
            </div>
            <div className="flex gap-3">
              
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleExport} className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}>
                <Download className="w-4 h-4" /> Export
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddStaffModal(true)} className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-emerald-600 text-emerald-400 hover:bg-emerald-900/20" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                <UserPlus className="w-4 h-4" /> {isUrdu ? "نیا ایجنٹ" : "Add Agent"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowNewCaseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 transition-all shadow-lg">
                <Plus className="w-4 h-4" /> {isUrdu ? "نیا کیس" : "New Case"}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col sm:flex-row gap-4 mb-6">
            {[
              { label: "Total Cases", value: stats.total, icon: FileText, color: "text-blue-600", bg: dc ? "bg-blue-900/20" : "bg-blue-50" },
              { label: "Active Cases", value: stats.active, icon: Clock, color: "text-orange-600", bg: dc ? "bg-orange-900/20" : "bg-orange-50" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-600", bg: dc ? "bg-green-900/20" : "bg-green-50" },
              { label: "Revenue", value: `PKR ${(stats.revenue / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-blue-600", bg: dc ? "bg-blue-900/20" : "bg-blue-50" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }} className={`${card} flex-1 rounded-2xl shadow-lg p-4 md:p-5 border ${dc ? "border-gray-700" : "border-gray-100"} flex items-center gap-4`}>
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    {stat.label === "Revenue" ? (
                      <span className={`${stat.color} font-bold text-sm`}>PKR</span>
                    ) : (
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs ${sub} mb-0.5`}>{stat.label}</p>
                    <h3 className={`text-2xl font-bold ${txt}`}>{stat.value}</h3>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Search & Filters */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg p-[10px] mx-[0px] mt-[0px] mb-[14px]`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, case ID, phone, passport..." className={`${inputCls} pl-12`} />
              </div>
              
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${showFilters ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700") : `border ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}`}>
                <Filter className="w-4 h-4" /> Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </motion.button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`mt-4 pt-4 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: "Status", key: "status", opts: ["all", ...LEAD_PIPELINE_STAGES.map(s => s.key), ...VISA_PIPELINE_STAGES.map(s => s.key)] },
                      { label: "Country", key: "country", opts: ["all", ...POPULAR_COUNTRIES, ...ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c))] },
                      { label: "Agent", key: "agent", opts: ["all", "Faizan", "Imran", "Safeer", "Aynee"] },
                      { label: "Priority", key: "priority", opts: ["all", "urgent", "high", "medium", "low"] },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className={labelCls}>{f.label}</label>
                        <select value={(filters as any)[f.key]} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })} className={inputCls}>
                          {f.opts.map((o) => (
                            <option key={o} value={o}>{o === "all" ? `All ${f.label}s` : f.key === "status" ? getStageLabel(o as Case["status"]) : o.charAt(0).toUpperCase() + o.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="flex items-end">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setFilters({ status: "all", country: "all", agent: "all", priority: "all", dateRange: "all" }); setSearchTerm(""); }} className={`w-full px-4 py-2.5 border rounded-xl ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                        Reset
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Cases Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${card} rounded-2xl shadow-lg overflow-hidden`}>
            {/* Bulk Action Bar */}
            <AnimatePresence>
              {bulkMode && bulkSelected.size > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${dc ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${dc ? "text-blue-300" : "text-blue-700"}`}>{bulkSelected.size} selected</span>
                    <button onClick={() => setBulkSelected(new Set(filteredCases.slice(0, 25).map(cs => cs.id)))} className={`text-xs px-2 py-1 rounded ${dc ? "text-blue-400 hover:bg-blue-900/30" : "text-blue-600 hover:bg-blue-100"}`}>Select All</button>
                    <button onClick={() => setBulkSelected(new Set())} className={`text-xs px-2 py-1 rounded ${dc ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}>Clear</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowBulkStatusModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      <Edit className="w-3 h-3" /> Change Status
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`Delete ${bulkSelected.size} cases? This cannot be undone.`)) return;
                      const ids = Array.from(bulkSelected);
                      const success = await bulkDeleteCases(ids);
                      if (success) {
                        toast.success(`${ids.length} cases deleted`);
                        setBulkSelected(new Set());
                        setBulkMode(false);
                        loadCases();
                      } else {
                        toast.error("Failed to delete cases");
                      }
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${dc ? "bg-gray-700" : "bg-gray-50"} border-b ${dc ? "border-gray-600" : "border-gray-200"}`}>
                  <tr>
                    {bulkMode && (
                      <th className="py-4 px-3 w-10">
                        <input type="checkbox" checked={bulkSelected.size === Math.min(filteredCases.length, 25) && bulkSelected.size > 0} onChange={(e) => { if (e.target.checked) { setBulkSelected(new Set(filteredCases.slice(0, 25).map(cs => cs.id))); } else { setBulkSelected(new Set()); } }} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                      </th>
                    )}
                    {["Case ID", "Customer", "Destination", "Status", "Priority", "Agent", "Payment", "Actions"].map((h) => (
                      <th key={h} className={`text-left py-4 px-3 md:px-5 text-xs font-semibold uppercase tracking-wider ${dc ? "text-gray-400" : "text-gray-500"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.slice(0, 25).map((c, idx) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className={`border-b cursor-pointer transition-colors ${bulkSelected.has(c.id) ? (dc ? "bg-blue-900/20" : "bg-blue-50") : ""} ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`} onClick={() => { if (bulkMode) { const next = new Set(bulkSelected); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setBulkSelected(next); } else { setSelectedCase(c); setShowCaseDetail(true); setActiveTab("overview"); } }}>
                      {bulkMode && (
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={bulkSelected.has(c.id)} onChange={() => { const next = new Set(bulkSelected); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setBulkSelected(next); }} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="py-3 px-3 md:px-5 font-mono text-blue-600 font-semibold text-[10px]">{c.id}</td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm font-semibold ${txt}`}>{c.customerName}</p>
                        <p className={`text-xs ${sub}`}>{c.phone}</p>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-900"}`}>{c.country}</p>
                        <p className={`text-xs ${sub}`}>{c.jobType}</p>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(c.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {getStageLabel(c.status)}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityColor(c.priority)}`}>{c.priority}</span>
                      </td>
                      <td className={`py-3 px-3 md:px-5 text-sm ${sub}`}>{c.agentName}</td>
                      <td className="py-3 px-3 md:px-5">
                        <p className={`text-sm font-semibold ${txt}`}>PKR {c.paidAmount.toLocaleString()}</p>
                        <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((c.paidAmount / c.totalFee) * 100, 100)}%` }} />
                        </div>
                      </td>
                      <td className="py-3 px-3 md:px-5">
                        <div className="flex gap-1">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`tel:${c.phone}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                            <Phone className="w-4 h-4" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`); toast.info(`Opening WhatsApp for ${c.customerName}`); }} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                            <MessageCircle className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCases.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
                <p className={sub}>No cases found matching your criteria</p>
              </div>
            )}
            {filteredCases.length > 25 && (
              <div className={`p-4 border-t text-center ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <p className={`text-sm ${sub}`}>Showing 25 of {filteredCases.length} cases</p>
              </div>
            )}
          </motion.div>
        </main>

      {/* ========== NEW CASE MODAL (Extracted) ========== */}
      <NewCaseModal
        isOpen={showNewCaseModal}
        onClose={() => setShowNewCaseModal(false)}
        adminName={adminName}
        onSuccess={loadCases}
      />

      <CaseDetailModal
        isOpen={showCaseDetail}
        onClose={() => setShowCaseDetail(false)}
        caseData={selectedCase}
        adminName={adminName}
        isMasterAdmin={isMasterAdmin}
        onSuccess={loadCases}
      />

      {/* ========== PAYMENT CONFIRMATION MODAL ========== */}
      {selectedCase && (
        <PaymentConfirmationModal
          caseData={selectedCase}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={(updatedCase) => {
            setSelectedCase(updatedCase);
            NotificationService.notifyPaymentReceived(updatedCase.id, updatedCase.paidAmount, updatedCase.customerName);
            loadCases();
          }}
        />
      )}


      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onClose={() => { setLightboxSrc(null); setLightboxAlt(""); }}
      />
      <BulkStatusChangeModal
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        selectedIds={bulkSelected}
        onSuccess={() => {
          setBulkSelected(new Set());
          setBulkMode(false);
          loadCases();
        }}
      />


      {/* ========== CANCELLATION / REOPEN MODAL ========== */}
      {showCancelModal && selectedCase && (
        <CancellationReopenModal
          caseData={selectedCase}
          darkMode={dc}
          isUrdu={isUrdu}
          userName={adminName}
          userId={isMasterAdmin ? "master_admin" : "admin"}
          onClose={() => setShowCancelModal(false)}
          onUpdate={async () => {
            await loadCases();
            const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
            const refreshed = data ? mapSupabaseCaseToLocal(data) : null;
            if (refreshed) setSelectedCase(refreshed);
          }}
        />
      )}

      {/* ========== ADD STAFF MODAL ========== */}
      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        darkMode={dc}
        isUrdu={isUrdu}
        createdBy={adminName}
        createdByRole={isMasterAdmin ? "master_admin" : "admin"}
        onCreated={loadCases}
      />

    </div>
  );
}