/**
 * Dual Pipeline Configuration — Emerald Tech Partner
 * 
 * Pipeline 1: Lead Tracking Pipeline (pre-agreement)
 * Pipeline 2: Main Visa Process Pipeline (post-agreement)
 * 
 * Automation: When a lead hits "Agreement" in Pipeline 1,
 * it automatically migrates to "New Entry" in Pipeline 2.
 */

export type PipelineType = "lead" | "visa";

export interface PipelineStage {
  key: string;
  label: string;
  labelUrdu: string;
  stageNumber: number;
  deadlineHours: number | null; // SLA timer — null = no deadline
  isFinal?: boolean;
  isCancelled?: boolean;
  requiresApproval?: boolean;       // Needs Platform Owner approval before advancing
  requiresDocChecklist?: boolean;   // All mandatory docs must be verified
  requiresPaymentVerification?: boolean; // 2 Lac payment must be confirmed
}

// ── Lead Tracking Pipeline ────────────────────────────────────────
export const LEAD_PIPELINE_STAGES: PipelineStage[] = [
  { key: "new_lead", label: "New Lead", labelUrdu: "نئی لیڈ", stageNumber: 1, deadlineHours: 24 },
  { key: "interested", label: "Interested", labelUrdu: "دلچسپی", stageNumber: 2, deadlineHours: 48 },
  { key: "follow_up", label: "Follow-up", labelUrdu: "فالو اپ", stageNumber: 3, deadlineHours: 24 },
  { key: "office_visit", label: "Office Visit", labelUrdu: "آفس وزٹ", stageNumber: 4, deadlineHours: 48 },
  { key: "agreement", label: "Agreement", labelUrdu: "معاہدہ", stageNumber: 5, deadlineHours: 24 },
  { key: "lead_cancelled", label: "Cancelled", labelUrdu: "منسوخ", stageNumber: 0, deadlineHours: null, isCancelled: true },
];

// ── Main Visa Process Pipeline ────────────────────────────────────
export const VISA_PIPELINE_STAGES: PipelineStage[] = [
  { key: "new_entry", label: "New Entry", labelUrdu: "نئی اندراج", stageNumber: 1, deadlineHours: 24 },
  { key: "documents_received", label: "Documents Received", labelUrdu: "دستاویزات موصول", stageNumber: 2, deadlineHours: 24 },
  { key: "documents_sent_to_company", label: "Documents Sent to Company", labelUrdu: "دستاویزات کمپنی کو بھیجی گئیں", stageNumber: 3, deadlineHours: 48 },
  { key: "selection_done", label: "Selection Done", labelUrdu: "سلیکشن ہو گیا", stageNumber: 4, deadlineHours: 24 },
  { key: "interview_done", label: "Interview Done", labelUrdu: "انٹرویو ہو گیا", stageNumber: 5, deadlineHours: 24 },
  { key: "offer_letter_issued", label: "Offer Letter Issued", labelUrdu: "آفر لیٹر جاری", stageNumber: 6, deadlineHours: 24 },
  { key: "invitation_letter_received", label: "Invitation Letter Received", labelUrdu: "دعوت نامہ موصول", stageNumber: 7, deadlineHours: 24 },
  { key: "candidate_office_visit", label: "Candidate Office Visit", labelUrdu: "امیدوار آفس وزٹ", stageNumber: 8, deadlineHours: 24 },
  { key: "agreement_with_client", label: "Agreement with Client", labelUrdu: "کلائنٹ سے معاہدہ", stageNumber: 9, deadlineHours: 24 },
  { key: "medical_done", label: "Medical Done", labelUrdu: "میڈیکل ہو گیا", stageNumber: 10, deadlineHours: 48 },
  { key: "e_number_granted", label: "E Number Granted", labelUrdu: "ای نمبر جاری", stageNumber: 11, deadlineHours: 24 },
  { key: "finger_process", label: "Finger Process", labelUrdu: "فنگر پروسیس", stageNumber: 12, deadlineHours: 24 },
  {
    key: "case_handover_to_owner", label: "Case Hand Over to Platform Owner", labelUrdu: "کیس مالک کو حوالے",
    stageNumber: 13, deadlineHours: 24,
    requiresApproval: true,
    requiresDocChecklist: true,
    requiresPaymentVerification: true,
  },
  {
    key: "case_submitted_to_agency", label: "Case Submitted to Agency", labelUrdu: "کیس ایجنسی کو جمع",
    stageNumber: 14, deadlineHours: 24,
    requiresApproval: true,
    requiresDocChecklist: true,
    requiresPaymentVerification: true,
  },
  { key: "visa_applied", label: "Visa Applied", labelUrdu: "ویزا اپلائی", stageNumber: 15, deadlineHours: 48 },
  { key: "visa_issued", label: "Visa Issued", labelUrdu: "ویزا جاری", stageNumber: 16, deadlineHours: 24 },
  { key: "ready_for_protector", label: "Ready for Protector", labelUrdu: "پروٹیکٹر کے لیے تیار", stageNumber: 17, deadlineHours: 24 },
  { key: "protector_done", label: "Protector Done", labelUrdu: "پروٹیکٹر ہو گیا", stageNumber: 18, deadlineHours: 24 },
  { key: "ticket_issued", label: "Ticket Issued", labelUrdu: "ٹکٹ جاری", stageNumber: 19, deadlineHours: 24 },
  { key: "flying_ready", label: "Flying Ready", labelUrdu: "فلائنگ ریڈی", stageNumber: 20, deadlineHours: null },
  { key: "visa_completed", label: "Completed", labelUrdu: "مکمل", stageNumber: 21, deadlineHours: null, isFinal: true },
  { key: "visa_cancelled", label: "Cancelled", labelUrdu: "منسوخ", stageNumber: 0, deadlineHours: null, isCancelled: true },
];

