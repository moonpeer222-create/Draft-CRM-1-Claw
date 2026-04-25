import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Trash2, Check, Link2, AlertTriangle, Clock, ChevronDown, Timer, 
  MessageSquare, DollarSign, Phone, Send, Plus, CheckCircle2, ChevronRight,
  Eye, Edit, MapPin, Calendar, User, Briefcase, FileText, Heart, GraduationCap, ShieldCheck, Home, 
  RotateCcw, XCircle
} from 'lucide-react';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { mapSupabaseCaseToLocal } from '../lib/caseMappers';
import { 
  updateCase, updateCaseStatus, addPayment, addNote, deleteCase
} from '../lib/caseApi';
import { 
  getStageLabel, getPipelineStages, getOverdueInfo, getDelayReasonLabel, 
  reportDelay, shouldAutoMigrateToVisa, DELAY_REASONS
} from '../lib/mockData';
import { pipelineApi, visaverseApi, documentUploadApi } from '../lib/api';
import { NotificationService } from '../lib/notifications';
import { copyToClipboard } from '../lib/clipboard';
import { AuditLogService } from '../lib/auditLog';
import { DataSyncService } from '../lib/dataSync';
import { sendCaseStatusEmail, extractEmailsFromCase } from '../lib/emailService';
import { pushCases } from '../lib/syncService';
import { useConflictPolling } from '../lib/useConflictPolling';
import { modalVariants } from '../lib/animations';
import { RealtimeIndicator } from './RealtimeIndicator';
import { EditableCaseFields } from './EditableCaseFields';
import { VisualTimelineStepper } from './VisualTimelineStepper';
import { WhatsAppActions } from './WhatsAppActions';
// import { SirAtifApprovalButton } from './SirAtifApprovalButton';
import { EmojiMoodTracker } from './visaverse/EmojiMoodTracker';
import { ARScannerButton } from './visaverse/ARScanner';
import { MandatoryDocumentChecklist } from './MandatoryDocumentChecklist';
import { DocumentUploadInterface } from './DocumentUploadInterface';
import { DocumentFileStore } from '../lib/documentStore';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { CancellationReopenModal } from './CancellationReopenModal';
import { ImageLightbox } from './ImageLightbox';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { Case, Payment, Note } from '../lib/mockData';

interface CaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Case | null;
  adminName: string;
  isMasterAdmin: boolean;
  onSuccess: () => void;
}

