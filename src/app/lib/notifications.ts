// Advanced Notification & Alert System — with Supabase sync hooks
import { CRMDataStore } from "./mockData";
import { useNotificationStore, type Notification } from "./notificationStore";
export { type Notification } from "./notificationStore";

export interface Alert {
  id: string;
  category: "deadline" | "payment_overdue" | "document_pending" | "system" | "performance";
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  description: string;
  affectedItems: number;
  timestamp: string;
  dismissed: boolean;
  autoResolve: boolean;
  resolutionSteps?: string[];
}

export class NotificationService {
  private static ALERTS_KEY = "crm_alerts";
  private static _pushNotifications: (() => void) | null = null;

  // Register sync push (called once from SyncProvider)
  static registerSyncPush(pushFn: () => void) {
    this._pushNotifications = pushFn;
  }

  private static notifySync() {
    if (this._pushNotifications) this._pushNotifications();
  }

  // Get all notifications
  static getNotifications(): Notification[] {
    // Use the Zustand memory store instead of blocking the main thread with localStorage
    return useNotificationStore.getState().notifications;
  }

  // Get notifications for a specific role
  static getNotificationsForRole(role: "admin" | "agent" | "customer", userId?: string): Notification[] {
    const all = this.getNotifications();
    return all.filter(n => {
      if (n.targetRole && n.targetRole !== "all" && n.targetRole !== role) return false;
      if (n.targetUserId && n.targetUserId !== userId) return false;
      return true;
    });
  }

  // Save notifications
  static saveNotifications(notifications: Notification[]): void {
    // Persist to Zustand memory cache
    useNotificationStore.getState().setNotifications(notifications);
    // Fire cloud sync hook
    this.notifySync();
  }

  // Add new notification
  static addNotification(notification: Omit<Notification, "id" | "timestamp" | "read">): Notification {
    const notifications = this.getNotifications();
    const newNotification: Notification = {
      ...notification,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    notifications.unshift(newNotification);
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }
    
    this.saveNotifications(notifications);
    return newNotification;
  }

