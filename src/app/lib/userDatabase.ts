// Unified User Database for Emerald Tech Partner
// Stores admin, agent, and customer users in localStorage with sync to KV store
// All authentication is handled locally — passwords are SHA-256 hashed

import {
  hashPassword,
  verifyPassword,
  checkLockout,
  recordFailedAttempt,
  clearLockout,
  formatLockoutTime,
  isSessionExpired,
  validatePasswordStrength,
} from "./security";

const USERS_STORAGE_KEY = "crm_users_db";
const CUSTOMER_SESSION_KEY = "emerald-customer-session";
const USERS_VERSION_KEY = "crm_users_version";
const CURRENT_USERS_VERSION = "v7-secure"; // v7: hashed passwords + lockout + session expiry

export type UserRole = "master_admin" | "admin" | "agent" | "customer" | "operator";
export type UserStatus = "active" | "inactive" | "suspended";

export interface CRMUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  password: string; // SHA-256 hashed
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  agentId?: string;    // links agent users to AccessCodeService (e.g. "AGENT-1")
  caseId?: string;     // links customer users to their visa case
  avatar?: string;
  meta?: Record<string, any>;
  passwordChangedAt?: string; // Track when password was last changed
  mustChangePassword?: boolean; // Force password change on next login
}

export interface CustomerSession {
  userId: string;
  fullName: string;
  email: string;
  caseId: string;
  loginAt: number;
  expiresAt: number;
  active: boolean;
}

// ── Sync callback ──────────────────────────────────────────
let _syncPush: (() => void) | null = null;

function notifySync() {
  if (_syncPush) _syncPush();
}

// ── Strong default passwords for each staff member ─────────
// These are the PLAINTEXT passwords — they get hashed during seeding.
// Share these with staff securely (in person or WhatsApp), then have them change on first login.
const STAFF_CREDENTIALS = {
  husnain:  { email: "husnain@emeraldvisa.com",  password: "Husn@!n$Adm#24" },
  faizan:   { email: "faizan@emeraldvisa.com",   password: "F@iz@n$Agt#24!" },
  imran:    { email: "imran@emeraldvisa.com",    password: "Imr@n$Agt#2024" },
  safeer:   { email: "safeer@emeraldvisa.com",   password: "S@feer$Agt#24!" },
  aynee:    { email: "aynee@emeraldvisa.com",    password: "Ayn33$Agt#2024" },
  operator: { email: "operator@emeraldvisa.com", password: "Oper@t0r$Em#24" },
};

// ── Default seed data (will be hashed on first init) ───────
async function seedDefaults(): Promise<CRMUser[]> {
  const now = new Date().toISOString();
  return [
    {
      id: "U-003", email: STAFF_CREDENTIALS.husnain.email, phone: "+92 301 2345678",
      fullName: "Husnain", password: await hashPassword(STAFF_CREDENTIALS.husnain.password),
      role: "admin", status: "active",
      createdAt: "2024-02-15T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Admin", department: "Operations" },
    },
    {
      id: "U-004", email: STAFF_CREDENTIALS.faizan.email, phone: "+92 302 3456789",
      fullName: "Faizan", password: await hashPassword(STAFF_CREDENTIALS.faizan.password),
      role: "agent", status: "active", agentId: "AGENT-1",
      createdAt: "2024-03-01T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Senior Agent", department: "Visa Processing" },
    },
    {
      id: "U-005", email: STAFF_CREDENTIALS.imran.email, phone: "+92 303 4567890",
      fullName: "Imran", password: await hashPassword(STAFF_CREDENTIALS.imran.password),
      role: "agent", status: "active", agentId: "AGENT-2",
      createdAt: "2024-03-10T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Agent", department: "Visa Processing" },
    },
    {
      id: "U-006", email: STAFF_CREDENTIALS.safeer.email, phone: "+92 304 5678901",
      fullName: "Safeer", password: await hashPassword(STAFF_CREDENTIALS.safeer.password),
      role: "agent", status: "active", agentId: "AGENT-3",
      createdAt: "2024-04-01T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Agent", department: "Visa Processing" },
    },
    {
      id: "U-007", email: STAFF_CREDENTIALS.aynee.email, phone: "+92 305 6789012",
      fullName: "Aynee", password: await hashPassword(STAFF_CREDENTIALS.aynee.password),
      role: "agent", status: "active", agentId: "AGENT-4",
      createdAt: "2024-04-15T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Agent", department: "Visa Processing" },
    },
    {
      id: "U-013", email: STAFF_CREDENTIALS.operator.email, phone: "+92 306 7890123",
      fullName: "Operator", password: await hashPassword(STAFF_CREDENTIALS.operator.password),
      role: "operator" as UserRole, status: "active" as UserStatus,
      createdAt: "2024-05-01T00:00:00Z", updatedAt: now, lastLogin: null,
      passwordChangedAt: now, mustChangePassword: false,
      meta: { title: "Computer Operator", department: "Operations" },
    },
  ];
}

