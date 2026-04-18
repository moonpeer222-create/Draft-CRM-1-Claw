export const SESSION_PREFIX = "crm:session:";

export const MAX_CASES = 500;
export const MAX_AUDIT_LOG = 300;
export const MAX_NOTIFICATIONS = 100;
export const MAX_ATTENDANCE = 500;
export const MAX_LEAVE_REQUESTS = 200;
export const MAX_PASSPORT_TRACKING = 300;
export const MAX_CODE_HISTORY = 200;

export const DOC_BUCKET = "make-5cdc87b7-documents";

export const KEY = {
  cases: "crm:cases",
  agents: "crm:agent_codes",
  adminProfile: "crm:admin_profile",
  agentProfile: (name: string) => `crm:agent_profile:${name}`,
  agentAvatar: (name: string) => `crm:agent_avatar:${name}`,
  settings: "crm:settings",
  codeHistory: "crm:code_history",
  notifications: "crm:notifications",
  attendance: (date: string) => `crm:attendance:${date}`,
  attendanceAll: "crm:attendance_all",
  leaveRequests: "crm:leave_requests",
  users: "crm:users_db",
  passportTracking: "crm:passport_tracking",
  auditLog: "crm:audit_log",
  documentFiles: "crm:document_files",
  meta: "crm:meta",
  operatorData: "crm:operator_data",
  aiAudit: "crm:ai_audit_log",
};
