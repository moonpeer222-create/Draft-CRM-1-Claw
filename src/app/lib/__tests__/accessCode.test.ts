import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessCodeService } from '../accessCode';

describe('AccessCodeService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('adminLogin / adminLogout', () => {
    it('logs in with correct credentials', () => {
      const result = AccessCodeService.adminLogin('admin@emeraldvisa.com', 'admin123');
      expect(result.success).toBe(true);
      expect(AccessCodeService.isAdminLoggedIn()).toBe(true);
    });

    it('rejects incorrect credentials', () => {
      const result = AccessCodeService.adminLogin('wrong@email.com', 'wrongpass');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
      expect(AccessCodeService.isAdminLoggedIn()).toBe(false);
    });

    it('logs out and clears session', () => {
      AccessCodeService.adminLogin('admin@emeraldvisa.com', 'admin123');
      AccessCodeService.adminLogout();
      expect(AccessCodeService.isAdminLoggedIn()).toBe(false);
      expect(AccessCodeService.getAdminSession()).toBeNull();
    });

    it('expires session after 8 hours', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      AccessCodeService.adminLogin('admin@emeraldvisa.com', 'admin123');
      
      vi.setSystemTime(now + 8 * 60 * 60 * 1000 + 1);
      expect(AccessCodeService.getAdminSession()).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe('TOTP code generation', () => {
    it('generates a 6-digit code', () => {
      const code = AccessCodeService.getTOTPCode('AGENT-1');
      expect(code).toMatch(/^\d{6}$/);
    });

    it('generates deterministic codes for same agent+time', () => {
      const code1 = AccessCodeService.getTOTPCode('AGENT-1');
      const code2 = AccessCodeService.getTOTPCode('AGENT-1');
      expect(code1).toBe(code2);
    });

    it('generates different codes for different agents', () => {
      const code1 = AccessCodeService.getTOTPCode('AGENT-1');
      const code2 = AccessCodeService.getTOTPCode('AGENT-2');
      expect(code1).not.toBe(code2);
    });

    it('returns time remaining until window expiry', () => {
      const remaining = AccessCodeService.getTOTPTimeRemaining();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
    });

    it('returns a formatted expiry time', () => {
      const expiry = AccessCodeService.getTOTPExpiryTime();
      expect(expiry).toMatch(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i);
    });
  });

  describe('validateCode', () => {
    it('rejects non-6-digit codes', () => {
      expect(AccessCodeService.validateCode('123')).toEqual({
        valid: false,
        error: 'Code must be 6 digits',
      });
      expect(AccessCodeService.validateCode('1234567')).toEqual({
        valid: false,
        error: 'Code must be 6 digits',
      });
    });

    it('rejects empty code', () => {
      expect(AccessCodeService.validateCode('')).toEqual({
        valid: false,
        error: 'Code must be 6 digits',
      });
    });

    it('validates a known agent code', () => {
      // Register an agent first
      AccessCodeService.registerAgent('AGENT-1', 'Test Agent');
      const validCode = AccessCodeService.getTOTPCode('AGENT-1');
      
      const result = AccessCodeService.validateCode(validCode);
      expect(result.valid).toBe(true);
      expect(result.agentId).toBe('AGENT-1');
      expect(result.agentName).toBe('Test Agent');
    });

    it('rejects unknown codes', () => {
      const result = AccessCodeService.validateCode('000000');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired access code');
    });
  });

  describe('agent session management', () => {
    it('creates and retrieves an agent session', () => {
      const session = AccessCodeService.createAgentSession('123456', 'AGENT-1', 'Test Agent');
      expect(session.agentId).toBe('AGENT-1');
      expect(session.agentName).toBe('Test Agent');
      expect(session.active).toBe(true);
      
      const retrieved = AccessCodeService.getAgentSession();
      expect(retrieved).not.toBeNull();
      expect(retrieved!.agentId).toBe('AGENT-1');
    });

    it('checks if agent is logged in', () => {
      expect(AccessCodeService.isAgentLoggedIn()).toBe(false);
      AccessCodeService.createAgentSession('123456', 'AGENT-1', 'Test Agent');
      expect(AccessCodeService.isAgentLoggedIn()).toBe(true);
    });

    it('returns time remaining for active session', () => {
      AccessCodeService.createAgentSession('123456', 'AGENT-1', 'Test Agent');
      const remaining = AccessCodeService.getAgentTimeRemaining();
      expect(remaining).toBeGreaterThan(0);
    });

    it('returns 0 time remaining when not logged in', () => {
      expect(AccessCodeService.getAgentTimeRemaining()).toBe(0);
    });

    it('logs out and clears session', () => {
      AccessCodeService.createAgentSession('123456', 'AGENT-1', 'Test Agent');
      AccessCodeService.agentLogout();
      expect(AccessCodeService.getAgentSession()).toBeNull();
      expect(AccessCodeService.isAgentLoggedIn()).toBe(false);
    });

    it('expires session after window duration', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      AccessCodeService.createAgentSession('123456', 'AGENT-1', 'Test Agent');
      
      vi.setSystemTime(now + 6 * 60 * 60 * 1000 + 1);
      expect(AccessCodeService.getAgentSession()).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe('formatTimeRemaining', () => {
    it('formats time correctly', () => {
      expect(AccessCodeService.formatTimeRemaining(0)).toBe('00:00:00');
      expect(AccessCodeService.formatTimeRemaining(3661000)).toBe('01:01:01');
      expect(AccessCodeService.formatTimeRemaining(6 * 60 * 60 * 1000)).toBe('06:00:00');
    });
  });

  describe('registerAgent / removeAgent', () => {
    it('registers a new agent and generates code', () => {
      const result = AccessCodeService.registerAgent('AGENT-NEW', 'New Agent');
      expect(result.agentId).toBe('AGENT-NEW');
      expect(result.agentName).toBe('New Agent');
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.active).toBe(true);
    });

    it('removes an agent from registry', () => {
      AccessCodeService.registerAgent('AGENT-RM', 'To Remove');
      AccessCodeService.removeAgent('AGENT-RM');
      
      const codes = AccessCodeService.getAllTOTPCodes();
      const found = codes.find(c => c.agentId === 'AGENT-RM');
      expect(found).toBeUndefined();
    });

    it('getAllTOTPCodes returns all registered agents', () => {
      AccessCodeService.registerAgent('AGENT-A', 'Agent A');
      AccessCodeService.registerAgent('AGENT-B', 'Agent B');
      
      const codes = AccessCodeService.getAllTOTPCodes();
      expect(codes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
