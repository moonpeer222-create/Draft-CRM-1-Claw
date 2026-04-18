import { readExportFile } from "../../lib/storageQuota";
import { ImportPreviewModal } from "../../components/ImportPreviewModal";
import {
  Database, HardDrive, History, Shield, CalendarDays, Settings,
  Download, Upload, Clock, CheckCircle, AlertTriangle, Trash2,
  RefreshCw, FileText, Archive, Cloud, Loader2, ChevronRight,
  ToggleLeft, ToggleRight, Info, Eye, FolderOpen,
  CheckCircle2, XCircle, Mail, Zap, Send, BarChart3,
} from "lucide-react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, tabContent } from "../../lib/animations";
import { backupApi } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

// ---- Types ----

interface BackupSettings {
  enabled: boolean;
  time: string;
  format: string;
  recipients: string[];
  selectedContent: string[];
  autoDelete90Days: boolean;
}

interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  status: "success" | "failed";
  error?: string;
  sizeKB: string;
  format: string;
  recipients: string[];
  contentTypes: string[];
  totalCases?: number;
  newCasesToday?: number;
  backupType?: string;
}

// ---- Constants ----

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  time: "02:00",
  format: "json",
  recipients: ["moonpeer222@gmail.com"],
  selectedContent: ["cases", "payments", "documents", "activity", "attendance"],
  autoDelete90Days: true,
};

const CONTENT_OPTIONS = [
  { id: "cases", label: "All Cases Data", labelUrdu: "تمام کیسز کا ڈیٹا", icon: Database },
  { id: "payments", label: "Payment Records", labelUrdu: "ادائیگیوں کا ریکارڈ", icon: HardDrive },
  { id: "documents", label: "Documents (metadata)", labelUrdu: "کاغذات کی فہرست", icon: Database },
  { id: "activity", label: "Activity Log", labelUrdu: "سرگرمیوں کا ریکارڈ", icon: History },
  { id: "vendors", label: "Vendor Transactions", labelUrdu: "وینڈر کے لین دین", icon: Database },
  { id: "medical", label: "Medical Results", labelUrdu: "میڈیکل رزلٹ", icon: Database },
  { id: "protector", label: "Protector Records", labelUrdu: "پروٹیکٹر ریکارڈ", icon: Shield },
  { id: "attendance", label: "Attendance Logs", labelUrdu: "حاضری کا ریکارڈ", icon: CalendarDays },
] as const;

const BACKUP_TYPES = [
  { id: "auto" as const, emoji: "🔄" },
  { id: "daily" as const, emoji: "📊" },
  { id: "weekly" as const, emoji: "📆" },
  { id: "monthly" as const, emoji: "📅" },
] as const;

