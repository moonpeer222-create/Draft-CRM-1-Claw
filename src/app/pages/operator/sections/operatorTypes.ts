// ── Shared Types ─────────────────────────────────────────
export interface CaseFolder {
  id: string; clientName: string; phone: string; destination: string; assignedTo: string; createdAt: string;
}
export interface Appointment {
  id: string; clientName: string; type: "medical" | "protector" | "payment"; date: string; time: string; notes: string; done: boolean;
}
export interface OfficeVisit {
  id: string; clientName: string; phone: string; purpose: string; metWith: string; notes: string; timestamp: string;
}
export interface PaymentRecord {
  id: string; clientName: string; amount: number; method: string; receiptNumber: string; receiptPhoto: string | null; storagePath?: string; uploadProgress: number; timestamp: string;
}
export interface AttendanceEntry {
  staffName: string; status: "present" | "late" | "absent" | ""; time: string; date: string;
}
export interface OperatorNotification {
  id: string; message: string; messageUr: string; type: "status" | "payment" | "flag" | "report"; time: string; read: boolean;
}

export const STORAGE = {
  folders: "emr-op-folders",
  appointments: "emr-op-appointments",
  visits: "emr-op-visits",
  payments: "emr-op-payments",
  attendance: "emr-op-attendance",
  notifications: "emr-op-notifications",
};

export function load<T>(key: string, fallback: T): T {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
export function save(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
  // Trigger debounced cloud sync
  import("../../../lib/operatorSync").then(m => m.debouncedPush()).catch(() => {});
}