export function CaseDetailModal({ 
  isOpen, 
  onClose, 
  caseData, 
  adminName, 
  isMasterAdmin, 
  onSuccess 
}: CaseDetailModalProps) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const labelCls = `block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`;

  const [selectedCase, setSelectedCase] = useState<Case | null>(caseData);
  const [activeTab, setActiveTab] = useState("overview");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDelayReason, setSelectedDelayReason] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayStep, setDelayStep] = useState<"reason" | "note">("reason");
  const [deepLinked, setDeepLinked] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const loadCases = onSuccess;

  useEffect(() => {
    setSelectedCase(caseData);
  }, [caseData]);

  const conflictState = useConflictPolling({
    entityId: selectedCase?.id || null,
    currentUserId: "admin",
    enabled: isOpen && !!selectedCase,
    intervalMs: 5000,
  });

  const [newPayment, setNewPayment] = useState({
    amount: 0,
    method: "cash" as Payment["method"],
    description: "",
    receiptNumber: "",
  });

  const [newNote, setNewNote] = useState({
    text: "",
    important: false,
  });

  // Deep-link: auto-open case from URL param
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
          setDeepLinked(true);
          setActiveTab(tab || "overview");
          if (fromNotification) {
            setDeepLinked(true);
            setTimeout(() => setDeepLinked(false), 3200);
            const tabLabel = tab ? ` → ${tab.charAt(0).toUpperCase() + tab.slice(1)}` : "";
            toast.success(`Opened ${target.id} (${target.customerName})${tabLabel}`);
          }
        }
      })();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state, urlCaseId, searchParams]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPayment = async () => {
    if (!selectedCase || newPayment.amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    setIsLoading(true);
    const success = await addPayment(selectedCase.id, {
      ...newPayment,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      collectedBy: "Admin",
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      if (data) setSelectedCase(mapSupabaseCaseToLocal(data));
      toast.success(`Payment of PKR ${newPayment.amount.toLocaleString()} recorded!`);
      AuditLogService.logPaymentAction(adminName, "admin", "payment_added", selectedCase.id, newPayment.amount);
      DataSyncService.markModified(selectedCase.id, "admin", adminName, "admin", "case", `Payment PKR ${newPayment.amount.toLocaleString()} recorded`);
      NotificationService.notifyPaymentReceived(selectedCase.id, newPayment.amount, selectedCase.customerName);
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, method: "cash", description: "", receiptNumber: "" });
      onSuccess();
    } else {
      toast.error("Failed to record payment");
    }
    setIsLoading(false);
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.text) {
      toast.error("Please enter a note");
      return;
    }
    const success = await addNote(selectedCase.id, {
      ...newNote,
      id: crypto.randomUUID(),
      author: "Admin",
      date: new Date().toISOString(),
    });
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
      if (data) setSelectedCase(mapSupabaseCaseToLocal(data));
      toast.success("Note added successfully!");
      setNewNote({ text: "", important: false });
      onSuccess();
    } else {
      toast.error("Failed to add note");
    }
  };

  const handleUpdateStatus = async (caseId: string, status: Case["status"]) => {
    const currentCase = selectedCase;
    try {
      const res = await pipelineApi.advanceStage(caseId, status, "admin", adminName);
      if (!res.success) {
        const blockers = (res as any).blockers;
        if (blockers && Array.isArray(blockers)) {
          toast.error("Stage locked — requirements not met");
          blockers.forEach((b: string) => toast.error(b));
        } else {
          toast.error(res.error || "Stage update failed");
        }
        return;
      }
    } catch {}

    const success = await updateCaseStatus(caseId, status);
    if (success) {
      const { data } = await supabase.from('cases').select('*').eq('id', caseId).single();
      if (data) setSelectedCase(mapSupabaseCaseToLocal(data));
      toast.success(`Case status updated to ${status}!`);
      if (currentCase) {
        NotificationService.notifyCaseStatusChanged(caseId, currentCase.customerName, currentCase.status, status);
        AuditLogService.logCaseStageChanged(adminName, "admin", caseId, currentCase.status, status);
        DataSyncService.markModified(caseId, "admin", adminName, "admin", "case", `Status changed to ${status}`);
        const { customerEmail, agentEmail } = extractEmailsFromCase(currentCase);
        sendCaseStatusEmail({
          caseId, customerName: currentCase.customerName, customerEmail,
          agentName: currentCase.agentName, agentEmail,
          oldStatus: currentCase.status, newStatus: status,
          phone: currentCase.phone, country: currentCase.country,
        });
      }
      if (shouldAutoMigrateToVisa(status)) {
        try { await pipelineApi.migrateToVisa(caseId); toast.success("Case auto-migrated to Visa Pipeline!"); } catch (err) {}
      }
      onSuccess();
      try { await pushCases(); } catch (err) { onSuccess(); if (currentCase) setSelectedCase(currentCase); toast.error(`Server sync failed — status change reverted. ${err}`); }
    }
  };

  const handleReportDelay = () => {
    if (!selectedCase || !selectedDelayReason) {
      toast.error(isUrdu ? "براہ کرم تاخیر کی وجہ منتخب کریں" : "Please select a delay reason");
      return;
    }
    setIsLoading(true);
    const lt = toast.loading(isUrdu ? "تاخیر کی اطلاع درج ہو رہی ہے..." : "Reporting delay...");
    setTimeout(() => {
      const updated = reportDelay(selectedCase.id, selectedDelayReason, delayNote || undefined);
      if (updated) {
        setSelectedCase(updated);
        toast.dismiss(lt);
        toast.success(isUrdu ? "تاخیر کی وجہ محفوظ ہو گئی!" : `Delay reported: ${getDelayReasonLabel(selectedDelayReason)}`);
        NotificationService.addNotification({
          type: "alert", priority: "high",
          title: isUrdu ? "تاخیر کی اطلاع" : "Delay Reported",
          message: `Case ${selectedCase.id} (${selectedCase.customerName}) delayed at ${getStageLabel(selectedCase.status)}. Reason: ${getDelayReasonLabel(selectedDelayReason)}${delayNote ? `. Note: ${delayNote}` : ""}`,
          actionable: true, actionUrl: "/admin/cases", actionLabel: "View Case", targetRole: "admin",
        });
        setShowDelayModal(false);
        setSelectedDelayReason("");
        setDelayNote("");
        setDelayStep("reason");
        onSuccess();
      }
      setIsLoading(false);
    }, 800);
  };

  const openDelayModal = () => {
    setSelectedDelayReason("");
    setDelayNote("");
    setDelayStep("reason");
    setShowDelayModal(true);
  };

  const handleDeleteCase = (caseId: string) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    const lt = toast.loading("Deleting case...");
    setTimeout(async () => {
      const success = await deleteCase(caseId);
      if (success) {
        toast.dismiss(lt);
        toast.success("Case deleted successfully!");
        onClose();
        onSuccess();
      } else {
        toast.dismiss(lt);
        toast.error("Failed to delete case");
      }
    }, 800);
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

  if (!isOpen || !selectedCase) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => onClose()}>
            <motion.div
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto ${deepLinked ? "animate-notif-ring" : ""}`}
            >
              {/* Deep-link highlight banner */}
              {deepLinked && (
                <div className="animate-notif-banner bg-gradient-to-r from-blue-500/20 via-blue-400/10 to-blue-500/20 border-b border-blue-500/30 px-6 py-2 flex items-center gap-2">
                  <div className="animate-notif-dot w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs font-medium text-blue-400">
                    {isUrdu ? "اطلاع سے کھولا گیا" : "Opened from notification"}
                  </span>
                </div>
              )}
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className={`text-xl font-bold ${txt}`}>{selectedCase.id}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedCase.status)}`}>{getStageLabel(selectedCase.status)}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedCase.priority)}`}>{selectedCase.priority}</span>
                    <RealtimeIndicator caseId={selectedCase.id} onRefresh={async () => {
                      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                      if (data) {
                        setSelectedCase(mapSupabaseCaseToLocal(data));
                        toast.success(isUrdu ? "کیس تازہ ترین ہو گیا" : "Case refreshed");
                      }
                    }} />
                  </div>
                  <p className={`mt-1 ${sub}`}>{selectedCase.customerName} • {selectedCase.country} • {selectedCase.jobType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { const url = `${window.location.origin}/admin/cases/${selectedCase.id}`; copyToClipboard(url).then(() => { setLinkCopied(true); toast.success(isUrdu ? "لنک کاپی ہو گیا!" : `Link copied: ${selectedCase.id}`); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {}); }} className={`p-2 rounded-lg transition-colors ${linkCopied ? "text-green-500 bg-green-50 dark:bg-green-900/20" : dc ? "text-gray-400 hover:bg-gray-700 hover:text-blue-400" : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"}`} title={isUrdu ? "لنک کاپی" : "Copy Link"}>{linkCopied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}</motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteCase(selectedCase.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-5 h-5" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => onClose()} className={`p-2 rounded-full ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X className="w-5 h-5" /></motion.button>
                </div>
              </div>

              {/* Conflict Warning Banner */}
              <AnimatePresence>
                {conflictState.hasConflict && conflictState.record && !conflictState.dismissed && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }}
                    className={`mx-6 mt-3 p-3 rounded-xl border flex items-start gap-3 ${dc ? "bg-amber-900/20 border-amber-700/50 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"}`}
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{isUrdu ? "ڈیٹا کہیں اور اپ ڈیٹ ہوا!" : "Data Updated Elsewhere!"}</p>
                      <p className={`text-xs mt-0.5 ${dc ? "text-amber-400/80" : "text-amber-700"}`}>
                        {`${conflictState.record.lastModifiedByName} (${conflictState.record.lastModifiedByRole}) modified this case ${conflictState.timeSince}`}
                      </p>
                    </div>
                    <button onClick={async () => {
                      conflictState.refresh();
                      const { data } = await supabase.from('cases').select('*').eq('id', selectedCase.id).single();
                      if (data) setSelectedCase(mapSupabaseCaseToLocal(data));
                    }} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${dc ? "bg-amber-800/50 text-amber-300" : "bg-amber-100 text-amber-800"}`}>Refresh</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabs */}
              <div className={`flex border-b ${dc ? "border-gray-700" : "border-gray-200"} px-6`}>
                {["overview", "timeline", "documents", "payments", "notes"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? "border-blue-500 text-blue-600" : `border-transparent ${sub} hover:text-blue-500`}`}>{tab}</button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <EditableCaseFields
                      caseData={selectedCase} darkMode={dc} isUrdu={isUrdu} userName={adminName} userRole={isMasterAdmin ? "master_admin" : "admin"}
                      onUpdate={(updated) => { setSelectedCase(updated); onSuccess(); }}
                    />
                    <div className={`p-4 rounded-xl ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm ${sub}`}>{isUrdu ? "ادائیگی پیش رفت" : "Payment Progress"}</span>
                        <span className={`text-sm font-semibold ${txt}`}>PKR {selectedCase.paidAmount.toLocaleString()} / {selectedCase.totalFee.toLocaleString()}</span>
                      </div>
                      <div className={`w-full h-3 rounded-full ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((selectedCase.paidAmount / selectedCase.totalFee) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Update Status</label>
                      <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1 w-full sm:max-w-xs">
                          <select value={selectedCase.status} onChange={(e) => handleUpdateStatus(selectedCase.id, e.target.value as Case["status"])} className={inputCls + " appearance-none"}>
                            {getPipelineStages(selectedCase.pipelineType || 'visa').map(s => <option key={s.key} value={s.key}>{s.stageNumber > 0 ? `${s.stageNumber}. ` : ""}{isUrdu ? s.labelUrdu : s.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const oi = getOverdueInfo(selectedCase);
                      if (!oi.hasDeadline) return null;
                      return (
                        <div className={`p-4 rounded-xl border-2 ${oi.isOverdue ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50"}`}>
                          <p className="text-sm font-bold">{oi.isOverdue ? "Overdue" : "On Track"}</p>
                          <p className="text-xs">{oi.timeLabel}</p>
                          {oi.isOverdue && <button onClick={openDelayModal} className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs">Report Delay</button>}
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Record Payment</button>
                      <WhatsAppActions caseData={selectedCase} compact />
                    </div>
                    {/* <SirAtifApprovalButton caseData={selectedCase} darkMode={dc} isUrdu={isUrdu} userName={adminName} userId="admin" onUpdate={onSuccess} /> */}
                    <button onClick={() => setShowCancelModal(true)} className="px-4 py-2 border border-red-500 text-red-500 rounded-lg">{isUrdu ? "منسوخ" : "Cancel Case"}</button>
                  </div>
                )}
                {activeTab === "timeline" && <VisualTimelineStepper caseData={selectedCase} onStageClick={(s) => handleUpdateStatus(selectedCase.id, s)} />}
                {activeTab === "documents" && (
                  <DocumentUploadInterface 
                    existingDocuments={selectedCase.documents} 
                    onUpload={async (files) => { /* simplified upload logic */ onSuccess(); }}
                    onDocumentVerify={async (id, s) => { /* simplified verify logic */ onSuccess(); }}
                  />
                )}
                {activeTab === "payments" && (
                  <div className="space-y-2">
                    {selectedCase.payments.map(p => <div key={p.id} className="p-2 bg-gray-100 rounded">PKR {p.amount.toLocaleString()} - {p.description}</div>)}
                  </div>
                )}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input type="text" value={newNote.text} onChange={e => setNewNote({...newNote, text: e.target.value})} className={inputCls} />
                      <button onClick={handleAddNote} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                    </div>
                    {selectedCase.notes.map(n => <div key={n.id} className="p-2 border-b">{n.text}</div>)}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delay Modal */}
      <AnimatePresence>
        {showDelayModal && (
          <motion.div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <motion.div className="bg-white p-6 rounded-2xl w-full max-w-lg">
              <h2 className="text-xl font-bold mb-4">Report Delay</h2>
              <div className="space-y-4">
                {DELAY_REASONS.map(r => (
                  <button key={r.value} onClick={() => setSelectedDelayReason(r.value)} className={`w-full p-3 text-left border rounded-xl ${selectedDelayReason === r.value ? "border-red-500 bg-red-50" : ""}`}>
                    {isUrdu ? r.labelUrdu : r.label}
                  </button>
                ))}
                <textarea value={delayNote} onChange={e => setDelayNote(e.target.value)} placeholder="Note..." className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={() => setShowDelayModal(false)} className="flex-1 py-2 border rounded-xl">Cancel</button>
                  <button onClick={handleReportDelay} className="flex-1 py-2 bg-red-600 text-white rounded-xl">Submit</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentConfirmationModal caseData={selectedCase} isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} onPaymentRecorded={onSuccess} />
      {showCancelModal && <CancellationReopenModal caseData={selectedCase} darkMode={dc} isUrdu={isUrdu} userName={adminName} userId="admin" onClose={() => setShowCancelModal(false)} onUpdate={onSuccess} />}
      <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => { setLightboxSrc(null); setLightboxAlt(""); }} />
    </>
  );
}
