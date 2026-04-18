// CRM Data Store for Emerald Tech Partner
import type { PipelineType } from "./pipelineConfig";
import { LEAD_PIPELINE_STAGES as _LEAD, VISA_PIPELINE_STAGES as _VISA } from "./pipelineConfig";

// Re-export pipeline config for consumers
export { type PipelineType, LEAD_PIPELINE_STAGES, VISA_PIPELINE_STAGES, MANDATORY_DOCUMENTS, getPipelineStages, getStageByKey, getNextStage, canAdvanceStage, shouldAutoMigrateToVisa, getSLAStatus, getChecklistStatus, calculateSLADeadline } from "./pipelineConfig";

export interface Case {
  id: string;
  customerId: string;
  customerName: string;
  fatherName: string;
  phone: string;
  email: string;
  cnic: string;
  passport: string;
  country: string;
  jobType: string;
  jobDescription: string;
  address: string;
  city: string;
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  dateOfBirth: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  education: string;
  experience: string;
  status: string; // Now dynamic — key from pipeline stages
  agentId: string;
  agentName: string;
  createdDate: string;
  updatedDate: string;
  timeline: TimelineEvent[];
  documents: Document[];
  payments: Payment[];
  medical: Medical | null;
  notes: Note[];
  priority: "low" | "medium" | "high" | "urgent";
  totalFee: number;
  paidAmount: number;

  // ── Dual Pipeline ──────────────────────────────────────
  pipelineType: PipelineType;       // "lead" or "visa"
  pipelineStageKey: string;         // Current stage key from pipeline config
  previousPipelineType?: PipelineType; // Set when migrated from lead to visa
  migratedAt?: string;              // ISO timestamp of auto-migration

  // ── Stage tracking ─────────────────────────────────────
  currentStage: number;
  stageStartedAt: string;
  stageDeadlineAt: string;
  isOverdue: boolean;
  delayReason?: string;
  delayReportedAt?: string;

  // ── Mandatory Document Verification Checklist ──────────
  documentChecklist?: Record<string, boolean>; // key → verified (true/false)
  documentChecklistFiles?: Record<string, string>; // key → docId in storage
  paymentVerified?: boolean;         // 2 Lac payment confirmed
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;

  // ── Sir Atif Approval ──────────────────────────────────
  sirAtifApproval?: boolean;
  sirAtifApprovalAt?: string;
  sirAtifApprovalNote?: string;

  // ── Cancellation & Reopen ──────────────────────────────
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenedFromStage?: string;

  // ── Staff Assignment ───────────────────────────────────
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedAt?: string;

  // ── Company tracking ───────────────────────────────────
  companyName?: string;
  companyCountry?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "status" | "payment" | "document" | "medical" | "note";
  user: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: "pending" | "verified" | "rejected";
  url: string;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  verificationHistory?: Array<{
    action: "verified" | "rejected";
    by: string;
    at: string;
    reason?: string;
  }>;
  // ── Cloud Storage fields ───────────────────────────────
  storagePath?: string;       // Path in Supabase Storage bucket
  storageSignedUrl?: string;  // Temporary signed URL for preview
  signedUrlExpiresAt?: string;
  mimeType?: string;
  fileSize?: number;
  checklistKey?: string;      // Links to mandatory document checklist key
  uploadedByRole?: "agent" | "customer" | "admin" | "master_admin";
  uploadedById?: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: "cash" | "bank" | "easypaisa" | "jazzcash" | "card";
  receiptNumber: string;
  description: string;
  collectedBy: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  submittedByRole?: "admin" | "agent";
}

export interface Medical {
  center: string;
  appointmentDate: string;
  appointmentTime: string;
  status: "scheduled" | "completed" | "failed";
  result?: "fit" | "unfit";
  notes?: string;
}

export interface Note {
  id: string;
  text: string;
  author: string;
  date: string;
  important: boolean;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "Agent" | "Senior Agent" | "Team Lead";
  status: "active" | "inactive" | "on-leave";
  joinDate: string;
  photo: string;
  cases: {
    total: number;
    active: number;
    completed: number;
  };
  performance: {
    rating: number;
    attendance: number;
    revenue: number;
    avgProcessingTime: number;
  };
  permissions: string[];
  salary: number;
  targets: {
    monthly: number;
    achieved: number;
  };
}

