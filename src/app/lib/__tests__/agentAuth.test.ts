import { describe, it, expect, vi } from 'vitest';
import {
  getAgentPassword,
  formatTimeRemaining,
  AgentAuthResult,
} from '../agentAuth';

describe('agentAuth', () => {
  describe('getAgentPassword', () => {
    it('returns a deterministic password for a given agentId', () => {
      const password1 = getAgentPassword('AGENT-1');
      const password2 = getAgentPassword('AGENT-1');
      expect(password1).toBe(password2);
      expect(password1).toMatch(/^Agent\d{8}!$/);
    });

    it('returns different passwords for different agentIds', () => {
      const p1 = getAgentPassword('AGENT-1');
      const p2 = getAgentPassword('AGENT-2');
      expect(p1).not.toBe(p2);
    });

    it('returns a password with the correct format', () => {
      const password = getAgentPassword('AGENT-TEST');
      expect(password).toMatch(/^Agent\d{8}!$/);
      expect(password.length).toBe(14); // "Agent" + 8 digits + "!"
    });
  });

  describe('formatTimeRemaining', () => {
    it('formats 0 ms as 00:00:00', () => {
      expect(formatTimeRemaining(0)).toBe('00:00:00');
    });

    it('formats seconds correctly', () => {
      expect(formatTimeRemaining(45_000)).toBe('00:00:45');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatTimeRemaining(125_000)).toBe('00:02:05');
    });

    it('formats hours, minutes, and seconds correctly', () => {
      expect(formatTimeRemaining(3_661_000)).toBe('01:01:01');
    });

    it('formats exactly 6 hours (TOTP window)', () => {
      expect(formatTimeRemaining(6 * 60 * 60 * 1000)).toBe('06:00:00');
    });

    it('pads single digits with zeros', () => {
      expect(formatTimeRemaining(1_001_000)).toBe('00:16:41');
    });
  });
});
