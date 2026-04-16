import React, { useState, useEffect } from "react";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminSidebar } from "../../components/AdminSidebar";
import { useTheme } from "../../lib/ThemeContext";
import { CRMDataStore } from "../../lib/mockData";
import { TrendingUp, TrendingDown, DollarSign, FileText, Users, BarChart3, PieChart } from "lucide-react";

import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function AdminAnalytics() {
  const { darkMode, isUrdu, t } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [timeRange, setTimeRange] = useState("monthly");
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalCases: 0,
    avgCaseValue: 0,
    collectionRate: 0,
    revenueByCountry: [] as { name: string; value: number }[],
    revenueByJobType: [] as { name: string; value: number }[],
    monthlyTrend: [] as { month: string; revenue: number; cases: number }[],
  });

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = () => {
    const cases = CRMDataStore.getCases();
    const now = new Date();
    
    // Filter based on time range
    const filteredCases = cases.filter(c => {
      const caseDate = new Date(c.createdAt);
      if (timeRange === "monthly") {
        return caseDate.getMonth() === now.getMonth() && caseDate.getFullYear() === now.getFullYear();
      } else if (timeRange === "quarterly") {
        const quarter = Math.floor(now.getMonth() / 3);
        const caseQuarter = Math.floor(caseDate.getMonth() / 3);
        return caseQuarter === quarter && caseDate.getFullYear() === now.getFullYear();
      } else {
        return caseDate.getFullYear() === now.getFullYear();
      }
    });

    const totalRevenue = filteredCases.reduce((sum, c) => sum + c.paidAmount, 0);
    const totalFees = filteredCases.reduce((sum, c) => sum + c.totalFee, 0);
    const collectionRate = totalFees > 0 ? Math.round((totalRevenue / totalFees) * 100) : 0;
    const avgCaseValue = filteredCases.length > 0 ? Math.round(totalRevenue / filteredCases.length) : 0;

    // Revenue by country
    const countryMap = new Map<string, number>();
    filteredCases.forEach(c => {
      countryMap.set(c.country, (countryMap.get(c.country) || 0) + c.paidAmount);
    });
    const revenueByCountry = Array.from(countryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Revenue by job type
    const jobTypeMap = new Map<string, number>();
    filteredCases.forEach(c => {
      jobTypeMap.set(c.jobType, (jobTypeMap.get(c.jobType) || 0) + c.paidAmount);
    });
    const revenueByJobType = Array.from(jobTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthCases = cases.filter(c => {
        const cd = new Date(c.createdAt);
        return cd.getMonth() === targetMonth.getMonth() && cd.getFullYear() === targetMonth.getFullYear();
      });
      monthlyTrend.push({
        month: monthNames[targetMonth.getMonth()],
        revenue: monthCases.reduce((sum, c) => sum + c.paidAmount, 0),
        cases: monthCases.length,
      });
    }

    setAnalytics({
      totalRevenue,
      totalCases: filteredCases.length,
      avgCaseValue,
      collectionRate,
      revenueByCountry,
      revenueByJobType,
      monthlyTrend,
    });
  };

  const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  // Custom bar chart component
  const CustomBarChart = ({ data, dataKey, labelKey, formatter }: { data: any[]; dataKey: string; labelKey: string; formatter: (v: number) => string }) => {
    const maxVal = Math.max(...data.map(d => d[dataKey]), 1);
    return (
      <div className="w-full h-[250px] flex flex-col justify-end">
        <div className="flex-1 flex items-end gap-2 px-1">
          {data.map((item, i) => {
            const pct = (item[dataKey] / maxVal) * 100;
            return (
              <div key={`bar-${item[labelKey]}-${i}`} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className={`text-[10px] font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{formatter(item[dataKey])}</span>
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: "#10B981", minHeight: "4px" }} />
              </div>
            );
          })}
        </div>
        <div className={`flex gap-2 px-1 pt-2 border-t ${darkMode ? "border-gray-600" : "border-gray-200"}`}>
          {data.map((item, i) => (
            <div key={`lbl-${item[labelKey]}-${i}`} className="flex-1 text-center">
              <span className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{item[labelKey]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Custom pie chart component
  const CustomPieChart = ({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div className={`h-[250px] flex items-center justify-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>No data</div>;
    return (
      <div className="h-[250px] flex items-center gap-4">
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {data.reduce<{ offset: number; elements: React.ReactNode[] }>((acc, item, i) => {
              const pct = (item.value / total) * 100;
              const strokeDash = `${pct} ${100 - pct}`;
              acc.elements.push(
                <circle key={`pie-${item.name}`} cx="50" cy="50" r="40" fill="none" stroke={colors[i % colors.length]} strokeWidth="20" strokeDasharray={strokeDash} strokeDashoffset={-acc.offset} />
              );
              acc.offset += pct;
              return acc;
            }, { offset: 0, elements: [] }).elements}
          </svg>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={`legend-${item.name}`} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{item.name}</span>
              <span className={`text-xs font-semibold ml-auto ${darkMode ? "text-gray-200" : "text-gray-900"}`}>PKR {(item.value / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"} ${darkMode ? "bg-gray-950" : "bg-gray-50"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "آمدنی کی تجزیات" : "Revenue Analytics"}
              </h1>
              <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {isUrdu ? "مالی کارکردگی اور رجحانات" : "Financial performance and trends"}
              </p>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className={`px-4 py-2 rounded-lg border ${darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="monthly">{isUrdu ? "ماہانہ" : "Monthly"}</option>
              <option value="quarterly">{isUrdu ? "سہ ماہی" : "Quarterly"}</option>
              <option value="yearly">{isUrdu ? "سالانہ" : "Yearly"}</option>
            </select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "کل آمدنی" : "Total Revenue"}
                  </p>
                  <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    PKR {(analytics.totalRevenue / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "کل کیسز" : "Total Cases"}
                  </p>
                  <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {analytics.totalCases}
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "اوسط کیس ویلیو" : "Avg Case Value"}
                  </p>
                  <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    PKR {(analytics.avgCaseValue / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "وصولی کی شرح" : "Collection Rate"}
                  </p>
                  <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {analytics.collectionRate}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Monthly Trend */}
            <div className={`p-6 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "ماہانہ رجحان" : "Monthly Trend"}
              </h3>
              <CustomBarChart
                data={analytics.monthlyTrend}
                dataKey="revenue"
                labelKey="month"
                formatter={(v) => `PKR ${(v / 1000).toFixed(0)}K`}
              />
            </div>

            {/* Revenue by Country */}
            <div className={`p-6 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "ملک کے لحاظ سے آمدنی" : "Revenue by Country"}
              </h3>
              <CustomPieChart data={analytics.revenueByCountry} colors={COLORS} />
            </div>
          </div>

          {/* Revenue by Job Type Table */}
          <div className={`p-6 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "ملازمت کی قسم کے لحاظ سے آمدنی" : "Revenue by Job Type"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "ملازمت کی قسم" : "Job Type"}
                    </th>
                    <th className={`text-right py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "آمدنی" : "Revenue"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.revenueByJobType.map((item, idx) => (
                    <tr key={idx} className={`border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>
                        {item.name}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                        PKR {(item.value / 1000).toFixed(0)}K
                      </td>
                    </tr>
                  ))}
                  {analytics.revenueByJobType.length === 0 && (
                    <tr>
                      <td colSpan={2} className={`py-8 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {isUrdu ? "کوئی ڈیٹا دستیاب نہیں" : "No data available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}