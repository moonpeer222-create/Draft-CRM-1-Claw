import { AgentSidebar } from "../../components/AgentSidebar";
import { AgentHeader } from "../../components/AgentHeader";
import { TrendingUp, Star, Clock, Target, Download, CalendarCheck, Trophy, Sparkles } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { motion } from "motion/react";
import { toast } from "../../lib/toast";
import { useMemo } from "react";
import { AttendanceService } from "../../lib/attendanceService";
import { AgentLeaderboardWidget, SatisfactionMeter } from "../../components/visaverse";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useVisaVerse } from "../../components/visaverse/VisaVerseContext";
import { SimpleLineChart, SimpleBarChart } from "../../components/SimpleCharts";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";

export function AgentPerformance() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const chartColor = dc ? "#60a5fa" : "#3b82f6";
  const gridStroke = dc ? "#374151" : "#f0f0f0";
  const axisStroke = dc ? "#9ca3af" : "#6b7280";

  const { profile } = useSupabaseAuth();
  const agentId = profile?.id || "agent";

  const attendanceStats = useMemo(() => {
    return AttendanceService.getAgentMonthlyStats(agentId);
  }, [agentId]);

  const monthlyData = [
    { month: "Sep", cases: 38 },
    { month: "Oct", cases: 42 },
    { month: "Nov", cases: 40 },
    { month: "Dec", cases: 45 },
    { month: "Jan", cases: 44 },
    { month: "Feb", cases: 47 },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}
        
        <main className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-2 ${txt}`}>{t("agentPerformance.title")}</h1>
              <p className={sub}>{t("agentPerformance.subtitle")}</p>
            </div>
            <button onClick={() => { const lt = toast.loading("Exporting..."); setTimeout(() => { toast.dismiss(lt); toast.success("Report exported!"); }, 1500); }} className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}>
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${txt}`}>47</h3>
              <p className={`text-xs md:text-sm mb-2 ${sub}`}>{t("agentPerformance.casesClosed")}</p>
              <p className="text-blue-600 text-xs font-semibold">+7% vs last month</p>
            </div>

            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <div className="flex items-center justify-between mb-4">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${txt}`}>8.2 days</h3>
              <p className={`text-xs md:text-sm mb-2 ${sub}`}>{t("agentPerformance.avgProcessing")}</p>
              <p className="text-blue-600 text-xs font-semibold">Team avg: 9.5 days</p>
            </div>

            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <div className="flex items-center justify-between mb-4">
                <Star className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${txt}`}>4.8/5</h3>
              <p className={`text-xs md:text-sm mb-2 ${sub}`}>{t("agent.customerRating")}</p>
              <p className="text-yellow-600 text-xs font-semibold">24 reviews</p>
            </div>

            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${txt}`}>PKR 2.1M</h3>
              <p className={`text-xs md:text-sm mb-2 ${sub}`}>{t("agentPerformance.revenueGenerated")}</p>
              <p className="text-purple-600 text-xs font-semibold">This month</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Attendance Performance Card */}
            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6 border ${brd}`}>
              <div className="flex items-center gap-2 mb-4">
                <CalendarCheck className="w-5 h-5 text-teal-600" />
                <h3 className={`text-lg font-semibold ${txt}`}>{isUrdu ? "حاضری کی کارکردگی" : "Attendance Performance"}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`p-3 rounded-lg ${dc ? "bg-green-900/20" : "bg-green-50"}`}>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "حاضر دن" : "Days Present"}</p>
                  <p className="text-xl font-bold text-green-600">{attendanceStats.daysPresent}</p>
                </div>
                <div className={`p-3 rounded-lg ${dc ? "bg-yellow-900/20" : "bg-yellow-50"}`}>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "دیر سے" : "Late Arrivals"}</p>
                  <p className="text-xl font-bold text-yellow-600">{attendanceStats.lateArrivals}</p>
                </div>
                <div className={`p-3 rounded-lg ${dc ? "bg-orange-900/20" : "bg-orange-50"}`}>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "سلسلہ" : "On-Time Streak"}</p>
                  <p className="text-xl font-bold text-orange-600">{attendanceStats.streak}d</p>
                </div>
                <div className={`p-3 rounded-lg ${dc ? "bg-blue-900/20" : "bg-blue-50"}`}>
                  <p className={`text-xs ${sub}`}>{isUrdu ? "بروقت شرح" : "On-Time Rate"}</p>
                  <p className="text-xl font-bold text-blue-600">{attendanceStats.onTimeRate}%</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "حاضری ہدف: 95%" : "Attendance Target: 95%"}</span>
                  <span className={`text-sm font-semibold ${attendanceStats.onTimeRate >= 95 ? "text-green-600" : "text-orange-600"}`}>{attendanceStats.onTimeRate}%</span>
                </div>
                <div className={`w-full rounded-full h-3 ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div className={`h-3 rounded-full transition-all ${attendanceStats.onTimeRate >= 95 ? "bg-green-500" : attendanceStats.onTimeRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(attendanceStats.onTimeRate, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt}`}>Cases Closed (Last 6 Months)</h3>
              <SimpleLineChart data={monthlyData} xKey="month" yKey="cases" color={chartColor} height={250} darkMode={dc} />
            </div>

            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt}`}>Cases by Status</h3>
              <SimpleBarChart
                data={[
                  { status: "New", count: 5 },
                  { status: "Documents", count: 7 },
                  { status: "Medical", count: 4 },
                  { status: "Visa", count: 7 },
                ]}
                xKey="status"
                yKey="count"
                color={chartColor}
                height={250}
                darkMode={dc}
              />
            </div>
          </div>

          {/* Goals & Progress */}
          <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{t("agentPerformance.monthlyGoals")}</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>Cases Target: 50</span>
                  <span className="text-sm font-semibold text-blue-600">47/50 (94%)</span>
                </div>
                <div className={`w-full rounded-full h-3 ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: "94%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>Revenue Target: PKR 2.5M</span>
                  <span className="text-sm font-semibold text-blue-600">PKR 2.1M (84%)</span>
                </div>
                <div className={`w-full rounded-full h-3 ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: "84%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>Customer Rating: 4.5+</span>
                  <span className="text-sm font-semibold text-yellow-600">4.8 (107%)</span>
                </div>
                <div className={`w-full rounded-full h-3 ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div className="bg-yellow-500 h-3 rounded-full" style={{ width: "100%" }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* VisaVerse: Gamification Section */}
          <VisaVersePerformanceSection card={card} dc={dc} txt={txt} sub={sub} brd={brd} isUrdu={isUrdu} />
        </main>
      </div>

    </div>
  );
}

function VisaVersePerformanceSection({ card, dc, txt, sub, brd, isUrdu }: { card: string; dc: boolean; txt: string; sub: string; brd: string; isUrdu: boolean }) {
  const { classicMode, xp, badges } = useVisaVerse();
  if (classicMode) return null;

  return (
    <div className="mt-6 space-y-6">
      {/* XP & Badge Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className={`${card} rounded-xl shadow-sm p-4 md:p-6 border ${brd}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h3 className={`text-lg font-semibold ${txt}`}>
            {isUrdu ? "VisaVerse گیمیفیکیشن" : "VisaVerse Gamification"}
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className={`p-3 rounded-xl text-center ${dc ? "bg-emerald-900/20 border border-emerald-800/30" : "bg-emerald-50 border border-emerald-200/50"}`}>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{xp}</p>
            <p className={`text-xs ${sub}`}>Total XP</p>
          </div>
          <div className={`p-3 rounded-xl text-center ${dc ? "bg-purple-900/20 border border-purple-800/30" : "bg-purple-50 border border-purple-200/50"}`}>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{badges.length}</p>
            <p className={`text-xs ${sub}`}>{isUrdu ? "بیجز" : "Badges"}</p>
          </div>
          <div className={`p-3 rounded-xl text-center ${dc ? "bg-amber-900/20 border border-amber-800/30" : "bg-amber-50 border border-amber-200/50"}`}>
            <div className="flex items-center justify-center gap-1">
              <Trophy className="w-5 h-5 text-amber-500" />
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Math.floor(xp / 50) + 1}
              </p>
            </div>
            <p className={`text-xs ${sub}`}>{isUrdu ? "لیول" : "Level"}</p>
          </div>
          <div className={`p-3 rounded-xl ${dc ? "bg-blue-900/20 border border-blue-800/30" : "bg-blue-50 border border-blue-200/50"}`}>
            <div className="mb-1">
              <div className="flex justify-between text-xs mb-1">
                <span className={sub}>{isUrdu ? "اگلا لیول" : "Next Level"}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{xp % 50}/50 XP</span>
              </div>
              <div className={`w-full h-2 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(xp % 50 / 50) * 100}%` }}
                  transition={{ duration: 1 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Satisfaction Meter */}
        <SatisfactionMeter isUrdu={isUrdu} />
      </motion.div>

      {/* Agent Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={`${card} rounded-xl shadow-sm p-4 md:p-6 border ${brd}`}
      >
        <AgentLeaderboardWidget isUrdu={isUrdu} />
      </motion.div>
    </div>
  );
}