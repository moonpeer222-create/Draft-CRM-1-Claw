import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { Case, getOverdueInfo } from "../lib/mockData";
import { getPipelineStages, type PipelineStage } from "../lib/pipelineConfig";
import {
  FileText, Phone, Stethoscope, Activity, Fingerprint, CreditCard,
  FolderOpen, Send, CheckCircle2, Wallet, Plane, Trophy,
  Clock, AlertTriangle, ChevronRight, Users, Building2,
  Eye, Handshake, ClipboardCheck, UserCheck, Stamp, ShieldCheck,
  Mail, ScrollText, Lock, Unlock, Star, MapPin,
} from "lucide-react";

// ── Icon mapping for BOTH pipelines ───────────────────────────
const STAGE_ICONS: Record<string, React.ElementType> = {
  // Lead Pipeline
  new_lead: Star,
  interested: Eye,
  follow_up: Phone,
  office_visit: Building2,
  agreement: Handshake,
  lead_cancelled: AlertTriangle,
  // Visa Pipeline
  new_entry: FileText,
  documents_received: FolderOpen,
  documents_sent_to_company: Send,
  selection_done: ClipboardCheck,
  interview_done: Users,
  offer_letter_issued: Mail,
  invitation_letter_received: ScrollText,
  candidate_office_visit: MapPin,
  agreement_with_client: Handshake,
  medical_done: Stethoscope,
  e_number_granted: Fingerprint,
  finger_process: Activity,
  case_handover_sir_atif: ShieldCheck,
  case_submitted_to_agency: Send,
  visa_applied: Stamp,
  visa_issued: CheckCircle2,
  ready_for_protector: ShieldCheck,
  protector_done: UserCheck,
  ticket_issued: Plane,
  flying_ready: Plane,
  visa_completed: Trophy,
  visa_cancelled: AlertTriangle,
  // Legacy pipeline
  document_collection: FileText,
  selection_call: Phone,
  medical_token: Stethoscope,
  check_medical: Activity,
  biometric: Fingerprint,
  payment_confirmation: CreditCard,
  original_documents: FolderOpen,
  submitted_to_manager: Send,
  approved: CheckCircle2,
  remaining_amount: Wallet,
  ticket_booking: Plane,
  completed: Trophy,
};

