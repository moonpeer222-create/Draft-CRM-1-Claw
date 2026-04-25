/**
 * OwnerApprovalButton — Digital approval widget for Master Admin / Platform Owner
 * Unlocks "Case Hand Over to Owner" and "Case Submitted to Agency" stages.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Lock, Unlock, Loader2, CheckCircle2, XCircle, Crown, MessageSquare } from "lucide-react";
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
  onUpdate: () => void;
}

export function OwnerApprovalButton({ caseData, darkMode: dc, isUrdu, userName, userId, onUpdate }: Props) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved = caseData.ownerApproval === true;

  const handleToggle = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      const approved = !isApproved;
      
      // Update case with owner approval
      const { error } = await supabase
        .from("cases")
        .update({
          owner_approval: approved,
          owner_approval_by: approved ? userId : null,
          owner_approval_at: approved ? new Date().toISOString() : null,
          owner_approval_note: approved ? note : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", caseData.id);

      if (error) throw error;

      // Log audit
      await AuditLogService.log({
        userId,
        userName,
        role: "master_admin",
        action: approved ? "owner_approve_case" : "owner_revoke_approval",
        category: "approval",
        description: `Platform Owner ${approved ? "approved" : "revoked approval for"} case ${caseData.id} (${caseData.customerName}). ${note ? `Note: ${note}` : ""}`,
        metadata: { caseId: caseData.id, approved, note }
      });

      toast.success(isUrdu 
        ? (approved ? "منظوری دے دی گئی" : "منظوری واپس لے لی گئی") 
        : (approved ? "Approval granted" : "Approval revoked")
      );
      
      setShowNoteInput(false);
      setNote("");
      onUpdate();
    } catch (err) {
      toast.error(isUrdu ? "تبدیلی ناکام" : "Failed to update approval");
      console.error("Owner approval error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bg = dc ? "bg-slate-900/80 border-slate-700" : "bg-white border-slate-200";
  const text = dc ? "text-slate-100" : "text-slate-900";
  const sub = dc ? "text-slate-400" : "text-slate-500";
  const accent = isApproved ? "text-emerald-500" : "text-amber-500";
  const btnBg = isApproved
    ? "bg-emerald-600 hover:bg-emerald-700"
    : "bg-amber-600 hover:bg-amber-700";

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${isApproved ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          {isApproved ? (
            <ShieldCheck className={`w-6 h-6 ${accent}`} />
          ) : (
            <Lock className={`w-6 h-6 ${accent}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold flex items-center gap-2 ${text}`}>
            <Crown className="w-4 h-4 text-amber-500" />
            {isUrdu ? "مالک کی ڈیجیٹل منظوری" : "Platform Owner's Digital Approval"}
          </h3>
          <p className={`text-sm mt-1 ${sub}`}>
            {isUrdu
              ? (isApproved 
                ? "یہ کیس مالک کی منظوری کے ساتھ آگے بڑھنے کے لیے تیار ہے" 
                : "یہ کیس مالک کی منظوری کا منتظر ہے")
              : (isApproved 
                ? "This case is cleared to proceed with owner approval" 
                : "This case is pending owner approval")}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleToggle}
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${btnBg}`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isApproved ? (
                <><XCircle className="w-4 h-4" /> {isUrdu ? "منظوری واپس لیں" : "Revoke Approval"}</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> {isUrdu ? "منظوری دیں" : "Grant Approval"}</>
              )}
            </button>
            
            {!isApproved && (
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${dc ? "border-slate-600 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <MessageSquare className="w-4 h-4" />
                {isUrdu ? "نوٹ" : "Note"}
              </button>
            )}
          </div>

          <AnimatePresence>
            {showNoteInput && !isApproved && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 overflow-hidden"
              >
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={isUrdu ? "اختیاری نوٹ..." : "Optional note..."}
                  className={`w-full p-3 rounded-lg border resize-none ${dc ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}
                  rows={2}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {(caseData as any).ownerApprovalBy && (
            <p className={`text-xs mt-2 ${sub}`}>
              {isUrdu ? "منظوری دی:" : "Approved by:"} {(caseData as any).ownerApprovalBy}
              {caseData.ownerApprovalAt && ` • ${new Date(caseData.ownerApprovalAt).toLocaleDateString()}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
