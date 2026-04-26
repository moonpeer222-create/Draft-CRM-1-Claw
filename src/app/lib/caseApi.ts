import { supabase } from "./supabase";
import { getCurrentTenantId, getCachedTenantId } from "./tenantContext";
import type { Case, Payment, Note } from "./mockData";
import { getStageNumber, getStageLabel, getStageDeadlineHours } from "./mockData";

export async function createCase(caseData: Partial<Case>): Promise<Case | null> {
  // Get tenant context for tenant isolation
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    console.error("No tenant context available for case creation");
    return null;
  }

  const { data: existing } = await supabase.from('cases').select('case_number').order('created_at', { ascending: false }).limit(100);
  const cases = existing || [];
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const c of cases) {
    const match = (c.case_number as string)?.match(/EMR-(\d{4})-(\d+)/);
    if (match && parseInt(match[1], 10) === year) {
      maxNum = Math.max(maxNum, parseInt(match[2], 10));
    }
  }
  const nextNum = Math.max(maxNum + 1, 1001);
  const caseNumber = `EMR-${year}-${String(nextNum).padStart(4, "0")}`;
  const id = crypto.randomUUID();

  const newCase: Case = {
    id,
    customerId: caseData.customerId || null,
    customerName: caseData.customerName || "",
    fatherName: caseData.fatherName || "",
    phone: caseData.phone || "",
    email: caseData.email || "",
    cnic: caseData.cnic || "",
    passport: caseData.passport || "",
    country: caseData.country || "",
    jobType: caseData.jobType || "",
    jobDescription: caseData.jobDescription || "",
    address: caseData.address || "",
    city: caseData.city || "",
    maritalStatus: (caseData.maritalStatus as any) || "single",
    dateOfBirth: caseData.dateOfBirth || "",
    emergencyContact: caseData.emergencyContact || { name: "", phone: "", relationship: "" },
    education: caseData.education || "",
    experience: caseData.experience || "",
    status: (caseData.status as any) || "new_case",
    agentId: caseData.agentId || "",
    agentName: caseData.agentName || "",
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    timeline: caseData.timeline || [],
    documents: caseData.documents || [],
    payments: caseData.payments || [],
    medical: caseData.medical || null,
    notes: caseData.notes || [],
    priority: (caseData.priority as any) || "medium",
    totalFee: caseData.totalFee || 0,
    paidAmount: caseData.paidAmount || 0,
    pipelineType: (caseData.pipelineType as any) || "visa",
    pipelineStageKey: (caseData.pipelineStageKey as any) || (caseData.status as any) || "new_case",
    currentStage: caseData.currentStage || 1,
    stageStartedAt: caseData.stageStartedAt || new Date().toISOString(),
    stageDeadlineAt: caseData.stageDeadlineAt || new Date(Date.now() + 24 * 3600000).toISOString(),
    isOverdue: false,
    documentChecklist: caseData.documentChecklist || {},
    documentChecklistFiles: caseData.documentChecklistFiles || {},
    ...caseData,
  } as Case;

  const dbRow = caseToDbRow({ ...newCase, case_number: caseNumber } as any, tenantId);
  const { error } = await supabase.from('cases').insert(dbRow);
  if (error) {
    console.error("Failed to create case:", error);
    return null;
  }
  return newCase;
}

export async function updateCase(caseId: string, updates: Partial<Case>): Promise<boolean> {
  const tenantId = getCachedTenantId();
  let query = supabase.from('cases').select('*').eq('id', caseId);
  
  // Add tenant filter for security
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  let { data } = await query.single();
  if (!data) {
    let fallbackQuery = supabase.from('cases').select('*').eq('case_number', caseId);
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
    }
    const { data: byCaseNumber } = await fallbackQuery.single();
    data = byCaseNumber;
  }
  if (!data) return false;
  
  const current = mapSupabaseCaseToLocal(data);
  const dbId = data.id;
  const merged: Case = { ...current, ...updates, updatedDate: new Date().toISOString() } as Case;
  const dbRow = caseToDbRow(merged, data.tenant_id);
  dbRow.id = dbId; // ensure we use the real UUID, not the case_number
  
  let updateQuery = supabase.from('cases').update(dbRow).eq('id', dbId);
  if (tenantId) {
    updateQuery = updateQuery.eq('tenant_id', tenantId);
  }
  
  const { error } = await updateQuery;
  if (error) {
    return false;
  }
  return true;
}

