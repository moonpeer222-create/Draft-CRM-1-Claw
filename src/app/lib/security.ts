// Security utilities for Emerald Visa CRM
// OWASP-aligned: hashing, lockout, password strength, rate limiting

const LOCKOUT_KEY = "crm_auth_lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SALT = "emerald-visa-crm-2024-salt-v1"; // Static salt for localStorage hashing

// ── Password Hashing (SHA-256 + salt) ──────────────────────────
export async function hashPassword(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(plaintext);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== hash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
}

// ── Password Strength Validation (OWASP) ──────────────────────
export interface PasswordStrength {
  valid: boolean;
  score: number; // 0-5
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length >= 8) score++; else errors.push("At least 8 characters required");
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++; else errors.push("At least one uppercase letter required");
  if (/[a-z]/.test(password)) score++; else errors.push("At least one lowercase letter required");
  if (/[0-9]/.test(password)) score++; else errors.push("At least one digit required");
  if (/[^A-Za-z0-9]/.test(password)) score++; else errors.push("At least one special character required (!@#$%^&*)");

  // Common password check
  const common = ["password", "12345678", "qwerty", "admin123", "letmein", "welcome", "emerald"];
  if (common.some(c => password.toLowerCase().includes(c))) {
    errors.push("Password is too common");
    score = Math.max(0, score - 2);
  }

  return { valid: errors.length === 0 && password.length >= 8, score: Math.min(5, score), errors };
}

// ── Brute Force Lockout ───────────────────────────────────────
interface LockoutEntry {
  attempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

function getLockoutStore(): Record<string, LockoutEntry> {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLockoutStore(store: Record<string, LockoutEntry>) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(store));
}

export function checkLockout(identifier: string): { locked: boolean; remainingMs: number; attempts: number } {
  const store = getLockoutStore();
  const entry = store[identifier.toLowerCase()];
  if (!entry) return { locked: false, remainingMs: 0, attempts: 0 };

  // Check if lockout expired
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now(), attempts: entry.attempts };
  }

  // Lockout expired — reset if was locked
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    delete store[identifier.toLowerCase()];
    saveLockoutStore(store);
    return { locked: false, remainingMs: 0, attempts: 0 };
  }

  return { locked: false, remainingMs: 0, attempts: entry.attempts };
}

export function recordFailedAttempt(identifier: string): { locked: boolean; remainingMs: number; attemptsLeft: number } {
  const store = getLockoutStore();
  const key = identifier.toLowerCase();
  const entry = store[key] || { attempts: 0, lockedUntil: null, lastAttempt: 0 };

  // Reset if last attempt was more than 30 minutes ago
  if (entry.lastAttempt && Date.now() - entry.lastAttempt > 30 * 60 * 1000) {
    entry.attempts = 0;
    entry.lockedUntil = null;
  }

  entry.attempts++;
  entry.lastAttempt = Date.now();

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    store[key] = entry;
    saveLockoutStore(store);
    return { locked: true, remainingMs: LOCKOUT_DURATION_MS, attemptsLeft: 0 };
  }

  store[key] = entry;
  saveLockoutStore(store);
  return { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - entry.attempts };
}

export function clearLockout(identifier: string) {
  const store = getLockoutStore();
  delete store[identifier.toLowerCase()];
  saveLockoutStore(store);
}

export function formatLockoutTime(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "less than a minute";
  return `${mins} minutes`;
}

// ── Password Reset Token (local) ─────────────────────────────
const RESET_TOKENS_KEY = "crm_reset_tokens";
const RESET_TOKEN_TTL = 10 * 60 * 1000; // 10 minutes

interface ResetToken {
  email: string;
  code: string;
  expiresAt: number;
  used: boolean;
}

export function generateResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeResetToken(email: string, code: string) {
  try {
    const tokens: ResetToken[] = JSON.parse(localStorage.getItem(RESET_TOKENS_KEY) || "[]");
    // Remove expired or same-email tokens
    const filtered = tokens.filter(t => t.email.toLowerCase() !== email.toLowerCase() && t.expiresAt > Date.now());
    filtered.push({ email: email.toLowerCase(), code, expiresAt: Date.now() + RESET_TOKEN_TTL, used: false });
    localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(filtered));
  } catch { }
}

export function validateResetToken(email: string, code: string): boolean {
  try {
    const tokens: ResetToken[] = JSON.parse(localStorage.getItem(RESET_TOKENS_KEY) || "[]");
    const token = tokens.find(t =>
      t.email.toLowerCase() === email.toLowerCase() &&
      t.code === code &&
      !t.used &&
      t.expiresAt > Date.now()
    );
    if (!token) return false;
    // Mark as used
    token.used = true;
    localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(tokens));
    return true;
  } catch { return false; }
}

// ── Session Security ──────────────────────────────────────────
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
const MASTER_SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

export function isSessionExpired(sessionKey: string, ttlMs?: number): boolean {
  try {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return true;
    const session = JSON.parse(raw);
    if (!session.active) return true;
    const ttl = ttlMs || (session.role === "master_admin" ? MASTER_SESSION_TTL : ADMIN_SESSION_TTL);
    if (session.loginAt && Date.now() - session.loginAt > ttl) return true;
    if (session.expiresAt && Date.now() > session.expiresAt) return true;
    return false;
  } catch { return true; }
}
