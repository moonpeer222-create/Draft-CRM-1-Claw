import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { BarChart3, DollarSign, Users, TrendingUp, FileDown, Filter, CalendarCheck } from "lucide-react";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../../constants/countries";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { useTheme } from "../../lib/ThemeContext";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { AttendanceService } from "../../lib/attendanceService";

import { useUnifiedLayout } from "../../components/UnifiedLayout";

// Simple custom bar chart to avoid recharts null-key warnings
function SimpleBarChart({ data, dataKey, labelKey, formatter, colors, darkMode }: {
  data: any[];
  dataKey: string;
  labelKey: string;
  formatter: (v: number) => string;
  colors: string[];
  darkMode: boolean;
}) {
  const maxVal = Math.max(...data.map(d => d[dataKey]));
  return (
    <div className="w-full h-[300px] flex flex-col justify-end">
      <div className="flex-1 flex items-end gap-3 px-2">
        {data.map((item, i) => {
          const pct = maxVal > 0 ? (item[dataKey] / maxVal) * 100 : 0;
          return (
            <div key={`${labelKey}-${item[labelKey]}`} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className={`text-xs font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {formatter(item[dataKey])}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  backgroundColor: colors[i % colors.length],
                  minHeight: "8px",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className={`flex gap-3 px-2 pt-2 border-t ${darkMode ? "border-gray-600" : "border-gray-200"}`}>
        {data.map((item, i) => (
          <div key={`label-${item[labelKey]}`} className="flex-1 text-center">
            <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{item[labelKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminReports() {
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("case-analytics");
  const [filters, setFilters] = useState({
    dateRange: "Last 30 Days",
    country: "All Countries",
    jobType: "All Types",
    agent: "All Agents",
    status: "All Statuses",
  });

  const categories = [
    { id: "case-analytics", label: t("reports.caseAnalytics"), icon: BarChart3 },
    { id: "financial", label: t("reports.financialReports"), icon: DollarSign },
    { id: "agent", label: t("reports.agentPerformance"), icon: Users },
    { id: "attendance", label: isUrdu ? "حاضری رپورٹ" : "Attendance", icon: CalendarCheck },
    { id: "customer", label: t("reports.customerInsights"), icon: TrendingUp },
  ];

  const processingTimeData = [
    { stage: "Documents", time: 5.2 },
    { stage: "Medical", time: 3.1 },
    { stage: "Visa", time: 12.5 },
    { stage: "Ticket", time: 2.8 },
  ];

  const revenueByCountry = [
    { country: "Saudi", revenue: 5200000 },
    { country: "UAE", revenue: 3800000 },
    { country: "Qatar", revenue: 1900000 },
    { country: "Kuwait", revenue: 980000 },
  ];

  const CHART_COLORS_ARRAY = ["#10B981", "#059669", "#047857", "#065f46"];
  const CHART_COLORS_ARRAY_DARK = ["#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"];

  const handleApplyFilters = () => {
    toast.success(t("reports.applyFilters") + " ✓");
  };

  const handleResetFilters = () => {
    setFilters({
      dateRange: "Last 30 Days",
      country: "All Countries",
      jobType: "All Types",
      agent: "All Agents",
      status: "All Statuses",
    });
    toast.info(t("reports.reset") + " ✓");
  };

  const handleExport = (format: string) => {
    const lt = toast.loading(`Exporting report as ${format}...`);
    setTimeout(() => { toast.dismiss(lt); toast.success(`Report exported as ${format}!`); }, 1500);
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        
        <main className="p-3 sm:p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className={`text-xl md:text-2xl font-bold mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>{t("reports.title")}</h1>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>{t("reports.subtitle")}</p>
          </motion.div>

          {/* Category Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
                    selectedCategory === category.id
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500"
                      : `border-gray-200 dark:border-gray-700 ${darkMode ? "bg-gray-800 hover:border-blue-400" : "bg-white hover:border-blue-300"}`
                  }`}
                >
                  <Icon className={`w-5 h-5 md:w-6 md:h-6 mb-2 ${
                    selectedCategory === category.id ? "text-blue-600 dark:text-blue-400" : darkMode ? "text-gray-400" : "text-gray-600"
                  }`} />
                  <h3 className={`font-semibold text-xs md:text-sm ${darkMode ? "text-gray-200" : "text-gray-900"}`}>{category.label}</h3>
                </motion.button>
              );
            })}
          </div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl shadow-sm p-4 md:p-6 mb-6 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-4 mb-4">
              <Filter className={`w-5 h-5 ${darkMode ? "text-gray-400" : "text-gray-600"}`} />
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("reports.filters")}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
              {[
                { label: t("reports.dateRange"), key: "dateRange", options: ["Last 7 Days", "Last 30 Days", "Last 3 Months", "Last Year"] },
                { label: t("reports.country"), key: "country", options: ["All Countries", ...POPULAR_COUNTRIES, ...ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c))] },
                { label: t("reports.jobType"), key: "jobType", options: ["All Types", "Driver", "Construction", "Hospitality", "Healthcare"] },
                { label: t("reports.agent"), key: "agent", options: ["All Agents", "Faizan", "Imran", "Safeer", "Aynee"] },
                { label: t("status"), key: "status", options: ["All Statuses", "New", "In Progress", "Completed", "Rejected"] },
              ].map((f) => (
                <div key={f.key}>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{f.label}</label>
                  <select
                    value={(filters as any)[f.key]}
                    onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                  >
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleApplyFilters} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all">
                {t("reports.applyFilters")}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleResetFilters} className={`px-4 py-2 border rounded-lg transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                {t("reports.reset")}
              </motion.button>
            </div>
          </motion.div>

          {/* Report Content */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-xl shadow-sm p-4 md:p-6 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
              <h2 className={`text-lg md:text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {categories.find((c) => c.id === selectedCategory)?.label}
              </h2>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleExport("pdf")} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  <FileDown className="w-4 h-4" /><span className="hidden sm:inline">{t("reports.exportPdf")}</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleExport("excel")} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                  <FileDown className="w-4 h-4" /><span className="hidden sm:inline">{t("reports.exportExcel")}</span>
                </motion.button>
              </div>
            </div>

            {selectedCategory === "case-analytics" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Total Cases", value: "1,247", bg: "blue" },
                    { label: "Completed", value: "892", bg: "green" },
                    { label: "In Progress", value: "355", bg: "orange" },
                  ].map((s) => (
                    <div key={s.label} onClick={() => navigate(`${prefix}/cases`)} className={`p-4 rounded-lg cursor-pointer active:opacity-80 active:scale-[0.98] transition-all ${darkMode ? "bg-gray-700 hover:bg-gray-600" : `bg-${s.bg}-50 hover:bg-${s.bg}-100`}`}>
                      <h4 className={`text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : `text-${s.bg}-900`}`}>{s.label}</h4>
                      <p className={`text-2xl font-bold ${darkMode ? "text-white" : `text-${s.bg}-600`}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className={`font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>Processing Time by Stage</h4>
                  <SimpleBarChart
                    data={processingTimeData}
                    dataKey="time"
                    labelKey="stage"
                    formatter={(v) => `${v} days`}
                    colors={darkMode ? CHART_COLORS_ARRAY_DARK : CHART_COLORS_ARRAY}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            )}

            {selectedCategory === "financial" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Revenue", value: "PKR 12.4M", bg: "blue" },
                    { label: "Collected", value: "PKR 9.2M", bg: "indigo" },
                    { label: "Outstanding", value: "PKR 3.2M", bg: "orange" },
                    { label: "Collection Rate", value: "74%", bg: "purple" },
                  ].map((s) => (
                    <div key={s.label} onClick={() => navigate(`${prefix}/financials`)} className={`p-4 rounded-lg cursor-pointer active:opacity-80 active:scale-[0.98] transition-all ${darkMode ? "bg-gray-700 hover:bg-gray-600" : `bg-${s.bg}-50 hover:bg-${s.bg}-100`}`}>
                      <h4 className={`text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : `text-${s.bg}-900`}`}>{s.label}</h4>
                      <p className={`text-xl md:text-2xl font-bold ${darkMode ? "text-white" : `text-${s.bg}-600`}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className={`font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>Revenue by Country</h4>
                  <SimpleBarChart
                    data={revenueByCountry}
                    dataKey="revenue"
                    labelKey="country"
                    formatter={(v) => `PKR ${(v / 1000).toFixed(0)}K`}
                    colors={darkMode ? CHART_COLORS_ARRAY_DARK : CHART_COLORS_ARRAY}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            )}

            {selectedCategory === "agent" && (() => {
              const agentList = [
                { id: "AGENT-1", name: "Faizan", shortName: "Faizan", cases: 47, revenue: "PKR 2.1M", time: "8.2 days", rating: 4.8 },
                { id: "AGENT-2", name: "Imran", shortName: "Imran", cases: 42, revenue: "PKR 1.9M", time: "7.5 days", rating: 4.9 },
                { id: "AGENT-3", name: "Safeer", shortName: "Safeer", cases: 38, revenue: "PKR 1.7M", time: "9.1 days", rating: 4.6 },
                { id: "AGENT-4", name: "Aynee", shortName: "Aynee", cases: 35, revenue: "PKR 1.5M", time: "8.8 days", rating: 4.7 },
              ];
              return (
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={darkMode ? "bg-gray-700" : "bg-gray-50"}>
                        <tr className={`border-b ${darkMode ? "border-gray-600" : "border-gray-200"}`}>
                          {[isUrdu ? "ایجنٹ" : "Agent", isUrdu ? "کیسز" : "Cases", isUrdu ? "آمدنی" : "Revenue", isUrdu ? "وقت" : "Avg. Time", isUrdu ? "ریٹنگ" : "Rating", isUrdu ? "حاضری" : "Attendance"].map((h) => (
                            <th key={h} className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentList.map((agent, idx) => {
                          const stats = AttendanceService.getAgentMonthlyStats(agent.id);
                          return (
                            <tr key={idx} onClick={() => navigate(`${prefix}/team`, { state: { highlightAgent: agent.name } })} className={`border-b cursor-pointer active:opacity-80 ${darkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                    {agent.name.split(" ").map(n => n[0]).join("")}
                                  </div>
                                  <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{agent.shortName}</span>
                                </div>
                              </td>
                              <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{agent.cases}</td>
                              <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{agent.revenue}</td>
                              <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{agent.time}</td>
                              <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{agent.rating}/5</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-16 h-2 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-200"}`}>
                                    <div className={`h-2 rounded-full ${stats.onTimeRate >= 90 ? "bg-blue-500" : stats.onTimeRate >= 75 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${stats.onTimeRate}%` }} />
                                  </div>
                                  <span className={`text-sm font-bold ${stats.onTimeRate >= 90 ? "text-blue-600" : stats.onTimeRate >= 75 ? "text-yellow-600" : "text-red-600"}`}>{stats.onTimeRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {selectedCategory === "attendance" && (() => {
              const agentList = [
                { id: "AGENT-1", name: "Faizan" },
                { id: "AGENT-2", name: "Imran" },
                { id: "AGENT-3", name: "Safeer" },
                { id: "AGENT-4", name: "Aynee" },
              ];
              const summary = AttendanceService.getDailySummary();
              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                      { label: isUrdu ? "حاضر" : "Present Today", value: summary.present, bg: "green" },
                      { label: isUrdu ? "دیر سے" : "Late", value: summary.late, bg: "yellow" },
                      { label: isUrdu ? "غیر حاضر" : "Absent", value: summary.absent, bg: "red" },
                      { label: isUrdu ? "چھٹی پر" : "On Leave", value: summary.onLeave, bg: "blue" },
                    ].map((s) => (
                      <div key={s.label} className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : `bg-${s.bg}-50`}`}>
                        <h4 className={`text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : `text-${s.bg}-900`}`}>{s.label}</h4>
                        <p className={`text-2xl font-bold ${darkMode ? "text-white" : `text-${s.bg}-600`}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={darkMode ? "bg-gray-700" : "bg-gray-50"}>
                        <tr className={`border-b ${darkMode ? "border-gray-600" : "border-gray-200"}`}>
                          {[isUrdu ? "ایجنٹ" : "Agent", isUrdu ? "حاضر دن" : "Present", isUrdu ? "دیر سے" : "Late", isUrdu ? "غیر حاضر" : "Absent", isUrdu ? "سلسلہ" : "Streak", isUrdu ? "شرح" : "On-Time %"].map((h) => (
                            <th key={h} className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentList.map((agent, idx) => {
                          const stats = AttendanceService.getAgentMonthlyStats(agent.id);
                          return (
                            <tr key={idx} onClick={() => navigate(`${prefix}/attendance`)} className={`border-b cursor-pointer active:opacity-80 ${darkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-teal-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                    {agent.name.split(" ").map(n => n[0]).join("")}
                                  </div>
                                  <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{agent.name}</span>
                                </div>
                              </td>
                              <td className={`py-3 px-4 text-sm font-semibold text-green-600`}>{stats.daysPresent}</td>
                              <td className={`py-3 px-4 text-sm font-semibold text-yellow-600`}>{stats.lateArrivals}</td>
                              <td className={`py-3 px-4 text-sm font-semibold text-red-600`}>{stats.absences}</td>
                              <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-900"}`}>{stats.streak}d</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-16 h-2 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-200"}`}>
                                    <div className={`h-2 rounded-full ${stats.onTimeRate >= 90 ? "bg-green-500" : stats.onTimeRate >= 75 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${stats.onTimeRate}%` }} />
                                  </div>
                                  <span className={`text-sm font-bold ${stats.onTimeRate >= 90 ? "text-green-600" : stats.onTimeRate >= 75 ? "text-yellow-600" : "text-red-600"}`}>{stats.onTimeRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {selectedCategory === "customer" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Total Customers", value: "1,247", bg: "blue" },
                    { label: "Satisfaction Rate", value: "4.7/5", bg: "green" },
                    { label: "Repeat Customers", value: "18%", bg: "purple" },
                  ].map((s) => (
                    <div key={s.label} className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : `bg-${s.bg}-50`}`}>
                      <h4 className={`text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : `text-${s.bg}-900`}`}>{s.label}</h4>
                      <p className={`text-2xl font-bold ${darkMode ? "text-white" : `text-${s.bg}-600`}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                  <h4 className={`font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>Customer Demographics</h4>
                  <div className="space-y-2">
                    {[{ label: "Age 18-25", val: "25%" }, { label: "Age 26-35", val: "48%" }, { label: "Age 36-45", val: "22%" }, { label: "Age 46+", val: "5%" }].map((d) => (
                      <div key={d.label} className="flex items-center justify-between">
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{d.label}</span>
                        <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{d.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}