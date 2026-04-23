import { useNavigate } from "react-router";
import { FileText, DollarSign, Phone, MessageCircle, LogOut, CheckCircle, Clock, AlertCircle, AlertTriangle, Shield, Calendar, RefreshCw, Menu } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { NotificationBell } from "../../components/NotificationPanel";
import { DocumentChecklist } from "../../components/DocumentChecklist";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { CustomerMobileMenu } from "../../components/CustomerMobileMenu";
import { Case, WORKFLOW_STAGES, getStageLabel, getOverdueInfo, getDelayReasonLabel, getStageNumber } from "../../lib/mockData";
import { NotificationService } from "../../lib/notifications";
import { AuditLogService } from "../../lib/auditLog";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AIVisaPredictor, JourneyMap, EmojiMoodTracker, TrustTrail, DynamicThemeEffect, ARScannerButton } from "../../components/visaverse";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { supabase } from "../../lib/supabase";

export function CustomerDashboard() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  const { profile, signOut } = useSupabaseAuth();
  const customerName = profile?.full_name || profile?.email || "Customer";

  const [myCase, setMyCase] = useState<Case | null>(null);
  const [caseId, setCaseId] = useState<string>("N/A");
  const [, setTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Map Supabase case to local Case shape (reads rich fields from metadata)
  const mapSupabaseCase = useCallback((raw: any): Case => {
    const meta = (raw.metadata || {}) as any;
    return {
      id: raw.case_number || raw.id,
      customerId: raw.client_id || profile?.id || "",
      customerName: meta.customerName || profile?.full_name || "Customer",
      fatherName: meta.fatherName || "",
      phone: meta.phone || "",
      email: meta.email || profile?.email || "",
      cnic: meta.cnic || "",
      passport: meta.passport || "",
      country: raw.destination_country || meta.country || "",
      jobType: meta.jobType || raw.visa_type || "",
      jobDescription: meta.jobDescription || "",
      address: meta.address || "",
      city: meta.city || "",
      maritalStatus: meta.maritalStatus || "single",
      dateOfBirth: meta.dateOfBirth || "",
      emergencyContact: meta.emergencyContact || { name: "", phone: "", relationship: "" },
      education: meta.education || "",
      experience: meta.experience || "",
      status: raw.status || meta.status || "new_case",
      agentId: raw.agent_id || meta.agentId || "",
      agentName: meta.agentName || "",
      createdDate: raw.created_at || meta.createdDate || new Date().toISOString(),
      updatedDate: raw.updated_at || meta.updatedDate || new Date().toISOString(),
      timeline: meta.timeline || [],
      documents: meta.documents || [],
      payments: meta.payments || [],
      medical: meta.medical || null,
      notes: meta.notes || [],
      priority: (raw.priority || meta.priority || "medium") as any,
      totalFee: meta.totalFee || 0,
      paidAmount: meta.paidAmount || 0,
      pipelineType: meta.pipelineType || "visa",
      pipelineStageKey: raw.status || meta.pipelineStageKey || "new_case",
      currentStage: meta.currentStage || 1,
      stageStartedAt: meta.stageStartedAt || raw.created_at || new Date().toISOString(),
      stageDeadlineAt: meta.stageDeadlineAt || raw.created_at || new Date().toISOString(),
      isOverdue: meta.isOverdue || false,
      delayReason: meta.delayReason,
      delayReportedAt: meta.delayReportedAt,
      documentChecklist: meta.documentChecklist || {},
      documentChecklistFiles: meta.documentChecklistFiles || {},
      paymentVerified: meta.paymentVerified || false,
      paymentVerifiedAt: meta.paymentVerifiedAt,
      paymentVerifiedBy: meta.paymentVerifiedBy,
      ownerApproval: meta.ownerApproval || false,
      ownerApprovalAt: meta.ownerApprovalAt,
      ownerApprovalNote: meta.ownerApprovalNote,
      cancellationReason: meta.cancellationReason,
      cancelledAt: meta.cancelledAt,
      cancelledBy: meta.cancelledBy,
      reopenedAt: meta.reopenedAt,
      reopenedBy: meta.reopenedBy,
      reopenedFromStage: meta.reopenedFromStage,
      assignedStaffId: meta.assignedStaffId,
      assignedStaffName: meta.assignedStaffName,
      assignedAt: meta.assignedAt,
      companyName: meta.companyName,
      companyCountry: meta.companyCountry,
    } as Case;
  }, [profile]);

  // Load live case data from Supabase
  const loadCase = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!error && data) {
      setMyCase(mapSupabaseCase(data));
      setCaseId(data.case_number || data.id);
    } else {
      setMyCase(null);
      setCaseId("N/A");
    }
    setLastRefreshed(Date.now());
  }, [profile?.id, mapSupabaseCase]);

  // Real-time polling — every 10 seconds
  useEffect(() => {
    loadCase();
    const interval = setInterval(() => { loadCase(); }, 10000);
    return () => clearInterval(interval);
  }, [loadCase]);

  // Live countdown refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-notify customer about overdue
  useEffect(() => {
    if (!myCase) return;
    const oi = getOverdueInfo(myCase);
    if (!oi.isOverdue) return;
    const NOTIFIED_KEY = `crm_customer_overdue_${myCase.id}`;
    if (localStorage.getItem(NOTIFIED_KEY)) return;
    NotificationService.addNotification({
      type: "deadline",
      priority: "high",
      title: "Your Case is Delayed",
      titleUrdu: "آپ کے کیس میں تاخیر ہے",
      message: `Your case ${myCase.id} is experiencing a delay at ${getStageLabel(myCase.status)}. Our team is working on it.`,
      messageUrdu: `آپ کے کیس ${myCase.id} میں ${getStageLabel(myCase.status, true)} مرحلے پر تاخیر ہے۔ ہماری ٹیم اس پر کام کر رہی ہے۔`,
      actionable: false,
      targetRole: "customer",
      targetUserId: profile?.id,
    });
    localStorage.setItem(NOTIFIED_KEY, "true");
  }, [myCase]);

  // Build live stages from case data
  const stages = useMemo(() => {
    const currentStageNum = myCase ? getStageNumber(myCase.status) : 0;
    return WORKFLOW_STAGES.filter(s => s.key !== "rejected").map(s => {
      let status: "completed" | "current" | "pending" = "pending";
      if (s.stageNumber < currentStageNum) status = "completed";
      else if (s.stageNumber === currentStageNum) status = "current";
      return {
        key: s.key,
        name: isUrdu ? s.labelUrdu : s.label,
        nameShort: (isUrdu ? s.labelUrdu : s.label).split(" ").slice(0, 2).join(" "),
        status,
        stageNumber: s.stageNumber,
        icon: status === "completed" ? CheckCircle : status === "current" ? Clock : AlertCircle,
      };
    });
  }, [myCase, isUrdu]);

  const completedCount = stages.filter(s => s.status === "completed").length;
  const progressPct = Math.round((completedCount / stages.length) * 100);
  const overdueInfo = myCase ? getOverdueInfo(myCase) : null;
  const isOverdue = overdueInfo?.isOverdue ?? false;
  const currentStageName = myCase ? getStageLabel(myCase.status, isUrdu) : "";

  // Recent updates from case timeline
  const recentUpdates = useMemo(() => {
    if (!myCase?.timeline) return [];
    return [...myCase.timeline]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        text: t.title,
        description: t.description,
        type: t.type,
      }));
  }, [myCase]);

  // Payment summary
  const totalFee = myCase?.totalFee || 0;
  const paidAmount = myCase?.paidAmount || 0;
  const remainingAmount = totalFee - paidAmount;
  const paymentPct = totalFee > 0 ? Math.round((paidAmount / totalFee) * 100) : 0;

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 to-gray-100"}`} dir={isUrdu ? "rtl" : "ltr"}>
      {/* Header — hidden when inside unified layout */}
      {!insideUnifiedLayout && (
      <header 
        className={`${dc ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"} border-b px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 sticky top-0 z-50`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base">
              E
            </div>
            <div>
              <h1 className={`text-sm sm:text-lg font-bold ${txt}`}>Emerald Tech Partner</h1>
              <span className="text-[10px] sm:text-xs text-blue-600 font-semibold">{t("customer.portal")}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live sync indicator */}
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full ${dc ? "bg-blue-900/30 border border-blue-800/30" : "bg-blue-50 border border-blue-200"}`}>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
              />
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                {isUrdu ? "لائیو" : "Live"}
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { loadCase(); toast.success(isUrdu ? "تازہ ترین ڈیٹا" : "Refreshed!"); }}
              aria-label={isUrdu ? "تازہ کریں" : "Refresh"}
              className={`p-2.5 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center active:opacity-80 ${dc ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
            <NotificationBell role="customer" userId={profile?.id} />
            <button
              onClick={() => {
                AuditLogService.logAuth(customerName, "customer", "logout");
                signOut();
                toast.success(t("loggingOut"));
                setTimeout(() => navigate("/customer/login"), 1000);
              }}
              aria-label={t("logout")}
              className={`hidden lg:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border rounded-lg min-h-[44px] text-xs sm:text-sm active:opacity-80 touch-manipulation ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <LogOut className="w-4 h-4" />
              <span>{t("logout")}</span>
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className={`lg:hidden p-2.5 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center active:opacity-80 ${dc ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 pb-28 lg:pb-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white relative overflow-hidden"
        >
          <motion.div animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 5, repeat: Infinity }} className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
          <div className="relative">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">
              {isUrdu ? `السلام علیکم، ${customerName}` : `Assalamualaikum, ${customerName}`}
            </h1>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <span className="text-blue-100 text-xs sm:text-sm">{isUrdu ? "کیس آئی ڈی:" : "Case ID:"}</span>
              <span className="font-mono font-bold text-base sm:text-xl">{caseId}</span>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/20 backdrop-blur rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {currentStageName || (isUrdu ? "لوڈ ہو رہا ہے..." : "Loading...")}
              </div>
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/20 backdrop-blur rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {isUrdu ? `${progressPct}% مکمل` : `${progressPct}% Complete`}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== OVERDUE ALERT BANNER ===== */}
        <AnimatePresence>
          {isOverdue && overdueInfo && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`mb-6 relative overflow-hidden rounded-2xl border-2 border-red-500/40 ${dc ? "bg-gradient-to-r from-red-950/50 to-orange-950/30" : "bg-gradient-to-r from-red-50 to-orange-50"}`}
            >
              <motion.div
                animate={{ opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-red-500/5"
              />
              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ rotate: [0, -12, 12, -12, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 5 }}
                    className="p-3 bg-red-500/20 rounded-xl flex-shrink-0"
                  >
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                      {isUrdu ? "آپ کے کیس میں تاخیر ہو رہی ہے" : "Your Case is Experiencing a Delay"}
                    </h3>
                    <p className={`text-sm mt-1 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu
                        ? `"${currentStageName}" مرحلے پر ${overdueInfo.timeLabel} تاخیر ہو چکی ہے۔ ہماری ٹیم اس پر کام کر رہی ہے۔`
                        : `Your application is ${overdueInfo.timeLabel} at the "${currentStageName}" stage. Our team is actively working to resolve this.`}
                    </p>

                    {/* Delay reason if reported */}
                    {myCase?.delayReason && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${dc ? "bg-orange-900/30 border border-orange-800/50" : "bg-orange-100 border border-orange-200"}`}
                      >
                        <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <div>
                          <span className={`font-semibold ${dc ? "text-orange-400" : "text-orange-700"}`}>
                            {isUrdu ? "وجہ: " : "Reason: "}
                          </span>
                          <span className={dc ? "text-orange-300" : "text-orange-800"}>
                            {getDelayReasonLabel(myCase.delayReason, isUrdu)}
                          </span>
                          {myCase.delayReportedAt && (
                            <span className={`text-xs ml-2 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                              ({new Date(myCase.delayReportedAt).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Reassurance message */}
                    <p className={`text-xs mt-3 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                      {isUrdu
                        ? "پریشان نہ ہوں — آپ کا ایجنٹ اس مسئلے کو حل کر رہا ہے۔ مزید معلومات کے لیے رابطہ کریں۔"
                        : "Don't worry — your agent is handling this. Contact us below for any questions."}
                    </p>
                  </div>
                </div>
                {/* Contact shortcuts */}
                <div className="flex gap-2 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { window.open("tel:+923186986259"); toast.info(isUrdu ? "کال کر رہے ہیں..." : "Calling support..."); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow"
                  >
                    <Phone className="w-4 h-4" />
                    {isUrdu ? "کال کریں" : "Call Now"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { window.open("https://wa.me/923186986259"); toast.info(isUrdu ? "واٹس ایپ کھل رہا ہے..." : "Opening WhatsApp..."); }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 shadow"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* VisaVerse: AI Predictor + AR Scanner */}
        {myCase && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <AIVisaPredictor caseData={myCase} />
            <ARScannerButton isUrdu={isUrdu} />
          </motion.div>
        )}

        {/* VisaVerse: Gamified Journey Map */}
        {myCase && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${card} rounded-2xl shadow-sm p-4 md:p-6 border ${brd} mb-4 sm:mb-6`}
          >
            <JourneyMap caseData={myCase} isUrdu={isUrdu} />
          </motion.div>
        )}

        {/* VisaVerse: Emoji Mood Tracker */}
        {myCase && currentStageName && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-4 sm:mb-6"
          >
            <EmojiMoodTracker
              stageLabel={currentStageName}
              caseId={myCase.id}
              isUrdu={isUrdu}
            />
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6"
        >
          <motion.button
            variants={staggerItem}
            whileHover={{ y: -3 }}
            onClick={() => navigate("/customer/documents")}
            className={`${card} rounded-2xl shadow-sm p-4 md:p-6 hover:shadow-lg transition-all text-start border ${brd}`}
          >
            <FileText className="w-8 h-8 md:w-10 md:h-10 text-blue-600 mb-3" />
            <h3 className={`text-lg font-semibold mb-2 ${txt}`}>{t("customer.myDocuments")}</h3>
            <p className={`text-sm ${sub}`}>{t("customer.viewUpload")}</p>
            {myCase && (
              <p className="text-xs mt-2 text-blue-600 font-semibold">
                {myCase.documents.length} {isUrdu ? "دستاویزات" : "documents"}
              </p>
            )}
          </motion.button>

          <motion.button
            variants={staggerItem}
            whileHover={{ y: -3 }}
            onClick={() => navigate("/customer/payments")}
            className={`${card} rounded-2xl shadow-sm p-4 md:p-6 hover:shadow-lg transition-all text-start border ${brd}`}
          >
            <DollarSign className="w-8 h-8 md:w-10 md:h-10 text-green-600 mb-3" />
            <h3 className={`text-lg font-semibold mb-2 ${txt}`}>{t("customer.payments")}</h3>
            <p className={`text-sm ${sub}`}>{t("customer.trackPayments")}</p>
            {myCase && (
              <div className="mt-2">
                <div className={`w-full h-1.5 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${paymentPct}%` }} />
                </div>
                <p className="text-xs mt-1 text-green-600 font-semibold">
                  PKR {paidAmount.toLocaleString()} / {totalFee.toLocaleString()} ({paymentPct}%)
                </p>
              </div>
            )}
          </motion.button>

          <motion.div variants={staggerItem} className={`${card} rounded-2xl shadow-sm p-4 md:p-6 border ${brd}`}>
            <Phone className="w-8 h-8 md:w-10 md:h-10 text-purple-600 mb-3" />
            <h3 className={`text-lg font-semibold mb-2 ${txt}`}>{t("customer.needHelp")}</h3>
            <div className="space-y-2">
              <button onClick={() => { window.open("tel:+923186986259"); toast.info("Calling support..."); }} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                <Phone className="w-4 h-4" />
                Call: +92 318 6986259
              </button>
              <button onClick={() => { window.open("https://wa.me/923186986259"); toast.info("Opening WhatsApp..."); }} className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700">
                <MessageCircle className="w-4 h-4" />
                WhatsApp Support
              </button>
            </div>
            {myCase && (
              <p className={`text-xs mt-3 ${sub}`}>
                {isUrdu ? `ایجنٹ: ${myCase.agentName}` : `Agent: ${myCase.agentName}`}
              </p>
            )}
          </motion.div>
        </motion.div>

        {/* Document Checklist */}
        {myCase && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            <DocumentChecklist
              caseId={myCase.id}
              country={myCase.country}
              jobType={myCase.jobType}
            />
          </motion.div>
        )}

        {/* Recent Updates - Live from case timeline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`${card} rounded-2xl shadow-sm p-4 md:p-6 border ${brd}`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{t("customer.recentUpdates")}</h3>
          <div className="space-y-3">
            {recentUpdates.length > 0 ? recentUpdates.map((update) => (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  update.type === "status" ? "bg-blue-500" :
                  update.type === "payment" ? "bg-blue-500" :
                  update.type === "document" ? "bg-purple-500" :
                  update.type === "medical" ? "bg-orange-500" : "bg-gray-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${txt}`}>{update.text}</p>
                  {update.description && (
                    <p className={`text-xs mt-0.5 ${sub}`}>{update.description}</p>
                  )}
                  <p className={`text-xs mt-1 ${dc ? "text-gray-500" : "text-gray-400"}`}>{update.date}</p>
                </div>
              </motion.div>
            )) : (
              <p className={`text-sm text-center py-6 ${sub}`}>{isUrdu ? "کوئی اپ ڈیٹ نہیں" : "No updates yet"}</p>
            )}
          </div>
        </motion.div>

        {/* VisaVerse: Trust Trail */}
        {myCase && myCase.timeline.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`${card} rounded-2xl shadow-sm p-4 md:p-6 border ${brd} mt-4 sm:mt-6`}
          >
            <TrustTrail timeline={myCase.timeline} isUrdu={isUrdu} />
          </motion.div>
        )}
      </main>

      {/* Dynamic theme effect */}
      <DynamicThemeEffect caseData={myCase} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role="customer" />
      <CustomerMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}