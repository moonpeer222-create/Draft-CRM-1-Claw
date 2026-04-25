// Shared Notification Panel — used in AdminHeader, AgentHeader, and CustomerHeader
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { NotificationService, type Notification } from "../lib/notifications";
import { toast } from "../lib/toast";
import { AuditLogService } from "../lib/auditLog";
import { notificationSound } from "../lib/notificationSound";
import {
  getBridgeNotificationsForRole,
  markAllBridgeRead,
  clearBridgeNotifications,
  type BridgeNotification,
} from "../lib/pushNotifications";
import {
  Bell, FileText, CreditCard, Upload, Clock, AlertTriangle,
  User, Settings as SettingsIcon, Trash2, Shield, CalendarCheck, MessageCircle, XCircle, CheckCircle2, ExternalLink, RefreshCw, Monitor,
  Volume2, VolumeX
} from "lucide-react";

interface NotificationPanelProps {
  role: "admin" | "agent" | "customer";
  userId?: string;
  compact?: boolean; // minimal style for UnifiedHeader integration
}

export function NotificationBell({ role, userId, compact }: NotificationPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, isUrdu, t } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => notificationSound.isEnabled());
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(() => {
    const notifs = NotificationService.getNotificationsForRole(role, userId);
    // Merge cross-portal bridge notifications (operator → admin, etc.)
    const bridgeNotifs = getBridgeNotificationsForRole(role);
    const bridgeTypeMap: Record<string, Notification["type"]> = {
      payment_recorded: "payment",
      flag: "alert",
      document_flagged: "document",
      status_confirmed: "system",
      report_sent: "system",
    };
    const bridgeAsNotifs: Notification[] = bridgeNotifs.map((bn: BridgeNotification) => ({
      id: bn.id,
      type: bridgeTypeMap[bn.type] || "system" as const,
      priority: bn.type === "flag" || bn.type === "document_flagged" ? "high" as const : "medium" as const,
      title: `🖥️ Operator: ${bn.type.replace(/_/g, " ")}`,
      titleUrdu: `🖥️ آپریٹر: ${bn.messageUr?.slice(0, 30) || bn.type}`,
      message: bn.messageEn,
      messageUrdu: bn.messageUr,
      timestamp: bn.timestamp,
      read: bn.read,
      actionable: false,
      targetRole: role as any,
      metadata: { fromRole: bn.fromRole, bridgeType: bn.type, isBridge: true },
    }));
    const merged = [...notifs, ...bridgeAsNotifs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
    setNotifications(merged);
  }, [role, userId]);

  useEffect(() => {
    loadNotifications();
    // Poll every 5 seconds for new notifications
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (showPanel && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showPanel]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        (!mobileSheetRef.current || !mobileSheetRef.current.contains(target))
      ) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    loadNotifications();
    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsRefreshing(false);
    toast.success(isUrdu ? "تازہ کر دیا گیا" : "Refreshed");
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead(role);
    markAllBridgeRead(role);
    loadNotifications();
    toast.success(isUrdu ? "تمام پڑھی گئیں" : "All marked as read");
  };

  const handleClearAll = () => {
    NotificationService.clearAllForRole(role);
    clearBridgeNotifications(role);
    loadNotifications();
    setShowPanel(false);
    toast.success(isUrdu ? "تمام صاف ہو گئیں" : "All notifications cleared");
  };

  const handleNotifClick = (notif: Notification) => {
    NotificationService.markAsRead(notif.id);
    loadNotifications();
    if (notif.actionUrl) {
      setShowPanel(false);
      const meta = notif.metadata;

      // Determine portal prefix from current URL for portal-aware navigation
      const portalPrefix = location.pathname.startsWith("/master") ? "/master"
        : location.pathname.startsWith("/agent") ? "/agent"
        : location.pathname.startsWith("/customer") ? "/customer"
        : location.pathname.startsWith("/operator") ? "/operator"
        : "/admin";

      // Determine the correct role-based base path for case notifications
      const casesBasePath = role === "agent" ? "/agent/cases"
        : role === "customer" ? "/customer"
        : `${portalPrefix}/cases`;

      // For case-related notifications, use URL-based deep-links with query params
      let caseId: string | null = null;
      let tab: string | null = null;

      if (notif.type === "case" || meta?.caseId) {
        caseId = meta?.caseId || extractCaseId(notif.message);
      }
      if (notif.type === "payment" && meta?.caseId) {
        caseId = meta.caseId;
        tab = "payments";
      }
      if (notif.type === "document") {
        caseId = meta?.caseId || extractCaseId(notif.message);
        if (caseId) tab = "documents";
      }
      if (notif.type === "deadline") {
        caseId = meta?.caseId || extractCaseId(notif.message);
      }

      // Case-related: use URL param pattern with query params
      if (caseId && role !== "customer") {
        const params = new URLSearchParams({ from: "notification" });
        if (tab) params.set("tab", tab);
        navigate(`${casesBasePath}/${caseId}?${params.toString()}`);
        return;
      }

      // Non-case notifications: use state-based navigation for attendance/agent highlights
      let targetUrl = notif.actionUrl;
      if (notif.actionUrl === "/admin/cases" && role === "customer") {
        targetUrl = "/customer";
      } else if (notif.actionUrl === "/admin/attendance" && role === "agent") {
        targetUrl = "/agent/attendance";
      } else if (notif.actionUrl === "/admin/team" && role === "agent") {
        targetUrl = "/agent/performance";
      } else if (portalPrefix !== "/admin" && notif.actionUrl.startsWith("/admin/")) {
        // Rewrite /admin/... URLs to current portal prefix for master admin
        targetUrl = notif.actionUrl.replace("/admin", portalPrefix);
      }

      const navState: Record<string, any> = {};
      if (notif.type === "attendance" && meta?.agentName) {
        navState.highlightAgent = meta.agentName;
      }
      if (notif.type === "agent" && meta?.agentName) {
        navState.highlightAgent = meta.agentName;
      }

      navigate(targetUrl, { state: Object.keys(navState).length > 0 ? navState : undefined });
    }
  };

  // Extract case ID pattern (EMR-XXXX-XXXX) from notification message
  const extractCaseId = (message: string): string | null => {
    const match = message.match(/EMR-\d{4}-\d{4}/);
    return match ? match[0] : null;
  };

  const handleDeleteNotif = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    NotificationService.deleteNotification(notifId);
    loadNotifications();
  };

  // Persist action status into notification metadata
  const updateNotifMetadata = (notifId: string, updates: Record<string, any>) => {
    const all = NotificationService.getNotifications();
    const notif = all.find(n => n.id === notifId);
    if (notif) {
      notif.metadata = { ...notif.metadata, ...updates };
      notif.read = true;
      NotificationService.saveNotifications(all);
    }
    loadNotifications();
  };

  const handlePaymentRequestAction = (e: React.MouseEvent, notif: Notification, action: "whatsapp" | "decline" | "sent") => {
    e.stopPropagation();
    const meta = notif.metadata;
    if (!meta) return;

    if (action === "whatsapp") {
      const phone = "923186986259"; // Admin contact (international format for wa.me)
      const message = encodeURIComponent(
        `Payment History for Case ${meta.caseId} (${meta.customerName})\nRequested by: ${meta.agentName}\n\nPlease find the payment details attached.`
      );
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
      updateNotifMetadata(notif.id, { status: "shared", actionAt: new Date().toISOString() });
      toast.success(isUrdu ? "واٹس ایپ کھل رہا ہے..." : "Opening WhatsApp...");
    } else if (action === "decline") {
      updateNotifMetadata(notif.id, { status: "declined", actionAt: new Date().toISOString() });
      toast.info(isUrdu ? "درخواست مسترد کر دی گئی" : "Request declined");
    } else if (action === "sent") {
      updateNotifMetadata(notif.id, { status: "shared", actionAt: new Date().toISOString() });
      toast.success(isUrdu ? "بھیجا گیا نشان زد" : "Marked as sent");
    }
  };

  const handlePaymentApproval = (e: React.MouseEvent, notif: Notification, approved: boolean) => {
    e.stopPropagation();
    updateNotifMetadata(notif.id, {
      approvalStatus: approved ? "approved" : "rejected",
      actionAt: new Date().toISOString(),
    });
    const meta = notif.metadata;
    AuditLogService.logApproval(
      "Imran Khan",
      approved ? "approval_granted" : "approval_denied",
      `Payment PKR ${meta?.amount?.toLocaleString()} for ${meta?.caseId}`,
      `Agent: ${meta?.agentName}`
    );
    if (approved) {
      toast.success(isUrdu ? "ادائیگی منظور!" : "Payment approved!");
    } else {
      toast.info(isUrdu ? "ادائیگی مسترد" : "Payment rejected");
    }
  };

  const getNotifIcon = (type: Notification["type"]) => {
    const iconMap: Record<string, JSX.Element> = {
      case: <FileText className="w-4 h-4 text-blue-500" />,
      payment: <CreditCard className="w-4 h-4 text-blue-500" />,
      document: <Upload className="w-4 h-4 text-orange-500" />,
      deadline: <Clock className="w-4 h-4 text-red-500" />,
      agent: <Shield className="w-4 h-4 text-purple-500" />,
      customer: <User className="w-4 h-4 text-blue-500" />,
      system: <SettingsIcon className="w-4 h-4 text-gray-500" />,
      attendance: <CalendarCheck className="w-4 h-4 text-teal-500" />,
      alert: <AlertTriangle className="w-4 h-4 text-red-500" />,
    };
    return iconMap[type] || <Bell className="w-4 h-4 text-gray-500" />;
  };

  const getPriorityColor = (priority: Notification["priority"]) => {
    const colors: Record<string, string> = {
      critical: "border-l-red-500",
      high: "border-l-orange-500",
      medium: "border-l-blue-500",
      low: "border-l-gray-400",
    };
    return priority ? colors[priority] || "" : "";
  };

  const getTimeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isUrdu ? "ابھی" : "Just now";
    if (mins < 60) return isUrdu ? `${mins} منٹ پہلے` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isUrdu ? `${hrs} گھنٹے پہلے` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return isUrdu ? `${days} دن پہلے` : `${days}d ago`;
  };

  // Check if a notification's action buttons have already been acted on
  const getActionStatus = (notif: Notification): string | null => {
    if (!notif.metadata) return null;
    if (notif.metadata.type === "payment_history_request") {
      return notif.metadata.status === "shared" ? "shared"
        : notif.metadata.status === "declined" ? "declined"
        : null;
    }
    if (notif.metadata.type === "payment_pending_approval") {
      return notif.metadata.approvalStatus || null;
    }
    return null;
  };

  // Render function for panel content (shared between desktop dropdown and mobile portal)
  const renderPanelContent = () => (
    <>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
        <div className="flex items-center gap-2">
          <Bell className={`w-5 h-5 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
          <span className={`font-bold text-lg sm:text-base ${darkMode ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "اطلاعات" : "Notifications"}
          </span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className={`text-xs px-3 py-2 rounded-lg transition-colors font-medium min-h-[36px] active:opacity-80 ${
                darkMode ? "text-blue-400 hover:bg-gray-700" : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              {isUrdu ? "سب پڑھیں" : "Mark all read"}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center active:opacity-80 ${
                darkMode ? "hover:bg-gray-700 text-gray-400 hover:text-red-400" : "hover:bg-gray-100 text-gray-500 hover:text-red-600"
              }`}
              title="Clear All"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center active:opacity-80 ${
              darkMode ? "hover:bg-gray-700 text-gray-400 hover:text-blue-400" : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
            }`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              notificationSound.setEnabled(next);
              if (next) notificationSound.success();
              toast.info(isUrdu ? (next ? "آواز آن" : "آواز آف") : (next ? "Sound on" : "Sound off"));
            }}
            className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center active:opacity-80 ${
              darkMode ? "hover:bg-gray-700 text-gray-400 hover:text-blue-400" : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
            }`}
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain sm:max-h-96 min-h-[300px] sm:min-h-0 -webkit-overflow-scrolling-touch">
        {notifications.length === 0 ? (
          <div className={`px-4 py-8 text-center ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{isUrdu ? "کوئی اطلاع نہیں" : "No notifications"}</p>
          </div>
        ) : (
          notifications.slice(0, 20).map((notif, index) => {
            const actionStatus = getActionStatus(notif);
            const isUnreadApprovalResult = !notif.read && notif.metadata?.type === "payment_approval_result";
            const approvalResultColor = notif.metadata?.result === "approved" ? "green" : "red";
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: isUrdu ? 20 : -20 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  ...(isUnreadApprovalResult ? {
                    backgroundColor: approvalResultColor === "green"
                      ? [darkMode ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)", darkMode ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.14)", darkMode ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)"]
                      : [darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)", darkMode ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.14)", darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)"]
                  } : {})
                }}
                transition={{
                  delay: index * 0.03,
                  ...(isUnreadApprovalResult ? { backgroundColor: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } } : {})
                }}
                onClick={() => handleNotifClick(notif)}
                className={`group flex items-start gap-3 px-4 py-3.5 sm:py-3 cursor-pointer transition-colors border-b border-l-4 last:border-b-0 min-h-[56px] active:opacity-80 ${
                  isUnreadApprovalResult
                    ? approvalResultColor === "green"
                      ? "border-l-green-500"
                      : "border-l-red-500"
                    : getPriorityColor(notif.priority)
                } ${
                  notif.read
                    ? darkMode ? "border-b-gray-700/50" : "border-b-gray-100"
                    : darkMode ? "bg-blue-900/10 border-b-gray-700/50" : "bg-blue-50/50 border-b-gray-100"
                } ${darkMode ? "hover:bg-gray-700/40" : "hover:bg-gray-50"}`}
              >
                <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                  darkMode ? "bg-gray-700/60" : "bg-gray-100"
                }`}>
                  {/* Override icon for agent payment approval result notifications */}
                  {notif.metadata?.type === "payment_approval_result" ? (
                    notif.metadata.result === "approved" ? (
                      <motion.div
                        className="relative"
                        animate={!notif.read ? {
                          scale: [1, 1.15, 1],
                          filter: [
                            "drop-shadow(0 0 0px rgba(16,185,129,0))",
                            "drop-shadow(0 0 6px rgba(16,185,129,0.6))",
                          ]
                        } : {}}
                        transition={!notif.read ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                      >
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <CheckCircle2 className="w-2.5 h-2.5 text-blue-500 absolute -bottom-0.5 -right-0.5 bg-white dark:bg-gray-700 rounded-full" />
                      </motion.div>
                    ) : (
                      <motion.div
                        className="relative"
                        animate={!notif.read ? {
                          scale: [1, 1.15, 1],
                          filter: [
                            "drop-shadow(0 0 0px rgba(239,68,68,0))",
                            "drop-shadow(0 0 6px rgba(239,68,68,0.6))",
                          ]
                        } : {}}
                        transition={!notif.read ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                      >
                        <CreditCard className="w-4 h-4 text-red-500" />
                        <XCircle className="w-2.5 h-2.5 text-red-500 absolute -bottom-0.5 -right-0.5 bg-white dark:bg-gray-700 rounded-full" />
                      </motion.div>
                    )
                  ) : (
                    getNotifIcon(notif.type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${
                      notif.read
                        ? darkMode ? "text-gray-400" : "text-gray-600"
                        : darkMode ? "text-white font-medium" : "text-gray-900 font-medium"
                    }`}>
                      {isUrdu && notif.titleUrdu ? notif.titleUrdu : notif.title}
                    </p>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                    {isUrdu && notif.messageUrdu ? notif.messageUrdu : notif.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-[10px] ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                      {getTimeAgo(notif.timestamp)}
                    </p>
                    {notif.metadata?.isBridge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${darkMode ? "bg-teal-900/30 text-teal-400" : "bg-teal-50 text-teal-700"}`}>
                        <Monitor className="w-2.5 h-2.5" />
                        {isUrdu ? "آپریٹر" : "Operator"}
                      </span>
                    )}
                    {notif.actionLabel && !actionStatus && (
                      <span className={`text-[10px] font-medium ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                        {notif.actionLabel} →
                      </span>
                    )}
                  </div>

                  {/* Payment Request Action Buttons (Admin Only) */}
                  {role === "admin" && notif.metadata?.type === "payment_history_request" && (
                    actionStatus ? (
                      <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg w-fit ${
                        actionStatus === "shared"
                          ? darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                          : darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"
                      }`}>
                        {actionStatus === "shared" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {actionStatus === "shared"
                          ? (isUrdu ? "شیئر کیا گیا" : "Shared")
                          : (isUrdu ? "مسترد کیا گیا" : "Declined")}
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center gap-1.5 mt-2"
                      >
                        <button
                          onClick={(e) => handlePaymentRequestAction(e, notif, "whatsapp")}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-semibold transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          {isUrdu ? "واٹس ایپ" : "Share via WhatsApp"}
                        </button>
                        <button
                          onClick={(e) => handlePaymentRequestAction(e, notif, "decline")}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${darkMode ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                        >
                          <XCircle className="w-3 h-3" />
                          {isUrdu ? "مسترد" : "Decline"}
                        </button>
                        <button
                          onClick={(e) => handlePaymentRequestAction(e, notif, "sent")}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${darkMode ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {isUrdu ? "بھیجا گیا" : "Mark Sent"}
                        </button>
                      </motion.div>
                    )
                  )}

                  {/* Payment Pending Approval Actions (Admin Only) */}
                  {role === "admin" && notif.metadata?.type === "payment_pending_approval" && (
                    actionStatus ? (
                      <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg w-fit ${
                        actionStatus === "approved"
                          ? darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                          : darkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"
                      }`}>
                        {actionStatus === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {actionStatus === "approved"
                          ? (isUrdu ? "منظور شدہ" : "Approved")
                          : (isUrdu ? "مسترد شدہ" : "Rejected")}
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center gap-1.5 mt-2"
                      >
                        <button
                          onClick={(e) => handlePaymentApproval(e, notif, true)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {isUrdu ? "منظور" : "Approve"}
                        </button>
                        <button
                          onClick={(e) => handlePaymentApproval(e, notif, false)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${darkMode ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                        >
                          <XCircle className="w-3 h-3" />
                          {isUrdu ? "مسترد" : "Reject"}
                        </button>
                      </motion.div>
                    )
                  )}

                  {/* Agent Payment Approval Result Badge (Agent Only) */}
                  {role === "agent" && notif.metadata?.type === "payment_approval_result" && (
                    <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg w-fit ${
                      notif.metadata.result === "approved"
                        ? darkMode ? "bg-blue-900/30 text-blue-400 border border-blue-800/40" : "bg-blue-50 text-blue-700 border border-blue-200"
                        : darkMode ? "bg-red-900/30 text-red-400 border border-red-800/40" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {notif.metadata.result === "approved"
                        ? <><CheckCircle2 className="w-3 h-3" /> {isUrdu ? "✓ منظور — رقم جمع ہو گئی" : "✓ Approved — Amount Credited"}</>
                        : <><XCircle className="w-3 h-3" /> {isUrdu ? "✗ مسترد — رقم جمع نہیں ہوئی" : "✗ Rejected — Not Credited"}</>
                      }
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  {notif.actionUrl && (
                    <div className={`p-1.5 rounded opacity-0 group-hover:opacity-100 sm:transition-opacity ${
                      darkMode ? "text-blue-400" : "text-blue-600"
                    }`}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <button
                    onClick={(e) => handleDeleteNotif(e, notif.id)}
                    aria-label={isUrdu ? "حذف کریں" : "Delete notification"}
                    className={`p-1.5 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-[32px] min-h-[32px] flex items-center justify-center ${
                      darkMode ? "hover:bg-gray-600 text-gray-500" : "hover:bg-gray-200 text-gray-400"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className={`flex items-center justify-between px-4 py-3 border-t flex-shrink-0 ${darkMode ? "border-gray-700" : "border-gray-200"}`} style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
          <span className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            {notifications.length} {isUrdu ? "اطلاعات" : "notifications"}
          </span>
          <button
            onClick={handleClearAll}
            className={`text-xs font-medium transition-colors px-3 py-1.5 rounded-lg min-h-[32px] active:opacity-80 ${
              darkMode ? "text-gray-500 hover:text-gray-400 hover:bg-gray-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            {isUrdu ? "سب صاف کریں" : "Clear all"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        whileHover={{ scale: compact ? 1.05 : 1.12, ...(compact ? {} : { boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }) }}
        whileTap={{ scale: 0.9 }}
        onClick={() => { setShowPanel(!showPanel); loadNotifications(); }}
        aria-label={isUrdu ? "اطلاعات" : "Notifications"}
        className={compact
          ? `relative p-2 rounded-xl transition-colors ${
              darkMode ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`
          : `p-[13px] rounded-xl relative transition-all duration-200 border bg-transparent shadow-lg min-w-[44px] min-h-[44px] flex items-center justify-center ${
              darkMode
                ? "border-slate-700 hover:bg-slate-700/20 active:bg-slate-600/30"
                : "border-gray-300 hover:bg-gray-100/60 active:bg-gray-200/60"
            }`}
      >
        <motion.div
          animate={unreadCount > 0 ? { rotate: [0, -15, 15, -10, 10, -5, 5, 0] } : {}}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 3 }}
        >
          <Bell className={`w-5 h-5 ${compact ? "" : "text-blue-400"}`} />
        </motion.div>
        {unreadCount > 0 && (
          compact ? (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          ) : (
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 rounded-full border-2 flex items-center justify-center shadow-lg shadow-red-500/30 ${
                darkMode ? "border-slate-800" : "border-white"
              }`}
            >
              <span className="text-[10px] text-white font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>
            </motion.span>
          )
        )}
      </motion.button>

      {/* Desktop dropdown renders in-place; Mobile bottom sheet renders via portal to escape transform containment */}
      <AnimatePresence>
        {showPanel && (
          <>
            {/* Desktop dropdown (rendered in place) */}
            <motion.div
              initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`
                hidden sm:flex sm:flex-col
                absolute inset-auto bottom-auto top-full
                ${isUrdu ? "left-0" : "right-0"} mt-2
                w-96 max-h-[80vh] rounded-2xl shadow-2xl border
                overflow-hidden
                ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}
              `}
            >
              {renderPanelContent()}
            </motion.div>

            {/* Mobile bottom sheet via portal to escape transform containment from motion.header */}
            {createPortal(
              <AnimatePresence>
                {showPanel && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] sm:hidden"
                      onClick={() => setShowPanel(false)}
                    />
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className={`
                        fixed bottom-0 left-0 right-0 z-[9999] flex flex-col sm:hidden
                        max-h-[85vh] rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
                        overflow-hidden
                        ${darkMode ? "bg-gray-800" : "bg-white"}
                      `}
                      ref={mobileSheetRef}
                    >
                      {/* Drag Handle */}
                      <div className="w-full flex justify-center py-3 bg-inherit cursor-grab active:cursor-grabbing touch-none" onClick={() => setShowPanel(false)}>
                        <div className={`w-12 h-1.5 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-300"}`} />
                      </div>
                      {renderPanelContent()}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}