// Attendance Service — localStorage persistence + Supabase sync via SyncProvider
export interface AttendanceRecord {
  id: string;
  agentId: string;
  agentName: string;
  date: string; // YYYY-MM-DD
  checkIn: string | null; // time string e.g. "9:00 AM"
  checkOut: string | null;
  status: "on-time" | "late" | "absent" | "on-leave" | "half-day";
  totalHours: string;
  location?: string;
  selfieAttached?: boolean;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  agentId: string;
  agentName: string;
  dates: string;
  startDate: string;
  endDate: string;
  type: "Vacation" | "Sick Leave" | "Personal" | "Emergency" | "Other";
  reason: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const ATTENDANCE_KEY = "crm_attendance";
const LEAVE_KEY = "crm_leave_requests";

// Scheduled office time (9:00 AM)
const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 0;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isLateCheckIn(): boolean {
  const now = new Date();
  return now.getHours() > OFFICE_START_HOUR ||
    (now.getHours() === OFFICE_START_HOUR && now.getMinutes() > OFFICE_START_MINUTE + 15);
}

function calculateHours(checkIn: string, checkOut: string): string {
  try {
    const parseTime = (t: string) => {
      const [time, period] = t.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    const mins = parseTime(checkOut) - parseTime(checkIn);
    if (mins <= 0) return "0h";
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  } catch {
    return "N/A";
  }
}

export class AttendanceService {
  private static _pushSync: (() => void) | null = null;

  static registerSyncPush(pushFn: () => void) {
    this._pushSync = pushFn;
  }

  private static notifySync() {
    if (this._pushSync) this._pushSync();
  }

  // ===== Attendance Records =====

  static getRecords(): AttendanceRecord[] {
    const stored = localStorage.getItem(ATTENDANCE_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    // Production: start with empty records — no seed data
    return [];
  }

  static saveRecords(records: AttendanceRecord[]): void {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
    this.notifySync();
  }

  static getRecordsForDate(date: string): AttendanceRecord[] {
    return this.getRecords().filter(r => r.date === date);
  }

  static getRecordsForAgent(agentId: string): AttendanceRecord[] {
    return this.getRecords().filter(r => r.agentId === agentId);
  }

  static getRecordsForAgentMonth(agentId: string, year: number, month: number): AttendanceRecord[] {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return this.getRecords().filter(r => r.agentId === agentId && r.date.startsWith(prefix));
  }

  static getTodayRecord(agentId: string): AttendanceRecord | undefined {
    return this.getRecords().find(r => r.agentId === agentId && r.date === todayStr());
  }

  static checkIn(agentId: string, agentName: string, location?: string): AttendanceRecord {
    const records = this.getRecords();
    const today = todayStr();
    const existing = records.find(r => r.agentId === agentId && r.date === today);

    const time = nowTimeStr();
    const late = isLateCheckIn();
    const status: AttendanceRecord["status"] = late ? "late" : "on-time";

    if (existing) {
      existing.checkIn = time;
      existing.status = status;
      existing.location = location;
      this.saveRecords(records);
      return existing;
    }

    const record: AttendanceRecord = {
      id: generateId("ATT"),
      agentId,
      agentName,
      date: today,
      checkIn: time,
      checkOut: null,
      status,
      totalHours: "0h",
      location,
    };
    records.unshift(record);
    this.saveRecords(records);
    return record;
  }

  static checkOut(agentId: string): AttendanceRecord | null {
    const records = this.getRecords();
    const today = todayStr();
    const record = records.find(r => r.agentId === agentId && r.date === today);
    if (!record || !record.checkIn) return null;

    record.checkOut = nowTimeStr();
    record.totalHours = calculateHours(record.checkIn, record.checkOut);

    // Check for overtime (> 9 hours)
    const totalMins = parseTotalMinutes(record.totalHours);
    if (totalMins > 9 * 60) {
      const extraMins = totalMins - 9 * 60;
      const extraH = Math.floor(extraMins / 60);
      const extraM = extraMins % 60;
      record.notes = `Overtime: ${extraH}h ${extraM}m`;
    }

    this.saveRecords(records);
    return record;
  }

  static markAbsent(agentId: string, agentName: string, date?: string): AttendanceRecord {
    const records = this.getRecords();
    const d = date || todayStr();
    const existing = records.find(r => r.agentId === agentId && r.date === d);

    if (existing) {
      existing.status = "absent";
      existing.checkIn = null;
      existing.checkOut = null;
      existing.totalHours = "-";
      this.saveRecords(records);
      return existing;
    }

    const record: AttendanceRecord = {
      id: generateId("ATT"),
      agentId,
      agentName,
      date: d,
      checkIn: null,
      checkOut: null,
      status: "absent",
      totalHours: "-",
    };
    records.unshift(record);
    this.saveRecords(records);
    return record;
  }

  // Summary stats for a date
  static getDailySummary(date?: string): {
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    total: number;
  } {
    const d = date || todayStr();
    const records = this.getRecordsForDate(d);
    return {
      present: records.filter(r => r.status === "on-time").length,
      late: records.filter(r => r.status === "late").length,
      absent: records.filter(r => r.status === "absent").length,
      onLeave: records.filter(r => r.status === "on-leave").length,
      total: records.length,
    };
  }

  // Agent monthly stats
  static getAgentMonthlyStats(agentId: string, year?: number, month?: number): {
    daysPresent: number;
    lateArrivals: number;
    absences: number;
    streak: number;
    onTimeRate: number;
  } {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;
    const records = this.getRecordsForAgentMonth(agentId, y, m);
    const present = records.filter(r => r.status === "on-time" || r.status === "late");
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;

    // Calculate current on-time streak
    const allRecords = this.getRecordsForAgent(agentId).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    let streak = 0;
    for (const r of allRecords) {
      if (r.status === "on-time") streak++;
      else break;
    }

    const totalWorking = present.length + absent;
    const onTimeRate = totalWorking > 0
      ? Math.round(((present.length - late) / totalWorking) * 100)
      : 100;

    return {
      daysPresent: present.length,
      lateArrivals: late,
      absences: absent,
      streak,
      onTimeRate,
    };
  }

  // ===== Leave Requests =====

  static getLeaveRequests(): LeaveRequest[] {
    const stored = localStorage.getItem(LEAVE_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    // Production: start with empty records — no seed data
    return [];
  }

  static saveLeaveRequests(requests: LeaveRequest[]): void {
    localStorage.setItem(LEAVE_KEY, JSON.stringify(requests));
    this.notifySync();
  }

  static getPendingLeaveRequests(): LeaveRequest[] {
    return this.getLeaveRequests().filter(r => r.status === "pending");
  }

  static submitLeaveRequest(
    agentId: string,
    agentName: string,
    type: LeaveRequest["type"],
    startDate: string,
    endDate: string,
    reason: string,
  ): LeaveRequest {
    const requests = this.getLeaveRequests();
    const dates = startDate === endDate
      ? new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : `${new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const request: LeaveRequest = {
      id: generateId("LR"),
      agentId,
      agentName,
      dates,
      startDate,
      endDate,
      type,
      reason,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    requests.unshift(request);
    this.saveLeaveRequests(requests);
    return request;
  }

  static approveLeave(requestId: string, reviewedBy: string = "Admin"): LeaveRequest | null {
    const requests = this.getLeaveRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return null;

    req.status = "approved";
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewedBy;
    this.saveLeaveRequests(requests);

    // Mark those dates as on-leave in attendance records
    const records = this.getRecords();
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const existing = records.find(r => r.agentId === req.agentId && r.date === dateStr);
      if (existing) {
        existing.status = "on-leave";
        existing.checkIn = null;
        existing.checkOut = null;
        existing.totalHours = "-";
      } else {
        records.push({
          id: generateId("ATT"),
          agentId: req.agentId,
          agentName: req.agentName,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          status: "on-leave",
          totalHours: "-",
          notes: `On leave: ${req.type}`,
        });
      }
    }
    this.saveRecords(records);

    return req;
  }

  static rejectLeave(requestId: string, reviewedBy: string = "Admin"): LeaveRequest | null {
    const requests = this.getLeaveRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return null;

    req.status = "rejected";
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewedBy;
    this.saveLeaveRequests(requests);
    return req;
  }

  // ===== Seed Data =====

  // Production: no seed data — all records are created by real user actions
  private static generateSeedData(): AttendanceRecord[] {
    return [];
  }

  private static generateSeedLeaveRequests(): LeaveRequest[] {
    return [];
  }
}

function parseTotalMinutes(hours: string): number {
  try {
    const hMatch = hours.match(/(\d+)h/);
    const mMatch = hours.match(/(\d+)m/);
    const h = hMatch ? parseInt(hMatch[1]) : 0;
    const m = mMatch ? parseInt(mMatch[1]) : 0;
    return h * 60 + m;
  } catch {
    return 0;
  }
}