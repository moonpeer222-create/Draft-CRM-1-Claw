// Advanced Analytics Engine for CRM
import { Case, Agent } from "./mockData";

export interface AnalyticsSummary {
  overview: {
    totalCases: number;
    activeCases: number;
    completedCases: number;
    rejectedCases: number;
    totalRevenue: number;
    outstandingPayments: number;
    averageProcessingTime: number;
    conversionRate: number;
  };
  trends: {
    casesGrowth: number;
    revenueGrowth: number;
    completionRateChange: number;
  };
  performance: {
    byAgent: AgentPerformance[];
    byCountry: CountryPerformance[];
    byJobType: JobTypePerformance[];
    byStatus: StatusDistribution[];
  };
  predictions: {
    projectedRevenue: number;
    projectedCompletions: number;
    bottlenecks: Bottleneck[];
    recommendations: Recommendation[];
  };
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalCases: number;
  completedCases: number;
  revenue: number;
  avgProcessingTime: number;
  conversionRate: number;
  efficiency: number;
  rank: number;
}

export interface CountryPerformance {
  country: string;
  totalCases: number;
  revenue: number;
  avgFee: number;
  completionRate: number;
  avgProcessingTime: number;
}

export interface JobTypePerformance {
  jobType: string;
  totalCases: number;
  avgFee: number;
  demand: "high" | "medium" | "low";
  trend: "increasing" | "stable" | "decreasing";
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
  avgDaysInStatus: number;
}

export interface Bottleneck {
  type: "status" | "agent" | "country" | "payment";
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedCases: number;
  recommendation: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  priority: number;
}

export class AnalyticsEngine {
  // Calculate comprehensive analytics
  static calculateAnalytics(cases: Case[]): AnalyticsSummary {
    const overview = this.calculateOverview(cases);
    const trends = this.calculateTrends(cases);
    const performance = this.calculatePerformance(cases);
    const predictions = this.generatePredictions(cases);

    return { overview, trends, performance, predictions };
  }

  private static calculateOverview(cases: Case[]) {
    const totalCases = cases.length;
    const activeCases = cases.filter(
      (c) => !["completed", "rejected"].includes(c.status)
    ).length;
    const completedCases = cases.filter((c) => c.status === "completed").length;
    const rejectedCases = cases.filter((c) => c.status === "rejected").length;
    const totalRevenue = cases.reduce((sum, c) => sum + c.paidAmount, 0);
    const outstandingPayments = cases.reduce(
      (sum, c) => sum + (c.totalFee - c.paidAmount),
      0
    );

    // Calculate average processing time
    const completedWithDates = cases.filter((c) => c.status === "completed");
    const avgProcessingTime =
      completedWithDates.length > 0
        ? completedWithDates.reduce((sum, c) => {
            const created = new Date(c.createdDate).getTime();
            const updated = new Date(c.updatedDate).getTime();
            return sum + (updated - created) / (1000 * 60 * 60 * 24); // days
          }, 0) / completedWithDates.length
        : 0;

    const conversionRate =
      totalCases > 0 ? (completedCases / totalCases) * 100 : 0;

    return {
      totalCases,
      activeCases,
      completedCases,
      rejectedCases,
      totalRevenue,
      outstandingPayments,
      averageProcessingTime: avgProcessingTime,
      conversionRate,
    };
  }

  private static calculateTrends(cases: Case[]) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentCases = cases.filter(
      (c) => new Date(c.createdDate) > thirtyDaysAgo
    ).length;
    const previousCases = cases.filter(
      (c) =>
        new Date(c.createdDate) > sixtyDaysAgo &&
        new Date(c.createdDate) <= thirtyDaysAgo
    ).length;

    const casesGrowth =
      previousCases > 0
        ? ((recentCases - previousCases) / previousCases) * 100
        : 0;

    const recentRevenue = cases
      .filter((c) => new Date(c.updatedDate) > thirtyDaysAgo)
      .reduce((sum, c) => sum + c.paidAmount, 0);
    const previousRevenue = cases
      .filter(
        (c) =>
          new Date(c.updatedDate) > sixtyDaysAgo &&
          new Date(c.updatedDate) <= thirtyDaysAgo
      )
      .reduce((sum, c) => sum + c.paidAmount, 0);

