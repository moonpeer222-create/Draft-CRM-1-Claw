/**
 * MandatoryDocumentChecklist — Verification section with Yes/No toggles and file upload
 * Hard-locks "Case Hand Over to Sir Atif" and "Case Submitted to Agency" until all docs verified + 2 Lac paid.
 */
import { useState, useRef } from "react";
import {
  CheckCircle2, XCircle, Upload, FileText, Image, Eye, Download,
  Lock, Unlock, ShieldCheck, AlertTriangle, Clock, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MANDATORY_DOCUMENTS, getChecklistStatus, type MandatoryDocument } from "../lib/pipelineConfig";
import { pipelineApi, documentUploadApi } from "../lib/api";
import { DocumentFileStore } from "../lib/documentStore";
import { toast } from "../lib/toast";

interface Props {
  caseId: string;
  caseData: {
    documentChecklist?: Record<string, boolean>;
    documentChecklistFiles?: Record<string, string>;
    paymentVerified?: boolean;
    paymentVerifiedAt?: string;
    paymentVerifiedBy?: string;
    sirAtifApproval?: boolean;
    sirAtifApprovalAt?: string;
  };
  darkMode: boolean;
  isUrdu: boolean;
  userRole: "admin" | "agent" | "customer" | "master_admin" | "operator";
  userName: string;
  userId: string;
  onUpdate: () => void; // callback to reload case data
  readOnly?: boolean;
}