// Color rotation for stages
const STAGE_COLOR_PALETTE = [
  { bg: "bg-blue-500", ring: "ring-blue-400", text: "text-blue-400", glow: "shadow-blue-500/30" },
  { bg: "bg-purple-500", ring: "ring-purple-400", text: "text-purple-400", glow: "shadow-purple-500/30" },
  { bg: "bg-orange-500", ring: "ring-orange-400", text: "text-orange-400", glow: "shadow-orange-500/30" },
  { bg: "bg-amber-500", ring: "ring-amber-400", text: "text-amber-400", glow: "shadow-amber-500/30" },
  { bg: "bg-cyan-500", ring: "ring-cyan-400", text: "text-cyan-400", glow: "shadow-cyan-500/30" },
  { bg: "bg-yellow-500", ring: "ring-yellow-400", text: "text-yellow-400", glow: "shadow-yellow-500/30" },
  { bg: "bg-indigo-500", ring: "ring-indigo-400", text: "text-indigo-400", glow: "shadow-indigo-500/30" },
  { bg: "bg-violet-500", ring: "ring-violet-400", text: "text-violet-400", glow: "shadow-violet-500/30" },
  { bg: "bg-pink-500", ring: "ring-pink-400", text: "text-pink-400", glow: "shadow-pink-500/30" },
  { bg: "bg-sky-500", ring: "ring-sky-400", text: "text-sky-400", glow: "shadow-sky-500/30" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400", text: "text-emerald-400", glow: "shadow-emerald-500/30" },
  { bg: "bg-rose-500", ring: "ring-rose-400", text: "text-rose-400", glow: "shadow-rose-500/30" },
  { bg: "bg-teal-500", ring: "ring-teal-400", text: "text-teal-400", glow: "shadow-teal-500/30" },
  { bg: "bg-lime-500", ring: "ring-lime-400", text: "text-lime-400", glow: "shadow-lime-500/30" },
  { bg: "bg-fuchsia-500", ring: "ring-fuchsia-400", text: "text-fuchsia-400", glow: "shadow-fuchsia-500/30" },
];

const RED_COLOR = { bg: "bg-red-500", ring: "ring-red-400", text: "text-red-400", glow: "shadow-red-500/30" };
const GREEN_COLOR = { bg: "bg-green-500", ring: "ring-green-400", text: "text-green-400", glow: "shadow-green-500/30" };

function getColorForStage(stage: PipelineStage, idx: number) {
  if (stage.isCancelled) return RED_COLOR;
  if (stage.isFinal) return GREEN_COLOR;
  return STAGE_COLOR_PALETTE[idx % STAGE_COLOR_PALETTE.length];
}

interface Props {
  caseData: Case;
  onStageClick?: (stageKey: Case["status"]) => void;
  compact?: boolean;
}

export function VisualTimelineStepper({ caseData, onStageClick, compact = false }: Props) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Determine which pipeline to render based on case data
  const pipelineType = caseData.pipelineType || "visa";
  const allStages = getPipelineStages(pipelineType);
  // Filter out cancelled stages for the main rendering (show them separately)
  const activeStages = allStages.filter(s => !s.isCancelled && s.stageNumber >= 1);

  const currentStageKey = caseData.pipelineStageKey || caseData.status;
  const currentStage = allStages.find(s => s.key === currentStageKey);
  const currentStageNum = currentStage?.stageNumber ?? 0;
  const isCancelled = allStages.some(s => s.isCancelled && s.key === currentStageKey);
  const isRejected = caseData.status === "rejected" || isCancelled;
  const overdueInfo = getOverdueInfo(caseData);
  const totalActiveStages = activeStages.length;
  const pipelineLabel = pipelineType === "lead"
    ? (isUrdu ? "لیڈ پائپ لائن" : "Lead Pipeline")
    : (isUrdu ? "ویزا پائپ لائن" : "Visa Pipeline");

  const getStageState = (stageNum: number) => {
    if (isRejected) return "rejected";
    if (stageNum < currentStageNum) return "completed";
    if (stageNum === currentStageNum) return "current";
    return "upcoming";
  };

  const progressPct = isRejected
    ? 100
    : totalActiveStages > 1
    ? Math.round(((currentStageNum - 1) / (totalActiveStages - 1)) * 100)
    : 0;

  // Compact horizontal view
  if (compact) {
    return (
      <div className="w-full">
        {/* Pipeline label */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            pipelineType === "lead"
              ? (dc ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-700")
              : (dc ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-700")
          }`}>
            {pipelineLabel} ({activeStages.length} {isUrdu ? "مراحل" : "stages"})
          </span>
          {currentStage?.requiresDocChecklist && (
            <Lock className={`w-3 h-3 ${dc ? "text-amber-400" : "text-amber-600"}`} />
          )}
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-1 min-w-max px-1">
            {activeStages.map((stage, idx) => {
              const state = getStageState(stage.stageNumber);
              const Icon = STAGE_ICONS[stage.key] || FileText;
              const colors = getColorForStage(stage, idx);

              return (
                <div key={stage.key} className="flex items-center">
                  <motion.div
                    className="relative group"
                    onMouseEnter={() => setShowTooltip(stage.key)}
                    onMouseLeave={() => setShowTooltip(null)}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onStageClick?.(stage.key)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                        state === "completed"
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                          : state === "current"
                          ? `${colors.bg} text-white ring-2 ${colors.ring} ring-offset-2 ${dc ? "ring-offset-gray-800" : "ring-offset-white"} shadow-lg ${colors.glow}`
                          : state === "rejected"
                          ? "bg-red-500 text-white"
                          : dc
                          ? "bg-gray-700 text-gray-500"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {state === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      {state === "current" && overdueInfo.isOverdue && (
                        <motion.div
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"
                        />
                      )}
                      {/* Lock icon for gated stages */}
                      {state === "upcoming" && (stage.requiresDocChecklist || stage.requiresApproval) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                          <Lock className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </motion.div>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {showTooltip === stage.key && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap z-50 ${
                            dc ? "bg-gray-700 text-white border border-gray-600" : "bg-gray-900 text-white"
                          } shadow-xl`}
                        >
                          <div>{stage.stageNumber}. {isUrdu ? stage.labelUrdu : stage.label}</div>
                          {state === "current" && overdueInfo.hasDeadline && (
                            <div className={`mt-1 ${overdueInfo.isOverdue ? "text-red-300" : "text-blue-300"}`}>
                              {overdueInfo.timeLabel}
                            </div>
                          )}
                          {(stage.requiresDocChecklist || stage.requiresApproval || stage.requiresPaymentVerification) && state === "upcoming" && (
                            <div className="mt-1 text-amber-300 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              {stage.requiresApproval ? "Requires approval" : "Requires verification"}
                            </div>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -mt-1"
                            style={{ background: dc ? "#374151" : "#111827" }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Connector line */}
                  {idx < activeStages.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 transition-all ${
                      getStageState(stage.stageNumber) === "completed"
                        ? "bg-blue-500"
                        : dc ? "bg-gray-700" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Full vertical timeline view
  return (
    <div className="w-full">
      {/* Pipeline label + progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              pipelineType === "lead"
                ? (dc ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-700")
                : (dc ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-700")
            }`}>
              {pipelineLabel}
            </span>
            <span className={`text-sm font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>
              {isUrdu ? "پیش رفت" : "Progress"}
            </span>
          </div>
          <span className={`text-sm font-bold ${isRejected ? "text-red-500" : dc ? "text-blue-400" : "text-blue-600"}`}>
            {isRejected ? (isUrdu ? "منسوخ" : "Cancelled") : `${progressPct}%`}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${isRejected ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-blue-400"}`}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-1">
        {activeStages.map((stage, idx) => {
          const state = getStageState(stage.stageNumber);
          const Icon = STAGE_ICONS[stage.key] || FileText;
          const colors = getColorForStage(stage, idx);
          const isHovered = hoveredStage === stage.key;
          const isCurrent = state === "current";
          const isGated = stage.requiresDocChecklist || stage.requiresApproval || stage.requiresPaymentVerification;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="flex items-start gap-3"
            >
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={() => setHoveredStage(stage.key)}
                  onMouseLeave={() => setHoveredStage(null)}
                  onClick={() => onStageClick?.(stage.key)}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                    state === "completed"
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                      : isCurrent
                      ? `${colors.bg} text-white ring-3 ${colors.ring} ring-offset-2 ${dc ? "ring-offset-gray-800" : "ring-offset-white"} shadow-lg ${colors.glow}`
                      : dc
                      ? "bg-gray-700/50 text-gray-500 border border-gray-600"
                      : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}
                >
                  {state === "completed" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                  {isCurrent && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`absolute inset-0 rounded-full ${colors.bg} opacity-30`}
                    />
                  )}
                  {isCurrent && overdueInfo.isOverdue && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <AlertTriangle className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                  {/* Gate lock indicator */}
                  {state === "upcoming" && isGated && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </motion.div>
                {idx < activeStages.length - 1 && (
                  <div className={`w-0.5 h-8 ${
                    state === "completed" ? "bg-blue-500" : dc ? "bg-gray-700" : "bg-gray-200"
                  }`} />
                )}
              </div>

              {/* Stage content */}
              <motion.div
                onClick={() => onStageClick?.(stage.key)}
                onMouseEnter={() => setHoveredStage(stage.key)}
                onMouseLeave={() => setHoveredStage(null)}
                className={`flex-1 pb-2 pt-1.5 cursor-pointer rounded-xl px-3 -ml-1 transition-all ${
                  isHovered
                    ? dc ? "bg-gray-800/50" : "bg-gray-50"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${
                      state === "completed"
                        ? dc ? "text-blue-400" : "text-blue-600"
                        : isCurrent
                        ? dc ? "text-white" : "text-gray-900"
                        : dc ? "text-gray-500" : "text-gray-400"
                    }`}>
                      <span className="text-xs opacity-60 mr-1">{stage.stageNumber}.</span>
                      {isUrdu ? stage.labelUrdu : stage.label}
                    </p>
                    {isCurrent && overdueInfo.hasDeadline && (
                      <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${
                        overdueInfo.isOverdue ? "text-red-400" : "text-blue-500"
                      }`}>
                        <Clock className="w-3 h-3" />
                        {overdueInfo.timeLabel}
                      </div>
                    )}
                    {isCurrent && caseData.delayReason && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        {isUrdu ? "تاخیر" : "Delayed"}
                      </div>
                    )}
                    {/* Gate requirements display for upcoming gated stages */}
                    {state === "upcoming" && isGated && isHovered && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-500">
                        <Lock className="w-3 h-3" />
                        {stage.requiresApproval && (isUrdu ? "سر عاطف کی منظوری" : "Sir Atif approval")}
                        {stage.requiresDocChecklist && !stage.requiresApproval && (isUrdu ? "دستاویزات تصدیق" : "Doc verification")}
                        {stage.requiresPaymentVerification && !stage.requiresDocChecklist && (isUrdu ? "ادائیگی تصدیق" : "Payment verified")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {state === "completed" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                      }`}>
                        {isUrdu ? "مکمل" : "Done"}
                      </span>
                    )}
                    {isCurrent && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse ${
                        overdueInfo.isOverdue
                          ? "bg-red-900/30 text-red-400"
                          : dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                      }`}>
                        {isUrdu ? "جاری" : "Current"}
                      </span>
                    )}
                    {isHovered && onStageClick && (
                      <ChevronRight className={`w-4 h-4 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Cancelled/Rejected badge */}
      {isRejected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-400">
              {isUrdu ? "کیس منسوخ / مسترد" : "Case Cancelled / Rejected"}
            </p>
            {caseData.cancellationReason && (
              <p className="text-xs text-red-400/70">
                {isUrdu ? "وجہ:" : "Reason:"} {caseData.cancellationReason}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