// ── Helper functions ──────────────────────────────────────────────

export function getPipelineStages(type: PipelineType): PipelineStage[] {
  return type === "lead" ? LEAD_PIPELINE_STAGES : VISA_PIPELINE_STAGES;
}

export function getStageByKey(type: PipelineType, key: string): PipelineStage | undefined {
  return getPipelineStages(type).find(s => s.key === key);
}

export function getStageLabel(type: PipelineType, key: string, urdu = false): string {
  const stage = getStageByKey(type, key);
  if (!stage) return key;
  return urdu ? stage.labelUrdu : stage.label;
}

export function getNextStage(type: PipelineType, currentKey: string): PipelineStage | null {
  const stages = getPipelineStages(type).filter(s => !s.isCancelled);
  const idx = stages.findIndex(s => s.key === currentKey);
  if (idx === -1 || idx >= stages.length - 1) return null;
  return stages[idx + 1];
}

export function getPreviousStage(type: PipelineType, currentKey: string): PipelineStage | null {
  const stages = getPipelineStages(type).filter(s => !s.isCancelled);
  const idx = stages.findIndex(s => s.key === currentKey);
  if (idx <= 0) return null;
  return stages[idx - 1];
}

/**
 * Check if a case can advance to the next stage.
 * Returns { canAdvance, blockers } where blockers lists unmet requirements.
 */
export function canAdvanceStage(
  type: PipelineType,
  currentKey: string,
  caseData: {
    documentChecklist?: Record<string, boolean>;
    paymentVerified?: boolean;
    ownerApproval?: boolean;
  }
): { canAdvance: boolean; blockers: string[] } {
  const nextStage = getNextStage(type, currentKey);
  if (!nextStage) return { canAdvance: false, blockers: ["No next stage available"] };

  const blockers: string[] = [];

  // Check if the NEXT stage has hard requirements (the gate is on entering that stage)
  if (nextStage.requiresDocChecklist) {
    const checklist = caseData.documentChecklist || {};
    const allDocsVerified = MANDATORY_DOCUMENTS.every(doc => checklist[doc.key] === true);
    if (!allDocsVerified) {
      blockers.push("All mandatory documents must be uploaded and verified");
    }
  }

  if (nextStage.requiresPaymentVerification) {
    if (!caseData.paymentVerified) {
      blockers.push("Initial payment of PKR 2,00,000 must be verified");
    }
  }

  if (nextStage.requiresApproval) {
    if (!caseData.ownerApproval) {
      blockers.push("Platform Owner must digitally approve before proceeding");
    }
  }

  return { canAdvance: blockers.length === 0, blockers };
}

/**
 * Check if a lead should auto-migrate to the visa pipeline.
 * Returns true when the lead reaches "agreement" stage.
 */