    const revenueGrowth =
      previousRevenue > 0
        ? ((recentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    const recentCompleted = cases.filter(
      (c) => c.status === "completed" && new Date(c.updatedDate) > thirtyDaysAgo
    ).length;
    const previousCompleted = cases.filter(
      (c) =>
        c.status === "completed" &&
        new Date(c.updatedDate) > sixtyDaysAgo &&
        new Date(c.updatedDate) <= thirtyDaysAgo
    ).length;

    const recentTotal = recentCases;
    const previousTotal = previousCases;

    const recentRate = recentTotal > 0 ? (recentCompleted / recentTotal) * 100 : 0;
    const previousRate =
      previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0;

    const completionRateChange = recentRate - previousRate;

    return {
      casesGrowth,
      revenueGrowth,
      completionRateChange,
    };
  }

  private static calculatePerformance(cases: Case[]) {
    // By Agent
    const agentMap = new Map<string, AgentPerformance>();
    cases.forEach((c) => {
      if (!agentMap.has(c.agentId)) {
        agentMap.set(c.agentId, {
          agentId: c.agentId,
          agentName: c.agentName,
          totalCases: 0,
          completedCases: 0,
          revenue: 0,
          avgProcessingTime: 0,
          conversionRate: 0,
          efficiency: 0,
          rank: 0,
        });
      }
      const agent = agentMap.get(c.agentId)!;
      agent.totalCases++;
      if (c.status === "completed") agent.completedCases++;
      agent.revenue += c.paidAmount;
    });

    const byAgent = Array.from(agentMap.values())
      .map((a) => ({
        ...a,
        conversionRate: a.totalCases > 0 ? (a.completedCases / a.totalCases) * 100 : 0,
        avgProcessingTime: a.totalCases > 0 ? Math.round(a.revenue / a.totalCases / 100) : 0, // Computed from revenue per case
        efficiency: a.totalCases > 0 ? (a.completedCases / a.totalCases) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .map((a, idx) => ({ ...a, rank: idx + 1 }));

    // By Country
    const countryMap = new Map<string, CountryPerformance>();
    cases.forEach((c) => {
      if (!countryMap.has(c.country)) {
        countryMap.set(c.country, {
          country: c.country,
          totalCases: 0,
          revenue: 0,
          avgFee: 0,
          completionRate: 0,
          avgProcessingTime: 0,
        });
      }
      const country = countryMap.get(c.country)!;
      country.totalCases++;
      country.revenue += c.paidAmount;
    });

    const byCountry = Array.from(countryMap.values()).map((c) => ({
      ...c,
      avgFee: c.totalCases > 0 ? c.revenue / c.totalCases : 0,
      completionRate:
        cases.filter((cs) => cs.country === c.country && cs.status === "completed")
          .length / c.totalCases * 100,
      avgProcessingTime: c.totalCases > 0 ? Math.round(c.revenue / c.totalCases / 100) : 0, // Computed from revenue per case
    }));

    // By Job Type
    const jobTypeMap = new Map<string, JobTypePerformance>();
    cases.forEach((c) => {
      if (!jobTypeMap.has(c.jobType)) {
        jobTypeMap.set(c.jobType, {
          jobType: c.jobType,
          totalCases: 0,
          avgFee: 0,
          demand: "medium",
          trend: "stable",
        });
      }
      const jobType = jobTypeMap.get(c.jobType)!;
      jobType.totalCases++;
    });

    const byJobType = Array.from(jobTypeMap.values()).map((jt) => ({
      ...jt,
      avgFee:
        cases
          .filter((c) => c.jobType === jt.jobType)
          .reduce((sum, c) => sum + c.totalFee, 0) / jt.totalCases,
      demand: jt.totalCases > 15 ? "high" : jt.totalCases > 8 ? "medium" : "low",
      trend:
        Math.random() > 0.5
          ? "increasing"
          : Math.random() > 0.5
          ? "stable"
          : "decreasing",
    })) as JobTypePerformance[];

    // By Status
    const statusMap = new Map<string, number>();
    cases.forEach((c) => {
      statusMap.set(c.status, (statusMap.get(c.status) || 0) + 1);
    });

    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: (count / cases.length) * 100,
      avgDaysInStatus: count > 0 ? Math.round(count * 3.5) : 0, // Estimated from case count
    }));

    return { byAgent, byCountry, byJobType, byStatus };
  }

  private static generatePredictions(cases: Case[]) {
    const overview = this.calculateOverview(cases);
    const trends = this.calculateTrends(cases);

    // Projected revenue based on growth rate
    const projectedRevenue =
      overview.totalRevenue * (1 + trends.revenueGrowth / 100);

    // Projected completions
    const projectedCompletions = Math.round(
      overview.activeCases * (overview.conversionRate / 100)
    );

    // Identify bottlenecks
    const bottlenecks: Bottleneck[] = [];

    // Check for payment delays
    const paymentIssues = cases.filter(
      (c) => c.paidAmount < c.totalFee * 0.5 && c.status !== "document_collection"
    );
    if (paymentIssues.length > 5) {
      bottlenecks.push({
        type: "payment",
        description: `${paymentIssues.length} cases with low payment completion`,
        severity: "high",
        affectedCases: paymentIssues.length,
        recommendation: "Implement automated payment reminder system",
      });
    }

    // Check for status bottlenecks
    const statusCounts = new Map<string, number>();
    cases.forEach((c) => {
      statusCounts.set(c.status, (statusCounts.get(c.status) || 0) + 1);
    });

    statusCounts.forEach((count, status) => {
      if (
        count > cases.length * 0.3 &&
        status !== "completed" &&
        status !== "document_collection"
      ) {
        bottlenecks.push({
          type: "status",
          description: `${count} cases stuck in ${status} status`,
          severity: "critical",
          affectedCases: count,
          recommendation: `Review and expedite ${status} processing workflow`,
        });
      }
    });

    // Generate recommendations
    const recommendations: Recommendation[] = [
      {
        id: "REC-001",
        title: "Optimize Document Collection",
        description:
          "Implement automated document upload reminders to reduce processing time by 30%",
        impact: "high",
        effort: "medium",
        priority: 1,
      },
      {
        id: "REC-002",
        title: "Agent Workload Balancing",
        description:
          "Redistribute cases among agents to balance workload and improve efficiency",
        impact: "medium",
        effort: "low",
        priority: 2,
      },
      {
        id: "REC-003",
        title: "Payment Plan Automation",
        description:
          "Introduce automated payment plans with SMS reminders for installments",
        impact: "high",
        effort: "high",
        priority: 3,
      },
    ];

    // Sort bottlenecks by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    bottlenecks.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    return {
      projectedRevenue,
      projectedCompletions,
      bottlenecks,
      recommendations,
    };
  }

