/**
 * CancellationReopenModal — Mandatory reason for cancellation + reopen with audit trail
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, AlertTriangle, RotateCcw, Loader2, ShieldAlert, History,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { pipelineApi } from "../lib/api";
import { Case } from "../lib/mockData";
import { updateCase } from "../lib/caseApi";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { AuditLogService } from "../lib/auditLog";
import { toast } from "../lib/toast";

interface Props {
  caseData: Case;
  darkMode: boolean;
  isUrdu: boolean;
  userName: string;
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const CANCELLATION_REASONS = [
  { key: "customer_request", label: "Customer Requested Cancellation", labelUrdu: "کسٹمر نے منسوخی کی درخواست کی" },
  { key: "document_fraud", label: "Fraudulent Documents", labelUrdu: "جعلی دستاویزات" },
  { key: "payment_default", label: "Payment Default", labelUrdu: "ادائیگی میں ناکامی" },
  { key: "visa_rejected", label: "Visa Rejected by Embassy", labelUrdu: "سفارتخانے نے ویزا مسترد کیا" },
  { key: "medical_unfit", label: "Medical Unfit", labelUrdu: "طبی طور پر نااہل" },
  { key: "duplicate_case", label: "Duplicate Case", labelUrdu: "ڈپلیکیٹ کیس" },
  { key: "company_issue", label: "Company/Employer Issue", labelUrdu: "کمپنی / آجر کا مسئلہ" },
  { key: "other", label: "Other", labelUrdu: "دیگر" },
];

export function CancellationReopenModal({ caseData, darkMode: dc, isUrdu, userName, userId, onClose, onUpdate }: Props) {
  const isCancelled = caseData.status === "visa_cancelled" || caseData.status === "lead_cancelled" || caseData.status === "rejected";

  const [mode, setMode] = useState<"cancel" | "reopen">(isCancelled ? "reopen" : "cancel");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;

  const handleCancel = async () => {
    if (!selectedReason) {
      toast.error(isUrdu ? "براہ کرم منسوخی کی وجہ منتخب کریں" : "Please select a cancellation reason");
      return;
    }
    const reason = selectedReason === "other"
      ? (customReason.trim() || "Other - no details provided")
      : CANCELLATION_REASONS.find(r => r.key === selectedReason)?.label || selectedReason;

    if (selectedReason === "other" && !customReason.trim()) {
      toast.error(isUrdu ? "براہ کرم وجہ درج کریں" : "Please provide details for 'Other' reason");
      return;
    }

    setIsSubmitting(true);
    try {
      // Server call
      const res = await pipelineApi.cancelCase(caseData.id, reason, userId, userName);
      if (!res.success) {
        toast.error(res.error || "Cancellation failed");
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Fallback to local
    }

    // Local update
    const cancelStatus = caseData.pipelineType === "lead" ? "lead_cancelled" : "visa_cancelled";
    await updateCase(caseData.id, {
      status: cancelStatus,
      pipelineStageKey: cancelStatus,
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userName,
    });
    const { data: cancelData } = await supabase.from('cases').select('*').eq('id', caseData.id).single();
    const refreshedCancel = cancelData ? mapSupabaseCaseToLocal(cancelData) : null;
    if (refreshedCancel) {
      // continue
    }

    AuditLogService.log({
      userId,
      userName,
      role: "admin",
      action: "case_cancelled",
      category: "case",
      description: `Case ${caseData.id} cancelled. Reason: ${reason}. Previous stage: ${caseData.pipelineStageKey || caseData.status}. By: ${userName}`,
      metadata: { caseId: caseData.id, reason, previousStage: caseData.pipelineStageKey || caseData.status },
    });

    toast.success(isUrdu ? "کیس منسوخ ہو گیا" : "Case cancelled successfully");
    setIsSubmitting(false);
    onUpdate();
    onClose();
  };

  const handleReopen = async () => {
    setIsSubmitting(true);
    try {
      const res = await pipelineApi.reopenCase(caseData.id, userId, userName);
      if (!res.success) {
        toast.error(res.error || "Reopen failed");
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Fallback
    }

    // Reopen to the stage before cancellation
    const reopenStage = caseData.reopenedFromStage || (caseData.pipelineType === "lead" ? "new_lead" : "new_entry");
    await updateCase(caseData.id, {
      status: reopenStage,
      pipelineStageKey: reopenStage,
      cancellationReason: undefined,
      cancelledAt: undefined,
      cancelledBy: undefined,
      reopenedAt: new Date().toISOString(),
      reopenedBy: userName,
      reopenedFromStage: caseData.pipelineStageKey || caseData.status,
    });
    const { data: reopenData } = await supabase.from('cases').select('*').eq('id', caseData.id).single();
    const refreshedReopen = reopenData ? mapSupabaseCaseToLocal(reopenData) : null;
    if (refreshedReopen) {
      // continue
    }

    AuditLogService.log({
      userId,
      userName,
      role: "admin",
      action: "case_reopened",
      category: "case",
      description: `Case ${caseData.id} reopened to stage: ${reopenStage}. Previous status: ${caseData.status}. By: ${userName}`,
      metadata: { caseId: caseData.id, reopenStage, previousStatus: caseData.status },
    });

    toast.success(isUrdu ? "کیس دوبارہ کھول دیا گیا" : "Case reopened successfully");
    setIsSubmitting(false);
    onUpdate();
    onClose();
  };

  // Gather audit trail events from case timeline
  const auditTrail = caseData.timeline
    .filter(e => e.title.toLowerCase().includes("cancel") || e.title.toLowerCase().includes("reopen") || e.title.toLowerCase().includes("status"))
    .slice(0, 20);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
            dc ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-5 border-b ${brd}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                mode === "cancel"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-green-500/10 text-green-500"
              }`}>
                {mode === "cancel" ? <ShieldAlert className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              </div>
              <div>
                <h2 className={`text-lg font-bold ${txt}`}>
                  {mode === "cancel"
                    ? (isUrdu ? "کیس منسوخ کریں" : "Cancel Case")
                    : (isUrdu ? "کیس دوبارہ کھولیں" : "Reopen Case")}
                </h2>
                <p className={`text-xs ${sub}`}>{caseData.id} — {caseData.customerName}</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${dc ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Mode toggle if case is cancelled (can choose reopen) */}
            {isCancelled && (
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("reopen")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    mode === "reopen"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                      : dc ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  {isUrdu ? "دوبارہ کھولیں" : "Reopen"}
                </button>
                <button
                  onClick={() => setShowAuditTrail(!showAuditTrail)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                    dc ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <History className="w-4 h-4" />
                  {isUrdu ? "آڈٹ ٹریل" : "Audit Trail"}
                </button>
              </div>
            )}

            {/* Cancellation reason */}
            {mode === "cancel" && (
              <>
                {/* Warning */}
                <div className={`p-4 rounded-xl border-2 border-red-500/30 ${dc ? "bg-red-950/20" : "bg-red-50"}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-bold ${dc ? "text-red-400" : "text-red-700"}`}>
                        {isUrdu ? "انتباہ: یہ عمل واپس نہیں ہو سکتا" : "Warning: This action will cancel the case"}
                      </p>
                      <p className={`text-xs mt-1 ${dc ? "text-red-300/70" : "text-red-600/70"}`}>
                        {isUrdu
                          ? "منسوخی کا ریکارڈ آڈٹ لاگ میں محفوظ ہوگا۔ کیس بعد میں دوبارہ کھولا جا سکتا ہے۔"
                          : "Cancellation will be recorded in the immutable audit log. The case can be reopened later if needed."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason selection (mandatory) */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${txt}`}>
                    {isUrdu ? "منسوخی کی وجہ (لازمی)" : "Cancellation Reason (Required)"} *
                  </label>
                  <div className="space-y-2">
                    {CANCELLATION_REASONS.map((reason) => (
                      <button
                        key={reason.key}
                        onClick={() => setSelectedReason(reason.key)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          selectedReason === reason.key
                            ? "border-red-500 bg-red-500/10 text-red-500"
                            : dc
                            ? "border-gray-700 hover:border-gray-600 text-gray-300"
                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedReason === reason.key ? "border-red-500" : dc ? "border-gray-600" : "border-gray-300"
                          }`}>
                            {selectedReason === reason.key && <div className="w-2 h-2 rounded-full bg-red-500" />}
                          </div>
                          {isUrdu ? reason.labelUrdu : reason.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom reason text for "Other" */}
                {selectedReason === "other" && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${txt}`}>
                      {isUrdu ? "تفصیلات درج کریں" : "Provide Details"} *
                    </label>
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder={isUrdu ? "منسوخی کی تفصیلی وجہ..." : "Detailed reason for cancellation..."}
                      rows={3}
                      className={inputCls}
                    />
                  </div>
                )}
              </>
            )}

            {/* Reopen confirmation */}
            {mode === "reopen" && !showAuditTrail && (
              <div className={`p-4 rounded-xl border-2 border-green-500/30 ${dc ? "bg-green-950/20" : "bg-green-50"}`}>
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className={`text-sm font-bold ${dc ? "text-green-400" : "text-green-700"}`}>
                      {isUrdu ? "کیس دوبارہ کھولنے کی تصدیق" : "Confirm Case Reopen"}
                    </p>
                    <p className={`text-xs mt-1 ${dc ? "text-green-300/70" : "text-green-600/70"}`}>
                      {isUrdu
                        ? "کیس اپنے پچھلے مرحلے سے دوبارہ شروع ہوگا۔ آڈٹ لاگ میں ریکارڈ ہوگا۔"
                        : "The case will be restored and resume from its previous stage. This will be recorded in the audit log."}
                    </p>
                    {caseData.cancellationReason && (
                      <div className={`mt-3 p-3 rounded-lg ${dc ? "bg-gray-800" : "bg-white"}`}>
                        <p className={`text-xs font-semibold ${sub}`}>{isUrdu ? "منسوخی کی وجہ:" : "Cancellation reason:"}</p>
                        <p className={`text-sm mt-1 ${txt}`}>{caseData.cancellationReason}</p>
                        {caseData.cancelledAt && (
                          <p className={`text-xs mt-1 ${sub}`}>
                            {isUrdu ? "منسوخ:" : "Cancelled:"} {new Date(caseData.cancelledAt).toLocaleString()} {isUrdu ? "بذریعہ" : "by"} {caseData.cancelledBy || "Unknown"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail */}
            {showAuditTrail && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold ${txt}`}>
                  {isUrdu ? "آڈٹ ٹریل" : "Audit Trail"}
                </h4>
                {auditTrail.length === 0 ? (
                  <p className={`text-sm text-center py-4 ${sub}`}>
                    {isUrdu ? "کوئی ریکارڈ نہیں" : "No audit records found"}
                  </p>
                ) : (
                  auditTrail.map((event) => (
                    <div key={event.id} className={`flex gap-3 p-3 rounded-lg ${dc ? "bg-gray-800" : "bg-gray-50"}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        event.title.toLowerCase().includes("cancel") ? "bg-red-500"
                        : event.title.toLowerCase().includes("reopen") ? "bg-green-500"
                        : "bg-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${txt} truncate`}>{event.title}</p>
                        <p className={`text-xs ${sub} truncate`}>{event.description}</p>
                        <p className={`text-xs mt-0.5 ${sub}`}>{new Date(event.date).toLocaleString()} • {event.user}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 p-5 border-t ${brd}`}>
            <button
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                dc ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isUrdu ? "واپس" : "Cancel"}
            </button>

            {mode === "cancel" && (
              <button
                onClick={handleCancel}
                disabled={isSubmitting || !selectedReason}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  isSubmitting || !selectedReason
                    ? "bg-red-500/50 text-white/50 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20"
                }`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {isUrdu ? "کیس منسوخ کریں" : "Cancel Case"}
              </button>
            )}

            {mode === "reopen" && !showAuditTrail && (
              <button
                onClick={handleReopen}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  isSubmitting
                    ? "bg-green-500/50 text-white/50 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20"
                }`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {isUrdu ? "دوبارہ کھولیں" : "Reopen Case"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}