const SCHEDULE_TIERS = [
  { type: "daily" as const, gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50 border-blue-200", bgDark: "bg-blue-900/20 border-blue-700/40" },
  { type: "weekly" as const, gradient: "from-cyan-500 to-cyan-600", bg: "bg-cyan-50 border-cyan-200", bgDark: "bg-cyan-900/20 border-cyan-700/40" },
  { type: "monthly" as const, gradient: "from-purple-500 to-purple-600", bg: "bg-purple-50 border-purple-200", bgDark: "bg-purple-900/20 border-purple-700/40" },
] as const;

// ---- Component ----

export function AdminBackup() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const dir = isUrdu ? "rtl" : "ltr";

  // Shared style tokens
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const itemBg = dc ? "bg-gray-700/50" : "bg-gray-50";
  const inputCls = `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[48px] text-base ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;

  // State
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "history">("dashboard");
  const [settings, setSettings] = useState<BackupSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "7" | "30">("all");
  const sendingProgressRef = useRef(0);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [selectedBackupType, setSelectedBackupType] = useState<"auto" | "daily" | "weekly" | "monthly">("auto");
  const [importPreviewData, setImportPreviewData] = useState<any>(null);
  const [brevoTestResult, setBrevoTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Computed values
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const autoResolvedType = dayOfMonth === lastDayOfMonth ? "monthly" : dayOfWeek === 5 ? "weekly" : "daily";
  const effectiveType = selectedBackupType === "auto" ? autoResolvedType : selectedBackupType;
  const isFullBackup = effectiveType === "weekly" || effectiveType === "monthly";

  // Stats
  const lastSuccessful = history.find((h) => h.status === "success");
  const successCount = history.filter((h) => h.status === "success").length;
  const failedCount = history.filter((h) => h.status === "failed").length;
  const totalStorageKB = history.reduce((sum, h) => sum + parseFloat(h.sizeKB || "0"), 0);
  const [localCasesCount, setLocalCasesCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { data, error } = await supabase.from('cases').select('*');
      setLocalCasesCount(error ? 0 : (data || []).map((r: any) => mapSupabaseCaseToLocal(r)).length);
    };
    fetchCount();
  }, []);

  const filteredHistory = history.filter((h) => {
    if (historyFilter === "all") return true;
    const days = parseInt(historyFilter);
    return new Date(h.timestamp).getTime() > Date.now() - days * 86400000;
  });

  // ---- Data Loading ----

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, historyRes] = await Promise.all([
        backupApi.getSettings(),
        backupApi.getHistory(),
      ]);
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
      if (historyRes.success && historyRes.data) setHistory(historyRes.data as BackupHistoryEntry[]);
    } catch (err) {
      console.error("Failed to load backup data:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- Handlers ----

  const handleSaveSettings = async () => {
    const lt = toast.loading(isUrdu ? "ترتیبات محفوظ ہو رہی ہیں..." : "Saving settings...");
    const res = await backupApi.saveSettings(settings);
    toast.dismiss(lt);
    res.success
      ? toast.success(isUrdu ? "ترتیبات محفوظ ہو گئیں!" : "Settings saved!")
      : toast.error(res.error || "Failed to save");
  };

  const handleSendNow = async () => {
    if (!settings.recipients.length) {
      toast.error(isUrdu ? "براہ کرم وصول کنندہ ای میل شامل کریں" : "Add at least one recipient");
      return;
    }
    setIsSending(true);
    setSendingProgress(0);
    sendingProgressRef.current = 0;

    const interval = setInterval(() => {
      sendingProgressRef.current = Math.min(sendingProgressRef.current + Math.random() * 15, 90);
      setSendingProgress(sendingProgressRef.current);
    }, 500);

    const lt = toast.loading(isUrdu ? "بیک اپ بھیجا جا رہا ہے..." : "Sending backup...");
    try {
      const res = await backupApi.sendNow({
        recipients: settings.recipients,
        selectedContent: settings.selectedContent,
        format: settings.format,
        backupType: selectedBackupType,
      });
      clearInterval(interval);
      setSendingProgress(100);
      toast.dismiss(lt);

      if (res.success) {
        toast.success(isUrdu ? `بیک اپ بھیجا گیا! (${res.data?.sizeKB} KB)` : `Backup sent! (${res.data?.sizeKB} KB)`);
        const historyRes = await backupApi.getHistory();
        if (historyRes.success && historyRes.data) setHistory(historyRes.data as BackupHistoryEntry[]);
      } else {
        toast.error(res.error || "Failed to send backup");
      }
    } catch (err) {
      clearInterval(interval);
      toast.dismiss(lt);
      toast.error(`Backup error: ${err}`);
    }
    setTimeout(() => { setIsSending(false); setSendingProgress(0); }, 1000);
  };

  const handleTestBrevo = async () => {
    setIsTesting(true);
    setBrevoTestResult(null);
    const lt = toast.loading(isUrdu ? "بریو ٹیسٹ ہو رہا ہے..." : "Testing Brevo...");
    try {
      const res = await backupApi.testBrevo(settings.recipients[0] || "");
      toast.dismiss(lt);
      if (res.success && res.data) {
        setBrevoTestResult(res.data);
        const d = res.data.diagnosis;
        d === "ALL_OK"
          ? toast.success(isUrdu ? "بریو کام کر رہا ہے!" : "Brevo is working!")
          : d === "SENDER_NOT_VERIFIED"
            ? toast.error(isUrdu ? "بھیجنے والی ای میل تصدیق نہیں ہوئی" : "Sender not verified")
            : d === "NO_CREDITS"
              ? toast.error(isUrdu ? "ای میل کریڈٹس ختم" : "No email credits")
              : toast.error(res.error || "Test failed");
      } else {
        setBrevoTestResult({ diagnosis: "ERROR", error: res.error });
        toast.error(res.error || "Brevo test failed");
      }
    } catch (err) {
      toast.dismiss(lt);
      setBrevoTestResult({ diagnosis: "ERROR", error: String(err) });
      toast.error(`Test error: ${err}`);
    }
    setIsTesting(false);
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    const res = await backupApi.deleteHistoryEntry(id);
    if (res.success) {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success(isUrdu ? "اندراج حذف ہو گیا" : "Entry deleted");
    }
  };

  const handleCleanup = async () => {
    const lt = toast.loading(isUrdu ? "صاف ہو رہا ہے..." : "Cleaning up...");
    const res = await backupApi.cleanup();
    toast.dismiss(lt);
    if (res.success) {
      toast.success(isUrdu ? `${res.data?.removed || 0} پرانے حذف ہوئے` : `${res.data?.removed || 0} old entries removed`);
      loadData();
    }
  };

  const handleAddEmail = () => {
    const email = newEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(isUrdu ? "درست ای میل درج کریں" : "Enter a valid email");
      return;
    }
    if (settings.recipients.includes(email)) {
      toast.warning(isUrdu ? "یہ ای میل پہلے سے موجود ہے" : "Already added");
      return;
    }
    setSettings((s) => ({ ...s, recipients: [...s.recipients, email] }));
    setNewEmail("");
  };

  const toggleContent = (id: string) => {
    setSettings((s) => ({
      ...s,
      selectedContent: s.selectedContent.includes(id)
        ? s.selectedContent.filter((c) => c !== id)
        : [...s.selectedContent, id],
    }));
  };

  const handleFileRestore = () => {
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
        toast.error(isUrdu ? `فائل خرابی: ${err}` : `File error: ${err}`);
      }
    };
    input.click();
  };

  // ---- Urdu labels helper ----
  const u = (en: string, ur: string) => isUrdu ? ur : en;

  // ---- Shared sub-components ----

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${value ? "bg-blue-600" : dc ? "bg-gray-600" : "bg-gray-300"}`}
      aria-label={label}
    >
      <motion.div
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
        animate={{ x: value ? 24 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
      status === "success"
        ? dc ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-700"
        : dc ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
    }`}>
      {status === "success" ? <><CheckCircle2 className="w-3 h-3" /> {u("Success", "کامیاب")}</> : <><XCircle className="w-3 h-3" /> {u("Failed", "ناکام")}</>}
    </span>
  );

  // Improvement #19: Fixed backup type labels to show proper names
  const BackupTypeBadge = ({ type }: { type?: string }) => {
    if (!type) return null;
    const labels: Record<string, string> = {
      daily: u("Daily", "روزانہ"),
      weekly: u("Weekly", "ہفتہ وار"),
      monthly: u("Monthly", "ماہانہ"),
      auto: u("Auto", "خودکار"),
      "auto-export": u("Auto Export", "خودکار ایکسپورٹ"),
    };
    const colors = type === "monthly"
      ? dc ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700"
      : type === "weekly"
        ? dc ? "bg-cyan-900/30 text-cyan-400" : "bg-cyan-100 text-cyan-700"
        : type === "auto-export"
          ? dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
          : dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700";
    return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${colors}`}>{labels[type] || type}</span>;
  };

  // ---- Tabs ----

  const tabs = [
    { id: "dashboard" as const, label: u("Dashboard", "ڈیش بورڈ"), icon: Database },
    { id: "settings" as const, label: u("Settings", "ترتیبات"), icon: Settings },
    { id: "history" as const, label: u("History", "تاریخچہ"), icon: History },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`} dir={dir}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
          {/* ---- Page Header ---- */}
          <motion.div {...tabContent} className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className={`text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2 ${txt}`}>
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  {u("Data Backup", "ڈیٹا بیک اپ")}
                </h1>
                <p className={`text-xs sm:text-sm mt-0.5 ${sub}`}>
                  {u("Automated backup & Brevo email", "خودکار بیک اپ اور بریو ای میل")}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSendNow}
                disabled={isSending}
                className={`flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold shadow-lg w-full sm:w-auto transition-all ${
                  isSending
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-700 active:to-indigo-700 text-white"
                }`}
              >
                {isSending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> {u("Sending...", "بھیجا جا رہا ہے...")}</>
                  : <><Send className="w-4 h-4" /> {u("Send Backup Now", "ابھی بیک اپ بھیجیں")}</>
                }
              </motion.button>
            </div>

            {/* Progress bar */}
            <AnimatePresence>
              {isSending && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3">
                  <div className={`rounded-xl p-3 ${dc ? "bg-gray-800 border-gray-700" : "bg-blue-50 border-blue-200"} border`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-medium ${dc ? "text-blue-400" : "text-blue-700"}`}>
                        {u("Progress", "پیشرفت")}
                      </span>
                      <span className={`text-xs font-bold ${dc ? "text-blue-400" : "text-blue-700"}`}>
                        {Math.round(sendingProgress)}%
                      </span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full ${dc ? "bg-gray-700" : "bg-blue-200"}`}>
                      <motion.div
                        className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        animate={{ width: `${sendingProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ---- Tabs ---- */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide" dir="ltr">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-xl whitespace-nowrap text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-md"
                      : `${card} ${dc ? "text-gray-300" : "text-gray-600"} border ${brd}`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* ============== DASHBOARD TAB ============== */}
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div key="dashboard" {...tabContent} className="space-y-3 sm:space-y-4">

                {/* Status Cards */}
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                  {[
                    {
                      icon: CheckCircle2, iconColor: "text-emerald-500",
                      label: u("Last Successful", "آخری کامیاب"),
                      value: lastSuccessful
                        ? new Date(lastSuccessful.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : u("None", "کوئی نہیں"),
                      sub: lastSuccessful ? `${lastSuccessful.sizeKB} KB` : "",
                    },
                    {
                      icon: Database, iconColor: "text-blue-500",
                      label: u("Total Backups", "کل بیک اپ"),
                      value: `${successCount}`,
                      sub: `${failedCount} ${u("failed", "ناکام")}`,
                    },
                    {
                      icon: HardDrive, iconColor: "text-purple-500",
                      label: u("Storage", "ذخیرے"),
                      value: `${(totalStorageKB / 1024).toFixed(1)} MB`,
                      sub: `${history.length} ${u("entries", "اندراجات")}`,
                    },
                    {
                      icon: Mail, iconColor: "text-indigo-500",
                      label: u("Recipients", "وصول کنندگان"),
                      value: `${settings.recipients.length}`,
                      sub: settings.recipients[0] || "",
                    },
                  ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div key={idx} variants={staggerItem} className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                          <span className={`text-[10px] sm:text-xs font-medium ${sub}`}>{stat.label}</span>
                        </div>
                        <p className={`text-base sm:text-lg font-bold ${txt} truncate`}>{stat.value}</p>
                        {stat.sub && <p className={`text-[10px] sm:text-xs mt-0.5 truncate ${sub}`}>{stat.sub}</p>}
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Brevo Diagnostic */}
                <motion.div variants={staggerItem} className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className={`text-sm sm:text-base font-semibold flex items-center gap-2 ${txt}`}>
                      <Mail className="w-4 h-4 text-blue-600" />
                      {u("Brevo Email Test", "بریو ای میل ٹیسٹ")}
                    </h3>
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={handleTestBrevo}
                      disabled={isTesting}
                      className={`flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-all ${
                        isTesting
                          ? "bg-gray-400 text-white cursor-not-allowed"
                          : "bg-emerald-600 text-white active:bg-emerald-700"
                      }`}
                    >
                      {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {isTesting ? u("Testing...", "ٹیسٹ...") : u("Test", "ٹیسٹ")}
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {brevoTestResult && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`rounded-lg p-3 border text-sm ${
                          brevoTestResult.diagnosis === "ALL_OK"
                            ? dc ? "bg-emerald-900/20 border-emerald-700/40" : "bg-emerald-50 border-emerald-200"
                            : brevoTestResult.diagnosis === "KEY_INVALID" || brevoTestResult.diagnosis === "ERROR"
                              ? dc ? "bg-red-900/20 border-red-700/40" : "bg-red-50 border-red-200"
                              : dc ? "bg-amber-900/20 border-amber-700/40" : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <div className="font-semibold text-xs mb-1">
                          {brevoTestResult.diagnosis === "ALL_OK"
                            ? <span className="text-emerald-600">✅ {u("Brevo is working!", "بریو کام کر رہا ہے!")}</span>
                            : brevoTestResult.diagnosis === "SENDER_NOT_VERIFIED"
                              ? <span className="text-amber-600">⚠️ {u("Sender not verified", "بھیجنے والی تصدیق نہیں")}</span>
                              : brevoTestResult.diagnosis === "NO_CREDITS"
                                ? <span className="text-amber-600">⚠️ {u("No credits", "کریڈٹس ختم")}</span>
                                : <span className="text-red-600">❌ {u("Failed", "ناکام")}</span>
                          }
                        </div>
                        {brevoTestResult.fix && (
                          <p className={`text-[10px] sm:text-xs ${dc ? "text-gray-300" : "text-gray-600"}`}>
                            💡 {brevoTestResult.fix}
                          </p>
                        )}
                        {brevoTestResult.keyValid && (
                          <div className={`grid grid-cols-2 gap-1.5 text-[10px] mt-2 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                            <div>🔑 <code className={`px-1 rounded ${dc ? "bg-gray-700" : "bg-gray-200"}`}>{brevoTestResult.keyPreview}</code></div>
                            <div>📨 {brevoTestResult.senderVerified ? "✅" : "❌"} Sender</div>
                            <div>💳 Credits: {brevoTestResult.credits}</div>
                            {brevoTestResult.testEmailStatus !== "skipped" && (
                              <div>📤 Test: {brevoTestResult.testEmailStatus === "sent" ? "✅" : "❌"}</div>
                            )}
                          </div>
                        )}
                        {brevoTestResult.error && !brevoTestResult.keyValid && (
                          <p className="text-[10px] text-red-500 mt-1">{brevoTestResult.error}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Schedule & Type Selector */}
                <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <h3 className={`text-sm sm:text-base font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    {u("Schedule & Type", "شیڈول اور قسم")}
                  </h3>

                  {/* Schedule tiers */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {SCHEDULE_TIERS.map((tier) => {
                      const isActive = effectiveType === tier.type;
                      const labels = {
                        daily: { name: u("Daily", "روزانہ"), desc: u("Summary report", "خلاصہ رپورٹ"), sched: u("Every day", "ہر روز") },
                        weekly: { name: u("Weekly", "ہفتہ وار"), desc: u("Full backup + JSON", "مکمل + JSON"), sched: u("Friday", "جمعہ") },
                        monthly: { name: u("Monthly", "ماہانہ"), desc: u("Full backup + JSON", "مکمل + JSON"), sched: u("Last day", "آخری دن") },
                      }[tier.type];
                      return (
                        <div
                          key={tier.type}
                          className={`relative rounded-xl p-2.5 sm:p-3 border-2 transition-all ${
                            isActive
                              ? dc ? `${tier.bgDark} ring-1 ring-white/10` : `${tier.bg} ring-1 ring-blue-300/30`
                              : dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          {isActive && (
                            <span className={`absolute -top-2 ${isUrdu ? "left-2" : "right-2"} text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white bg-gradient-to-r ${tier.gradient}`}>
                              {u("TODAY", "آج")}
                            </span>
                          )}
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-r ${tier.gradient} mb-1.5`}>
                            <BarChart3 className="w-3 h-3 text-white" />
                          </div>
                          <p className={`text-xs font-bold ${txt}`}>{labels.name}</p>
                          <p className={`text-[10px] ${sub} leading-tight mt-0.5`}>{labels.sched}</p>
                          <p className={`text-[10px] ${sub} leading-tight hidden sm:block`}>{labels.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual type override */}
                  <div className={`p-2.5 rounded-lg border ${dc ? "bg-gray-700/30 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className={`text-xs font-semibold mb-2 ${txt}`}>
                      {u("Override Type", "قسم منتخب کریں")}
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      {BACKUP_TYPES.map((opt) => (
                        <motion.button
                          key={opt.id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setSelectedBackupType(opt.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium min-h-[36px] whitespace-nowrap transition-all ${
                            selectedBackupType === opt.id
                              ? "bg-blue-600 text-white shadow-sm"
                              : dc ? "bg-gray-600 text-gray-300" : "bg-white text-gray-700 border border-gray-200"
                          }`}
                        >
                          {opt.emoji} {opt.id === "auto" ? u(`Auto (${autoResolvedType})`, "خودکار") : u(opt.id.charAt(0).toUpperCase() + opt.id.slice(1), opt.id === "daily" ? "روزانہ" : opt.id === "weekly" ? "ہفتہ وار" : "ماہانہ")}
                        </motion.button>
                      ))}
                    </div>

                    {/* Info badge */}
                    <div className={`mt-2 p-2 rounded-lg text-[10px] sm:text-xs ${
                      isFullBackup
                        ? dc ? "bg-green-900/20 text-green-400 border border-green-800/30" : "bg-green-50 text-green-700 border border-green-200"
                        : dc ? "bg-blue-900/20 text-blue-400 border border-blue-800/30" : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                      {isFullBackup
                        ? u("📦 Full data backup with JSON", "📦 مکمل ڈیٹا بیک اپ JSON کے ساتھ")
                        : u("📊 Summary report — lightweight", "📊 خلاصہ رپورٹ — ہلکا")}
                    </div>
                  </div>
                </div>

                {/* Quick Settings + Recent History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Quick Settings */}
                  <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                    <h3 className={`text-sm sm:text-base font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                      <Zap className="w-4 h-4 text-blue-600" />
                      {u("Quick Settings", "فوری ترتیبات")}
                    </h3>
                    <div className="space-y-3">
                      {/* Enable toggle */}
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-xs sm:text-sm font-semibold ${txt}`}>{u("Auto Backup", "خودکار بیک اپ")}</p>
                          <p className={`text-[10px] sm:text-xs ${sub}`}>{u("Send automatically", "خودکار طور پر بھیجیں")}</p>
                        </div>
                        <Toggle value={settings.enabled} onChange={() => {
                          setSettings((s) => ({ ...s, enabled: !s.enabled }));
                          toast.info(settings.enabled ? u("Backup disabled", "بیک اپ غیر فعال") : u("Backup enabled", "بیک اپ فعال"));
                        }} label={u("Toggle backup", "بیک اپ ٹوگل")} />
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-xs sm:text-sm font-semibold ${txt}`}>{u("Schedule Time", "شیڈول وقت")}</p>
                        <input
                          type="time"
                          value={settings.time}
                          onChange={(e) => setSettings((s) => ({ ...s, time: e.target.value }))}
                          className={`px-2.5 py-1.5 border rounded-lg text-sm min-h-[36px] ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                        />
                      </div>

                      {/* Format */}
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-xs sm:text-sm font-semibold ${txt}`}>{u("Format", "فارمیٹ")}</p>
                        <select
                          value={settings.format}
                          onChange={(e) => setSettings((s) => ({ ...s, format: e.target.value }))}
                          className={`px-2.5 py-1.5 border rounded-lg text-sm min-h-[36px] ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                        >
                          <option value="json">JSON</option>
                          <option value="csv">CSV</option>
                          <option value="pdf">PDF</option>
                        </select>
                      </div>

                      {/* Data count */}
                      <div className={`p-2.5 rounded-lg ${dc ? "bg-gray-700/50" : "bg-blue-50"} border ${dc ? "border-gray-600" : "border-blue-200"}`}>
                        <p className={`text-[10px] sm:text-xs ${dc ? "text-blue-400" : "text-blue-700"}`}>
                          <strong>{localCasesCount}</strong> {u("cases", "کیسز")} | <strong>{settings.selectedContent.length}</strong> {u("types", "اقسام")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recent History */}
                  <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-sm sm:text-base font-semibold flex items-center gap-2 ${txt}`}>
                        <History className="w-4 h-4 text-blue-600" />
                        {u("Recent", "حالیہ")}
                      </h3>
                      <button onClick={() => setActiveTab("history")} className="text-blue-600 text-xs font-semibold">
                        {u("View All →", "مزید →")}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {history.length === 0 ? (
                        <p className={`text-xs text-center py-6 ${sub}`}>{u("No backups yet", "ابھی کوئی بیک اپ نہیں")}</p>
                      ) : (
                        history.slice(0, 5).map((entry) => (
                          <div key={entry.id} className={`flex items-center gap-2.5 p-2 rounded-lg ${itemBg}`}>
                            {entry.status === "success"
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] sm:text-xs font-medium truncate ${txt}`}>
                                {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <p className={`text-[9px] sm:text-[10px] truncate ${sub}`}>{entry.sizeKB} KB | {entry.format.toUpperCase()}</p>
                            </div>
                            <StatusBadge status={entry.status} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Recipients */}
                <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <h3 className={`text-sm sm:text-base font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                    <Mail className="w-4 h-4 text-blue-600" />
                    {u("Recipients", "وصول کنندہ ای میلز")}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {settings.recipients.map((email) => (
                      <motion.span
                        key={email}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-medium ${
                          dc ? "bg-blue-900/30 text-blue-400 border border-blue-800/30" : "bg-blue-100 text-blue-700 border border-blue-200"
                        }`}
                      >
                        <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="max-w-[140px] sm:max-w-none truncate">{email}</span>
                        <button onClick={() => setSettings((s) => ({ ...s, recipients: s.recipients.filter((e) => e !== email) }))} className="p-0.5 hover:text-red-500 min-w-[14px]">
                          <XCircle className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                      placeholder={u("Add email", "ای میل شامل کریں")}
                      className={inputCls}
                      dir="ltr"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleAddEmail}
                      className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium min-h-[48px] whitespace-nowrap active:bg-blue-700"
                    >
                      {u("Add", "شامل")}
                    </motion.button>
                  </div>
                </div>

                {/* Restore from Backup */}
                <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <h3 className={`text-sm sm:text-base font-semibold mb-1.5 flex items-center gap-2 ${txt}`}>
                    <Upload className="w-4 h-4 text-emerald-600" />
                    {u("Restore from Backup", "بیک اپ سے بحال کریں")}
                  </h3>
                  <p className={`text-[10px] sm:text-xs mb-3 ${sub}`}>
                    {u("Upload JSON export file to restore data", "ڈیٹا بحال کرنے کیلئے JSON فائل اپلوڈ کریں")}
                  </p>
                  <div className={`p-4 rounded-xl border-2 border-dashed text-center ${dc ? "border-gray-600 bg-gray-700/30" : "border-gray-300 bg-gray-50"}`}>
                    <Upload className={`w-6 h-6 mx-auto mb-1.5 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleFileRestore}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium min-h-[44px] active:bg-emerald-700"
                    >
                      <Upload className="w-4 h-4" />
                      {u("Select File", "فائل منتخب کریں")}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============== SETTINGS TAB ============== */}
            {activeTab === "settings" && (
              <motion.div key="settings" {...tabContent} className="space-y-3 sm:space-y-4">
                {/* Content Selection */}
                <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm sm:text-base font-semibold flex items-center gap-2 ${txt}`}>
                      <Database className="w-4 h-4 text-blue-600" />
                      {u("Backup Content", "بیک اپ مواد")}
                    </h3>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setSettings((s) => ({ ...s, selectedContent: CONTENT_OPTIONS.map((o) => o.id) }))}
                        className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border ${dc ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-700"}`}
                      >
                        {u("All", "سب")}
                      </button>
                      <button
                        onClick={() => setSettings((s) => ({ ...s, selectedContent: [] }))}
                        className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border ${dc ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-700"}`}
                      >
                        {u("None", "کوئی نہیں")}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {CONTENT_OPTIONS.map((option) => {
                      const isSelected = settings.selectedContent.includes(option.id);
                      const Icon = option.icon;
                      return (
                        <motion.button
                          key={option.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => toggleContent(option.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-start min-h-[40px] ${
                            isSelected
                              ? dc ? "bg-blue-900/20 border-blue-700/40 text-blue-400" : "bg-blue-50 border-blue-300 text-blue-700"
                              : dc ? "bg-gray-700/30 border-gray-700 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-blue-600 border-blue-600" : dc ? "border-gray-500" : "border-gray-300"
                          }`}>
                            {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs font-medium">{isUrdu ? option.labelUrdu : option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Security */}
                <div className={`${card} rounded-xl p-3 sm:p-4 border ${brd}`}>
                  <h3 className={`text-sm sm:text-base font-semibold mb-3 flex items-center gap-2 ${txt}`}>
                    <Shield className="w-4 h-4 text-blue-600" />
                    {u("Security", "سیکورٹی")}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs sm:text-sm font-semibold ${txt}`}>{u("Auto-delete 90 days", "90 دن بعد خودکار حذف")}</p>
                        <p className={`text-[10px] sm:text-xs ${sub}`}>{u("Clean old backups", "پرانے بیک اپ صاف")}</p>
                      </div>
                      <Toggle
                        value={settings.autoDelete90Days}
                        onChange={() => setSettings((s) => ({ ...s, autoDelete90Days: !s.autoDelete90Days }))}
                        label={u("Toggle auto-delete", "خودکار حذف ٹوگل")}
                      />
                    </div>
                  </div>
                </div>

                {/* Save */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSaveSettings}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[48px] active:bg-blue-700 shadow-lg"
                >
                  <Settings className="w-4 h-4" />
                  {u("Save Settings", "ترتیبات محفوظ کریں")}
                </motion.button>
              </motion.div>
            )}

            {/* ============== HISTORY TAB ============== */}
            {activeTab === "history" && (
              <motion.div key="history" {...tabContent}>
                {/* Filters + Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex gap-1.5">
                    {([
                      { id: "7" as const, label: u("7D", "7 دن") },
                      { id: "30" as const, label: u("30D", "30 دن") },
                      { id: "all" as const, label: u("All", "سب") },
                    ]).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setHistoryFilter(f.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-[32px] transition-all ${
                          historyFilter === f.id
                            ? "bg-blue-600 text-white"
                            : `${dc ? "bg-gray-800 text-gray-400" : "bg-white text-gray-600"} border ${brd}`
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={loadData} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border min-h-[32px] ${dc ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-600"}`}>
                      <RefreshCw className="w-3 h-3" /> {u("Refresh", "تازہ")}
                    </button>
                    <button onClick={handleCleanup} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border min-h-[32px] ${dc ? "border-red-800/40 text-red-400" : "border-red-200 text-red-600"}`}>
                      <Trash2 className="w-3 h-3" /> {u("Clean", "صاف")}
                    </button>
                  </div>
                </div>

                <div className={`${card} rounded-xl border ${brd} overflow-hidden`}>
                  {filteredHistory.length === 0 ? (
                    <div className="p-8 text-center">
                      <Database className={`w-10 h-10 mx-auto mb-2 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                      <p className={`text-sm font-medium ${txt}`}>{u("No history", "کوئی تاریخچہ نہیں")}</p>
                      <p className={`text-xs mt-1 ${sub}`}>{u("Send a backup first", "پہلا بیک اپ بھیجیں")}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredHistory.map((entry, idx) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                          className={`p-3 sm:p-4 transition-colors ${dc ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}
                        >
                          {/* Row 1: Date + Status */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`text-xs sm:text-sm font-semibold ${txt}`}>
                                  {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                                <BackupTypeBadge type={entry.backupType} />
                              </div>
                              <p className={`text-[10px] sm:text-xs ${sub}`}>
                                {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                {entry.totalCases != null && ` | ${entry.totalCases} ${u("cases", "کیسز")}`}
                              </p>
                            </div>
                            <StatusBadge status={entry.status} />
                          </div>

                          {/* Row 2: Details */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                              <span className={sub}>{entry.sizeKB} KB</span>
                              <span className={`px-1.5 py-0.5 rounded ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                                {entry.format.toUpperCase()}
                              </span>
                              <span className={`${sub} hidden sm:inline truncate max-w-[200px]`}>
                                {(entry.recipients || []).join(", ")}
                              </span>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeleteHistoryEntry(entry.id)}
                              className={`p-1.5 rounded-lg min-w-[28px] min-h-[28px] flex items-center justify-center ${dc ? "text-red-400 hover:bg-red-900/20" : "text-red-500 hover:bg-red-50"}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>

                          {/* Error message if failed */}
                          {entry.status === "failed" && entry.error && (
                            <p className={`text-[10px] mt-1.5 px-2 py-1 rounded ${dc ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`}>
                              {entry.error}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Import Preview Modal */}
      {importPreviewData && (
        <ImportPreviewModal
          exportJson={importPreviewData}
          onClose={() => setImportPreviewData(null)}
          onImported={() => {
            setImportPreviewData(null);
            toast.success(isUrdu ? "ڈیٹا بحال ہو گیا!" : "Data restored!");
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      )}
    </div>
  );
}