export function shouldAutoMigrateToVisa(leadStageKey: string): boolean {
  return leadStageKey === "agreement";
}

// ── Mandatory Document Checklist ──────────────────────────────────
export interface MandatoryDocument {
  key: string;
  label: string;
  labelUrdu: string;
  acceptedTypes: string[]; // MIME types
  required: boolean;
}

export const MANDATORY_DOCUMENTS: MandatoryDocument[] = [
  { key: "original_passport", label: "Original Passport", labelUrdu: "اصل پاسپورٹ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "old_passport_lost_report", label: "Old Passport / Lost Report", labelUrdu: "پرانا پاسپورٹ / گمشدگی رپورٹ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "original_cnic", label: "Original CNIC", labelUrdu: "اصل شناختی کارڈ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "original_pictures", label: "Original Pictures", labelUrdu: "اصل تصاویر", acceptedTypes: ["image/png", "image/jpeg"], required: true },
  { key: "original_medical_report", label: "Original Medical Report", labelUrdu: "اصل میڈیکل رپورٹ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "e_number_copy", label: "E Number Copy", labelUrdu: "ای نمبر کاپی", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "finger_slip", label: "Finger Slip", labelUrdu: "فنگر سلپ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "character_certificate", label: "Character Certificate", labelUrdu: "کردار سرٹیفکیٹ", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "frc_nadra", label: "FRC (NADRA)", labelUrdu: "ایف آر سی (نادرا)", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "driving_license", label: "Driving License", labelUrdu: "ڈرائیونگ لائسنس", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
  { key: "initial_payment_2lac", label: "Initial Payment (2 Lac Full)", labelUrdu: "ابتدائی ادائیگی (2 لاکھ مکمل)", acceptedTypes: ["image/png", "image/jpeg", "application/pdf"], required: true },
];

/**
 * Calculate document checklist completion status
 */
export function getChecklistStatus(checklist: Record<string, boolean>): {
  total: number;
  verified: number;
  pending: number;
  percentage: number;
  isComplete: boolean;
} {
  const total = MANDATORY_DOCUMENTS.filter(d => d.required).length;
  const verified = MANDATORY_DOCUMENTS.filter(d => d.required && checklist[d.key] === true).length;
  return {
    total,
    verified,
    pending: total - verified,
    percentage: total > 0 ? Math.round((verified / total) * 100) : 0,
    isComplete: verified === total,
  };
}

// ── SLA Timer Logic ───────────────────────────────────────────────
export function calculateSLADeadline(stageStartedAt: string, deadlineHours: number | null): string | null {
  if (!deadlineHours || !stageStartedAt) return null;
  return new Date(new Date(stageStartedAt).getTime() + deadlineHours * 3600000).toISOString();
}

export interface SLAStatus {
  hasDeadline: boolean;
  isOverdue: boolean;
  deadlineAt: string | null;
  hoursRemaining: number | null;
  hoursOverdue: number | null;
  timeLabel: string;
}

export function getSLAStatus(stageStartedAt: string, deadlineHours: number | null): SLAStatus {
  if (!deadlineHours) {
    return { hasDeadline: false, isOverdue: false, deadlineAt: null, hoursRemaining: null, hoursOverdue: null, timeLabel: "No deadline" };
  }
  const deadline = new Date(new Date(stageStartedAt).getTime() + deadlineHours * 3600000);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / 3600000;

  if (diffMs <= 0) {
    const overdueHours = Math.abs(diffHours);
    const days = Math.floor(overdueHours / 24);
    const hrs = Math.floor(overdueHours % 24);
    return {
      hasDeadline: true,
      isOverdue: true,
      deadlineAt: deadline.toISOString(),
      hoursRemaining: null,
      hoursOverdue: overdueHours,
      timeLabel: days > 0 ? `${days}d ${hrs}h overdue` : `${hrs}h ${Math.floor((overdueHours % 1) * 60)}m overdue`,
    };
  }

  const days = Math.floor(diffHours / 24);
  const hrs = Math.floor(diffHours % 24);
  const mins = Math.floor((diffHours % 1) * 60);
  return {
    hasDeadline: true,
    isOverdue: false,
    deadlineAt: deadline.toISOString(),
    hoursRemaining: diffHours,
    hoursOverdue: null,
    timeLabel: days > 0 ? `${days}d ${hrs}h left` : hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
  };
}