export async function updateCaseStatus(caseId: string, status: Case["status"]): Promise<boolean> {
  const tenantId = getCachedTenantId();
  let query = supabase.from('cases').select('*').eq('id', caseId);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  let { data } = await query.single();
  if (!data) {
    let fallbackQuery = supabase.from('cases').select('*').eq('case_number', caseId);
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
    }
    const { data: byCaseNumber } = await fallbackQuery.single();
    data = byCaseNumber;
  }
  if (!data) return false;
  
  const current = mapSupabaseCaseToLocal(data);
  const dbId = data.id;
  const now = new Date().toISOString();

  // Build next stage deadline
  const currentStageNumber = getStageNumber(status);
  const stageLabel = getStageLabel(status);
  const deadlineHours = getStageDeadlineHours(status);
  const newDeadline = new Date(Date.now() + (deadlineHours ?? 24) * 60 * 60 * 1000).toISOString();

  const timelineEntry = {
    stage: currentStageNumber,
    label: stageLabel,
    status: "completed" as const,
    timestamp: now,
    note: `Status updated to ${status}`,
    agent: "System",
  };

  const merged: Case = {
    ...current,
    status,
    currentStage: currentStageNumber,
    stageStartedAt: now,
    stageDeadlineAt: newDeadline,
    updatedDate: now,
    timeline: [...(current.timeline || []), timelineEntry],
  } as Case;

  const dbRow = caseToDbRow(merged, data.tenant_id);
  dbRow.id = dbId;
  
  let updateQuery = supabase.from('cases').update(dbRow).eq('id', dbId);
  if (tenantId) {
    updateQuery = updateQuery.eq('tenant_id', tenantId);
  }
  
  const { error } = await updateQuery;
  if (error) {
    return false;
  }
  return true;
}

export async function addPayment(caseId: string, payment: Payment): Promise<boolean> {
  const tenantId = getCachedTenantId();
  
  // First, get the actual case UUID
  let query = supabase.from('cases').select('id').eq('id', caseId);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  let { data: caseData } = await query.single();
  if (!caseData) {
    let fallbackQuery = supabase.from('cases').select('id').eq('case_number', caseId);
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
    }
    const { data: byCaseNumber } = await fallbackQuery.single();
    caseData = byCaseNumber;
  }
  if (!caseData) return false;
  
  const dbId = caseData.id;
  
  // Insert into payments table instead of metadata blob
  const { error } = await supabase.from('payments').insert({
    case_id: dbId,
    amount: payment.amount || 0,
    method: payment.method || 'cash',
    status: payment.approvalStatus === 'approved' ? 'completed' : 'pending',
    reference: payment.receiptNumber || null,
    notes: payment.description || null,
    verified: payment.approvalStatus === 'approved',
    tenant_id: tenantId || null,
  });
  
  if (error) {
    console.error('Failed to add payment:', error);
    return false;
  }
  
  // paid_amount is auto-calculated by trigger
  return true;
}

export async function addNote(caseId: string, note: Note): Promise<boolean> {
  const tenantId = getCachedTenantId();
  let query = supabase.from('cases').select('*').eq('id', caseId);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  let { data } = await query.single();
  if (!data) {
    let fallbackQuery = supabase.from('cases').select('*').eq('case_number', caseId);
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
    }
    const { data: byCaseNumber } = await fallbackQuery.single();
    data = byCaseNumber;
  }
  if (!data) return false;
  
  const current = mapSupabaseCaseToLocal(data);
  const dbId = data.id;
  const notes = [...(current.notes || []), note];
  const dbRow = caseToDbRow({ ...current, notes, updatedDate: new Date().toISOString() } as Case, data.tenant_id);
  dbRow.id = dbId;
  
  let updateQuery = supabase.from('cases').update(dbRow).eq('id', dbId);
  if (tenantId) {
    updateQuery = updateQuery.eq('tenant_id', tenantId);
  }
  
  const { error } = await updateQuery;
  if (error) {
    return false;
  }
  return true;
}

