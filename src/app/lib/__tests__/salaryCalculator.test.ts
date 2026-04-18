import { describe, it, expect } from 'vitest';
import {
  calculateSalary,
  calculateTeamLeaderBonus,
  generateSalaryReport,
  SALARY_CONFIG,
} from '../salaryCalculator';

describe('salaryCalculator', () => {
  describe('calculateSalary', () => {
    it('returns 0 for 0 entries', () => {
      const result = calculateSalary(0);
      expect(result.totalSalary).toBe(0);
      expect(result.entries).toBe(0);
      expect(result.isAboveThreshold).toBe(false);
    });

    it('calculates per-entry rate below threshold', () => {
      const result = calculateSalary(5);
      expect(result.totalSalary).toBe(5 * SALARY_CONFIG.PER_ENTRY_BELOW_THRESHOLD);
      expect(result.baseSalary).toBe(0);
      expect(result.bonusAmount).toBe(0);
      expect(result.isAboveThreshold).toBe(false);
    });

    it('calculates exactly at threshold (12 entries)', () => {
      const result = calculateSalary(12);
      expect(result.totalSalary).toBe(SALARY_CONFIG.BASE_SALARY);
      expect(result.baseSalary).toBe(SALARY_CONFIG.BASE_SALARY);
      expect(result.bonusEntries).toBe(0);
      expect(result.isAboveThreshold).toBe(true);
    });

    it('calculates above threshold with bonus', () => {
      const result = calculateSalary(15);
      expect(result.baseSalary).toBe(SALARY_CONFIG.BASE_SALARY);
      expect(result.bonusEntries).toBe(3);
      expect(result.bonusAmount).toBe(3 * SALARY_CONFIG.BONUS_PER_EXTRA_ENTRY);
      expect(result.totalSalary).toBe(30000 + 15000);
      expect(result.isAboveThreshold).toBe(true);
    });

    it('calculates target achievement percentage', () => {
      const result = calculateSalary(10);
      expect(result.targetAchievedPercent).toBe(Math.round((10 / 20) * 100));
    });

    it('calculates per-entry rate above threshold', () => {
      const result = calculateSalary(20);
      expect(result.perEntryRate).toBe(Math.round(result.totalSalary / 20));
    });
  });

  describe('calculateTeamLeaderBonus', () => {
    it('returns 0 for empty team', () => {
      const result = calculateTeamLeaderBonus([]);
      expect(result.teamTotalEntries).toBe(0);
      expect(result.teamTotalSalary).toBe(0);
      expect(result.bonusAmount).toBe(0);
    });

    it('calculates 10% of team total salary', () => {
      const team = [
        { entries: 15 }, // 30,000 + 15,000 = 45,000
        { entries: 10 }, // 10 * 2,000 = 20,000
      ];
      const result = calculateTeamLeaderBonus(team);
      expect(result.teamTotalEntries).toBe(25);
      expect(result.teamTotalSalary).toBe(65_000);
      expect(result.bonusAmount).toBe(6_500); // 10%
    });
  });

  describe('generateSalaryReport', () => {
    it('generates report with all agents', () => {
      const agents = [
        { id: '1', name: 'Alice', entries: 15 },
        { id: '2', name: 'Bob', entries: 8 },
      ];
      const report = generateSalaryReport(agents);
      expect(report.agents).toHaveLength(2);
      expect(report.agents[0].totalSalary).toBe(45_000);
      expect(report.agents[1].totalSalary).toBe(16_000);
      expect(report.grandTotal).toBe(61_000);
      expect(report.teamLeaderBonus).toBeNull();
    });

    it('includes team leader bonus when a team lead exists', () => {
      const agents = [
        { id: '1', name: 'Alice', entries: 15 },
        { id: '2', name: 'Bob', entries: 10, isTeamLead: true },
        { id: '3', name: 'Charlie', entries: 8 },
      ];
      const report = generateSalaryReport(agents);
      expect(report.teamLeaderBonus).not.toBeNull();
      expect(report.teamLeaderBonus!.bonusPercent).toBe(10);
    });
  });
});
