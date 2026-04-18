// Security utilities for Emerald Tech Partner
// OWASP-aligned: password strength.
// NOTE: Authentication lockout, rate limiting, and hashing have been moved to the server.

// ── Password Hashing (SHA-256 + salt) ──────────────────────────
// DEPRECATED: Password hashing must be done on the backend (see authController.ts).
export async function hashPassword(plaintext: string): Promise<string> {
  return plaintext;
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return plaintext === hash;
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
// DEPRECATED: Client-side lockout via localStorage is insecure.
// The application now uses backend rate limiting (backend/middleware/rateLimiter.ts).
export function checkLockout(identifier: string): { locked: boolean; remainingMs: number; attempts: number } {
  // Always return unlocked locally; the backend will enforce actual lockouts and return 429.
  return { locked: false, remainingMs: 0, attempts: 0 };
}

export function recordFailedAttempt(identifier: string): { locked: boolean; remainingMs: number; attemptsLeft: number } {
  return { locked: false, remainingMs: 0, attemptsLeft: 5 };
}

export function clearLockout(identifier: string) {
  // No-op
}

export function formatLockoutTime(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "less than a minute";
  return `${mins} minutes`;
}

// ── Password Reset Token (local) ─────────────────────────────
// DEPRECATED: Password reset tokens must be generated and verified securely on the server.
export function generateResetCode(): string {
  return ""; // Handled by backend
}

export function storeResetToken(email: string, code: string) {
}

export function validateResetToken(email: string, code: string): boolean {
  return true; // Should wait for backend validation
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