export function MandatoryDocumentChecklist({
  caseId, caseData, darkMode: dc, isUrdu, userRole, userName, userId, onUpdate, readOnly,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);

  const checklist = caseData.documentChecklist || {};
  const checklistFiles = caseData.documentChecklistFiles || {};
  const status = getChecklistStatus(checklist);

  const canEdit = !readOnly && (userRole === "admin" || userRole === "master_admin" || userRole === "operator");
  const canUpload = !readOnly && (userRole !== "customer");

  const handleToggle = async (key: string, verified: boolean) => {
    setToggling(key);
    try {
      const res = await pipelineApi.updateChecklist(caseId, key, verified, checklistFiles[key], userId, userName);
      if (res.success) {
        toast.success(isUrdu
          ? `${verified ? "تصدیق شدہ" : "غیر تصدیق شدہ"}`
          : `Document ${verified ? "verified" : "unverified"}`);
        onUpdate();
      } else {
        toast.error(res.error || "Failed to update");
      }
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setToggling(null);
    }
  };

  const handleFileUpload = async (key: string, file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error(isUrdu ? "صرف PNG, JPG, PDF فائلیں قبول ہیں" : "Only PNG, JPG, PDF files accepted");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isUrdu ? "فائل 10MB سے زیادہ ہے" : "File exceeds 10MB");
      return;
    }

    setUploading(key);
    try {
      const docId = `CHECKLIST-${key}-${Date.now()}`;

      // Upload to Supabase Storage
      const res = await documentUploadApi.uploadForm(file, caseId, docId, {
        checklistKey: key,
        uploadedBy: userName,
        uploadedByRole: userRole,
      });

      if (res.success) {
        // Also update checklist with file reference
        await pipelineApi.updateChecklist(caseId, key, true, docId, userId, userName);
        toast.success(isUrdu ? "فائل اپ لوڈ اور تصدیق ہو گئی" : "File uploaded & verified");
        onUpdate();
      } else {
        toast.error(res.error || "Upload failed");
      }
    } catch (err) {
      toast.error(`Upload error: ${err}`);
    } finally {
      setUploading(null);
      setActiveUploadKey(null);
    }
  };

  const handlePaymentVerify = async (verified: boolean) => {
    setToggling("payment");
    try {
      const res = await pipelineApi.verifyPayment(caseId, verified, userId, userName);
      if (res.success) {
        toast.success(isUrdu
          ? `ادائیگی ${verified ? "تصدیق شدہ" : "غیر تصدیق شدہ"}`
          : `Payment ${verified ? "verified" : "unverified"}`);
        onUpdate();
      } else {
        toast.error(res.error || "Failed");
      }
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setToggling(null);
    }
  };

  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const cardBg = dc ? "bg-gray-800/50" : "bg-gray-50";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className={`p-4 rounded-xl border ${brd} ${cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {isUrdu ? "لازمی دستاویزات اور ادائیگی کی تصدیق" : "Original Documents & Payment Verification"}
          </h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            status.isComplete
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
          }`}>
            {status.verified}/{status.total} ({status.percentage}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className={`h-2.5 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"} overflow-hidden`}>
          <motion.div
            className={`h-full rounded-full ${status.isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${status.percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {!status.isComplete && (
          <p className={`text-xs mt-2 flex items-center gap-1.5 ${sub}`}>
            <Lock className="w-3 h-3" />
            {isUrdu
              ? `${status.pending} دستاویزات باقی ہیں — "سر عاطف کو حوالے" مرحلہ مقفل ہے`
              : `${status.pending} documents remaining — "Case Hand Over to Sir Atif" stage is locked`}
          </p>
        )}
      </div>

      {/* Document Items */}
      <div className="space-y-2">
        {MANDATORY_DOCUMENTS.map((doc) => {
          const isVerified = checklist[doc.key] === true;
          const hasFile = !!checklistFiles[doc.key];
          const isUploading = uploading === doc.key;
          const isToggling = toggling === doc.key;

          return (
            <div
              key={doc.key}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isVerified
                  ? dc ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50/50"
                  : dc ? `border-gray-700 ${cardBg}` : `border-gray-200 ${cardBg}`
              }`}
            >
              {/* Status indicator */}
              <button
                onClick={() => canEdit && !isToggling && handleToggle(doc.key, !isVerified)}
                disabled={!canEdit || isToggling}
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isVerified
                    ? "bg-emerald-500 text-white"
                    : dc ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
              >
                {isToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isVerified ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </button>

              {/* Document name */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isVerified ? (dc ? "text-emerald-400" : "text-emerald-700") : txt}`}>
                  {isUrdu ? doc.labelUrdu : doc.label}
                </p>
                {hasFile && (
                  <p className={`text-xs ${sub} truncate`}>
                    {isUrdu ? "فائل اپ لوڈ شدہ" : "File uploaded"}
                  </p>
                )}
              </div>

              {/* Upload button */}
              {canUpload && !isVerified && (
                <button
                  onClick={() => {
                    setActiveUploadKey(doc.key);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isUploading
                      ? "opacity-50 cursor-not-allowed"
                      : dc
                        ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {isUrdu ? "اپ لوڈ" : "Upload"}
                </button>
              )}

              {/* Verified badge */}
              {isVerified && (
                <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                  dc ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {isUrdu ? "تصدیق شدہ" : "Verified"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Verification */}
      <div className={`p-4 rounded-xl border-2 ${
        caseData.paymentVerified
          ? dc ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50/50"
          : dc ? "border-amber-500/30 bg-amber-950/10" : "border-amber-200 bg-amber-50/50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              caseData.paymentVerified
                ? "bg-emerald-500 text-white"
                : dc ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-600"
            }`}>
              {caseData.paymentVerified ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <p className={`text-sm font-bold ${txt}`}>
                {isUrdu ? "ابتدائی ادائیگی (PKR 2,00,000)" : "Initial Payment (PKR 2,00,000)"}
              </p>
              {caseData.paymentVerified && caseData.paymentVerifiedAt && (
                <p className={`text-xs ${sub}`}>
                  {isUrdu ? "تصدیق کنندہ:" : "Verified by:"} {caseData.paymentVerifiedBy || "Admin"} - {new Date(caseData.paymentVerifiedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => handlePaymentVerify(!caseData.paymentVerified)}
              disabled={toggling === "payment"}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                caseData.paymentVerified
                  ? dc ? "bg-red-600/20 text-red-400 hover:bg-red-600/30" : "bg-red-50 text-red-600 hover:bg-red-100"
                  : dc ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              {toggling === "payment" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : caseData.paymentVerified ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {caseData.paymentVerified
                ? (isUrdu ? "واپس لیں" : "Revoke")
                : (isUrdu ? "تصدیق کریں" : "Verify")}
            </button>
          )}
        </div>
      </div>

      {/* Sir Atif Approval Status */}
      {(userRole === "admin" || userRole === "master_admin") && (
        <div className={`p-4 rounded-xl border ${brd} ${cardBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                caseData.sirAtifApproval
                  ? "bg-purple-500 text-white"
                  : dc ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-400"
              }`}>
                {caseData.sirAtifApproval ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <p className={`text-sm font-bold ${txt}`}>
                  {isUrdu ? "سر عاطف کی منظوری" : "Sir Atif's Approval"}
                </p>
                <p className={`text-xs ${sub}`}>
                  {caseData.sirAtifApproval
                    ? (isUrdu ? "منظور شدہ — ایجنسی جمع کرانے کا اختیار" : "Approved — Agency submission unlocked")
                    : (isUrdu ? "ایجنسی جمع کرانے سے پہلے منظوری ضروری ہے" : "Required before agency submission")}
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              caseData.sirAtifApproval
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {caseData.sirAtifApproval ? (isUrdu ? "منظور" : "Approved") : (isUrdu ? "زیر التواء" : "Pending")}
            </span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeUploadKey) {
            handleFileUpload(activeUploadKey, file);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
