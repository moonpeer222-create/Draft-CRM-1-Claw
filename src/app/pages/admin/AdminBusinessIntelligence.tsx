import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { useTheme } from "../../lib/ThemeContext";
import { Case } from "../../lib/mockData";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { AnalyticsEngine, AnalyticsSummary, formatCurrency, formatPercentage, formatDays } from "../../lib/analytics";
import { AttendanceService } from "../../lib/attendanceService";
import {
  DollarSign, Target, Activity, Clock, ArrowUpRight, ArrowDownRight,
  Download, RefreshCw, Award, AlertTriangle, Zap, TrendingUp, CalendarCheck
} from "lucide-react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import React from "react";

// Custom Area Chart
function CustomAreaChart({ data, darkMode }: { data: { label: string; value: number }[]; darkMode: boolean }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.value / maxVal) * 85,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;
  return (
    <div className="w-full h-[300px] flex flex-col">
      <div className="flex-1 relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between px-1 pt-1">
        {data.map((d, i) => (
          <span key={`al-${d.label}-${i}`} className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

// Custom Pie Chart
function CustomPieChartBI({ data, nameKey, valueKey, colors, darkMode, totalRevenue, formatCurrency, formatPercentage }: {
  data: any[]; nameKey: string; valueKey: string; colors: string[]; darkMode: boolean; totalRevenue: number;
  formatCurrency: (v: number) => string; formatPercentage: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  if (total === 0) return <div className="h-[300px] flex items-center justify-center text-gray-400">No data</div>;
  return (
    <div className="h-[300px] flex items-center gap-4">
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.reduce<{ offset: number; elements: React.ReactNode[] }>((acc, item, i) => {
            const pct = (item[valueKey] / total) * 100;
            acc.elements.push(
              <circle key={`pie-${item[nameKey]}`} cx="50" cy="50" r="40" fill="none" stroke={colors[i % colors.length]} strokeWidth="18" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acc.offset} />
            );
            acc.offset += pct;
            return acc;
          }, { offset: 0, elements: [] }).elements}
        </svg>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[280px]">
        {data.map((item, i) => (
          <div key={`legend-${item[nameKey]}`} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{item[nameKey]}</span>
            <span className={`text-xs font-semibold ml-auto ${darkMode ? "text-gray-200" : "text-gray-900"}`}>
              {formatPercentage((item[valueKey] / totalRevenue) * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBusinessIntelligence() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const [cases, setCases] = useState<Case[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [selectedMetric, setSelectedMetric] = useState<"cases" | "revenue" | "completions">("revenue");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('cases').select('*');
    const loadedCases = error ? [] : (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
    setCases(loadedCases);
    const analyticsData = AnalyticsEngine.calculateAnalytics(loadedCases);
    setAnalytics(analyticsData);
    setIsLoading(false);
  };

  const handleRefresh = () => {
    const loadingToast = toast.loading(t("bi.refreshingAnalytics"));
    setTimeout(() => {
      loadAnalytics();
      toast.dismiss(loadingToast);
      toast.success(t("bi.analyticsRefreshed"));
    }, 1500);
  };

  const handleExport = async () => {
    const loadingToast = toast.loading(t("bi.exportingReport"));
    setTimeout(async () => {
      const { data: casesData, error } = await supabase.from('cases').select('*');
      const cases = error ? [] : (casesData || []).map((r: any) => mapSupabaseCaseToLocal(r));
      const headers = "Case ID,Customer,Country,Job Type,Status,Priority,Agent,Total Fee,Paid,Outstanding\n";
      const rows = cases.map(c =>
        `${c.id},${c.customerName},${c.country},${c.jobType},${c.status},${c.priority},${c.agentName},${c.totalFee},${c.paidAmount},${c.totalFee - c.paidAmount}`
      ).join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-bi-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(loadingToast);
      toast.success(t("bi.reportExported"));
    }, 1500);
  };

  if (!analytics) {
    return (
      <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"} bg-gradient-to-br from-gray-50 to-gray-100`}>
        {!insideUnifiedLayout && <AdminSidebar />}
        <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
          {!insideUnifiedLayout && <AdminHeader />}
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timeSeriesData = AnalyticsEngine.generateTimeSeriesData(
    cases,
    selectedMetric,
    selectedPeriod,
    12
  );

  const funnelData = AnalyticsEngine.calculateConversionFunnel(cases);
  const customerSegments = AnalyticsEngine.calculateCustomerSegments(cases);

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}

        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h1 className={`text-xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent mb-2`}>
                {t("bi.title")}
              </h1>
              <p className={sub}>{t("bi.subtitle")}</p>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl hover:from-blue-700 hover:to-indigo-600 transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export Report
              </motion.button>
            </div>
          </motion.div>

          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6"
          >
            {[
              {
                label: "Total Revenue",
                value: formatCurrency(analytics.overview.totalRevenue),
                change: analytics.trends.revenueGrowth,
                icon: DollarSign,
                color: "blue",
                trend: analytics.trends.revenueGrowth > 0 ? "up" : "down",
              },
              {
                label: "Conversion Rate",
                value: formatPercentage(analytics.overview.conversionRate),
                change: analytics.trends.completionRateChange,
                icon: Target,
                color: "blue",
                trend: analytics.trends.completionRateChange > 0 ? "up" : "down",
              },
              {
                label: "Active Cases",
                value: analytics.overview.activeCases.toString(),
                change: analytics.trends.casesGrowth,
                icon: Activity,
                color: "orange",
                trend: analytics.trends.casesGrowth > 0 ? "up" : "down",
              },
              {
                label: "Avg Processing",
                value: formatDays(analytics.overview.averageProcessingTime),
                change: -8.5,
                icon: Clock,
                color: "purple",
                trend: "up",
              },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              const TrendIcon = kpi.trend === "up" ? ArrowUpRight : ArrowDownRight;
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className={`bg-gradient-to-br ${dc ? "from-gray-800 to-gray-800" : `from-white to-${kpi.color}-50`} rounded-2xl shadow-lg p-4 md:p-6 border ${dc ? "border-gray-700" : `border-${kpi.color}-100`} relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-white/50 rounded-full -mr-16 -mt-16" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 bg-${kpi.color}-100 rounded-xl`}>
                        <Icon className={`w-6 h-6 text-${kpi.color}-600`} />
                      </div>
                      <div
                        className={`flex items-center gap-1 text-sm font-semibold ${
                          kpi.change > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <TrendIcon className="w-4 h-4" />
                        {Math.abs(kpi.change).toFixed(1)}%
                      </div>
                    </div>
                    <h3 className={`text-xl md:text-3xl font-bold mb-1 ${txt}`}>{kpi.value}</h3>
                    <p className={`text-xs md:text-sm ${sub}`}>{kpi.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Main Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Time Series Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`lg:col-span-2 ${card} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${txt}`}>{t("bi.performanceTrends")}</h2>
                  <p className={`text-sm ${sub}`}>Track key metrics over time</p>
                </div>
                <div className="flex gap-2">
                  {(["cases", "revenue", "completions"] as const).map((metric) => (
                    <motion.button
                      key={metric}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMetric(metric)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        selectedMetric === metric
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {metric.charAt(0).toUpperCase() + metric.slice(1)}
                    </motion.button>
                  ))}
                </div>
              </div>
              <CustomAreaChart data={timeSeriesData} darkMode={dc} />
            </motion.div>

            {/* Top Performers */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-gradient-to-br ${dc ? "from-gray-800 to-gray-800" : "from-white to-blue-50"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${txt}`}>{t("bi.topAgents")}</h2>
                  <p className={`text-sm ${sub}`}>By revenue generated</p>
                </div>
              </div>
              <div className="space-y-4">
                {analytics.performance.byAgent.slice(0, 5).map((agent, idx) => (
                  <motion.div
                    key={agent.agentId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-xl hover:shadow-md transition-all ${dc ? "bg-gray-700" : "bg-white"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                        idx === 0
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                          : idx === 1
                          ? "bg-gradient-to-br from-gray-300 to-gray-500"
                          : idx === 2
                          ? "bg-gradient-to-br from-orange-400 to-orange-600"
                          : "bg-gradient-to-br from-blue-400 to-indigo-600"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${txt}`}>{agent.agentName}</p>
                      <p className={`text-xs ${sub}`}>
                        {agent.completedCases} cases • {formatPercentage(agent.conversionRate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">
                        {formatCurrency(agent.revenue).slice(0, -3)}K
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Conversion Funnel & Country Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Conversion Funnel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${card} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <h2 className={`text-lg md:text-xl font-bold mb-2 ${txt}`}>{t("bi.conversionFunnel")}</h2>
              <p className={`text-sm mb-6 ${sub}`}>Customer journey visualization</p>
              <div className="space-y-3">
                {funnelData.map((stage, idx) => (
                  <motion.div
                    key={stage.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold capitalize ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {stage.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${sub}`}>{stage.count} cases</span>
                        <span className="text-sm font-bold text-blue-600">
                          {formatPercentage(stage.percentage)}
                        </span>
                      </div>
                    </div>
                    <div className={`relative w-full h-10 md:h-12 rounded-xl overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-100"}`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stage.percentage}%` }}
                        transition={{ delay: idx * 0.1 + 0.2, duration: 0.6 }}
                        className={`h-full bg-gradient-to-r ${
                          idx === 0
                            ? "from-blue-400 to-blue-600"
                            : idx === 1
                            ? "from-purple-400 to-purple-600"
                            : idx === 2
                            ? "from-orange-400 to-orange-600"
                            : idx === 3
                            ? "from-yellow-400 to-yellow-600"
                            : idx === 4
                            ? "from-indigo-400 to-indigo-600"
                            : "from-blue-400 to-indigo-600"
                        } flex items-center justify-center text-white font-bold`}
                      >
                        {stage.percentage > 15 && formatPercentage(stage.percentage)}
                      </motion.div>
                    </div>
                    {stage.dropoff > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <ArrowDownRight className="w-3 h-3" />
                        {stage.dropoff} dropoff
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Country Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${card} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <h2 className={`text-lg md:text-xl font-bold mb-2 ${txt}`}>{t("bi.countryDistribution")}</h2>
              <p className={`text-sm mb-6 ${sub}`}>Revenue by destination</p>
              <CustomPieChartBI
                data={analytics.performance.byCountry}
                valueKey="revenue"
                nameKey="country"
                colors={COLORS}
                darkMode={dc}
                totalRevenue={analytics.overview.totalRevenue}
                formatCurrency={formatCurrency}
                formatPercentage={formatPercentage}
              />
            </motion.div>
          </div>

          {/* Bottlenecks & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Attendance Overview */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-gradient-to-br ${dc ? "from-gray-800 to-gray-800" : "from-white to-teal-50"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-teal-100 rounded-xl">
                  <CalendarCheck className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${txt}`}>{isUrdu ? "ٹیم حاضری" : "Team Attendance"}</h2>
                  <p className={`text-sm ${sub}`}>{isUrdu ? "ماہانہ جائزہ" : "Monthly overview"}</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { id: "AGENT-1", name: "Faizan" },
                  { id: "AGENT-2", name: "Imran" },
                  { id: "AGENT-3", name: "Safeer" },
                  { id: "AGENT-4", name: "Aynee" },
                ].map((agent, idx) => {
                  const stats = AttendanceService.getAgentMonthlyStats(agent.id);
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`flex items-center gap-3 p-3 rounded-xl ${dc ? "bg-gray-700" : "bg-white"}`}
                    >
                      <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                        {agent.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${txt}`}>{agent.name}</p>
                        <p className={`text-xs ${sub}`}>{stats.daysPresent}d present • {stats.lateArrivals} late</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-12 h-1.5 rounded-full ${dc ? "bg-gray-600" : "bg-gray-200"}`}>
                          <div className={`h-1.5 rounded-full ${stats.onTimeRate >= 90 ? "bg-teal-500" : stats.onTimeRate >= 75 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${stats.onTimeRate}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${stats.onTimeRate >= 90 ? "text-teal-600" : stats.onTimeRate >= 75 ? "text-yellow-600" : "text-red-600"}`}>{stats.onTimeRate}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Bottlenecks */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-gradient-to-br ${dc ? "from-gray-800 to-gray-800" : "from-white to-red-50"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${txt}`}>{t("bi.bottlenecks")}</h2>
                  <p className={`text-sm ${sub}`}>Critical areas requiring attention</p>
                </div>
              </div>
              <div className="space-y-4">
                {analytics.predictions.bottlenecks.slice(0, 3).map((bottleneck, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-xl border-2 ${
                      bottleneck.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : bottleneck.severity === "high"
                        ? "bg-orange-50 border-orange-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          bottleneck.severity === "critical"
                            ? "bg-red-100"
                            : bottleneck.severity === "high"
                            ? "bg-orange-100"
                            : "bg-yellow-100"
                        }`}
                      >
                        <AlertTriangle
                          className={`w-5 h-5 ${
                            bottleneck.severity === "critical"
                              ? "text-red-600"
                              : bottleneck.severity === "high"
                              ? "text-orange-600"
                              : "text-yellow-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              bottleneck.severity === "critical"
                                ? "bg-red-200 text-red-800"
                                : bottleneck.severity === "high"
                                ? "bg-orange-200 text-orange-800"
                                : "bg-yellow-200 text-yellow-800"
                            }`}
                          >
                            {bottleneck.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-600">
                            {bottleneck.affectedCases} cases affected
                          </span>
                        </div>
                        <p className={`font-semibold mb-2 ${txt}`}>
                          {bottleneck.description}
                        </p>
                        <p className={`text-sm ${sub}`}>{bottleneck.recommendation}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AI Recommendations */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-gradient-to-br ${dc ? "from-gray-800 to-gray-800" : "from-white to-blue-50"} rounded-2xl shadow-lg p-4 md:p-6`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${txt}`}>{t("bi.recommendations")}</h2>
                  <p className={`text-sm ${sub}`}>Actionable insights for growth</p>
                </div>
              </div>
              <div className="space-y-4">
                {analytics.predictions.recommendations.map((rec, idx) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-xl border-2 hover:border-blue-300 transition-all cursor-pointer ${dc ? "bg-gray-700 border-gray-600" : "bg-white border-blue-100"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">
                          {rec.priority}
                        </div>
                        <h3 className={`font-semibold ${txt}`}>{rec.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            rec.impact === "high"
                              ? "bg-green-100 text-green-700"
                              : rec.impact === "medium"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {rec.impact} impact
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            rec.effort === "low"
                              ? "bg-green-100 text-green-700"
                              : rec.effort === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {rec.effort} effort
                        </span>
                      </div>
                    </div>
                    <p className={`text-sm ${sub}`}>{rec.description}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Predictions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Predictive Insights</h2>
                <p className="text-purple-100">Based on current trends and historical data</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-purple-100 text-sm mb-2">Projected Monthly Revenue</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(analytics.predictions.projectedRevenue)}
                </p>
                <p className="text-purple-100 text-xs mt-2">
                  +{formatPercentage(analytics.trends.revenueGrowth)} vs last month
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-purple-100 text-sm mb-2">Expected Completions</p>
                <p className="text-3xl font-bold">{analytics.predictions.projectedCompletions}</p>
                <p className="text-purple-100 text-xs mt-2">
                  From {analytics.overview.activeCases} active cases
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-purple-100 text-sm mb-2">Outstanding Collections</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(analytics.overview.outstandingPayments)}
                </p>
                <p className="text-purple-100 text-xs mt-2">Pending payment collection</p>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}