// 14-Stage Workflow Configuration
export const WORKFLOW_STAGES: { key: Case["status"]; label: string; labelUrdu: string; deadlineHours: number | null; stageNumber: number }[] = [
  { key: "document_collection", label: "Document Collection", labelUrdu: "دستاویزات جمع", deadlineHours: 48, stageNumber: 1 },
  { key: "selection_call", label: "Selection Call / Office Appointment", labelUrdu: "سلیکشن کال / آفس اپائنٹمنٹ", deadlineHours: null, stageNumber: 2 },
  { key: "medical_token", label: "Medical Token Grant (GAMCA)", labelUrdu: "میڈیکل ٹوکن (گامکا)", deadlineHours: null, stageNumber: 3 },
  { key: "check_medical", label: "Check Medical Status", labelUrdu: "میڈیکل اسٹیٹس چیک", deadlineHours: 36, stageNumber: 4 },
  { key: "biometric", label: "Biometric / Saudi Aitmaad", labelUrdu: "بائیومیٹرک / سعودی اعتماد", deadlineHours: 24, stageNumber: 5 },
  { key: "payment_confirmation", label: "Payment Confirmation", labelUrdu: "ادائیگی کی تصدیق", deadlineHours: 24, stageNumber: 6 },
  { key: "original_documents", label: "Original Documents", labelUrdu: "اصل دستاویزات", deadlineHours: 12, stageNumber: 7 },
  { key: "submitted_to_manager", label: "Case Submitted to Manager", labelUrdu: "کیس مینیجر کو جمع", deadlineHours: 192, stageNumber: 8 }, // 8 days = 192 hours
  { key: "approved", label: "Approved", labelUrdu: "منظور شدہ", deadlineHours: null, stageNumber: 9 },
  { key: "remaining_amount", label: "Remaining Amount", labelUrdu: "باقی رقم", deadlineHours: 24, stageNumber: 10 },
  { key: "ticket_booking", label: "Ticket Booking", labelUrdu: "ٹکٹ بکنگ", deadlineHours: null, stageNumber: 11 },
  { key: "completed", label: "Complete", labelUrdu: "مکمل", deadlineHours: null, stageNumber: 12 },
  // Keep these for backward compatibility but mark as deprecated
  { key: "e_number_issued", label: "E-Number Issued (Deprecated)", labelUrdu: "ای نمبر", deadlineHours: 24, stageNumber: 6 }, 
  { key: "protector", label: "Protector (Deprecated)", labelUrdu: "پروٹیکٹر", deadlineHours: null, stageNumber: 11 },
  { key: "rejected", label: "Rejected", labelUrdu: "مسترد", deadlineHours: null, stageNumber: 0 },
];

export const DELAY_REASONS = [
  { value: "customer_unavailable", label: "Customer Unavailable", labelUrdu: "کسٹمر دستیاب نہیں" },
  { value: "document_issue", label: "Document Issue", labelUrdu: "دستاویزات کا مسئلہ" },
  { value: "medical_delay", label: "Medical Delay", labelUrdu: "میڈیکل تاخیر" },
  { value: "embassy_delay", label: "Embassy Delay", labelUrdu: "سفارتخانے کی تاخیر" },
  { value: "payment_pending", label: "Payment Pending", labelUrdu: "ادائیگی زیرِ التوا" },
  { value: "agent_followup", label: "Agent Follow-up", labelUrdu: "ایجنٹ فالو اپ" },
  { value: "other", label: "Other", labelUrdu: "دیگر" },
];

export function getStageNumber(status: Case["status"]): number {
  const stage = WORKFLOW_STAGES.find(s => s.key === status);
  return stage ? stage.stageNumber : 0;
}