export async function deleteCase(caseId: string): Promise<boolean> {
  const tenantId = getCachedTenantId();
  let query = supabase.from('cases').select('id').eq('id', caseId);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  let { data } = await query.single();
  if (!data) {
    let fallbackQuery = supabase.from('cases').select('id').eq('case_number', caseId);
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
    }
    const { data: byCaseNumber } = await fallbackQuery.single();
    data = byCaseNumber;
  }
  
  const dbId = data?.id;
  if (!dbId) return false;
  
  let deleteQuery = supabase.from('cases').delete().eq('id', dbId);
  if (tenantId) {
    deleteQuery = deleteQuery.eq('tenant_id', tenantId);
  }
  
  const { error } = await deleteQuery;
  if (error) {
    return false;
  }
  return true;
}

export async function bulkDeleteCases(caseIds: string[]): Promise<boolean> {
  const tenantId = getCachedTenantId();
  let query = supabase.from('cases').delete().in('id', caseIds);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  
  const { error } = await query;
  if (error) {
    return false;
  }
  return true;
}

function caseToDbRow(c: Case, tenantId?: string | null): any {
  const isValidUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  
  // Get tenant ID from parameter or cache
  const effectiveTenantId = tenantId || getCachedTenantId();
  
  const row: any = {
    id: c.id,
    case_number: (c as any).case_number || c.id,
    client_id: c.customerId || null,
    organization_id: (c as any).organization_id || undefined,
    agent_id: isValidUuid(c.agentId || '') ? c.agentId : null,
    visa_type: c.jobType || (c as any).visa_type || null,
    destination_country: c.country || null,
    status: c.status || c.pipelineStageKey || "new_case",
    priority: c.priority || "medium",
    
    // Proper columns (new normalized fields)
    customer_name: c.customerName || null,
    father_name: c.fatherName || null,
    phone: c.phone || null,
    email: c.email || null,
    cnic: c.cnic || null,
    passport: c.passport || null,
    address: c.address || null,
    city: c.city || null,
    marital_status: c.maritalStatus || "single",
    date_of_birth: c.dateOfBirth || null,
    education: c.education || null,
    experience: c.experience || null,
    total_fee: c.totalFee || 0,
    paid_amount: c.paidAmount || 0,
    job_description: c.jobDescription || null,
    emergency_contact: c.emergencyContact || {},
    
    // Keep metadata for backward compatibility and fields not yet normalized
    metadata: {
      agentId: c.agentId,
      agentName: c.agentName,
      timeline: c.timeline,
      documents: c.documents,
      payments: c.payments,
      medical: c.medical,
      notes: c.notes,
      pipelineType: c.pipelineType,
      pipelineStageKey: c.pipelineStageKey,
      currentStage: c.currentStage,
      stageStartedAt: c.stageStartedAt,
      stageDeadlineAt: c.stageDeadlineAt,
      isOverdue: c.isOverdue,
      delayReason: c.delayReason,
      delayReportedAt: c.delayReportedAt,
      documentChecklist: c.documentChecklist,
      documentChecklistFiles: c.documentChecklistFiles,
      paymentVerified: c.paymentVerified,
      paymentVerifiedAt: c.paymentVerifiedAt,
      paymentVerifiedBy: c.paymentVerifiedBy,
      ownerApproval: c.ownerApproval,
      ownerApprovalAt: c.ownerApprovalAt,
      ownerApprovalNote: c.ownerApprovalNote,
      cancellationReason: c.cancellationReason,
      cancelledAt: c.cancelledAt,
      cancelledBy: c.cancelledBy,
      reopenedAt: c.reopenedAt,
      reopenedBy: c.reopenedBy,
      reopenedFromStage: c.reopenedFromStage,
      assignedStaffId: c.assignedStaffId,
      assignedStaffName: c.assignedStaffName,
      assignedAt: c.assignedAt,
      companyName: c.companyName,
      companyCountry: c.companyCountry,
    },
    updated_at: new Date().toISOString(),
  };
  
  // Add tenant_id for tenant isolation
  if (effectiveTenantId) {
    row.tenant_id = effectiveTenantId;
  }
  
  return row;
}

