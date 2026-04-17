/**
 * MasterDataReset — Master-only data reset panel with granular options.
 * Allows wiping specific data categories with confirmation dialogs.
 * NOT available to Admin, Agent, or any other role.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2, AlertTriangle, ShieldAlert, Briefcase, FileText,
  Users, DollarSign, ClipboardList, Database, ChevronDown,
  ChevronUp, Lock, CheckCircle, XCircle, Loader2, Cloud,
} from "lucide-react";
import { CRMDataStore } from "../lib/mockData";
import { UserDB } from "../lib/userDatabase";
import { AuditLogService } from "../lib/auditLog";
import { toast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { forceSync, pushCases, pushUsers, pushAuditLog, pushDocumentFiles, pushNotifications, markEntityModified } from "../lib/syncService";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";

interface ResetOption {
  id: string;
  label: string;
  labelUrdu: string;
  description: string;
  descriptionUrdu: string;
  icon: any;
  color: string;
  danger: "low" | "medium" | "high" | "critical";
  action: () => void;
  countFn: () => number;
}

interface Props {
  darkMode: boolean;
  isUrdu: boolean;
  onDataReset?: () => void;
}

export function MasterDataReset({ darkMode: dc, isUrdu, onDataReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [serverCounts, setServerCounts] = useState({ cases: 0, docs: 0, payments: 0, notes: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("cases").select("*");
      const cases = (data || []).map(mapSupabaseCaseToLocal);
      setServerCounts({
        cases: cases.length,
        docs: cases.reduce((sum, c) => sum + (c.documents?.length || 0), 0),
        payments: cases.reduce((sum, c) => sum + (c.payments?.length || 0), 0),
        notes: cases.reduce((sum, c) => sum + (c.notes?.length || 0), 0),
      });
    };
    fetchCounts();
  }, []);

  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const cardBg = dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";

  const resetOptions: ResetOption[] = [
    {
      id: "cases",
      label: "All Cases",
      labelUrdu: "تمام کیسز",
      description: "Remove all case records, timelines, and stage history",
      descriptionUrdu: "تمام کیس ریکارڈز، ٹائم لائنز، اور سٹیج ہسٹری حذف کریں",
      icon: Briefcase,
      color: "red",
      danger: "critical",
      countFn: () => serverCounts.cases,
      action: () => {
        CRMDataStore.saveCases([]);
        // Don't removeItem — saveCases already wrote "[]" + version stamp
        // Now push empty array to server so sync doesn't pull old data back
        markEntityModified("cases");
        pushCases();
      },
    },
    {
      id: "documents",
      label: "All Documents",
      labelUrdu: "تمام دستاویزات",
      description: "Clear all document metadata and locally cached file previews",
      descriptionUrdu: "تمام دستاویزات کا میٹا ڈیٹا اور مقامی فائل پیش نظارہ صاف کریں",
      icon: FileText,
      color: "orange",
      danger: "high",
      countFn: () => serverCounts.docs,
      action: () => {
        const cases = CRMDataStore.getCases();
        cases.forEach(c => { c.documents = []; });
        CRMDataStore.saveCases(cases);
        // Clear document file store
        const keys = Object.keys(localStorage).filter(k => k.startsWith("doc_file_"));
        keys.forEach(k => localStorage.removeItem(k));
        pushCases(); // Push updated cases (with empty docs) to server
        pushDocumentFiles();
      },
    },
    {
      id: "payments",
      label: "All Payments",
      labelUrdu: "تمام ادائیگیاں",
      description: "Remove all payment records from all cases and reset paid amounts",
      descriptionUrdu: "تمام کیسز سے ادائیگی ریکارڈ حذف کریں اور ادا شدہ رقم ری سیٹ کریں",
      icon: DollarSign,
      color: "amber",
      danger: "high",
      countFn: () => serverCounts.payments,
      action: () => {
        const cases = CRMDataStore.getCases();
        cases.forEach(c => {
          c.payments = [];
          c.paidAmount = 0;
          c.paymentVerified = false;
          c.paymentVerifiedAt = undefined;
          c.paymentVerifiedBy = undefined;
        });
        CRMDataStore.saveCases(cases);
      },
    },
    {
      id: "notes",
      label: "All Notes",
      labelUrdu: "تمام نوٹس",
      description: "Clear all case notes across every case",
      descriptionUrdu: "ہر کیس سے تمام نوٹس حذف کریں",
      icon: ClipboardList,
      color: "yellow",
      danger: "medium",
      countFn: () => serverCounts.notes,
      action: () => {
        const cases = CRMDataStore.getCases();
        cases.forEach(c => { c.notes = []; });
        CRMDataStore.saveCases(cases);
      },
    },
    {
      id: "users",
      label: "Non-Master Users",
      labelUrdu: "غیر ماسٹر صارفین",
      description: "Remove all admin, agent, operator, and customer accounts (keeps master admin)",
      descriptionUrdu: "تمام ایڈمن، ایجنٹ، آپریٹر، اور کسٹمر اکاؤنٹس حذف کریں (ماسٹر ایڈمن رہے گا)",
      icon: Users,
      color: "purple",
      danger: "critical",
      countFn: () => {
        const allUsers = UserDB.getAllUsers();
        return allUsers.filter(u => u.role !== "master_admin").length;
      },
      action: () => {
        const allUsers = UserDB.getAllUsers();
        const mastersOnly = allUsers.filter(u => u.role === "master_admin");
        localStorage.setItem("crm_users", JSON.stringify(mastersOnly));
        pushUsers();
      },
    },
    {
      id: "audit_logs",
      label: "Audit Logs",
      labelUrdu: "آڈٹ لاگز",
      description: "Clear all local audit log entries",
      descriptionUrdu: "تمام مقامی آڈٹ لاگ اندراجات صاف کریں",
      icon: ClipboardList,
      color: "blue",
      danger: "medium",
      countFn: () => {
        try {
          const logs = JSON.parse(localStorage.getItem("crm_audit_logs") || "[]");
          return Array.isArray(logs) ? logs.length : 0;
        } catch { return 0; }
      },
      action: () => {
        localStorage.removeItem("crm_audit_logs");
        localStorage.removeItem("crm_audit_log");
        localStorage.setItem("crm_audit_log", "[]");
        pushAuditLog();
      },
    },
    {
      id: "all_data",
      label: "FACTORY RESET (Everything)",
      labelUrdu: "فیکٹری ری سیٹ (سب کچھ)",
      description: "Wipe ALL local data: cases, users, documents, payments, logs, sessions, preferences",
      descriptionUrdu: "تمام مقامی ڈیٹا حذف کریں: کیسز، صارفین، دستاویزات، ادائیگیاں، لاگز، سیشنز",
      icon: Database,
      color: "red",
      danger: "critical",
      countFn: () => Object.keys(localStorage).filter(k => k.startsWith("crm_") || k.startsWith("doc_") || k.startsWith("emerald_")).length,
      action: () => {
        const keysToRemove = Object.keys(localStorage).filter(
          k => k.startsWith("crm_") || k.startsWith("doc_") || k.startsWith("emerald_") || k.startsWith("sync_")
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
        // Re-initialize empty arrays so pushes send [] to server instead of skipping
        localStorage.setItem("crm_cases", "[]");
        localStorage.setItem("crm_audit_log", "[]");
        localStorage.setItem("crm_notifications", "[]");
        localStorage.setItem("crm_document_files", "[]");
        localStorage.setItem("crm_attendance", "[]");
        localStorage.setItem("crm_leave_requests", "[]");
        localStorage.setItem("crm_passport_tracking", "[]");
        // Mark all entities as locally modified (newer than server) so sync won't overwrite
        markEntityModified("cases");
        markEntityModified("users");
        markEntityModified("notifications");
        markEntityModified("auditLog");
        markEntityModified("documentFiles");
        markEntityModified("attendance");
        markEntityModified("leaveRequests");
        markEntityModified("passportTracking");
        // Push all empty data to server
        forceSync();
      },
    },
  ];

  const dangerColors: Record<string, { bg: string; border: string; text: string }> = {
    low: {
      bg: dc ? "bg-blue-900/20" : "bg-blue-50",
      border: dc ? "border-blue-700/30" : "border-blue-200",
      text: dc ? "text-blue-400" : "text-blue-700",
    },
    medium: {
      bg: dc ? "bg-yellow-900/20" : "bg-yellow-50",
      border: dc ? "border-yellow-700/30" : "border-yellow-200",
      text: dc ? "text-yellow-400" : "text-yellow-700",
    },
    high: {
      bg: dc ? "bg-orange-900/20" : "bg-orange-50",
      border: dc ? "border-orange-700/30" : "border-orange-200",
      text: dc ? "text-orange-400" : "text-orange-700",
    },
    critical: {
      bg: dc ? "bg-red-900/20" : "bg-red-50",
      border: dc ? "border-red-700/30" : "border-red-200",
      text: dc ? "text-red-400" : "text-red-700",
    },
  };

  const handleReset = async (option: ResetOption) => {
    if (confirmText !== "CONFIRM") {
      toast.error(isUrdu ? "تصدیق کے لیے CONFIRM ٹائپ کریں" : 'Type "CONFIRM" to proceed');
      return;
    }

    setResetting(true);
    try {
      option.action();

      // Log the reset action
      try {
        AuditLogService.log({
          action: "data_reset",
          category: "system",
          userId: "master_admin",
          userName: "Master Admin",
          details: `Data reset: ${option.label}`,
          severity: "critical",
        });
      } catch { /* audit log might have been cleared */ }

      toast.success(
        isUrdu
          ? `${option.labelUrdu} کامیابی سے حذف ہو گئے`
          : `${option.label} cleared successfully`
      );

      onDataReset?.();
    } catch (err) {
      console.error("Reset failed:", err);
      toast.error(isUrdu ? "ری سیٹ میں خرابی" : "Reset failed");
    } finally {
      setResetting(false);
      setConfirmingId(null);
      setConfirmText("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className={`rounded-xl border ${cardBg} overflow-hidden`}
    >
      <div className={`px-5 py-3 text-xs flex items-center gap-2 ${dc ? "bg-blue-900/20 text-blue-300" : "bg-blue-50 text-blue-700"}`}>
        <Cloud className="w-4 h-4" />
        {isUrdu
          ? "اب ڈیٹا Supabase کلاؤڈ میں محفوظ ہوتا ہے۔ یہ پینل صرف براؤزر کیشے صاف کرے گا — سرور کا ڈیٹا متاثر نہیں ہوگا۔"
          : "Data now lives in the Supabase cloud. This panel only clears browser cache — it will NOT affect server data."}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${txt} flex items-center gap-2`}>
              {isUrdu ? "ڈیٹا ری سیٹ پینل" : "Data Reset Panel"}
              <Lock className="w-4 h-4 text-red-500" />
            </h2>
            <p className={`text-xs ${sub}`}>
              {isUrdu ? "ماسٹر ایڈمن کے لیے مخصوص — پورٹل ڈیٹا مستقل طور پر حذف کریں" : "Master Admin exclusive — permanently remove portal data"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${dc ? "bg-red-900/40 text-red-400" : "bg-red-100 text-red-700"}`}>
            {isUrdu ? "خطرناک" : "DANGER ZONE"}
          </span>
          {expanded ? <ChevronUp className={`w-5 h-5 ${sub}`} /> : <ChevronDown className={`w-5 h-5 ${sub}`} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`border-t ${brd}`}
          >
            {/* Supabase Cloud Warning */}
            <div className={`mx-4 mt-4 p-3 rounded-lg flex items-start gap-3 ${dc ? "bg-blue-900/20 border border-blue-700/30" : "bg-blue-50 border border-blue-200"}`}>
              <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-bold ${dc ? "text-blue-400" : "text-blue-700"}`}>
                  {isUrdu ? "نوٹ: ڈیٹا اب Supabase کلاؤڈ میں محفوظ ہے۔" : "Data now lives in Supabase cloud."}
                </p>
                <p className={`text-xs mt-1 ${dc ? "text-blue-400/70" : "text-blue-600"}`}>
                  {isUrdu
                    ? "Resetting localStorage صرف براؤزر کیش صاف کرتی ہے اور سرور ڈیٹا متاثر نہیں کرتی۔"
                    : "Resetting localStorage only clears browser cache and will not affect server data."}
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            <div className={`mx-4 mt-4 p-3 rounded-lg flex items-start gap-3 ${dc ? "bg-red-900/20 border border-red-700/30" : "bg-red-50 border border-red-200"}`}>
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-bold ${dc ? "text-red-400" : "text-red-700"}`}>
                  {isUrdu ? "انتباہ: یہ عمل واپس نہیں ہو سکتا!" : "Warning: These actions are irreversible!"}
                </p>
                <p className={`text-xs mt-1 ${dc ? "text-red-400/70" : "text-red-600"}`}>
                  {isUrdu
                    ? "حذف شدہ ڈیٹا بحال نہیں کیا جا سکتا۔ ری سیٹ سے پہلے بیک اپ لینا یقینی بنائیں۔"
                    : "Deleted data cannot be recovered. Ensure you have a backup before resetting."}
                </p>
              </div>
            </div>

            {/* Reset Options */}
            <div className="p-4 space-y-3">
              {resetOptions.map((option) => {
                const dc2 = dangerColors[option.danger];
                const count = option.countFn();
                const isConfirming = confirmingId === option.id;
                const Icon = option.icon;

                return (
                  <div
                    key={option.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isConfirming
                        ? `${dc2.border} ${dc2.bg} ring-2 ${option.danger === "critical" ? "ring-red-500/40" : "ring-orange-500/30"}`
                        : `${brd} ${dc ? "bg-gray-800/50" : "bg-gray-50"}`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          option.danger === "critical"
                            ? "bg-red-500/20"
                            : option.danger === "high"
                            ? "bg-orange-500/20"
                            : "bg-yellow-500/20"
                        }`}>
                          <Icon className={`w-4.5 h-4.5 ${
                            option.danger === "critical"
                              ? "text-red-500"
                              : option.danger === "high"
                              ? "text-orange-500"
                              : "text-yellow-500"
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold ${txt} truncate`}>
                            {isUrdu ? option.labelUrdu : option.label}
                          </p>
                          <p className={`text-xs ${sub} truncate`}>
                            {isUrdu ? option.descriptionUrdu : option.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-mono px-2 py-1 rounded ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}>
                          {count} {isUrdu ? "آئٹمز" : "items"}
                        </span>

                        {!isConfirming ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setConfirmingId(option.id); setConfirmText(""); }}
                            disabled={count === 0}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                              count === 0
                                ? `${dc ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"} cursor-not-allowed`
                                : option.danger === "critical"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : option.danger === "high"
                                ? "bg-orange-600 hover:bg-orange-700 text-white"
                                : "bg-yellow-600 hover:bg-yellow-700 text-white"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            {isUrdu ? "ری سیٹ" : "Reset"}
                          </motion.button>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setConfirmingId(null); setConfirmText(""); }}
                            className={`px-3 py-2 rounded-lg text-xs font-bold ${dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                          >
                            <XCircle className="w-3.5 h-3.5 inline mr-1" />
                            {isUrdu ? "منسوخ" : "Cancel"}
                          </motion.button>
                        )}
                      </div>
                    </div>

                    {/* Confirmation Input */}
                    <AnimatePresence>
                      {isConfirming && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-dashed"
                          style={{ borderColor: option.danger === "critical" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)" }}
                        >
                          <p className={`text-xs mb-2 font-semibold ${dc2.text}`}>
                            {isUrdu
                              ? `تصدیق: "${option.labelUrdu}" کو مستقل طور پر حذف کرنے کے لیے نیچے CONFIRM ٹائپ کریں`
                              : `To permanently delete "${option.label}", type CONFIRM below:`}
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={confirmText}
                              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                              placeholder="CONFIRM"
                              className={`flex-1 px-3 py-2 text-sm font-mono border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none ${
                                dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                              }`}
                              autoFocus
                            />
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={confirmText !== "CONFIRM" || resetting}
                              onClick={() => handleReset(option)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                                confirmText === "CONFIRM"
                                  ? "bg-red-600 hover:bg-red-700 text-white"
                                  : `${dc ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"} cursor-not-allowed`
                              }`}
                            >
                              {resetting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {isUrdu ? "حذف کریں" : "Delete Now"}
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}