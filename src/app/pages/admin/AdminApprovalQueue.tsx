import { useState, useEffect, useMemo, useCallback } from "react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useTheme } from "../../lib/ThemeContext";
import { NotificationService, type Notification } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { updateCase } from "../../lib/caseApi";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2, XCircle, CreditCard, FileText, Upload, Clock, Search,
  Filter, RefreshCw, Eye, MessageCircle, Shield, AlertTriangle, Wifi
} from "lucide-react";

type ApprovalItem = {
  id: string;
  type: "payment_approval" | "payment_history" | "document_review";
  title: string;
  description: string;
  submittedBy: string;
  submittedByRole: "agent" | "customer";
  caseId?: string;
  customerName?: string;
  amount?: number;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
  notificationId?: string;
  metadata?: Record<string, any>;
};

export function AdminApprovalQueue() {
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { darkMode, isUrdu, fontClass } = useTheme();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "payment_approval" | "payment_history" | "document_review">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSync, setLastSync] = useState(new Date());
  const [allCases, setAllCases] = useState<any[]>([]);

  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('*');
      if (!error && data) setAllCases(data.map((r: any) => mapSupabaseCaseToLocal(r)));
    };
    fetchCases();
    const iv = setInterval(fetchCases, 15000);
    return () => clearInterval(iv);
  }, []);

  const loadItems = useCallback(() => {
    const notifications = NotificationService.getNotificationsForRole("admin");

    const approvalItems: ApprovalItem[] = [];

    // Payment pending approval notifications
    notifications
      .filter(n => n.metadata?.type === "payment_pending_approval")
      .forEach(n => {
        const status = n.metadata?.approvalStatus || (n.read ? "approved" : "pending");
        approvalItems.push({
          id: `PA-${n.id}`,
          type: "payment_approval",
          title: isUrdu ? "ادائیگی کی منظوری" : "Payment Approval",
          description: `PKR ${n.metadata?.amount?.toLocaleString()} — ${n.metadata?.customerName}`,
          submittedBy: n.metadata?.agentName || "Agent",
          submittedByRole: "agent",
          caseId: n.metadata?.caseId,
          customerName: n.metadata?.customerName,
          amount: n.metadata?.amount,
          timestamp: n.timestamp,
          status: status as any,
          notificationId: n.id,
          metadata: n.metadata,
        });
      });

    // Payment history request notifications
    notifications
      .filter(n => n.metadata?.type === "payment_history_request")
      .forEach(n => {
        const status = n.metadata?.status === "shared" ? "approved"
          : n.metadata?.status === "declined" ? "rejected"
          : (n.read ? "approved" : "pending");
        approvalItems.push({
          id: `PH-${n.id}`,
          type: "payment_history",
          title: isUrdu ? "ادائیگی کی تاریخ کی درخواست" : "Payment History Request",
          description: `Case ${n.metadata?.caseId} — ${n.metadata?.customerName}`,
          submittedBy: n.metadata?.agentName || "Agent",
          submittedByRole: "agent",
          caseId: n.metadata?.caseId,
          customerName: n.metadata?.customerName,
          timestamp: n.timestamp,
          status: status as any,
          notificationId: n.id,
          metadata: n.metadata,
        });
      });

    // Documents pending verification from cases
    allCases.forEach(c => {
      c.documents
        .filter((d: any) => d.status === "pending")
        .forEach((d: any) => {
          approvalItems.push({
            id: `DOC-${c.id}-${d.id}`,
            type: "document_review",
            title: isUrdu ? "دستاویز کی تصدیق" : "Document Verification",
            description: `${d.name} — ${c.customerName}`,
            submittedBy: c.agentName,
            submittedByRole: "agent",
            caseId: c.id,
            customerName: c.customerName,
            timestamp: d.uploadDate,
            status: "pending",
            metadata: { documentId: d.id, documentName: d.name },
          });
        });
    });

    // Sort by timestamp, newest first
    approvalItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(approvalItems);
    setLastSync(new Date());
  }, [isUrdu]);

  useEffect(() => {
    loadItems();
    const interval = setInterval(loadItems, 10000);
    return () => clearInterval(interval);
  }, [loadItems]);

  const handleApprove = (item: ApprovalItem) => {
    if (item.type === "payment_approval" && item.notificationId) {
      const all = NotificationService.getNotifications();
      const notif = all.find(n => n.id === item.notificationId);
      if (notif) {
        notif.metadata = { ...notif.metadata, approvalStatus: "approved" };
        notif.read = true;
        NotificationService.saveNotifications(all);
      }
      // Actually credit paidAmount by approving the pending payment in CRMDataStore
      if (item.caseId) {
        const c = allCases.find((cs: any) => cs.id === item.caseId);
        if (c) {
          const pendingPay = c.payments.find((p: any) => p.approvalStatus === "pending" && p.amount === item.amount);
          if (pendingPay) {
            pendingPay.approvalStatus = "approved";
            const timelineEntry = {
              id: `TL-${Date.now()}`,
              date: new Date().toISOString(),
              title: "Payment Approved",
              description: `PKR ${pendingPay.amount.toLocaleString()} payment approved by Admin (Receipt: ${pendingPay.receiptNumber})`,
              type: "payment" as any,
              user: "Admin",
            };
            updateCase(item.caseId, {
              payments: c.payments,
              paidAmount: (c.paidAmount || 0) + pendingPay.amount,
              timeline: [...c.timeline, timelineEntry],
            });
          }
        }
      }
      AuditLogService.logApproval("Imran Khan", "approval_granted", `Payment PKR ${item.amount?.toLocaleString()} for ${item.caseId}`, `Agent: ${item.submittedBy}`);
      AuditLogService.logPaymentAction("Imran Khan", "admin", "payment_approved", item.caseId || "", item.amount);
      if (item.caseId) DataSyncService.markModified(item.caseId, "admin", "Imran Khan", "admin", "case", "Payment approved by admin");
      // Notify the agent that their payment was approved
      NotificationService.notifyAgentPaymentApproved(item.submittedBy, item.caseId || "", item.customerName || "", item.amount || 0);
      toast.success(isUrdu ? "ادائیگی منظور! بیلنس اپڈیٹ ہو گیا" : `Payment of PKR ${item.amount?.toLocaleString()} approved & credited!`);
    } else if (item.type === "payment_history" && item.notificationId) {
      const all = NotificationService.getNotifications();
      const notif = all.find(n => n.id === item.notificationId);
      if (notif) {
        notif.metadata = { ...notif.metadata, status: "shared" };
        notif.read = true;
        NotificationService.saveNotifications(all);
      }
      AuditLogService.logApproval("Imran Khan", "approval_granted", `Payment history for ${item.caseId}`);
      toast.success(isUrdu ? "درخواست منظور" : "Request approved & shared");
    } else if (item.type === "document_review" && item.caseId && item.metadata?.documentId) {
      const c = allCases.find((cs: any) => cs.id === item.caseId);
      if (c) {
        const doc = c.documents.find((d: any) => d.id === item.metadata?.documentId);
        if (doc) {
          doc.status = "verified";
          updateCase(item.caseId, { documents: c.documents });
        }
      }
      AuditLogService.logDocumentAction("Imran Khan", "admin", "document_verified", item.caseId, item.metadata?.documentName);
      if (item.caseId) DataSyncService.markModified(item.caseId, "admin", "Imran Khan", "admin", "case", `Document "${item.metadata?.documentName}" verified`);
      toast.success(isUrdu ? "دستاویز تصدیق شدہ" : `Document "${item.metadata?.documentName}" verified`);
    }
    loadItems();
  };

  const handleReject = (item: ApprovalItem) => {
    if (item.type === "payment_approval" && item.notificationId) {
      const all = NotificationService.getNotifications();
      const notif = all.find(n => n.id === item.notificationId);
      if (notif) {
        notif.metadata = { ...notif.metadata, approvalStatus: "rejected" };
        notif.read = true;
        NotificationService.saveNotifications(all);
      }
      // Mark the pending payment as rejected
      if (item.caseId) {
        const c = allCases.find((cs: any) => cs.id === item.caseId);
        if (c) {
          const pendingPay = c.payments.find((p: any) => p.approvalStatus === "pending" && p.amount === item.amount);
          if (pendingPay) {
            pendingPay.approvalStatus = "rejected";
            const timelineEntry = {
              id: `TL-${Date.now()}`,
              date: new Date().toISOString(),
              title: "Payment Rejected",
              description: `PKR ${pendingPay.amount.toLocaleString()} payment rejected by Admin (Receipt: ${pendingPay.receiptNumber})`,
              type: "payment" as any,
              user: "Admin",
            };
            updateCase(item.caseId, {
              payments: c.payments,
              timeline: [...c.timeline, timelineEntry],
            });
          }
        }
      }
      AuditLogService.logApproval("Imran Khan", "approval_denied", `Payment PKR ${item.amount?.toLocaleString()} for ${item.caseId}`);
      AuditLogService.logPaymentAction("Imran Khan", "admin", "payment_rejected", item.caseId || "", item.amount);
      // Notify the agent that their payment was rejected
      NotificationService.notifyAgentPaymentRejected(item.submittedBy, item.caseId || "", item.customerName || "", item.amount || 0);
      toast.info(isUrdu ? "ادائیگی مسترد" : "Payment rejected");
    } else if (item.type === "payment_history" && item.notificationId) {
      const all = NotificationService.getNotifications();
      const notif = all.find(n => n.id === item.notificationId);
      if (notif) {
        notif.metadata = { ...notif.metadata, status: "declined" };
        notif.read = true;
        NotificationService.saveNotifications(all);
      }
      AuditLogService.logApproval("Imran Khan", "approval_denied", `Payment history for ${item.caseId}`);
      toast.info(isUrdu ? "درخواست مسترد" : "Request declined");
    } else if (item.type === "document_review" && item.caseId && item.metadata?.documentId) {
      const c = allCases.find((cs: any) => cs.id === item.caseId);
      if (c) {
        const doc = c.documents.find((d: any) => d.id === item.metadata?.documentId);
        if (doc) {
          doc.status = "rejected";
          updateCase(item.caseId, { documents: c.documents });
        }
      }
      AuditLogService.logDocumentAction("Imran Khan", "admin", "document_rejected", item.caseId, item.metadata?.documentName);
      toast.info(isUrdu ? "دستاویز مسترد" : `Document "${item.metadata?.documentName}" rejected`);
    }
    loadItems();
  };

  const filtered = items.filter(item => {
    if (filter !== "all" && item.status !== filter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        item.submittedBy.toLowerCase().includes(q) ||
        item.caseId?.toLowerCase().includes(q) ||
        item.customerName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = items.filter(i => i.status === "pending").length;

  const getTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isUrdu ? "ابھی" : "Just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const getTypeIcon = (type: ApprovalItem["type"]) => {
    switch (type) {
      case "payment_approval": return <CreditCard className="w-4 h-4 text-orange-500" />;
      case "payment_history": return <FileText className="w-4 h-4 text-blue-500" />;
      case "document_review": return <Upload className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: ApprovalItem["status"]) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{isUrdu ? "زیر التوا" : "PENDING"}</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{isUrdu ? "منظور" : "APPROVED"}</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{isUrdu ? "مسترد" : "REJECTED"}</span>;
    }
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className={`text-2xl md:text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  <Shield className="w-7 h-7 inline-block mr-2 text-blue-500" />
                  {isUrdu ? "منظوری کی قطار" : "Approval Queue"}
                </h1>
                
              </div>
              <div className="flex items-center gap-3">
                {/* Live Sync Badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${darkMode ? "bg-blue-900/20 text-blue-400 border border-blue-800/30" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <Wifi className="w-3 h-3" />
                  {isUrdu ? "لائیو سنک" : "Live Sync"}
                  <span className={`text-[10px] ${darkMode ? "text-blue-500/60" : "text-blue-500/80"}`}>
                    {lastSync.toLocaleTimeString()}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { loadItems(); toast.success(isUrdu ? "ریفریش ہو گیا" : "Refreshed"); }}
                  className={`p-2 rounded-xl border ${darkMode ? "border-gray-700 hover:bg-gray-800 text-gray-400" : "border-gray-300 hover:bg-gray-50 text-gray-600"}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Pending Alert */}
            {pendingCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className={`mt-4 p-3 rounded-xl border-2 border-yellow-500/30 ${darkMode ? "bg-yellow-900/10" : "bg-yellow-50"}`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className={`text-sm font-semibold ${darkMode ? "text-yellow-400" : "text-yellow-700"}`}>
                    {pendingCount} {isUrdu ? "آئٹمز منظوری کے منتظر ہیں" : "items awaiting your approval"}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`p-4 rounded-2xl mb-6 ${darkMode ? "bg-gray-800" : "bg-white"} shadow-lg`}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isUrdu ? "تلاش کریں..." : "Search cases, agents, customers..."}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "pending", "approved", "rejected"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${filter === f
                      ? "bg-blue-600 text-white"
                      : darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {f === "all" ? (isUrdu ? "سب" : "All") : f === "pending" ? (isUrdu ? "زیر التوا" : "Pending") : f === "approved" ? (isUrdu ? "منظور" : "Approved") : (isUrdu ? "مسترد" : "Rejected")}
                    {f === "pending" && pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[9px]">{pendingCount}</span>}
                  </button>
                ))}
              </div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${darkMode ? "bg-gray-700 border-gray-600 text-gray-300" : "border-gray-300 text-gray-600"}`}
              >
                <option value="all">{isUrdu ? "تمام اقسام" : "All Types"}</option>
                <option value="payment_approval">{isUrdu ? "ادائیگی منظوری" : "Payment Approval"}</option>
                <option value="payment_history">{isUrdu ? "ادائیگی تاریخ" : "Payment History"}</option>
                <option value="document_review">{isUrdu ? "دستاویز تصدیق" : "Document Review"}</option>
              </select>
            </div>
          </motion.div>

          {/* Queue List */}
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`text-center py-16 rounded-2xl ${darkMode ? "bg-gray-800" : "bg-white"} shadow-lg`}
                >
                  <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
                  <p className={`text-lg font-semibold ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {isUrdu ? "کوئی آئٹم نہیں ملی" : "No items found"}
                  </p>
                  <p className={`text-sm mt-1 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {filter === "pending" ? (isUrdu ? "تمام آئٹمز کی تصدیق ہو چکی ہے" : "All items have been reviewed") : (isUrdu ? "فلٹر تبدیل کریں" : "Try adjusting your filters")}
                  </p>
                </motion.div>
              ) : (
                filtered.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`rounded-2xl border-l-4 p-4 transition-all ${
                      item.status === "pending"
                        ? `border-l-yellow-500 ${darkMode ? "bg-gray-800 border border-yellow-900/30" : "bg-white border border-yellow-200/50"}`
                        : item.status === "approved"
                        ? `border-l-blue-500 ${darkMode ? "bg-gray-800/60 border border-gray-700" : "bg-gray-50 border border-gray-200"}`
                        : `border-l-red-500 ${darkMode ? "bg-gray-800/60 border border-gray-700" : "bg-gray-50 border border-gray-200"}`
                    } shadow-sm hover:shadow-md`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className={`p-2 rounded-xl flex-shrink-0 ${darkMode ? "bg-gray-700/60" : "bg-gray-100"}`}>
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{item.title}</span>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className={`text-xs mt-0.5 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{item.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                            {isUrdu ? "جمع کنندہ:" : "By:"} <span className="font-semibold">{item.submittedBy}</span> ({item.submittedByRole})
                          </span>
                          {item.caseId && (
                            <span className={`text-[10px] font-mono ${darkMode ? "text-blue-400/70" : "text-blue-600/70"}`}>{item.caseId}</span>
                          )}
                          <span className={`text-[10px] ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                            <Clock className="w-3 h-3 inline mr-0.5" />{getTimeAgo(item.timestamp)} {isUrdu ? "پہلے" : "ago"}
                          </span>
                          {item.amount && (
                            <span className={`text-[10px] font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                              PKR {item.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action Buttons */}
                      {item.status === "pending" ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.caseId && (
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                              onClick={() => navigate(`${prefix}/cases`)}
                              className={`p-2 rounded-xl ${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
                              title={isUrdu ? "دیکھیں" : "View Case"}
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>
                          )}
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleApprove(item)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isUrdu ? "منظور" : "Approve"}
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleReject(item)}
                            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${darkMode ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {isUrdu ? "مسترد" : "Reject"}
                          </motion.button>
                        </div>
                      ) : (
                        <div className={`text-[10px] flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                          {item.status === "approved" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Summary Footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className={`mt-6 p-4 rounded-2xl ${darkMode ? "bg-gray-800" : "bg-white"} shadow-lg`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: isUrdu ? "کل" : "Total", value: items.length, color: "text-blue-500" },
                { label: isUrdu ? "زیر التوا" : "Pending", value: items.filter(i => i.status === "pending").length, color: "text-yellow-500" },
                { label: isUrdu ? "منظور" : "Approved", value: items.filter(i => i.status === "approved").length, color: "text-green-500" },
                { label: isUrdu ? "مسترد" : "Rejected", value: items.filter(i => i.status === "rejected").length, color: "text-red-500" },
              ].map(s => (
                <div key={s.label}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}