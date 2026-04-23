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
  const newDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();

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
  const payments = [...(current.payments || []), payment];
  const paidAmount = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0);
  const dbRow = caseToDbRow({ ...current, payments, paidAmount, updatedDate: new Date().toISOString() } as Case, data.tenant_id);
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
    visa_type: c.jobType || c.visa_type || null,
    destination_country: c.country || null,
    status: c.status || c.pipelineStageKey || "new_case",
    priority: c.priority || "medium",
    metadata: {
      customerName: c.customerName,
      fatherName: c.fatherName,
      phone: c.phone,
      email: c.email,
      cnic: c.cnic,
      passport: c.passport,
      country: c.country,
      jobType: c.jobType,
      jobDescription: c.jobDescription,
      address: c.address,
      city: c.city,
      maritalStatus: c.maritalStatus,
      dateOfBirth: c.dateOfBirth,
      emergencyContact: c.emergencyContact,
      education: c.education,
      experience: c.experience,
      agentId: c.agentId,
      agentName: c.agentName,
      timeline: c.timeline,
      documents: c.documents,
      payments: c.payments,
      medical: c.medical,
      notes: c.notes,
      totalFee: c.totalFee,
      paidAmount: c.paidAmount,
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
    customerName: meta.customerName || "Customer",
    fatherName: meta.fatherName || "",
    phone: meta.phone || "",
    email: meta.email || "",
    cnic: meta.cnic || "",
    passport: meta.passport || "",
    country: raw.destination_country || meta.country || "",
    jobType: meta.jobType || raw.visa_type || "",
    jobDescription: meta.jobDescription || "",
    address: meta.address || "",
    city: meta.city || "",
    maritalStatus: meta.maritalStatus || "single",
    dateOfBirth: meta.dateOfBirth || "",
    emergencyContact: meta.emergencyContact || { name: "", phone: "", relationship: "" },
    education: meta.education || "",
    experience: meta.experience || "",
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
    totalFee: meta.totalFee || 0,
    paidAmount: meta.paidAmount || 0,
    pipelineType: meta.pipelineType || "visa",
    pipelineStageKey: raw.status || meta.pipelineStageKey || "new_case",
    currentStage: meta.currentStage || 1,
    stageStartedAt: meta.stageStartedAt || raw.created_at || new Date().toISOString(),
    stageDeadlineAt: meta.stageDeadlineAt || raw.created_at || new Date().toISOString(),
    isOverdue: meta.isOverdue || false,
    delayReason: meta.delayReason,
    delayReportedAt: meta.delayReportedAt,
    documentChecklist: meta.documentChecklist || {},
    documentChecklistFiles: meta.documentChecklistFiles || {},
    paymentVerified: meta.paymentVerified || false,
    paymentVerifiedAt: meta.paymentVerifiedAt,
    paymentVerifiedBy: meta.paymentVerifiedBy,
    ownerApproval: meta.ownerApproval || false,
    ownerApprovalAt: meta.ownerApprovalAt,
    ownerApprovalNote: meta.ownerApprovalNote,
    cancellationReason: meta.cancellationReason,
    cancelledAt: meta.cancelledAt,
    cancelledBy: meta.cancelledBy,
    reopenedAt: meta.reopenedAt,
    reopenedBy: meta.reopenedBy,
    reopenedFromStage: meta.reopenedFromStage,
    assignedStaffId: meta.assignedStaffId,
    assignedStaffName: meta.assignedStaffName,
    assignedAt: meta.assignedAt,
    companyName: meta.companyName,
    companyCountry: meta.companyCountry,
  } as Case;
}

// Re-export mapSupabaseCaseToLocal for other modules
export { mapSupabaseCaseToLocal };