// ════════════════════════════════════════════════════════════
// UserDB — the main API
// ════════════════════════════════════════════════════════════
export class UserDB {

  // Register a sync callback (called once from SyncProvider)
  static registerSyncPush(fn: () => void) {
    _syncPush = fn;
  }

  // ── Initialise (now async due to hashing) ───────────────
  static async initialize(): Promise<CRMUser[]> {
    const storedVersion = localStorage.getItem(USERS_VERSION_KEY);
    const existing = this.getAllUsers();

    if (storedVersion !== CURRENT_USERS_VERSION) {
      // Version changed — re-seed with hashed passwords, keep custom users
      const defaults = await seedDefaults();
      const defaultIds = new Set(defaults.map(d => d.id));
      const merged = [
        ...defaults,
        ...existing.filter(u => !defaultIds.has(u.id)),
      ];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
      localStorage.setItem(USERS_VERSION_KEY, CURRENT_USERS_VERSION);
      notifySync();
      return merged;
    }

    if (existing.length > 0) return existing;

    const defaults = await seedDefaults();
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaults));
    localStorage.setItem(USERS_VERSION_KEY, CURRENT_USERS_VERSION);
    notifySync();
    return defaults;
  }

  // ── CRUD ─────────────────────────────────────────────────
  static getAllUsers(): CRMUser[] {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  }

  static getUserById(id: string): CRMUser | null {
    return this.getAllUsers().find(u => u.id === id) || null;
  }

  static getUserByEmail(email: string): CRMUser | null {
    return this.getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  static getUserByCaseId(caseId: string): CRMUser | null {
    return this.getAllUsers().find(u => u.caseId?.toLowerCase() === caseId.toLowerCase()) || null;
  }

  static getUsersByRole(role: UserRole): CRMUser[] {
    return this.getAllUsers().filter(u => u.role === role);
  }

  static async createUser(data: Omit<CRMUser, "id" | "createdAt" | "updatedAt" | "lastLogin"> & { password: string }): Promise<CRMUser> {
    const users = this.getAllUsers();
    const maxNum = users.reduce((max, u) => {
      const n = parseInt(u.id.replace("U-", ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const hashedPw = await hashPassword(data.password);
    const newUser: CRMUser = {
      ...data,
      password: hashedPw,
      id: `U-${String(maxNum + 1).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null,
      passwordChangedAt: new Date().toISOString(),
    };
    users.push(newUser);
    this._save(users);
    return newUser;
  }

  static updateUser(id: string, updates: Partial<CRMUser>): CRMUser | null {
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    this._save(users);
    return users[idx];
  }

  static deleteUser(id: string): boolean {
    const users = this.getAllUsers();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) return false;
    this._save(filtered);
    return true;
  }

  static async changePassword(id: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return { success: false, error: strength.errors[0] };
    }
    const hashed = await hashPassword(newPassword);
    const updated = this.updateUser(id, {
      password: hashed,
      passwordChangedAt: new Date().toISOString(),
      mustChangePassword: false,
    });
    return updated ? { success: true } : { success: false, error: "User not found" };
  }

  // ── Auth (async — uses SHA-256 verification) ────────────

  /** Admin / Master-Admin login by email + password */
  static async adminLogin(email: string, password: string): Promise<{ success: boolean; user?: CRMUser; error?: string }> {
    // Check lockout
    const lockout = checkLockout(email);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const user = this.getUserByEmail(email);
    if (!user) {
      recordFailedAttempt(email);
      return { success: false, error: "Invalid email or password" }; // Generic message per OWASP
    }
    if (user.role !== "admin" && user.role !== "master_admin") {
      return { success: false, error: "Not an admin account" };
    }
    if (user.status !== "active") {
      return { success: false, error: "Account is " + user.status };
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const result = recordFailedAttempt(email);
      if (result.locked) {
        return { success: false, error: `Too many failed attempts. Account locked for ${formatLockoutTime(result.remainingMs)}` };
      }
      return { success: false, error: `Invalid email or password (${result.attemptsLeft} attempts remaining)` };
    }

    // Success — clear lockout
    clearLockout(email);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });

    // Store admin session with expiry
    const sessionTTL = 8 * 60 * 60 * 1000; // 8 hours
    localStorage.setItem("emerald-admin-auth", JSON.stringify({
      email: user.email,
      userId: user.id,
      fullName: user.fullName,
      role: user.role,
      loginAt: Date.now(),
      expiresAt: Date.now() + sessionTTL,
      active: true,
    }));
    return { success: true, user: { ...user, lastLogin: new Date().toISOString() } };
  }

  /** Master-Admin only login by email + password */
  static async masterAdminLogin(email: string, password: string): Promise<{ success: boolean; user?: CRMUser; error?: string }> {
    const lockout = checkLockout(email);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const user = this.getUserByEmail(email);
    if (!user) {
      recordFailedAttempt(email);
      return { success: false, error: "Invalid email or password" };
    }
    if (user.role !== "master_admin") {
      return { success: false, error: "Not a master admin account" };
    }
    if (user.status !== "active") {
      return { success: false, error: "Account is " + user.status };
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const result = recordFailedAttempt(email);
      if (result.locked) {
        return { success: false, error: `Too many failed attempts. Account locked for ${formatLockoutTime(result.remainingMs)}` };
      }
      return { success: false, error: `Invalid email or password (${result.attemptsLeft} attempts remaining)` };
    }

    clearLockout(email);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });

    const sessionTTL = 12 * 60 * 60 * 1000; // 12 hours
    localStorage.setItem("emerald-master-auth", JSON.stringify({
      email: user.email,
      userId: user.id,
      fullName: user.fullName,
      role: user.role,
      loginAt: Date.now(),
      expiresAt: Date.now() + sessionTTL,
      active: true,
    }));
    return { success: true, user: { ...user, lastLogin: new Date().toISOString() } };
  }

  /** Check if master admin is logged in (with session expiry) */
  static isMasterLoggedIn(): boolean {
    if (isSessionExpired("emerald-master-auth")) {
      localStorage.removeItem("emerald-master-auth");
      return false;
    }
    try {
      const data = localStorage.getItem("emerald-master-auth");
      if (!data) return false;
      const session = JSON.parse(data);
      return session.active && session.role === "master_admin";
    } catch { return false; }
  }

  /** Get current master admin session */
  static getMasterSession(): { email: string; userId: string; fullName: string; role: string; loginAt: number; expiresAt: number; active: boolean } | null {
    if (isSessionExpired("emerald-master-auth")) {
      localStorage.removeItem("emerald-master-auth");
      return null;
    }
    try {
      const data = localStorage.getItem("emerald-master-auth");
      if (!data) return null;
      const session = JSON.parse(data);
      return session.active ? session : null;
    } catch { return null; }
  }

  /** Master admin logout */
  static masterLogout(): void {
    localStorage.removeItem("emerald-master-auth");
  }

  /** Customer login by email + password */
  static async customerLogin(email: string, password: string): Promise<{ success: boolean; user?: CRMUser; error?: string }> {
    const lockout = checkLockout(email);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const user = this.getUserByEmail(email);
    if (!user) {
      recordFailedAttempt(email);
      return { success: false, error: "Account not found. Contact your agent." };
    }
    if (user.role !== "customer") return { success: false, error: "Not a customer account" };
    if (user.status !== "active") return { success: false, error: "Account is " + user.status };

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const result = recordFailedAttempt(email);
      if (result.locked) {
        return { success: false, error: `Too many failed attempts. Account locked for ${formatLockoutTime(result.remainingMs)}` };
      }
      return { success: false, error: `Invalid password (${result.attemptsLeft} attempts remaining)` };
    }

    clearLockout(email);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });
    const session: CustomerSession = {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      caseId: user.caseId || "",
      loginAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      active: true,
    };
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
    return { success: true, user };
  }

  /** Customer login by Case ID + phone */
  static customerLoginByCaseId(caseId: string, phone: string): { success: boolean; user?: CRMUser; error?: string } {
    const lockout = checkLockout(caseId);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const user = this.getUserByCaseId(caseId);
    if (!user) {
      recordFailedAttempt(caseId);
      return { success: false, error: "Case ID not found" };
    }
    const normalizePhone = (p: string) => p.replace(/[\s\-\(\)]/g, "");
    if (normalizePhone(user.phone) !== normalizePhone(phone)) {
      const result = recordFailedAttempt(caseId);
      return { success: false, error: `Phone number does not match (${result.attemptsLeft} attempts remaining)` };
    }
    if (user.status !== "active") return { success: false, error: "Account is " + user.status };

    clearLockout(caseId);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });
    const session: CustomerSession = {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      caseId: user.caseId || "",
      loginAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      active: true,
    };
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
    return { success: true, user };
  }

  // ── Customer Session ─────────────────────────────────────
  static getCustomerSession(): CustomerSession | null {
    try {
      const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
      if (!raw) return null;
      const session: CustomerSession = JSON.parse(raw);
      if (!session.active || Date.now() > session.expiresAt) {
        this.customerLogout();
        return null;
      }
      return session;
    } catch { return null; }
  }

  static isCustomerLoggedIn(): boolean {
    return !!this.getCustomerSession();
  }

  static customerLogout(): void {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }

  // ── Operator Auth ───────────────────────────────────────
  static async operatorLogin(email: string, password: string): Promise<{ success: boolean; user?: CRMUser; error?: string }> {
    const lockout = checkLockout(email);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const user = this.getUserByEmail(email);
    if (!user) {
      recordFailedAttempt(email);
      return { success: false, error: "Invalid email or password" };
    }
    if (user.role !== "operator") return { success: false, error: "Not an operator account" };
    if (user.status !== "active") return { success: false, error: "Account is " + user.status };

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const result = recordFailedAttempt(email);
      if (result.locked) {
        return { success: false, error: `Too many failed attempts. Account locked for ${formatLockoutTime(result.remainingMs)}` };
      }
      return { success: false, error: `Invalid email or password (${result.attemptsLeft} attempts remaining)` };
    }

    clearLockout(email);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });
    const sessionTTL = 8 * 60 * 60 * 1000;
    localStorage.setItem("emerald-operator-session", JSON.stringify({
      email: user.email,
      userId: user.id,
      fullName: user.fullName,
      role: "operator",
      loginAt: Date.now(),
      expiresAt: Date.now() + sessionTTL,
      active: true,
    }));
    return { success: true, user: { ...user, lastLogin: new Date().toISOString() } };
  }

  static isOperatorLoggedIn(): boolean {
    if (isSessionExpired("emerald-operator-session")) {
      localStorage.removeItem("emerald-operator-session");
      return false;
    }
    try {
      const data = localStorage.getItem("emerald-operator-session");
      if (!data) return false;
      const session = JSON.parse(data);
      if (!session.active || session.role !== "operator") return false;
      return true;
    } catch { return false; }
  }

  static getOperatorSession(): { email: string; userId: string; fullName: string; role: string; loginAt: number; expiresAt: number; active: boolean } | null {
    if (isSessionExpired("emerald-operator-session")) {
      localStorage.removeItem("emerald-operator-session");
      return null;
    }
    try {
      const data = localStorage.getItem("emerald-operator-session");
      if (!data) return null;
      const session = JSON.parse(data);
      if (!session.active) return null;
      return session;
    } catch { return null; }
  }

  static operatorLogout(): void {
    localStorage.removeItem("emerald-operator-session");
  }

  // ── Agent Login by Credentials (same-device offline) ────
  static async agentLoginByCredentials(
    emailOrAgentId: string,
    password: string
  ): Promise<{ success: boolean; agentId?: string; agentName?: string; error?: string }> {
    const lockout = checkLockout(emailOrAgentId);
    if (lockout.locked) {
      return { success: false, error: `Account locked. Try again in ${formatLockoutTime(lockout.remainingMs)}` };
    }

    const input = emailOrAgentId.trim();
    let user: CRMUser | null | undefined = null;

    if (input.includes("@")) {
      user = this.getUserByEmail(input);
    } else {
      let aid = input.toUpperCase();
      if (!aid.startsWith("AGENT-")) aid = `AGENT-${aid}`;
      user = this.getAllUsers().find(u => u.agentId === aid && u.role === "agent") || null;
    }

    if (!user) {
      recordFailedAttempt(emailOrAgentId);
      return { success: false, error: "Invalid credentials" };
    }
    if (user.role !== "agent") return { success: false, error: "Not an agent account" };
    if (user.status !== "active") return { success: false, error: "Account is " + user.status };

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const result = recordFailedAttempt(emailOrAgentId);
      if (result.locked) {
        return { success: false, error: `Too many failed attempts. Account locked for ${formatLockoutTime(result.remainingMs)}` };
      }
      return { success: false, error: `Invalid credentials (${result.attemptsLeft} attempts remaining)` };
    }
    if (!user.agentId) return { success: false, error: "Agent ID not configured" };

    clearLockout(emailOrAgentId);
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });

    const session = {
      agentId: user.agentId,
      agentName: user.fullName,
      code: "credential-login",
      loginAt: Date.now(),
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      active: true,
    };
    localStorage.setItem("emerald-agent-session", JSON.stringify(session));

    return { success: true, agentId: user.agentId, agentName: user.fullName };
  }

  // ── Helpers ──────────────────────────────────────────────
  static getNextAgentId(): string {
    const users = this.getAllUsers();
    const agentNums = users
      .filter(u => u.agentId)
      .map(u => parseInt(u.agentId!.replace("AGENT-", ""), 10))
      .filter(n => !isNaN(n));
    const max = agentNums.length > 0 ? Math.max(...agentNums) : 0;
    return `AGENT-${max + 1}`;
  }

  static getStats() {
    const users = this.getAllUsers();
    return {
      total: users.length,
      admins: users.filter(u => u.role === "admin" || u.role === "master_admin").length,
      agents: users.filter(u => u.role === "agent").length,
      customers: users.filter(u => u.role === "customer").length,
      active: users.filter(u => u.status === "active").length,
      inactive: users.filter(u => u.status !== "active").length,
    };
  }

  // ── Admin Session (with expiry) ─────────────────────────
  static isAdminLoggedIn(): boolean {
    if (isSessionExpired("emerald-admin-auth")) {
      localStorage.removeItem("emerald-admin-auth");
      return false;
    }
    try {
      const data = localStorage.getItem("emerald-admin-auth");
      if (!data) return false;
      const session = JSON.parse(data);
      return session.active === true;
    } catch { return false; }
  }

  static getAdminSession(): { email: string; userId: string; fullName: string; role: string; loginAt: number; expiresAt: number; active: boolean } | null {
    if (isSessionExpired("emerald-admin-auth")) {
      localStorage.removeItem("emerald-admin-auth");
      return null;
    }
    try {
      const data = localStorage.getItem("emerald-admin-auth");
      if (!data) return null;
      const session = JSON.parse(data);
      return session.active ? session : null;
    } catch { return null; }
  }

  static adminLogout(): void {
    localStorage.removeItem("emerald-admin-auth");
  }

  // ── Internal ─────────────────────────────────────────────
  private static _save(users: CRMUser[]) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    notifySync();
  }
}