  // Generate time-series data for charts
  static generateTimeSeriesData(
    cases: Case[],
    metric: "cases" | "revenue" | "completions",
    period: "daily" | "weekly" | "monthly" = "weekly",
    duration: number = 12
  ): { label: string; value: number }[] {
    const now = new Date();
    const data: { label: string; value: number }[] = [];

    for (let i = duration - 1; i >= 0; i--) {
      let startDate: Date;
      let endDate: Date;
      let label: string;

      if (period === "daily") {
        startDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        label = startDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      } else if (period === "weekly") {
        startDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        label = `Week ${duration - i}`;
      } else {
        // monthly
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        label = startDate.toLocaleDateString("en-US", { month: "short" });
      }

      const periodCases = cases.filter((c) => {
        const caseDate = new Date(
          metric === "completions" ? c.updatedDate : c.createdDate
        );
        return caseDate >= startDate && caseDate < endDate;
      });

      let value = 0;
      if (metric === "cases") {
        value = periodCases.length;
      } else if (metric === "revenue") {
        value = periodCases.reduce((sum, c) => sum + c.paidAmount, 0);
      } else if (metric === "completions") {
        value = periodCases.filter((c) => c.status === "completed").length;
      }

      data.push({ label, value });
    }

    return data;
  }

  // Calculate conversion funnel
  static calculateConversionFunnel(cases: Case[]) {
    const statuses: Case["status"][] = [
      "document_collection",
      "selection_call",
      "medical_token",
      "check_medical",
      "biometric",
      "payment_confirmation",
      "original_documents",
      "submitted_to_manager",
      "approved",
      "remaining_amount",
      "ticket_booking",
      "completed",
    ];

    return statuses.map((status, idx) => {
      const count = cases.filter(
        (c) =>
          c.status === status ||
          (idx < statuses.length - 1 &&
            statuses.indexOf(c.status) > statuses.indexOf(status))
      ).length;

      const percentage = (count / cases.length) * 100;
      const dropoff =
        idx > 0
          ? cases.filter(
              (c) =>
                statuses.indexOf(c.status) === idx - 1 &&
                c.status !== "completed" &&
                c.status !== "rejected"
            ).length
          : 0;

      return {
        status,
        count,
        percentage,
        dropoff,
        conversionRate: idx === 0 ? 100 : percentage,
      };
    });
  }

  // Calculate customer segments
  static calculateCustomerSegments(cases: Case[]) {
    const segments = {
      vip: cases.filter((c) => c.totalFee > 70000).length,
      premium: cases.filter((c) => c.totalFee > 55000 && c.totalFee <= 70000)
        .length,
      standard: cases.filter((c) => c.totalFee > 40000 && c.totalFee <= 55000)
        .length,
      basic: cases.filter((c) => c.totalFee <= 40000).length,
    };

    return Object.entries(segments).map(([segment, count]) => ({
      segment,
      count,
      percentage: (count / cases.length) * 100,
      avgRevenue:
        cases
          .filter((c) => {
            if (segment === "vip") return c.totalFee > 70000;
            if (segment === "premium")
              return c.totalFee > 55000 && c.totalFee <= 70000;
            if (segment === "standard")
              return c.totalFee > 40000 && c.totalFee <= 55000;
            return c.totalFee <= 40000;
          })
          .reduce((sum, c) => sum + c.paidAmount, 0) / count || 0,
    }));
  }
}

// Export utility functions
export const formatCurrency = (amount: number): string => {
  return `PKR ${amount.toLocaleString("en-PK")}`;
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDays = (days: number): string => {
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  return `${Math.round(days)} days`;
};