function mapSupabaseCaseToLocal(raw: any): Case {
  const meta = (raw.metadata || {}) as any;
  return {
    id: raw.case_number || raw.id,
    customerId: raw.client_id || meta.customerId || "",
    // Read from proper columns first, fallback to metadata
    customerName: raw.customer_name || meta.customerName || "Customer",
    fatherName: raw.father_name || meta.fatherName || "",
    phone: raw.phone || meta.phone || "",
    email: raw.email || meta.email || "",
    cnic: raw.cnic || meta.cnic || "",
    passport: raw.passport || meta.passport || "",
    country: raw.destination_country || meta.country || "",
    jobType: meta.jobType || raw.visa_type || "",
    jobDescription: raw.job_description || meta.jobDescription || "",
    address: raw.address || meta.address || "",
    city: raw.city || meta.city || "",
    maritalStatus: raw.marital_status || meta.maritalStatus || "single",
    dateOfBirth: raw.date_of_birth || meta.dateOfBirth || "",
    emergencyContact: raw.emergency_contact || meta.emergencyContact || { name: "", phone: "", relationship: "" },
    education: raw.education || meta.education || "",
    experience: raw.experience || meta.experience || "",
    status: raw.status || meta.status || "new_case",
    agentId: raw.agent_id || meta.agentId || "",
    agentName: meta.agentName || "",
    createdDate: raw.created_at || meta.createdDate || new Date().toISOString(),
    updatedDate: raw.updated_at || meta.updatedDate || new Date().toISOString(),
    timeline: meta.timeline || [],
    documents: meta.documents || [],
    payments: meta.payments || [],
    medical: meta.medical || null,
    notes: meta.notes || [],
    priority: (raw.priority || meta.priority || "medium") as any,
    totalFee: parseFloat(raw.total_fee) || meta.totalFee || 0,
    paidAmount: parseFloat(raw.paid_amount) || meta.paidAmount || 0,
    pipelineType: meta.pipelineType || "visa",
    pipelineStageKey: raw.status || meta.pipelineStageKey || "new_case",
    currentStage: meta.currentStage || 1,
    stageStartedAt: meta.stageStartedAt || raw.created_at || new Date().toISOString(),
    stageDeadlineAt: meta.stageDeadlineAt || raw.created_at || new Date().toISOString(),
    isOverdue: raw.is_overdue || meta.isOverdue || false,
    delayReason: meta.delayReason,
    delayReportedAt: meta.delayReportedAt,
    documentChecklist: meta.documentChecklist || {},
    documentChecklistFiles: meta.documentChecklistFiles || {},
    paymentVerified: raw.payment_verified || meta.paymentVerified || false,
    paymentVerifiedAt: raw.payment_verified_at || meta.paymentVerifiedAt,
    paymentVerifiedBy: raw.payment_verified_by || meta.paymentVerifiedBy,
    ownerApproval: raw.owner_approval || meta.ownerApproval || false,
    ownerApprovalAt: raw.owner_approval_at || meta.ownerApprovalAt,
    ownerApprovalNote: raw.owner_approval_note || meta.ownerApprovalNote,
    cancellationReason: raw.cancellation_reason || meta.cancellationReason,
    cancelledAt: raw.cancelled_at || meta.cancelledAt,
    cancelledBy: raw.cancelled_by || meta.cancelledBy,
    reopenedAt: raw.reopened_at || meta.reopenedAt,
    reopenedBy: raw.reopened_by || meta.reopenedBy,
    reopenedFromStage: raw.reopened_from_stage || meta.reopenedFromStage,
    assignedStaffId: raw.assigned_staff_id || meta.assignedStaffId,
    assignedStaffName: raw.assigned_staff_name || meta.assignedStaffName,
    assignedAt: raw.assigned_at || meta.assignedAt,
    companyName: raw.company_name || meta.companyName,
    companyCountry: raw.company_country || meta.companyCountry,
  } as Case;
}

// Re-export mapSupabaseCaseToLocal for other modules
export { mapSupabaseCaseToLocal };
