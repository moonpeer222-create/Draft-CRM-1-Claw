/**
 * SirAtifApprovalButton — Digital approval widget for Master Admin / Sir Atif
 * Unlocks "Case Hand Over to Sir Atif" and "Case Submitted to Agency" stages.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Lock, Unlock, Loader2, CheckCircle2, XCircle, Crown, MessageSquare } from "lucide-react";
import { pipelineApi } from "../lib/api";
import { CRMDataStore, Case } from "../lib/mockData";
import { AuditLogService } from "../lib/auditLog";
import { toast } from "../lib/toast";

interface Props {
  caseData: Case;
  darkMode: boolean;
  isUrdu: boolean;
  userName: string;
  userId: string;
  onUpdate: () => void;
}

export function SirAtifApprovalButton({ caseData, darkMode: dc, isUrdu, userName, userId, onUpdate }: Props) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved = caseData.sirAtifApproval === true;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";

  const handleApproval = async (approved: boolean) => {
    setIsSubmitting(true);
    try {
      const res = await pipelineApi.sirAtifApprove(caseData.id, approved, note || undefined, userId, userName);
      if (!res.success) {
        toast.error(res.error || "Approval update failed");
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Fallback to local
    }

    // Local update
    CRMDataStore.updateCase(caseData.id, {
      sirAtifApproval: approved,
      sirAtifApprovalAt: approved ? new Date().toISOString() : undefined,
      sirAtifApprovalNote: note || undefined,
    });

    AuditLogService.log({
      userId,
      userName,
      role: "master_admin",
      action: approved ? "sir_atif_approved" : "sir_atif_revoked",
      category: "approval",
      description: `Sir Atif ${approved ? "approved" : "revoked approval for"} case ${caseData.id} (${caseData.customerName}). ${note ? `Note: ${note}` : ""}`,
      metadata: { caseId: caseData.id, approved, note },
    });

    toast.success(isUrdu
      ? `${approved ? "منظوری دے دی گئی" : "منظوری واپس لے لی گئی"}`
      : `${approved ? "Approval granted — gated stages unlocked" : "Approval revoked"}`);

    setIsSubmitting(false);
    setShowNoteInput(false);
    setNote("");
    onUpdate();
  };

  return (
    <div className={`p-5 rounded-2xl border-2 transition-all ${
      isApproved
        ? dc ? "border-purple-500/40 bg-gradient-to-br from-purple-950/30 to-purple-900/10" : "border-purple-300 bg-gradient-to-br from-purple-50 to-white"
        : dc ? "border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-amber-900/5" : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isApproved
              ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20"
              : dc ? "bg-amber-900/40" : "bg-amber-100"
          }`}>
            {isApproved ? (
              <Unlock className="w-6 h-6 text-white" />
            ) : (
              <Lock className={`w-6 h-6 ${dc ? "text-amber-400" : "text-amber-600"}`} />
            )}
          </div>
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
              <Crown className={`w-4 h-4 ${isApproved ? "text-purple-500" : "text-amber-500"}`} />
              {isUrdu ? "سر عاطف کی ڈیجیٹل منظوری" : "Sir Atif's Digital Approval"}
            </h3>
            <p className={`text-xs ${sub}`}>
              {isApproved
                ? (isUrdu ? "منظور — ایجنسی جمع کرانے کے مراحل کھل گئے" : "Approved — Agency submission stages unlocked")
                : (isUrdu ? "ایجنسی جمع کرانے سے پہلے لازمی" : "Required before agency submission (Stage 13-14)")}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
          isApproved
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        }`}>
          {isApproved ? (isUrdu ? "منظور" : "APPROVED") : (isUrdu ? "زیر التواء" : "PENDING")}
        </div>
      </div>

      {/* Approval details if approved */}
      {isApproved && caseData.sirAtifApprovalAt && (
        <div className={`mb-4 p-3 rounded-xl ${dc ? "bg-purple-900/20" : "bg-purple-50"}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
            <span className={`text-xs font-medium ${dc ? "text-purple-300" : "text-purple-700"}`}>
              {isUrdu ? "منظوری کی تاریخ:" : "Approved on:"} {new Date(caseData.sirAtifApprovalAt).toLocaleString()}
            </span>
          </div>
          {caseData.sirAtifApprovalNote && (
            <p className={`text-xs mt-1.5 ${dc ? "text-purple-300/70" : "text-purple-600/70"}`}>
              <MessageSquare className="w-3 h-3 inline mr-1" />
              {caseData.sirAtifApprovalNote}
            </p>
          )}
        </div>
      )}

      {/* Note input */}
      <AnimatePresence>
        {showNoteInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isUrdu ? "اختیاری نوٹ شامل کریں..." : "Add an optional note..."}
              rows={2}
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                dc ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "border-gray-200"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!isApproved ? (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleApproval(true)}
              disabled={isSubmitting}
              className={`flex-1 px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                isSubmitting
                  ? "bg-purple-500/50 text-white/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/20"
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {isUrdu ? "منظوری دیں" : "Grant Approval"}
            </motion.button>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                dc ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleApproval(false)}
            disabled={isSubmitting}
            className={`px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : dc
                ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {isUrdu ? "منظوری واپس لیں" : "Revoke Approval"}
          </motion.button>
        )}
      </div>
    </div>
  );
}