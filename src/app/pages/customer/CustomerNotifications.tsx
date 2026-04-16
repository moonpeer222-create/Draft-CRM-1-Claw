import { useNavigate } from "react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCircle, Clock, DollarSign, FileText, AlertTriangle, ArrowLeft, Filter, RefreshCw, Check, Trash2, ChevronRight, Phone } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { CRMDataStore, Case, getStageLabel, getOverdueInfo } from "../../lib/mockData";
import { NotificationService } from "../../lib/notifications";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { supabase } from "../../lib/supabase";

interface CustomerNotification {
  id: string;
  type: "status_change" | "payment" | "document" | "deadline" | "general";
  title: string;
  message: string;
  date: string;
  read: boolean;
  icon: string;
  caseId?: string;
}

export function CustomerNotifications() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const { profile } = useSupabaseAuth();
  const customerName = profile?.full_name || profile?.email || "Customer";
  const [caseId, setCaseId] = useState<string>("N/A");

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);

  // Generate notifications from case timeline and payments
  const generateNotifications = useCallback(async () => {
    if (!profile?.id) return [];

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return [];

    const meta = (data.metadata || {}) as any;
    setCaseId(data.case_number || data.id);
    const myCase: Case = {
      id: data.case_number || data.id,
      customerId: data.client_id || profile.id,
      customerName: meta.customerName || profile.full_name || "Customer",
      fatherName: meta.fatherName || "",
      phone: meta.phone || "",
      email: meta.email || profile.email || "",
      cnic: meta.cnic || "",
      passport: meta.passport || "",
      country: meta.country || data.destination_country || "",
      jobType: meta.jobType || data.visa_type || "",
      jobDescription: meta.jobDescription || "",
      address: meta.address || "",
      city: meta.city || "",
      maritalStatus: meta.maritalStatus || "single",
      dateOfBirth: meta.dateOfBirth || "",
      emergencyContact: meta.emergencyContact || { name: "", phone: "", relationship: "" },
      education: meta.education || "",
      experience: meta.experience || "",
      status: data.status || meta.status || "new_case",
      agentId: data.agent_id || meta.agentId || "",
      agentName: meta.agentName || "",
      createdDate: data.created_at || meta.createdDate || new Date().toISOString(),
      updatedDate: data.updated_at || meta.updatedDate || new Date().toISOString(),
      timeline: meta.timeline || [],
      documents: meta.documents || [],
      payments: meta.payments || [],
      medical: meta.medical || null,
      notes: meta.notes || [],
      priority: (data.priority || meta.priority || "medium") as any,
      totalFee: meta.totalFee || 0,
      paidAmount: meta.paidAmount || 0,
      pipelineType: meta.pipelineType || "visa",
      pipelineStageKey: data.status || meta.pipelineStageKey || "new_case",
      currentStage: meta.currentStage || 1,
      stageStartedAt: meta.stageStartedAt || data.created_at || new Date().toISOString(),
      stageDeadlineAt: meta.stageDeadlineAt || data.created_at || new Date().toISOString(),
      isOverdue: meta.isOverdue || false,
      delayReason: meta.delayReason,
      delayReportedAt: meta.delayReportedAt,
      documentChecklist: meta.documentChecklist || {},
      documentChecklistFiles: meta.documentChecklistFiles || {},
      paymentVerified: meta.paymentVerified || false,
      paymentVerifiedAt: meta.paymentVerifiedAt,
      paymentVerifiedBy: meta.paymentVerifiedBy,
      sirAtifApproval: meta.sirAtifApproval || false,
      sirAtifApprovalAt: meta.sirAtifApprovalAt,
      sirAtifApprovalNote: meta.sirAtifApprovalNote,
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

    const notifs: CustomerNotification[] = [];
    const readIds = JSON.parse(localStorage.getItem(`customer-notifs-read-${caseId}`) || "[]");

    // Status change notifications from timeline
    myCase.timeline
      .filter(e => e.type === "status")
      .forEach(event => {
        notifs.push({
          id: `tl-${event.id}`,
          type: "status_change",
          title: isUrdu ? "کیس اسٹیٹس اپڈیٹ" : "Case Status Update",
          message: isUrdu
            ? `آپ کے کیس ${myCase.id} کی حیثیت تبدیل ہوئی: ${event.title}`
            : `Your case ${myCase.id} status changed: ${event.title}`,
          date: event.date,
          read: readIds.includes(`tl-${event.id}`),
          icon: "status",
          caseId: myCase.id,
        });
      });

    // Payment notifications
    myCase.payments.forEach(payment => {
      notifs.push({
        id: `pay-${payment.id}`,
        type: "payment",
        title: isUrdu ? "ادائیگی کی تصدیق" : "Payment Confirmation",
        message: isUrdu
          ? `PKR ${payment.amount.toLocaleString()} کی ${payment.description} ادائیگی ${payment.approvalStatus === "approved" ? "منظور ہوئی" : payment.approvalStatus === "rejected" ? "مسترد ہوئی" : "زیر غور ہے"}`
          : `PKR ${payment.amount.toLocaleString()} ${payment.description} payment ${payment.approvalStatus === "approved" ? "approved" : payment.approvalStatus === "rejected" ? "rejected" : "pending review"}`,
        date: payment.date,
        read: readIds.includes(`pay-${payment.id}`),
        icon: "payment",
        caseId: myCase.id,
      });
    });

    // Document notifications
    myCase.documents.forEach(doc => {
      notifs.push({
        id: `doc-${doc.id}`,
        type: "document",
        title: isUrdu ? "دستاویز اپڈیٹ" : "Document Update",
        message: isUrdu
          ? `${doc.name}: ${doc.status === "verified" ? "تصدیق شدہ" : doc.status === "rejected" ? "مسترد" : "زیر جائزہ"}`
          : `${doc.name}: ${doc.status === "verified" ? "Verified" : doc.status === "rejected" ? "Rejected" : "Under review"}`,
        date: doc.uploadDate,
        read: readIds.includes(`doc-${doc.id}`),
        icon: "document",
        caseId: myCase.id,
      });
    });

    // Overdue / deadline notification
    const overdueInfo = getOverdueInfo(myCase);
    if (overdueInfo.hasDeadline) {
      notifs.push({
        id: `deadline-${myCase.id}`,
        type: "deadline",
        title: isUrdu ? "ڈیڈ لائن یاد دہانی" : "Deadline Reminder",
        message: isUrdu
          ? `آپ کا کیس ابھی "${getStageLabel(myCase.status, true)}" مرحلے پر ہے۔ ${overdueInfo.timeLabel}`
          : `Your case is at "${getStageLabel(myCase.status)}" stage. ${overdueInfo.timeLabel}`,
        date: new Date().toISOString(),
        read: readIds.includes(`deadline-${myCase.id}`),
        icon: "deadline",
        caseId: myCase.id,
      });
    }

    // Welcome notification
    notifs.push({
      id: "welcome",
      type: "general",
      title: isUrdu ? "خوش آمدید!" : "Welcome!",
      message: isUrdu
        ? `${customerName}، ایمرالڈ ویزا کنسلٹنسی میں خوش آمدید۔ آپ کا کیس نمبر ${caseId} ہے۔`
        : `Welcome ${customerName}! Your case number is ${caseId}. Track your visa application progress here.`,
      date: myCase.createdDate,
      read: readIds.includes("welcome"),
      icon: "general",
    });

    return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [caseId, customerName, isUrdu]);

  useEffect(() => {
    setNotifications(generateNotifications());
    const interval = setInterval(() => setNotifications(generateNotifications()), 15000);
    return () => clearInterval(interval);
  }, [generateNotifications]);

  const filteredNotifications = useMemo(() => {
    return filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  }, [notifications, filter]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAsRead = useCallback((notifId: string) => {
    const readIds = JSON.parse(localStorage.getItem(`customer-notifs-read-${caseId}`) || "[]");
    if (!readIds.includes(notifId)) {
      readIds.push(notifId);
      localStorage.setItem(`customer-notifs-read-${caseId}`, JSON.stringify(readIds));
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    }
  }, [caseId]);

  const markAllRead = useCallback(() => {
    const readIds = notifications.map(n => n.id);
    localStorage.setItem(`customer-notifs-read-${caseId}`, JSON.stringify(readIds));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [notifications, caseId]);

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "status_change": return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "payment": return <DollarSign className="w-5 h-5 text-blue-500" />;
      case "document": return <FileText className="w-5 h-5 text-purple-500" />;
      case "deadline": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotifColor = (type: string) => {
    switch (type) {
      case "status_change": return dc ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50";
      case "payment": return dc ? "border-blue-500/30 bg-blue-500/5" : "border-blue-200 bg-blue-50/50";
      case "document": return dc ? "border-purple-500/30 bg-purple-500/5" : "border-purple-200 bg-purple-50/50";
      case "deadline": return dc ? "border-amber-500/30 bg-amber-500/5" : "border-amber-200 bg-amber-50/50";
      default: return dc ? "border-gray-600 bg-gray-800/50" : "border-gray-200 bg-gray-50/50";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return isUrdu ? "ابھی" : "Just now";
    if (diffHours < 24) return isUrdu ? `${Math.floor(diffHours)} گھنٹے پہلے` : `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return isUrdu ? `${Math.floor(diffDays)} دن پہلے` : `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {/* Header */}
      {!insideUnifiedLayout && (
      <header className={`sticky top-0 z-40 ${dc ? "bg-gray-900/95 border-gray-800" : "bg-white/95 border-gray-200"} border-b backdrop-blur-sm`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/customer")} className={`p-2 rounded-lg ${dc ? "hover:bg-gray-800" : "hover:bg-gray-100"} transition-colors`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-lg font-bold ${txt}`}>
                {isUrdu ? "اطلاعات" : "Notifications"}
              </h1>
              {unreadCount > 0 && (
                <p className={`text-xs ${sub}`}>
                  {isUrdu ? `${unreadCount} نئی` : `${unreadCount} unread`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dc ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
              >
                <Check className="w-3 h-3 inline mr-1" />
                {isUrdu ? "سب پڑھ لیں" : "Mark all read"}
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2">
          {(["all", "unread"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? dc ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-100 text-emerald-700"
                  : dc ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? (isUrdu ? "سب" : "All") : (isUrdu ? "نہ پڑھے" : "Unread")}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </header>
      )}

      {/* Notifications List */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center py-16 ${sub}`}
            >
              <Bell className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-700" : "text-gray-300"}`} />
              <p className="font-medium">{isUrdu ? "کوئی اطلاع نہیں" : "No notifications"}</p>
              <p className="text-xs mt-1">{isUrdu ? "نئی اطلاعات یہاں نظر آئیں گی" : "New notifications will appear here"}</p>
            </motion.div>
          ) : (
            filteredNotifications.map((notif, i) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markAsRead(notif.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${getNotifColor(notif.type)} ${
                  !notif.read ? "ring-1 ring-emerald-500/30" : ""
                } hover:shadow-md`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    dc ? "bg-gray-800" : "bg-white"
                  } shadow-sm`}>
                    {getNotifIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-semibold ${txt} truncate`}>{notif.title}</p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-xs ${sub} line-clamp-2`}>{notif.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className={`w-3 h-3 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                      <span className={`text-[10px] ${dc ? "text-gray-500" : "text-gray-400"}`}>{formatDate(notif.date)}</span>
                      {notif.caseId && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${dc ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                          {notif.caseId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Help Section */}
        <div className={`mt-6 p-4 rounded-xl border ${dc ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Phone className={`w-4 h-4 ${dc ? "text-emerald-400" : "text-emerald-600"}`} />
            <p className={`text-sm font-semibold ${txt}`}>
              {isUrdu ? "مدد چاہیے؟" : "Need Help?"}
            </p>
          </div>
          <p className={`text-xs ${sub}`}>
            {isUrdu
              ? "اپنے ایجنٹ سے رابطہ کریں یا 03186986259 پر کال کریں"
              : "Contact your agent or call 03186986259 for assistance"}
          </p>
        </div>
      </main>

      <MobileBottomNav role="customer" />
    </div>
  );
}