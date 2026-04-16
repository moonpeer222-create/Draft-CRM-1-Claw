import { CRMDataStore, Case, getOverdueInfo, getDelayReasonLabel, DELAY_REASONS, getStageLabel } from "../../lib/mockData";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminSidebar } from "../../components/AdminSidebar";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

import { FileText, Clock, DollarSign, Users, TrendingUp, Plus, Bell, FileBarChart, Calendar, Send, X, CalendarCheck, AlertTriangle, MapPin, CreditCard, MessageCircle, CheckCircle2, XCircle, Wifi, Shield, ClipboardCheck, ScrollText } from "lucide-react";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import { useTheme } from "../../lib/ThemeContext";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { NotificationService } from "../../lib/notifications";
import { AttendanceService } from "../../lib/attendanceService";
import { PassportTracker, LOCATIONS, getLocationLabel } from "../../lib/passportTracker";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { StorageUsageWidget } from "../../components/StorageUsageWidget";
import { useCrossTabRefresh } from "../../lib/useCrossTabRefresh";
import { SatisfactionMeter, AgentLeaderboardWidget } from "../../components/visaverse";
import { useVisaVerse } from "../../components/visaverse";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

// Production: no demo seeding — passport tracking data comes from real user actions only
function seedPassportDemoData() {
  // Removed: no demo data in production
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Live data from CRMDataStore
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState({
    totalCases: 0,
    pendingActions: 0,
    revenueThisMonth: 0,
    activeAgents: 0,
    topAgent: { name: "", count: 0 }
  });

  const [newCase, setNewCase] = useState({
    customerName: "",
    phone: "",
    country: "Saudi Arabia",
    jobType: "Driver",
    agent: "Faizan",
  });

  const [broadcast, setBroadcast] = useState({
    recipients: "All Agents",
    channel: "WhatsApp",
    message: "",
  });

  const [meeting, setMeeting] = useState({
    title: "",
    date: "",
    time: "",
    attendees: "All Team",
  });

  // loadLiveData — defined before useEffect/hooks that reference it
  const loadLiveData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      const allCases = (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
      setCases(allCases);

      const totalCases = allCases.length;
      const pendingCases = allCases.filter(c => 
        c.status === 'document_collection' || c.status === 'selection_call' || c.status === 'medical_token'
      ).length;

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const revenueThisMonth = allCases
        .filter(c => {
          const caseDate = new Date(c.createdDate);
          return caseDate.getMonth() === thisMonth && caseDate.getFullYear() === thisYear;
        })
        .reduce((sum, c) => sum + c.paidAmount, 0);

      const agents = [...new Set(allCases.map(c => c.agentName).filter(Boolean))];
      
      const agentCounts = allCases.reduce((acc, c) => {
        if (c.agentName) acc[c.agentName] = (acc[c.agentName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topAgentEntry = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0];
      const topAgent = topAgentEntry ? { name: topAgentEntry[0], count: topAgentEntry[1] } : { name: "N/A", count: 0 };

      setStats({
        totalCases,
        pendingActions: pendingCases,
        revenueThisMonth,
        activeAgents: agents.length,
        topAgent
      });
    }
    setIsLoading(false);
  };

  // Load live data on mount and set up refresh
  useEffect(() => {
    seedPassportDemoData();
    const allCases = CRMDataStore.getCases();
    DataSyncService.seedFromCases(allCases.map(c => ({
      id: c.id, agentId: c.agentId, agentName: c.agentName, updatedDate: c.updatedDate,
    })));
    loadLiveData();
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh when another tab modifies cases, attendance, or notifications
  useCrossTabRefresh(["cases", "attendance", "notifications"], loadLiveData);

  // Get recent activity from cases
  const getRecentActivity = () => {
    return cases
      .slice(0, 5)
      .map((c, idx) => ({
        id: idx + 1,
        caseId: c.id,
        text: `Case ${c.id} - ${c.customerName} (${c.status})`,
        time: getTimeAgo(c.createdDate),
        type: c.status === 'completed' ? 'success' : c.paidAmount > 0 ? 'payment' : 'info'
      }));
  };

  // Get upcoming deadlines
  const getUpcomingDeadlines = () => {
    return cases
      .filter(c => c.status !== 'completed' && c.status !== 'cancelled')
      .slice(0, 3)
      .map((c, idx) => ({
        id: idx + 1,
        caseId: c.id,
        customer: c.customerName,
        deadline: new Date(c.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        type: (c.status === 'medical_token' || c.status === 'check_medical') ? 'Medical Appointment' : c.paidAmount < c.totalFee ? 'Payment Due' : 'Document Expiry',
        agent: c.agentName
      }));
  };

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleCreateCase = async () => {
    if (!newCase.customerName || !newCase.phone) {
      toast.error(t("dashboard.fillRequired"));
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading(t("dashboard.creatingCase"));

    // Map agent name to agent ID
    const agentNameToId: Record<string, string> = {
      "Faizan": "AGENT-1", "Imran": "AGENT-2", "Safeer": "AGENT-3", "Aynee": "AGENT-4",
    };
    const resolvedAgentId = agentNameToId[newCase.agent] || "AGENT-1";

    setTimeout(() => {
      const created = CRMDataStore.addCase({
        customerName: newCase.customerName,
        phone: newCase.phone,
        country: newCase.country,
        jobType: newCase.jobType,
        agentName: newCase.agent,
        status: "document_collection",
        currentStage: 1,
        stageStartedAt: new Date().toISOString(),
        stageDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isOverdue: false,
        agentId: resolvedAgentId,
        totalFee: 50000,
        email: "",
        cnic: "",
        passport: "",
      });
      toast.dismiss(loadingToast);
      toast.success(`${t("cases.newCase")} ${created.id} ${t("dashboard.caseCreated")} ${newCase.customerName}`);
      NotificationService.notifyCaseCreated(created.id, newCase.customerName, newCase.agent);
      AuditLogService.logCaseCreated("Imran Khan", "admin", created.id, newCase.customerName);
      DataSyncService.markModified(created.id, "admin", "Imran Khan", "admin", "case", "Case created by admin");
      setShowNewCaseModal(false);
      setNewCase({ customerName: "", phone: "", country: "Saudi Arabia", jobType: "Driver", agent: "Faizan" });
      setIsLoading(false);
      loadLiveData(); // Refresh data
    }, 1500);
  };

  const handleSendBroadcast = async () => {
    if (!broadcast.message) {
      toast.error(t("dashboard.enterMessage"));
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading(t("dashboard.sendingBroadcast"));

    setTimeout(() => {
      toast.dismiss(loadingToast);
      NotificationService.notifyBroadcast(broadcast.recipients, broadcast.message, broadcast.channel);
      AuditLogService.log({ userId: "admin", userName: "Imran Khan", role: "admin", action: "broadcast_sent", category: "system", description: `Broadcast sent to ${broadcast.recipients} via ${broadcast.channel}` });
      toast.success(`${t("dashboard.broadcastSent")} ${broadcast.recipients} ${t("dashboard.via")} ${broadcast.channel}`);
      setShowBroadcastModal(false);
      setBroadcast({ recipients: "All Agents", channel: "WhatsApp", message: "" });
      setIsLoading(false);
    }, 1500);
  };

  const handleScheduleMeeting = async () => {
    if (!meeting.title || !meeting.date || !meeting.time) {
      toast.error(t("dashboard.fillRequired"));
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading(t("dashboard.schedulingMeeting"));

    setTimeout(() => {
      toast.dismiss(loadingToast);
      NotificationService.notifySystemUpdate(
        `Meeting: ${meeting.title}`,
        `Scheduled for ${meeting.date} at ${meeting.time} - ${meeting.attendees}`
      );
      AuditLogService.log({ userId: "admin", userName: "Imran Khan", role: "admin", action: "meeting_scheduled", category: "system", description: `Scheduled meeting "${meeting.title}" for ${meeting.date} at ${meeting.time}` });
      toast.success(`${t("dashboard.meetingScheduled")} "${meeting.title}" ${t("dashboard.scheduledFor")} ${meeting.date} ${t("dashboard.at")} ${meeting.time}`);
      setShowMeetingModal(false);
      setMeeting({ title: "", date: "", time: "", attendees: "All Team" });
      setIsLoading(false);
    }, 1500);
  };

  const handleSendReminder = (deadline: any) => {
    toast.loading(t("dashboard.sendingReminder"));
    setTimeout(() => {
      toast.success(`${t("dashboard.reminderSent")} ${deadline.agent} ${t("dashboard.for")} ${deadline.customer}`);
    }, 1000);
  };

  const handleGenerateReport = () => {
    const loadingToast = toast.loading(t("dashboard.generatingReport"));
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success(t("dashboard.reportGenerated"));
    }, 2000);
  };

  const activities = getRecentActivity();
  const deadlines = getUpcomingDeadlines();

  // Overdue analytics
  const overdueCases = cases.filter(c => getOverdueInfo(c).isOverdue);
  const overdueCount = overdueCases.length;
  const unreportedOverdue = overdueCases.filter(c => !c.delayReason).length;
  const overdueRate = cases.length > 0 ? Math.round((overdueCount / cases.length) * 100) : 0;

  // Auto-notify for newly overdue cases (check on each data load)
  useEffect(() => {
    if (overdueCases.length === 0) return;
    const OVERDUE_NOTIFIED_KEY = "crm_overdue_notified_ids";
    const notifiedRaw = localStorage.getItem(OVERDUE_NOTIFIED_KEY);
    const notifiedIds: string[] = notifiedRaw ? JSON.parse(notifiedRaw) : [];
    const newlyOverdue = overdueCases.filter(c => !notifiedIds.includes(c.id));
    if (newlyOverdue.length > 0) {
      newlyOverdue.forEach(c => {
        const oi = getOverdueInfo(c);
        NotificationService.addNotification({
          type: "deadline",
          priority: (oi.hoursOverdue && oi.hoursOverdue > 48) ? "critical" : "high",
          title: "Case Overdue",
          titleUrdu: "کیس تاخیر شدہ",
          message: `Case ${c.id} (${c.customerName}) is ${oi.timeLabel} at stage ${getStageLabel(c.status)}. Agent: ${c.agentName}`,
          messageUrdu: `کیس ${c.id} (${c.customerName}) ${oi.timeLabel} — ایجنٹ: ${c.agentName}`,
          actionable: true,
          actionUrl: "/admin/overdue-cases",
          actionLabel: "View Overdue",
          targetRole: "admin",
          metadata: { caseId: c.id, agentName: c.agentName, overdueHours: oi.hoursOverdue },
        });
      });
      const updatedIds = [...notifiedIds, ...newlyOverdue.map(c => c.id)];
      localStorage.setItem(OVERDUE_NOTIFIED_KEY, JSON.stringify(updatedIds.slice(-200)));
    }
  }, [overdueCases]);

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${
      darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"
    }`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        
        <main className="p-3 sm:p-4 md:p-6">
          {/* Live Sync Banner + Quick Nav */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-3 sm:mb-4 flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium ${darkMode ? "bg-blue-900/20 text-blue-400 border border-blue-800/30" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse" />
              <Wifi className="w-3 h-3" />
              {isUrdu ? "لائیو" : "Live Sync"}
              <span className={`text-[10px] ${darkMode ? "text-blue-500/60" : "text-blue-500/80"}`}>
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`${prefix}/approval-queue`)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold border min-h-[36px] ${darkMode ? "border-yellow-800/40 bg-yellow-900/10 text-yellow-400 hover:bg-yellow-900/20" : "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"}`}>
                <ClipboardCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{isUrdu ? "منظوری قطار" : "Approval Queue"}</span>
                <span className="sm:hidden">{isUrdu ? "قطار" : "Queue"}</span>
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`${prefix}/audit-log`)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold border min-h-[36px] ${darkMode ? "border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}>
                <ScrollText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{isUrdu ? "آڈٹ لاگ" : "Audit Log"}</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Quick Actions Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:flex gap-2 sm:gap-3 p-[0px] mx-[0px] mt-[30px] mb-[16px]"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewCaseModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl active:shadow-md"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-semibold">{t("dashboard.newCase")}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBroadcastModal(true)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] border rounded-xl transition-all shadow-sm hover:shadow-md active:shadow-none ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-semibold">{isUrdu ? "براڈکاسٹ" : "Broadcast"}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleGenerateReport}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] border rounded-xl transition-all shadow-sm hover:shadow-md active:shadow-none ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <FileBarChart className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">{t("dashboard.generateReport")}</span>
              <span className="text-xs font-semibold sm:hidden">{isUrdu ? "رپورٹ" : "Report"}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMeetingModal(true)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px] border rounded-xl transition-all shadow-sm hover:shadow-md active:shadow-none ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">{t("dashboard.scheduleMeeting")}</span>
              <span className="text-xs font-semibold sm:hidden">{isUrdu ? "میٹنگ" : "Meeting"}</span>
            </motion.button>
          </motion.div>

          {/* Overdue Alert Banner */}
          {overdueCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`mb-6 relative overflow-hidden rounded-2xl p-4 border-2 border-red-500/40 ${darkMode ? "bg-gradient-to-r from-red-950/40 to-orange-950/20" : "bg-gradient-to-r from-red-50 to-orange-50"}`}
            >
              <motion.div animate={{ opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 bg-red-500/5" />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 4 }} className="p-2.5 bg-red-500/20 rounded-xl flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      {isUrdu ? `${overdueCount} کیسز ڈیڈ لائن سے تجاوز کر گئے!` : `${overdueCount} Cases Overdue!`}
                    </p>
                    <p className={`text-xs mt-0.5 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {isUrdu ? `${unreportedOverdue} بغیر وجہ • ${overdueRate}% شرح` : `${unreportedOverdue} unreported • ${overdueRate}% overdue rate`}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`${prefix}/overdue-cases`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-500/20 flex-shrink-0"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {isUrdu ? "تفصیل دیکھیں" : "View Overdue Report"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Executive Summary Cards - Live Data */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 mb-4 sm:mb-6"
          >
            {[
              { 
                icon: FileText, 
                value: stats.totalCases.toString(), 
                label: t("dashboard.totalCases"), 
                trend: "+12%", 
                color: "blue",
                route: `${prefix}/cases`
              },
              { 
                icon: Clock, 
                value: stats.pendingActions.toString(), 
                label: t("dashboard.pendingActions"), 
                trend: `${stats.pendingActions} ${t("dashboard.urgent")}`, 
                color: "orange",
                route: `${prefix}/overdue-cases`
              },
              { 
                icon: DollarSign, 
                value: `PKR ${(stats.revenueThisMonth / 1000).toFixed(0)}K`, 
                label: t("dashboard.revenueMonth"), 
                trend: "+18%", 
                color: "blue",
                route: `${prefix}/financials`
              },
              { 
                icon: Users, 
                value: `${stats.activeAgents}/15`, 
                label: t("dashboard.activeAgents"), 
                trend: `${stats.topAgent.name} (${stats.topAgent.count} cases)`, 
                color: "purple",
                route: `${prefix}/team`
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  whileHover={{ y: -5, scale: 1.02 }}
                  onClick={() => navigate(card.route)}
                  className={`${darkMode ? "bg-gray-800 border-gray-700" : `bg-gradient-to-br from-white to-${card.color}-50 border-${card.color}-100`} rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl p-3 sm:p-4 md:p-6 cursor-pointer transition-all border active:scale-[0.98] active:opacity-80`}
                >
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <Icon className={`w-7 h-7 sm:w-10 sm:h-10 text-${card.color}-600`} />
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <h3 className={`text-lg sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{card.value}</h3>
                  <p className={`text-[10px] sm:text-xs md:text-sm mb-1 sm:mb-2 line-clamp-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{card.label}</p>
                  <p className={`text-${card.color}-600 text-[10px] sm:text-xs font-semibold truncate`}>{card.trend}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
            {/* Live Activity Feed - From Audit Log */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <Shield className="w-5 h-5 text-blue-600" />
                  {isUrdu ? "لائیو سرگرمی فیڈ" : "Live Activity Feed"}
                </h3>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`${prefix}/audit-log`)}
                  className="text-blue-600 text-sm font-semibold hover:text-blue-700">
                  {isUrdu ? "مکمل لاگ" : "Full Log →"}
                </motion.button>
              </div>
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {(() => {
                  const recentAudit = AuditLogService.getRecent(8);
                  if (recentAudit.length === 0) return (
                    <p className={`text-sm text-center py-8 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      {t("noData")}
                    </p>
                  );
                  return recentAudit.map((entry, idx) => {
                    const dotColor = entry.category === "approval" ? "bg-yellow-500"
                      : entry.category === "payment" ? "bg-indigo-500"
                      : entry.category === "case" ? "bg-blue-500"
                      : entry.category === "document" ? "bg-orange-500"
                      : entry.category === "auth" ? "bg-purple-500"
                      : "bg-gray-500";
                    const roleBg = entry.role === "admin"
                      ? (darkMode ? "text-blue-400" : "text-blue-600")
                      : entry.role === "agent"
                      ? (darkMode ? "text-indigo-400" : "text-indigo-600")
                      : (darkMode ? "text-purple-400" : "text-purple-600");
                    const timeDiff = Date.now() - new Date(entry.timestamp).getTime();
                    const mins = Math.floor(timeDiff / 60000);
                    const timeStr = mins < 1 ? (isUrdu ? "ابھی" : "now") : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
                    return (
                      <motion.div key={entry.id}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => navigate(`${prefix}/audit-log`)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer active:opacity-80 ${darkMode ? "bg-gray-700/30 hover:bg-gray-700/50" : "bg-gray-50 hover:bg-gray-100"}`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${roleBg}`}>{entry.userName}</span>
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                              entry.role === "admin" ? (darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700")
                              : entry.role === "agent" ? (darkMode ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700")
                              : (darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700")
                            }`}>{entry.role}</span>
                          </div>
                          <p className={`text-xs mt-0.5 line-clamp-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{entry.description}</p>
                        </div>
                        <span className={`text-[10px] flex-shrink-0 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>{timeStr}</span>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </motion.div>

            {/* Attendance Quick Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <CalendarCheck className="w-5 h-5 text-teal-600" />
                  {isUrdu ? "آج کی حاضری" : "Today's Attendance"}
                </h3>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`${prefix}/attendance`)}
                  className="text-blue-600 text-sm font-semibold hover:text-blue-700">
                  {isUrdu ? "تفصیل دیکھیں" : "View Details →"}
                </motion.button>
              </div>
              {(() => {
                const summary = AttendanceService.getDailySummary();
                const total = summary.present + summary.late + summary.absent + summary.onLeave;
                const presentPct = total > 0 ? Math.round(((summary.present + summary.late) / total) * 100) : 0;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: isUrdu ? "حاضر" : "Present", value: summary.present, color: "text-green-600", bg: darkMode ? "bg-green-900/20" : "bg-green-50" },
                        { label: isUrdu ? "دیر سے" : "Late", value: summary.late, color: "text-yellow-600", bg: darkMode ? "bg-yellow-900/20" : "bg-yellow-50" },
                        { label: isUrdu ? "غائب" : "Absent", value: summary.absent, color: "text-red-600", bg: darkMode ? "bg-red-900/20" : "bg-red-50" },
                        { label: isUrdu ? "چھٹی" : "Leave", value: summary.onLeave, color: "text-blue-600", bg: darkMode ? "bg-blue-900/20" : "bg-blue-50" },
                      ].map(s => (
                        <div key={s.label} onClick={() => navigate(`${prefix}/attendance`)} className={`${s.bg} rounded-xl p-3 text-center cursor-pointer active:opacity-80 transition-all hover:scale-105`}>
                          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                          <p className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={darkMode ? "text-gray-400" : "text-gray-500"}>{isUrdu ? "حاضری شرح" : "Attendance Rate"}</span>
                        <span className="font-bold text-blue-600">{presentPct}%</span>
                      </div>
                      <div className={`w-full h-2.5 rounded-full ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                        <div className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" style={{ width: `${presentPct}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {AttendanceService.getRecordsForDate(new Date().toISOString().split("T")[0]).slice(0, 3).map(record => (
                        <div key={record.id} onClick={() => navigate(`${prefix}/attendance`)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer active:opacity-80 transition-all ${darkMode ? "bg-gray-700/30 hover:bg-gray-700/50" : "bg-gray-50 hover:bg-gray-100"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${record.status === "on-time" ? "bg-green-500" : record.status === "late" ? "bg-yellow-500" : "bg-red-500"}`} />
                            <span className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{record.agentName}</span>
                          </div>
                          <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{record.checkIn || "-"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>

          {/* Passport Tracker Widget + Payment Requests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
            {/* Passport Tracker Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <MapPin className="w-5 h-5 text-blue-600" />
                  {isUrdu ? "پاسپورٹ ٹریکر" : "Passport Tracker"}
                </h3>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`${prefix}/passport-tracker`)}
                  className="text-blue-600 text-sm font-semibold hover:text-blue-700">
                  {isUrdu ? "تفصیل دیکھیں" : "View All →"}
                </motion.button>
              </div>
              {(() => {
                const ptStats = PassportTracker.getStats();
                // Office count = total tracked passports minus those currently checked out
                const officeCount = Math.max(0, ptStats.total - ptStats.checkedOut);
                const locationData = LOCATIONS.map(loc => ({
                  key: loc.value,
                  label: isUrdu ? loc.labelUrdu : loc.label,
                  icon: loc.icon,
                  count: loc.value === "office" ? officeCount : (ptStats.byLocation[loc.value] || 0),
                  alert: loc.value === "medical" || loc.value === "vendor",
                }));
                return (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between p-2 rounded-lg text-xs ${darkMode ? "bg-gray-700/40" : "bg-gray-100"}`}>
                      <span className={darkMode ? "text-gray-400" : "text-gray-500"}>
                        {isUrdu ? `${ptStats.total} ٹریک شدہ · ${ptStats.checkedOut} باہر` : `${ptStats.total} tracked · ${ptStats.checkedOut} out`}
                      </span>
                      {ptStats.overdue > 0 && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-bold dark:bg-red-900/30 dark:text-red-400">
                          {ptStats.overdue} {isUrdu ? "تاخیر" : "OVERDUE"}
                        </span>
                      )}
                    </div>
                    {locationData.map(loc => (
                      <div key={loc.key} onClick={() => navigate(`${prefix}/passport-tracker`)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer active:opacity-80 transition-all ${darkMode ? "bg-gray-700/30 hover:bg-gray-700/50" : "bg-gray-50 hover:bg-gray-100"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${loc.count > 0 && loc.alert ? "bg-red-500 animate-pulse" : loc.count > 0 ? "bg-blue-500" : "bg-gray-400/40"}`} />
                          <span className={`text-sm font-medium ${darkMode ? "text-gray-200" : "text-gray-700"}`}>{loc.icon} {loc.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${loc.count > 0 ? (darkMode ? "text-white" : "text-gray-900") : (darkMode ? "text-gray-600" : "text-gray-400")}`}>{loc.count}</span>
                          <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{isUrdu ? "پاسپورٹ" : "passports"}</span>
                          {loc.count > 0 && loc.alert && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-bold dark:bg-red-900/30 dark:text-red-400">
                              {isUrdu ? "الرٹ" : "ALERT"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>

            {/* Payment Requests Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  {isUrdu ? "ادائیگی کی درخواستیں" : "Payment Requests"}
                </h3>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`${prefix}/approval-queue`)}
                  className="text-blue-600 text-sm font-semibold hover:text-blue-700">
                  {isUrdu ? "سب دیکھیں" : "View Queue →"}
                </motion.button>
              </div>
              {(() => {
                const paymentRequests = NotificationService.getNotificationsForRole("admin")
                  .filter(n => n.metadata?.type === "payment_history_request" || n.metadata?.type === "payment_pending_approval")
                  .slice(0, 5);
                
                if (paymentRequests.length === 0) {
                  return (
                    <div className={`text-center py-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">{isUrdu ? "کوئی زیر التواء درخواست نہیں" : "No pending requests"}</p>
                    </div>
                  );
                }

                // Helper to persist metadata and audit
                const updateReqMeta = (reqId: string, updates: Record<string, any>) => {
                  const all = NotificationService.getNotifications();
                  const notif = all.find((n: any) => n.id === reqId);
                  if (notif) {
                    notif.metadata = { ...notif.metadata, ...updates };
                    notif.read = true;
                    NotificationService.saveNotifications(all);
                  }
                  loadLiveData();
                };

                return (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {paymentRequests.map((req) => {
                      const histStatus = req.metadata?.status;
                      const approvalStatus = req.metadata?.approvalStatus;
                      const isActedOn = (req.metadata?.type === "payment_history_request" && (histStatus === "shared" || histStatus === "declined"))
                        || (req.metadata?.type === "payment_pending_approval" && (approvalStatus === "approved" || approvalStatus === "rejected"));

                      return (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-3 rounded-xl border-l-4 cursor-pointer active:opacity-80 transition-all ${
                            req.metadata?.type === "payment_pending_approval"
                              ? `border-l-orange-500 ${darkMode ? "bg-orange-900/10 hover:bg-orange-900/20" : "bg-orange-50 hover:bg-orange-100"}`
                              : `border-l-blue-500 ${darkMode ? "bg-blue-900/10 hover:bg-blue-900/20" : "bg-blue-50 hover:bg-blue-100"}`
                          }`}
                        >
                          <div className="flex items-start justify-between" onClick={() => navigate(`${prefix}/approval-queue`)}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${darkMode ? "text-white" : "text-gray-900"}`}>
                                {req.metadata?.type === "payment_pending_approval"
                                  ? `${isUrdu ? "ادائیگی منظوری:" : "Payment Approval:"} PKR ${req.metadata?.amount?.toLocaleString()}`
                                  : `${isUrdu ? "تاریخ کی درخواست:" : "History Request:"} ${req.metadata?.caseId}`}
                              </p>
                              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                                {req.metadata?.agentName} • {req.metadata?.customerName}
                              </p>
                            </div>
                            {!req.read && !isActedOn && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {req.metadata?.type === "payment_history_request" && (
                              isActedOn ? (
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                  histStatus === "shared"
                                    ? darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                                    : darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"
                                }`}>
                                  {histStatus === "shared" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {histStatus === "shared" ? (isUrdu ? "شیئر کیا گیا" : "Shared") : (isUrdu ? "مسترد کیا گیا" : "Declined")}
                                </span>
                              ) : (
                                <>
                                  <button onClick={() => {
                                    const msg = encodeURIComponent(`Payment History for Case ${req.metadata?.caseId} (${req.metadata?.customerName})`);
                                    window.open(`https://wa.me/923186986259?text=${msg}`, "_blank");
                                    updateReqMeta(req.id, { status: "shared", actionAt: new Date().toISOString() });
                                    AuditLogService.logApproval("Imran Khan", "approval_granted", `Payment history shared for ${req.metadata?.caseId}`);
                                    toast.success(isUrdu ? "واٹس ایپ کھل رہا ہے..." : "Opening WhatsApp...");
                                  }} className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-semibold">
                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                  </button>
                                  <button onClick={() => {
                                    updateReqMeta(req.id, { status: "declined", actionAt: new Date().toISOString() });
                                    AuditLogService.logApproval("Imran Khan", "approval_denied", `Payment history for ${req.metadata?.caseId}`);
                                    toast.info(isUrdu ? "مسترد" : "Declined");
                                  }} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"}`}>
                                    <XCircle className="w-3 h-3" /> {isUrdu ? "مسترد" : "Decline"}
                                  </button>
                                  <button onClick={() => {
                                    updateReqMeta(req.id, { status: "shared", actionAt: new Date().toISOString() });
                                    AuditLogService.logApproval("Imran Khan", "approval_granted", `Payment history sent for ${req.metadata?.caseId}`);
                                    toast.success(isUrdu ? "بھیجا گیا" : "Marked as sent");
                                  }} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                                    <CheckCircle2 className="w-3 h-3" /> {isUrdu ? "بھیجا" : "Sent"}
                                  </button>
                                </>
                              )
                            )}
                            {req.metadata?.type === "payment_pending_approval" && (
                              isActedOn ? (
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                  approvalStatus === "approved"
                                    ? darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                                    : darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"
                                }`}>
                                  {approvalStatus === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {approvalStatus === "approved" ? (isUrdu ? "منظور شدہ" : "Approved") : (isUrdu ? "مسترد شدہ" : "Rejected")}
                                </span>
                              ) : (
                                <>
                                  <button onClick={() => {
                                    updateReqMeta(req.id, { approvalStatus: "approved", actionAt: new Date().toISOString() });
                                    AuditLogService.logPaymentAction("Imran Khan", "admin", "payment_approved", req.metadata?.caseId, req.metadata?.amount);
                                    toast.success(isUrdu ? "ادائیگی منظور!" : "Payment approved!");
                                  }} className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold">
                                    <CheckCircle2 className="w-3 h-3" /> {isUrdu ? "منظور" : "Approve"}
                                  </button>
                                  <button onClick={() => {
                                    updateReqMeta(req.id, { approvalStatus: "rejected", actionAt: new Date().toISOString() });
                                    AuditLogService.logPaymentAction("Imran Khan", "admin", "payment_rejected", req.metadata?.caseId, req.metadata?.amount);
                                    toast.info(isUrdu ? "ادائیگی مسترد" : "Payment rejected");
                                  }} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"}`}>
                                    <XCircle className="w-3 h-3" /> {isUrdu ? "مسترد" : "Reject"}
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          </div>

          {/* VisaVerse: Admin Overview */}
          <VisaVerseAdminOverview darkMode={darkMode} isUrdu={isUrdu} />

          {/* Storage Usage Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
            <div className="lg:col-span-1">
              <StorageUsageWidget />
            </div>
            <div className="lg:col-span-2">
          {/* Upcoming Deadlines - Live Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6 h-full`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("dashboard.upcomingDeadlines")}</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`${prefix}/cases`)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
              >
                {t("dashboard.viewAll")}
              </motion.button>
            </div>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2.5">
              {deadlines.length > 0 ? deadlines.map((deadline) => (
                <motion.div
                  key={deadline.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`${prefix}/cases/${deadline.caseId}`)}
                  className={`p-3.5 rounded-xl border-l-4 border-l-orange-500 cursor-pointer active:opacity-80 transition-all ${darkMode ? "bg-gray-700/40 hover:bg-gray-700/60" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-mono font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>{deadline.caseId}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${darkMode ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700"}`}>{deadline.type}</span>
                  </div>
                  <p className={`text-sm font-semibold mb-1.5 ${darkMode ? "text-white" : "text-gray-900"}`}>{deadline.customer}</p>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      <span>{deadline.deadline}</span> · <span>{deadline.agent}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendReminder(deadline); }}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold min-h-[32px] px-2"
                    >
                      <Send className="w-3 h-3" />
                      {t("dashboard.remind")}
                    </button>
                  </div>
                </motion.div>
              )) : (
                <p className={`py-8 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {t("noData")}
                </p>
              )}
            </div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    {[t("dashboard.caseId"), t("dashboard.customer"), t("dashboard.deadline"), t("dashboard.type"), t("dashboard.agent"), t("dashboard.action")].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deadlines.length > 0 ? deadlines.map((deadline) => (
                    <motion.tr
                      key={deadline.id}
                      whileHover={{ backgroundColor: darkMode ? "rgba(55,65,81,0.5)" : "#f9fafb" }}
                      onClick={() => navigate(`${prefix}/cases/${deadline.caseId}`)}
                      className={`border-b cursor-pointer active:opacity-80 ${darkMode ? "border-gray-700" : "border-gray-100"}`}
                    >
                      <td className={`py-3 px-4 text-sm font-mono font-semibold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>{deadline.caseId}</td>
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{deadline.customer}</td>
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{deadline.deadline}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                          {deadline.type}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-400" : "text-gray-700"}`}>{deadline.agent}</td>
                      <td className="py-3 px-4">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); handleSendReminder(deadline); }}
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          {t("dashboard.remind")}
                        </motion.button>
                      </td>
                    </motion.tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className={`py-8 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {t("noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* New Case Modal */}
        {showNewCaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 lg:p-4"
            onClick={() => setShowNewCaseModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} w-full h-full lg:h-auto lg:max-h-[90vh] overflow-y-auto lg:rounded-2xl shadow-2xl lg:max-w-2xl`}
            >
              <div className={`flex items-center justify-between p-6 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("dashboard.createNewCase")}</h2>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowNewCaseModal(false)}
                  className={`p-2 rounded-xl transition-all ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <X className={`w-5 h-5 ${darkMode ? "text-gray-400" : "text-gray-600"}`} />
                </motion.button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.customerName")} *</label>
                    <input type="text" value={newCase.customerName} onChange={(e) => setNewCase({ ...newCase, customerName: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`} placeholder="Enter customer name" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.phoneNumber")} *</label>
                    <input type="tel" value={newCase.phone} onChange={(e) => setNewCase({ ...newCase, phone: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`} placeholder="+92 3XX XXXXXXX" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.destinationCountry")} *</label>
                    <select value={newCase.country} onChange={(e) => setNewCase({ ...newCase, country: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                      <option>Saudi Arabia</option><option>UAE</option><option>Qatar</option><option>Kuwait</option><option>Oman</option><option>Bahrain</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.jobType")} *</label>
                    <select value={newCase.jobType} onChange={(e) => setNewCase({ ...newCase, jobType: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                      <option>Driver</option><option>Construction Worker</option><option>Hospitality</option><option>Healthcare</option><option>Security Guard</option><option>Other</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.assignAgent")}</label>
                    <select value={newCase.agent} onChange={(e) => setNewCase({ ...newCase, agent: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                      <option>Faizan</option><option>Imran</option><option>Safeer</option><option>Aynee</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={`flex gap-3 justify-end p-6 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowNewCaseModal(false)}
                  className={`px-6 py-3 border rounded-xl transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {t("cancel")}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateCase}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isLoading ? t("dashboard.creating") : t("dashboard.createCase")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Broadcast Modal */}
        {showBroadcastModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 lg:p-4"
            onClick={() => setShowBroadcastModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} w-full h-full lg:h-auto lg:max-h-[90vh] overflow-y-auto lg:rounded-2xl shadow-2xl lg:max-w-2xl`}
            >
              <div className={`flex items-center justify-between p-6 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("dashboard.broadcastNotification")}</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowBroadcastModal(false)} className={`p-2 rounded-xl transition-all ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className={`w-5 h-5 ${darkMode ? "text-gray-400" : "text-gray-600"}`} />
                </motion.button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.sendTo")}</label>
                    <select value={broadcast.recipients} onChange={(e) => setBroadcast({ ...broadcast, recipients: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                      <option>{t("dashboard.allAgents")}</option><option>{t("dashboard.allCustomers")}</option><option>{t("dashboard.specificAgent")}</option><option>{t("dashboard.specificCustomer")}</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.channel")}</label>
                    <select value={broadcast.channel} onChange={(e) => setBroadcast({ ...broadcast, channel: e.target.value })} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}>
                      <option>WhatsApp</option><option>SMS</option><option>Email</option><option>In-App</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.message")}</label>
                  <textarea value={broadcast.message} onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })} rows={4} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`} placeholder="Type your message here..."></textarea>
                </div>
              </div>
              <div className={`flex gap-3 justify-end p-6 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowBroadcastModal(false)} className={`px-6 py-3 border rounded-xl transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  {t("cancel")}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendBroadcast}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 disabled:opacity-50 transition-all shadow-lg flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isLoading ? t("dashboard.sending") : t("dashboard.sendNotification")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Meeting Modal */}
        {showMeetingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 lg:p-4"
            onClick={() => setShowMeetingModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${darkMode ? "bg-gray-800" : "bg-white"} w-full h-full lg:h-auto lg:max-h-[90vh] overflow-y-auto lg:rounded-2xl shadow-2xl lg:max-w-2xl`}
            >
              <div className={`flex items-center justify-between p-6 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("dashboard.scheduleMeeting")}</h2>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMeetingModal(false)}
                  className={`p-2 rounded-xl transition-all ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <X className={`w-5 h-5 ${darkMode ? "text-gray-400" : "text-gray-600"}`} />
                </motion.button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.meetingTitle")} *</label>
                  <input
                    type="text"
                    value={meeting.title}
                    onChange={(e) => setMeeting({ ...meeting, title: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`}
                    placeholder="E.g., Weekly Team Review"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.date")} *</label>
                    <input
                      type="date"
                      value={meeting.date}
                      onChange={(e) => setMeeting({ ...meeting, date: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.time")} *</label>
                    <input
                      type="time"
                      value={meeting.time}
                      onChange={(e) => setMeeting({ ...meeting, time: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{t("dashboard.attendees")}</label>
                  <select
                    value={meeting.attendees}
                    onChange={(e) => setMeeting({ ...meeting, attendees: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                  >
                    <option>{t("dashboard.allTeam")}</option>
                    <option>{t("dashboard.allAgents")}</option>
                    <option>{t("dashboard.managementOnly")}</option>
                    <option>{t("dashboard.selectSpecific")}</option>
                  </select>
                </div>
              </div>
              <div className={`flex gap-3 justify-end p-6 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowMeetingModal(false)}
                  className={`px-6 py-3 border rounded-xl transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {t("cancel")}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleScheduleMeeting}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {isLoading ? t("dashboard.scheduling") : t("dashboard.scheduleMeeting")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}

function VisaVerseAdminOverview({ darkMode, isUrdu }: { darkMode: boolean; isUrdu: boolean }) {
  const { classicMode, xp, badges, satisfaction } = useVisaVerse();
  if (classicMode) return null;

  const card = darkMode ? "bg-gray-800" : "bg-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6"
    >
      {/* Satisfaction Meter + Quick Stats */}
      <div className={`${card} rounded-2xl shadow-lg p-4 md:p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💬</span>
          <h3 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "کسٹمر فیڈبیک" : "Client Feedback"}
          </h3>
        </div>
        <SatisfactionMeter isUrdu={isUrdu} />
        {satisfaction.length === 0 && (
          <div className={`text-center py-6 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            <span className="text-3xl mb-2 block">💬</span>
            <p className="text-sm">{isUrdu ? "ابھی تک کوئی فیڈبیک نہیں" : "No feedback yet"}</p>
            <p className="text-xs mt-1">{isUrdu ? "کسٹمر پورٹل سے فیڈبیک آئے گا" : "Feedback comes from customer portal"}</p>
          </div>
        )}

        {/* Quick gamification stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className={`p-2 rounded-lg text-center ${darkMode ? "bg-emerald-900/20" : "bg-emerald-50"}`}>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{xp}</p>
            <p className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>XP</p>
          </div>
          <div className={`p-2 rounded-lg text-center ${darkMode ? "bg-purple-900/20" : "bg-purple-50"}`}>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{badges.length}</p>
            <p className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{isUrdu ? "بیجز" : "Badges"}</p>
          </div>
          <div className={`p-2 rounded-lg text-center ${darkMode ? "bg-blue-900/20" : "bg-blue-50"}`}>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{satisfaction.length}</p>
            <p className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{isUrdu ? "جوابات" : "Responses"}</p>
          </div>
        </div>
      </div>

      {/* Agent Leaderboard */}
      <div className={`lg:col-span-2 ${card} rounded-2xl shadow-lg p-4 md:p-6`}>
        <AgentLeaderboardWidget isUrdu={isUrdu} />
      </div>
    </motion.div>
  );
}