  // Mark as read
  static markAsRead(notificationId: string): void {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications(notifications);
    }
  }

  // Mark all as read
  static markAllAsRead(role?: string): void {
    const notifications = this.getNotifications();
    notifications.forEach(n => {
      if (!role || !n.targetRole || n.targetRole === "all" || n.targetRole === role) {
        n.read = true;
      }
    });
    this.saveNotifications(notifications);
  }

  // Delete notification
  static deleteNotification(notificationId: string): void {
    const notifications = this.getNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    this.saveNotifications(filtered);
  }

  // Clear all for a role
  static clearAllForRole(role: string): void {
    const notifications = this.getNotifications();
    const filtered = notifications.filter(n =>
      n.targetRole && n.targetRole !== "all" && n.targetRole !== role
    );
    this.saveNotifications(filtered);
  }

  // Get unread count
  static getUnreadCount(role?: string, userId?: string): number {
    const notifications = role ? this.getNotificationsForRole(role as any, userId) : this.getNotifications();
    return notifications.filter(n => !n.read).length;
  }

  // Get alerts
  static getAlerts(): Alert[] {
    const stored = localStorage.getItem(this.ALERTS_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    // Production: start with empty alerts — no seed data
    return [];
  }

  // Save alerts
  static saveAlerts(alerts: Alert[]): void {
    localStorage.setItem(this.ALERTS_KEY, JSON.stringify(alerts));
  }

  // Add alert
  static addAlert(alert: Omit<Alert, "id" | "timestamp" | "dismissed">): Alert {
    const alerts = this.getAlerts();
    const newAlert: Alert = {
      ...alert,
      id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    alerts.unshift(newAlert);
    this.saveAlerts(alerts);
    return newAlert;
  }

  // Dismiss alert
  static dismissAlert(alertId: string): void {
    const alerts = this.getAlerts();
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      this.saveAlerts(alerts);
    }
  }

  // ===== Specific notification generators =====

  static notifyCaseCreated(caseId: string, customerName: string, agentName: string): Notification {
    return this.addNotification({
      type: "case",
      priority: "medium",
      title: "New Case Created",
      titleUrdu: "نیا کیس بنایا گیا",
      message: `Case ${caseId} for ${customerName} has been created and assigned to ${agentName}`,
      messageUrdu: `کیس ${caseId} بنایا گیا - ${customerName} - ایجنٹ: ${agentName}`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "View Case",
      targetRole: "all",
      metadata: { caseId, customerName, agentName },
    });
  }

  static notifyCaseStatusChanged(caseId: string, customerName: string, oldStatus: string, newStatus: string): Notification {
    return this.addNotification({
      type: "case",
      priority: newStatus === "completed" ? "high" : "medium",
      title: "Case Status Updated",
      titleUrdu: "کیس کی حیثیت اپ ڈیٹ ہوئی",
      message: `Case ${caseId} for ${customerName} changed from ${oldStatus} to ${newStatus}`,
      messageUrdu: `کیس ${caseId} (${customerName}) کی حیثیت ${oldStatus} سے ${newStatus} ہوئی`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "View Details",
      targetRole: "all",
      metadata: { caseId, customerName, oldStatus, newStatus },
    });
  }

  static notifyPaymentReceived(caseId: string, amount: number, customerName: string): Notification {
    return this.addNotification({
      type: "payment",
      priority: "high",
      title: "Payment Received",
      titleUrdu: "ادائیگی موصول ہوئی",
      message: `Payment of PKR ${amount.toLocaleString()} received for case ${caseId} (${customerName})`,
      messageUrdu: `PKR ${amount.toLocaleString()} کی ادائیگی موصول - کیس ${caseId} (${customerName})`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "View Receipt",
      metadata: { amount, caseId },
      targetRole: "all",
    });
  }

  static notifyPaymentOverdue(caseId: string, customerName: string, daysOverdue: number): Notification {
    return this.addNotification({
      type: "payment",
      priority: "critical",
      title: "Payment Overdue",
      titleUrdu: "ادائیگی واجب الادا",
      message: `Payment for case ${caseId} (${customerName}) is ${daysOverdue} days overdue`,
      messageUrdu: `کیس ${caseId} (${customerName}) کی ادائیگی ${daysOverdue} دن سے واجب الادا ہے`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "Send Reminder",
      metadata: { daysOverdue, caseId },
      targetRole: "admin",
    });
  }

  static notifyDocumentUploaded(caseId: string, documentName: string, customerName: string): Notification {
    return this.addNotification({
      type: "document",
      priority: "medium",
      title: "New Document Uploaded",
      titleUrdu: "نئی دستاویز اپ لوڈ ہوئی",
      message: `${documentName} uploaded for case ${caseId} (${customerName})`,
      messageUrdu: `${documentName} اپ لوڈ ہوئی - کیس ${caseId} (${customerName})`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "Review Document",
      targetRole: "all",
      metadata: { caseId, documentName, customerName },
    });
  }

  static notifyDocumentExpiring(documentName: string, daysUntilExpiry: number): Notification {
    return this.addNotification({
      type: "document",
      priority: daysUntilExpiry < 7 ? "critical" : "high",
      title: "Document Expiring Soon",
      titleUrdu: "دستاویز کی میعاد ختم ہونے والی ہے",
      message: `${documentName} will expire in ${daysUntilExpiry} days`,
      messageUrdu: `${documentName} کی میعاد ${daysUntilExpiry} دنوں میں ختم ہو جائے گی`,
      actionable: true,
      actionLabel: "Renew Now",
      targetRole: "admin",
    });
  }

  static notifyDeadlineApproaching(caseId: string, customerName: string, deadline: string, daysRemaining: number): Notification {
    return this.addNotification({
      type: "deadline",
      priority: daysRemaining < 3 ? "critical" : daysRemaining < 7 ? "high" : "medium",
      title: "Deadline Approaching",
      titleUrdu: "آخری تاریخ قریب ہے",
      message: `Case ${caseId} (${customerName}) deadline in ${daysRemaining} days (${deadline})`,
      messageUrdu: `کیس ${caseId} (${customerName}) کی آخری تاریخ ${daysRemaining} دنوں میں (${deadline})`,
      actionable: true,
      actionUrl: `/admin/cases`,
      actionLabel: "View Case",
      metadata: { caseId, customerName, daysRemaining, deadline },
      targetRole: "all",
    });
  }

  static notifyAgentPerformance(agentName: string, metric: string, value: number, threshold: number): Notification {
    return this.addNotification({
      type: "agent",
      priority: value < threshold ? "high" : "low",
      title: "Agent Performance Alert",
      titleUrdu: "ایجنٹ کارکردگی الرٹ",
      message: `${agentName}'s ${metric} is ${value}% (threshold: ${threshold}%)`,
      messageUrdu: `${agentName} کی ${metric} ${value}% ہے (حد: ${threshold}%)`,
      actionable: true,
      actionUrl: "/admin/team",
      actionLabel: "View Details",
      targetRole: "admin",
      metadata: { agentName, metric, value, threshold },
    });
  }

  static notifyAgentLogin(agentName: string): Notification {
    return this.addNotification({
      type: "agent",
      priority: "low",
      title: "Agent Logged In",
      titleUrdu: "ایجنٹ لاگ ان ہوا",
      message: `${agentName} has logged into the agent portal`,
      messageUrdu: `${agentName} ایجنٹ پورٹل میں لاگ ان ہوا`,
      actionable: false,
      targetRole: "admin",
      metadata: { agentName },
    });
  }

  static notifyCustomerLogin(customerName: string): Notification {
    return this.addNotification({
      type: "customer",
      priority: "low",
      title: "Customer Logged In",
      titleUrdu: "صارف لاگ ان ہوا",
      message: `${customerName} has logged into the customer portal`,
      messageUrdu: `${customerName} صارف پورٹل میں لاگ ان ہوا`,
      actionable: false,
      targetRole: "admin",
    });
  }

  static notifySystemUpdate(title: string, message: string): Notification {
    return this.addNotification({
      type: "system",
      priority: "low",
      title,
      message,
      actionable: false,
      targetRole: "all",
    });
  }

  static notifyUserCreated(userName: string, role: string): Notification {
    return this.addNotification({
      type: "system",
      priority: "medium",
      title: "New User Created",
      titleUrdu: "نیا صارف بنایا گیا",
      message: `${userName} (${role}) has been added to the system`,
      messageUrdu: `${userName} (${role}) سسٹم میں شامل کیا گیا`,
      actionable: true,
      actionUrl: "/admin/user-management",
      actionLabel: "View Users",
      targetRole: "admin",
    });
  }

  static notifyBroadcast(subject: string, message: string, channel: string): Notification {
    return this.addNotification({
      type: "system",
      priority: "high",
      title: `Broadcast: ${subject}`,
      titleUrdu: `نشریات: ${subject}`,
      message: `[${channel}] ${message}`,
      actionable: false,
      targetRole: "all",
    });
  }

  // Payment history request from agent to admin
  static notifyPaymentHistoryRequest(agentName: string, agentId: string, caseId: string, customerName: string, reason?: string): Notification {
    return this.addNotification({
      type: "payment",
      priority: "high",
      title: "Agent Payment History Request",
      titleUrdu: "ایجنٹ ادائیگی کی تاریخ کی درخواست",
      message: `${agentName} is requesting payment history for case ${caseId} (${customerName}).${reason ? ` Reason: ${reason}` : ""}`,
      messageUrdu: `${agentName} کیس ${caseId} (${customerName}) کی ادائیگی کی تاریخ کی درخواست کر رہا ہے۔${reason ? ` وجہ: ${reason}` : ""}`,
      actionable: true,
      actionUrl: "/admin/cases",
      actionLabel: "View Request",
      targetRole: "admin",
      metadata: { 
        type: "payment_history_request",
        agentName, 
        agentId, 
        caseId, 
        customerName,
        reason: reason || "General inquiry",
        status: "pending", // pending | shared | declined
        requestedAt: new Date().toISOString(),
      },
    });
  }

  // Agent payment entry pending approval notification
  static notifyPaymentPendingApproval(agentName: string, caseId: string, customerName: string, amount: number): Notification {
    return this.addNotification({
      type: "payment",
      priority: "high",
      title: "Payment Entry Pending Approval",
      titleUrdu: "ادائیگی کی اندراج منظوری کا انتظار",
      message: `${agentName} recorded PKR ${amount.toLocaleString()} for case ${caseId} (${customerName}). Awaiting admin approval.`,
      messageUrdu: `${agentName} نے کیس ${caseId} (${customerName}) کے لیے PKR ${amount.toLocaleString()} ریکارڈ کیا۔ ایڈمن کی منظوری کا انتظار ہے۔`,
      actionable: true,
      actionUrl: "/admin/cases",
      actionLabel: "Review Payment",
      targetRole: "admin",
      metadata: {
        type: "payment_pending_approval",
        agentName,
        caseId,
        customerName,
        amount,
      },
    });
  }

  // Notify agent that their submitted payment was approved by admin
  static notifyAgentPaymentApproved(agentName: string, caseId: string, customerName: string, amount: number): Notification {
    return this.addNotification({
      type: "payment",
      priority: "high",
      title: "Payment Approved",
      titleUrdu: "ادائیگی منظور ہو گئی",
      message: `Your payment of PKR ${amount.toLocaleString()} for case ${caseId} (${customerName}) has been approved and credited.`,
      messageUrdu: `آپ کی کیس ${caseId} (${customerName}) کے لیے PKR ${amount.toLocaleString()} کی ادائیگی منظور اور جمع ہو گئی۔`,
      actionable: true,
      actionUrl: `/agent/cases`,
      actionLabel: "View Case",
      targetRole: "agent",
      metadata: {
        type: "payment_approval_result",
        result: "approved",
        agentName,
        caseId,
        customerName,
        amount,
      },
    });
  }

  // Notify agent that their submitted payment was rejected by admin
  static notifyAgentPaymentRejected(agentName: string, caseId: string, customerName: string, amount: number): Notification {
    return this.addNotification({
      type: "payment",
      priority: "high",
      title: "Payment Rejected",
      titleUrdu: "ادائیگی مسترد ہو گئی",
      message: `Your payment of PKR ${amount.toLocaleString()} for case ${caseId} (${customerName}) has been rejected by admin.`,
      messageUrdu: `آپ کی کیس ${caseId} (${customerName}) کے لیے PKR ${amount.toLocaleString()} کی ادائیگی ایڈمن نے مسترد کر دی۔`,
      actionable: true,
      actionUrl: `/agent/cases`,
      actionLabel: "View Case",
      targetRole: "agent",
      metadata: {
        type: "payment_approval_result",
        result: "rejected",
        agentName,
        caseId,
        customerName,
        amount,
      },
    });
  }

  // ===== Attendance notification generators =====

  static notifyCheckIn(agentName: string, time: string, status: "on-time" | "late"): Notification {
    const isLate = status === "late";
    return this.addNotification({
      type: "attendance",
      priority: isLate ? "high" : "low",
      title: isLate ? "Late Check-In" : "Agent Checked In",
      titleUrdu: isLate ? "دیر سے حاضری" : "ایجنٹ حاضر ہوا",
      message: `${agentName} checked in at ${time}${isLate ? " (LATE)" : ""}`,
      messageUrdu: `${agentName} نے ${time} پر حاضری لگائی${isLate ? " (دیر سے)" : ""}`,
      actionable: true,
      actionUrl: "/admin/attendance",
      actionLabel: "View Attendance",
      metadata: { agentName, time, status },
      targetRole: "admin",
    });
  }

  static notifyCheckOut(agentName: string, time: string, totalHours: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "low",
      title: "Agent Checked Out",
      titleUrdu: "ایجنٹ روانہ ہوا",
      message: `${agentName} checked out at ${time}. Total working hours: ${totalHours}`,
      messageUrdu: `${agentName} ${time} پر روانہ ہوا۔ کل اوقات کار: ${totalHours}`,
      actionable: false,
      actionUrl: "/admin/attendance",
      metadata: { agentName, time, totalHours },
      targetRole: "admin",
    });
  }

  static notifyLeaveRequest(agentName: string, dates: string, leaveType: string, reason: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "medium",
      title: "New Leave Request",
      titleUrdu: "نئی چھٹی کی درخواست",
      message: `${agentName} requested ${leaveType} for ${dates}. Reason: ${reason}`,
      messageUrdu: `${agentName} نے ${dates} کے لیے ${leaveType} کی درخواست کی۔ وجہ: ${reason}`,
      actionable: true,
      actionUrl: "/admin/attendance",
      actionLabel: "Review Request",
      metadata: { agentName, dates, leaveType, reason },
      targetRole: "admin",
    });
  }

  static notifyLeaveApproved(agentName: string, dates: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "medium",
      title: "Leave Request Approved",
      titleUrdu: "چھٹی کی درخواست منظور",
      message: `${agentName}'s leave request for ${dates} has been approved`,
      messageUrdu: `${agentName} کی ${dates} کی چھٹی کی درخواست منظور ہوئی`,
      actionable: false,
      actionUrl: "/admin/attendance",
      targetRole: "all",
      metadata: { agentName, dates },
    });
  }

  static notifyLeaveRejected(agentName: string, dates: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "medium",
      title: "Leave Request Rejected",
      titleUrdu: "چھٹی کی درخواست مسترد",
      message: `${agentName}'s leave request for ${dates} has been rejected`,
      messageUrdu: `${agentName} کی ${dates} کی چھٹی کی درخواست مسترد ہوئی`,
      actionable: false,
      actionUrl: "/admin/attendance",
      targetRole: "all",
      metadata: { agentName, dates },
    });
  }

  static notifyAbsentAgent(agentName: string, date: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "high",
      title: "Agent Absent",
      titleUrdu: "ایجنٹ غیر حاضر",
      message: `${agentName} is absent on ${date} without prior notice`,
      messageUrdu: `${agentName} ${date} کو بغیر اطلاع غیر حاضر ہے`,
      actionable: true,
      actionUrl: "/admin/attendance",
      actionLabel: "Contact Agent",
      metadata: { agentName, date },
      targetRole: "admin",
    });
  }

  static notifyAttendanceStreak(agentName: string, days: number): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "low",
      title: "Attendance Streak!",
      titleUrdu: "!حاضری کا سلسلہ",
      message: `Congratulations! ${agentName} has a ${days}-day on-time attendance streak`,
      messageUrdu: `مبارک ہو! ${agentName} کی ${days} دن مسلسل بروقت حاضری`,
      actionable: false,
      targetRole: "all",
      metadata: { agentName, days },
    });
  }

  static notifyOvertimeWorked(agentName: string, extraHours: string, date: string): Notification {
    return this.addNotification({
      type: "attendance",
      priority: "medium",
      title: "Overtime Recorded",
      titleUrdu: "اوور ٹائم ریکارڈ ہوا",
      message: `${agentName} worked ${extraHours} overtime on ${date}`,
      messageUrdu: `${agentName} نے ${date} کو ${extraHours} اوور ٹائم کام کیا`,
      actionable: true,
      actionUrl: "/admin/attendance",
      actionLabel: "View Details",
      metadata: { agentName, extraHours, date },
      targetRole: "admin",
    });
  }

  // Generate initial notifications (seed data) — uses real case IDs from CRMDataStore
  private static generateInitialNotifications(): Notification[] {
    return [];
  }

  // Generate initial alerts
  private static generateInitialAlerts(): Alert[] {
    return [];
  }

  // Smart notification generator based on case data
  static generateSmartNotifications(cases: any[]): void {
    const now = new Date();
    
    cases.forEach(caseItem => {
      // Check for payment issues
      const paymentPercentage = (caseItem.paidAmount / caseItem.totalFee) * 100;
      const caseAge = (now.getTime() - new Date(caseItem.createdDate).getTime()) / (1000 * 60 * 60 * 24);
      
      if (paymentPercentage < 50 && caseAge > 7 && caseItem.status !== "document_collection") {
        this.notifyPaymentOverdue(caseItem.id, caseItem.customerName, Math.floor(caseAge - 7));
      }
      
      // Check for deadline proximity
      if (caseItem.medical && caseItem.medical.appointmentDate) {
        const appointmentDate = new Date(caseItem.medical.appointmentDate);
        const daysUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysUntil <= 3 && daysUntil > 0) {
          this.notifyDeadlineApproaching(
            caseItem.id,
            caseItem.customerName,
            appointmentDate.toLocaleDateString(),
            Math.ceil(daysUntil)
          );
        }
      }
      
      // Check for stuck cases
      const daysSinceUpdate = (now.getTime() - new Date(caseItem.updatedDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 10 && !["completed", "rejected"].includes(caseItem.status)) {
        this.addNotification({
          type: "case",
          priority: "high",
          title: "Case Needs Attention",
          titleUrdu: "کیس پر توجہ درکار ہے",
          message: `Case ${caseItem.id} (${caseItem.customerName}) hasn't been updated in ${Math.floor(daysSinceUpdate)} days`,
          messageUrdu: `کیس ${caseItem.id} (${caseItem.customerName}) ${Math.floor(daysSinceUpdate)} دنوں سے اپ ڈیٹ نہیں ہوا`,
          actionable: true,
          actionUrl: `/admin/cases`,
          actionLabel: "Review Case",
          targetRole: "admin",
          metadata: { caseId: caseItem.id, customerName: caseItem.customerName },
        });
      }
    });
  }
}

// Notification preferences
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  whatsapp: boolean;
  categories: {
    case: boolean;
    payment: boolean;
    document: boolean;
    deadline: boolean;
    agent: boolean;
    system: boolean;
    attendance: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export const defaultNotificationPreferences: NotificationPreferences = {
  email: true,
  sms: true,
  inApp: true,
  whatsapp: false,
  categories: {
    case: true,
    payment: true,
    document: true,
    deadline: true,
    agent: true,
    system: true,
    attendance: true,
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};