export function getStageLabel(status: Case["status"], urdu = false): string {
  const stage = WORKFLOW_STAGES.find(s => s.key === status);
  if (stage) return urdu ? stage.labelUrdu : stage.label;
  // Also check dual pipeline stages
  const leadStage = _LEAD.find(s => s.key === status);
  if (leadStage) return urdu ? leadStage.labelUrdu : leadStage.label;
  const visaStage = _VISA.find(s => s.key === status);
  if (visaStage) return urdu ? visaStage.labelUrdu : visaStage.label;
  return status === "rejected" ? (urdu ? "مسترد" : "Rejected") : status;
}

export function getStageDeadlineHours(status: Case["status"]): number | null {
  const stage = WORKFLOW_STAGES.find(s => s.key === status);
  if (stage) return stage.deadlineHours;
  // Also check dual pipeline stages
  const leadStage = _LEAD.find(s => s.key === status);
  if (leadStage) return leadStage.deadlineHours;
  const visaStage = _VISA.find(s => s.key === status);
  if (visaStage) return visaStage.deadlineHours;
  return null;
}

export function calculateDeadline(stageStartedAt: string, status: Case["status"]): string | null {
  const hours = getStageDeadlineHours(status);
  if (!hours) return null;
  const start = new Date(stageStartedAt);
  return new Date(start.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export interface OverdueInfo {
  isOverdue: boolean;
  hasDeadline: boolean;
  deadlineAt: string | null;
  hoursRemaining: number | null;
  hoursOverdue: number | null;
  timeLabel: string;
}

export function getOverdueInfo(c: Case): OverdueInfo {
  const deadlineHours = getStageDeadlineHours(c.status);
  const terminalStatuses = ["completed", "rejected", "visa_completed", "visa_cancelled", "lead_cancelled", "stamped"];
  if (!deadlineHours || terminalStatuses.includes(c.status)) {
    return { isOverdue: false, hasDeadline: false, deadlineAt: null, hoursRemaining: null, hoursOverdue: null, timeLabel: "No deadline" };
  }
  const deadline = new Date(new Date(c.stageStartedAt).getTime() + deadlineHours * 3600000);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / 3600000;

  if (diffMs <= 0) {
    const overdueHours = Math.abs(diffHours);
    const days = Math.floor(overdueHours / 24);
    const hrs = Math.floor(overdueHours % 24);
    return {
      isOverdue: true,
      hasDeadline: true,
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
    isOverdue: false,
    hasDeadline: true,
    deadlineAt: deadline.toISOString(),
    hoursRemaining: diffHours,
    hoursOverdue: null,
    timeLabel: days > 0 ? `${days}d ${hrs}h left` : hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
  };
}

export function getDelayReasonLabel(value: string, urdu = false): string {
  const reason = DELAY_REASONS.find(r => r.value === value);
  if (!reason) return value;
  return urdu ? reason.labelUrdu : reason.label;
}

export function reportDelay(caseId: string, reason: string, note?: string): Case | null {
  const cases = CRMDataStore.getCases();
  const idx = cases.findIndex(c => c.id === caseId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  cases[idx].isOverdue = true;
  cases[idx].delayReason = reason;
  cases[idx].delayReportedAt = now;
  cases[idx].updatedDate = now;
  cases[idx].timeline.push({
    id: `TL-DELAY-${Date.now()}`,
    date: now,
    title: `Delay Reported: ${getDelayReasonLabel(reason)}`,
    description: note || `Case delayed at stage ${getStageLabel(cases[idx].status)}. Reason: ${getDelayReasonLabel(reason)}`,
    type: "status",
    user: "Admin",
  });
  CRMDataStore.saveCases(cases);
  return cases[idx];
}

// Local Storage Management
export class CRMDataStore {
  private static CASES_KEY = "crm_cases";
  private static AGENTS_KEY = "crm_agents";
  private static DATA_VERSION_KEY = "crm_data_version";
  private static CURRENT_VERSION = "v10-zombie-kill"; // v10: definitive zombie-data fix — sync guard wipes ALL entity keys + pushes empty to server
  private static _pushCases: (() => void) | null = null;

  // Register the sync push function (called once from SyncProvider)
  static registerSyncPush(fn: () => void) {
    this._pushCases = fn;
  }

  private static notifySync() {
    if (this._pushCases) this._pushCases();
  }

  static getCases(): Case[] {
    const stored = localStorage.getItem(this.CASES_KEY);
    const storedVersion = localStorage.getItem(this.DATA_VERSION_KEY);

    // Version changed or first launch → start with empty (production mode)
    if (!stored || storedVersion !== this.CURRENT_VERSION) {
      // Don't call saveCases here to avoid overwriting intentional resets
      // Just write empty array and version stamp
      localStorage.setItem(this.CASES_KEY, "[]");
      localStorage.setItem(this.DATA_VERSION_KEY, this.CURRENT_VERSION);
      return [];
    }

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(this.CASES_KEY, "[]");
        return [];
      }
      return parsed;
    } catch {
      localStorage.setItem(this.CASES_KEY, "[]");
      return [];
    }
  }
  
  static saveCases(cases: Case[]): void {
    localStorage.setItem(this.CASES_KEY, JSON.stringify(cases));
    localStorage.setItem(this.DATA_VERSION_KEY, this.CURRENT_VERSION);
    this.notifySync();
  }
  
  static addCase(caseData: Partial<Case>): Case {
    const cases = this.getCases();
    const year = new Date().getFullYear();
    // Use max existing case number + 1 to avoid ID collisions after deletions
    let maxNum = 0;
    for (const c of cases) {
      const match = c.id.match(/EMR-\d{4}-(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const nextNum = Math.max(maxNum + 1, 1000 + cases.length);
    const newCase: Case = {
      id: `EMR-${year}-${String(nextNum).padStart(4, "0")}`,
      customerId: `CUST-${nextNum}`,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      timeline: [],
      documents: [],
      payments: [],
      medical: null,
      notes: [],
      priority: "medium",
      paidAmount: 0,
      // Default pipeline fields — new cases start in Lead Pipeline
      pipelineType: "lead",
      pipelineStageKey: "new_lead",
      currentStage: 1,
      stageStartedAt: new Date().toISOString(),
      stageDeadlineAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      isOverdue: false,
      documentChecklist: {},
      documentChecklistFiles: {},
      ...caseData,
    } as Case;
    
    cases.unshift(newCase);
    this.saveCases(cases);
    return newCase;
  }
  
  static updateCase(caseId: string, updates: Partial<Case>): Case | null {
    const cases = this.getCases();
    const index = cases.findIndex(c => c.id === caseId);
    if (index === -1) return null;
    
    cases[index] = {
      ...cases[index],
      ...updates,
      updatedDate: new Date().toISOString(),
    };
    
    this.saveCases(cases);
    return cases[index];
  }
  
  static deleteCase(caseId: string): boolean {
    const cases = this.getCases();
    const filtered = cases.filter(c => c.id !== caseId);
    if (filtered.length === cases.length) return false;
    
    this.saveCases(filtered);
    return true;
  }

  static addDocumentToCase(caseId: string, doc: { name: string; type: string; uploadedAt: string; storagePath?: string; status?: string }): Case | null {
    const cases = this.getCases();
    const idx = cases.findIndex(c => c.id === caseId);
    if (idx === -1) return null;
    if (!cases[idx].documents) cases[idx].documents = [];
    cases[idx].documents.push({
      id: `DOC-${Date.now()}`,
      name: doc.name,
      type: doc.type as any,
      uploadDate: doc.uploadedAt || new Date().toISOString(),
      url: doc.storagePath || "#",
      storagePath: doc.storagePath,
      status: (doc.status || "pending") as any,
    } as any);
    cases[idx].updatedDate = new Date().toISOString();
    this.saveCases(cases);
    return cases[idx];
  }
  
  static addPayment(caseId: string, payment: Omit<Payment, "id">): Case | null {
    const cases = this.getCases();
    const caseIndex = cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) return null;
    
    const newPayment: Payment = {
      ...payment,
      id: `PAY-${cases[caseIndex].payments.length + 1}`,
    };
    
    cases[caseIndex].payments.push(newPayment);
    // Only credit paidAmount if not pending approval
    if (payment.approvalStatus !== "pending") {
      cases[caseIndex].paidAmount += payment.amount;
    }
    cases[caseIndex].updatedDate = new Date().toISOString();
    
    this.saveCases(cases);
    return cases[caseIndex];
  }

  // Approve a pending payment — credit paidAmount
  static approvePayment(caseId: string, paymentId: string): Case | null {
    const cases = this.getCases();
    const caseIndex = cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) return null;

    const payment = cases[caseIndex].payments.find(p => p.id === paymentId);
    if (!payment || payment.approvalStatus !== "pending") return null;

    payment.approvalStatus = "approved";
    cases[caseIndex].paidAmount += payment.amount;
    cases[caseIndex].updatedDate = new Date().toISOString();
    cases[caseIndex].timeline.push({
      id: `TL-${Date.now()}`,
      date: new Date().toISOString(),
      title: "Payment Approved",
      description: `PKR ${payment.amount.toLocaleString()} payment approved by Admin (Receipt: ${payment.receiptNumber})`,
      type: "payment",
      user: "Admin",
    });

    this.saveCases(cases);
    return cases[caseIndex];
  }

  // Reject a pending payment
  static rejectPayment(caseId: string, paymentId: string): Case | null {
    const cases = this.getCases();
    const caseIndex = cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) return null;

    const payment = cases[caseIndex].payments.find(p => p.id === paymentId);
    if (!payment || payment.approvalStatus !== "pending") return null;

    payment.approvalStatus = "rejected";
    cases[caseIndex].updatedDate = new Date().toISOString();
    cases[caseIndex].timeline.push({
      id: `TL-${Date.now()}`,
      date: new Date().toISOString(),
      title: "Payment Rejected",
      description: `PKR ${payment.amount.toLocaleString()} payment rejected by Admin (Receipt: ${payment.receiptNumber})`,
      type: "payment",
      user: "Admin",
    });

    this.saveCases(cases);
    return cases[caseIndex];
  }
  
  static addNote(caseId: string, note: Omit<Note, "id">): Case | null {
    const cases = this.getCases();
    const caseIndex = cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) return null;
    
    const newNote: Note = {
      ...note,
      id: `NOTE-${cases[caseIndex].notes.length + 1}`,
    };
    
    cases[caseIndex].notes.unshift(newNote);
    cases[caseIndex].updatedDate = new Date().toISOString();
    
    this.saveCases(cases);
    return cases[caseIndex];
  }
  
  static updateCaseStatus(caseId: string, status: Case["status"]): Case | null {
    const cases = this.getCases();
    const caseIndex = cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) return null;
    
    const now = new Date().toISOString();
    const stageNum = getStageNumber(status);
    const deadlineHours = getStageDeadlineHours(status);
    const deadlineAt = deadlineHours
      ? new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString()
      : cases[caseIndex].stageDeadlineAt;

    cases[caseIndex].status = status;
    cases[caseIndex].pipelineStageKey = status; // Keep pipeline stage in sync
    cases[caseIndex].currentStage = stageNum || cases[caseIndex].currentStage;
    cases[caseIndex].stageStartedAt = now;
    cases[caseIndex].stageDeadlineAt = deadlineAt;
    cases[caseIndex].isOverdue = false;
    cases[caseIndex].delayReason = undefined;
    cases[caseIndex].delayReportedAt = undefined;
    cases[caseIndex].timeline.push({
      id: `TL-${cases[caseIndex].timeline.length + 1}`,
      date: now,
      title: `Status changed to ${getStageLabel(status)}`,
      description: `Case moved to stage ${stageNum}: ${getStageLabel(status)}`,
      type: "status",
      user: "Agent",
    });
    cases[caseIndex].updatedDate = now;
    
    this.saveCases(cases);
    return cases[caseIndex];
  }

  // Demo Data Generation — REMOVED: production system starts empty
  private static getDemoCases(): Case[] {
    return [];
  }
}