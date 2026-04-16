/**
 * Salary Calculator — Emerald Visa Consultancy
 * 
 * Rules:
 * - Target: 20 entries/month (26 working days)
 * - 12+ entries = PKR 30,000 base salary
 * - Each entry above 12 = +PKR 5,000 bonus
 * - Below 12 entries = PKR 2,000 per entry
 * - Team Leader bonus tracking included
 */

export const SALARY_CONFIG = {
  MONTHLY_TARGET: 20,
  WORKING_DAYS: 26,
  BASE_SALARY_THRESHOLD: 12,      // Min entries for base salary
  BASE_SALARY: 30000,             // PKR 30,000
  BONUS_PER_EXTRA_ENTRY: 5000,    // PKR 5,000 per entry above 12
  PER_ENTRY_BELOW_THRESHOLD: 2000, // PKR 2,000 per entry if below 12
  TEAM_LEADER_BONUS_PERCENT: 10,  // 10% of team total as TL bonus
};

export interface SalaryBreakdown {
  entries: number;
  target: number;
  baseSalary: number;
  bonusEntries: number;
  bonusAmount: number;
  totalSalary: number;
  isAboveThreshold: boolean;
  targetAchievedPercent: number;
  perEntryRate: number;
}

/**
 * Calculate salary for an agent based on their monthly entries
 */
export function calculateSalary(entries: number): SalaryBreakdown {
  const { BASE_SALARY_THRESHOLD, BASE_SALARY, BONUS_PER_EXTRA_ENTRY, PER_ENTRY_BELOW_THRESHOLD, MONTHLY_TARGET } = SALARY_CONFIG;

  if (entries >= BASE_SALARY_THRESHOLD) {
    const bonusEntries = entries - BASE_SALARY_THRESHOLD;
    const bonusAmount = bonusEntries * BONUS_PER_EXTRA_ENTRY;
    const totalSalary = BASE_SALARY + bonusAmount;

    return {
      entries,
      target: MONTHLY_TARGET,
      baseSalary: BASE_SALARY,
      bonusEntries,
      bonusAmount,
      totalSalary,
      isAboveThreshold: true,
      targetAchievedPercent: Math.round((entries / MONTHLY_TARGET) * 100),
      perEntryRate: Math.round(totalSalary / entries),
    };
  }

  // Below threshold
  const totalSalary = entries * PER_ENTRY_BELOW_THRESHOLD;
  return {
    entries,
    target: MONTHLY_TARGET,
    baseSalary: 0,
    bonusEntries: 0,
    bonusAmount: 0,
    totalSalary,
    isAboveThreshold: false,
    targetAchievedPercent: Math.round((entries / MONTHLY_TARGET) * 100),
    perEntryRate: PER_ENTRY_BELOW_THRESHOLD,
  };
}

export interface TeamLeaderBonus {
  teamTotalEntries: number;
  teamTotalSalary: number;
  bonusPercent: number;
  bonusAmount: number;
}

/**
 * Calculate Team Leader bonus based on team performance
 */
export function calculateTeamLeaderBonus(teamMembers: { entries: number }[]): TeamLeaderBonus {
  const teamTotalEntries = teamMembers.reduce((sum, m) => sum + m.entries, 0);
  const teamTotalSalary = teamMembers.reduce((sum, m) => sum + calculateSalary(m.entries).totalSalary, 0);
  const bonusAmount = Math.round(teamTotalSalary * (SALARY_CONFIG.TEAM_LEADER_BONUS_PERCENT / 100));

  return {
    teamTotalEntries,
    teamTotalSalary,
    bonusPercent: SALARY_CONFIG.TEAM_LEADER_BONUS_PERCENT,
    bonusAmount,
  };
}

/**
 * Generate salary report for all agents
 */
export function generateSalaryReport(agents: { id: string; name: string; entries: number; isTeamLead?: boolean }[]): {
  agents: (typeof agents[0] & SalaryBreakdown)[];
  teamLeaderBonus: TeamLeaderBonus | null;
  grandTotal: number;
} {
  const agentBreakdowns = agents.map(a => ({
    ...a,
    ...calculateSalary(a.entries),
  }));

  const teamLead = agents.find(a => a.isTeamLead);
  const teamLeaderBonus = teamLead
    ? calculateTeamLeaderBonus(agents.filter(a => !a.isTeamLead))
    : null;

  const grandTotal = agentBreakdowns.reduce((sum, a) => sum + a.totalSalary, 0)
    + (teamLeaderBonus?.bonusAmount || 0);

  return { agents: agentBreakdowns, teamLeaderBonus, grandTotal };
}
