import { AgentHeader } from "../../components/AgentHeader";
import { AgentSidebar } from "../../components/AgentSidebar";
import { Case } from "../../lib/mockData";
import { useState, useEffect, useMemo } from "react";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { motion } from "motion/react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import {
  Plus,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  Users,
  CheckCircle,
  Calendar,
  Phone,
  MessageCircle,
  Star,
  Flame,
  Target,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
} from "lucide-react";
import { AgentLeaderboardWidget, SatisfactionMeter, VideoGenerator } from "../../components/visaverse";
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from "../../components/SimpleCharts";

export function AgentDashboard() {
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const { profile } = useSupabaseAuth();
  const agentName = profile?.full_name || profile?.email || "Agent";

  // Load real case data
  const [cases, setCases] = useState<Case[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
      const mapped = (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
      setCases(mapped);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);
  const myCases = useMemo(() => cases.filter(c => c.agentName === agentName), [cases, agentName]);
  const pendingActions = myCases.filter(c =>
    ["new_case", "document_collection", "medical_token", "payment_pending"].includes(c.status)
  ).length;
  const completedCases = myCases.filter(c => c.status === "deployed").length;
  const activeCases = myCases.filter(c => c.status !== "deployed" && c.status !== "rejected").length;

  // Performance data
  const weeklyPerformance = [
    { day: "Mon", cases: 4 },
    { day: "Tue", cases: 6 },
    { day: "Wed", cases: 3 },
    { day: "Thu", cases: 7 },
    { day: "Fri", cases: 5 },
    { day: "Sat", cases: 2 },
    { day: "Sun", cases: 0 },
  ];

  const caseStageData = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    myCases.forEach(c => {
      stageCounts[c.status] = (stageCounts[c.status] || 0) + 1;
    });
    const stageColors: Record<string, string> = {
      "new_case": "#3B82F6",
      "document_collection": "#8B5CF6",
      "medical_token": "#F59E0B",
      "medical_completed": "#10B981",
      "payment_pending": "#EF4444",
      "visa_applied": "#6366F1",
      "visa_approved": "#14B8A6",
      "deployed": "#22C55E",
    };
    return Object.entries(stageCounts).map(([name, value], idx) => ({
      name: `stage-${idx}-${name}`,
      displayName: name.length > 14 ? name.slice(0, 14) + "..." : name,
      fullName: name,
      value,
      color: stageColors[name] || "#64748B",
    }));
  }, [myCases]);

  const monthlyTrend = [
    { month: "Sep", closed: 8 },
    { month: "Oct", closed: 12 },
    { month: "Nov", closed: 10 },
    { month: "Dec", closed: 15 },
    { month: "Jan", closed: 14 },
    { month: "Feb", closed: 17 },
  ];

  const tasks = [
    {
      id: 1,
      priority: "urgent" as const,
      text: isUrdu
        ? "احمد خان سے فالو اپ - کل میڈیکل اپائنٹمنٹ گرین سینٹر، لاہور"
        : "Follow up with Ahmed Khan - Medical appointment tomorrow at Green Center, Lahore",
      actions: ["call", "whatsapp", "done"],
    },
    {
      id: 2,
      priority: "pending" as const,
      text: isUrdu
        ? "فاطمہ بی بی کی اپلوڈ شدہ دستاویزات کی تصدیق کریں (CNIC، پاسپورٹ)"
        : "Verify uploaded documents for Fatima Bibi (CNIC, Passport)",
      actions: ["review", "request"],
    },
    {
      id: 3,
      priority: "reminder" as const,
      text: isUrdu
        ? "محمد اسلام کو ادائیگی کی یاد دہانی بھیجیں - PKR 25,000 کل واجب الادا"
        : "Send payment reminder to Muhammad Aslam - PKR 25,000 due tomorrow",
      actions: ["whatsapp", "email"],
    },
  ];

  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  const appointments = [
    { id: 1, time: "10:00 AM", customer: "Ahmed Khan", type: isUrdu ? "میڈیکل" : "Medical", deadline: "Mar 2, 2026", caseId: "EMR-2024-0892" },
    { id: 2, time: "2:00 PM", customer: "Fatima Bibi", type: isUrdu ? "دستاویز جائزہ" : "Document Review", deadline: "Mar 3, 2026", caseId: "EMR-2024-0876" },
    { id: 3, time: "4:30 PM", customer: "Ali Raza", type: isUrdu ? "پری ڈیپارچر" : "Pre-Departure", deadline: "Mar 5, 2026", caseId: "EMR-2024-0884" },
  ];

  const activities = [
    { id: 1, text: isUrdu ? "کیس EMR-2024-0892 ویزا اپلائیڈ میں اپ ڈیٹ ہوا" : "Updated case EMR-2024-0892 to Visa Applied", time: isUrdu ? "2 منٹ پہلے" : "2m ago", type: "success" },
    { id: 2, text: isUrdu ? "فاطمہ بی بی کی دستاویزات اپ لوڈ ہوئیں" : "Documents uploaded for Fatima Bibi", time: isUrdu ? "15 منٹ پہلے" : "15m ago", type: "info" },
    { id: 3, text: isUrdu ? "ادائیگی PKR 45,000 ایڈمن منظوری کے لیے جمع ہوئی" : "Payment PKR 45,000 submitted for admin approval", time: isUrdu ? "30 منٹ پہلے" : "30m ago", type: "payment" },
    { id: 4, text: isUrdu ? "علی رضا کی میڈیکل اپائنٹمنٹ طے ہوئی" : "Medical appointment scheduled for Ali Raza", time: isUrdu ? "1 گھنٹہ پہلے" : "1h ago", type: "info" },
    { id: 5, text: isUrdu ? "نئی ہدایت ایڈمن سے موصول ہوئی" : "New directive received from Admin", time: isUrdu ? "2 گھنٹے پہلے" : "2h ago", type: "system" },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex h-screen overflow-hidden"} bg-gray-50 dark:bg-gray-900`} dir={isUrdu ? "rtl" : "ltr"}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 flex flex-col overflow-hidden ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}
        <main className={`flex-1 overflow-y-auto ${isUrdu ? fontClass : ""}`}>
          {/* Mobile padding: compact, Desktop padding: generous */}
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header - Mobile Optimized */}
            <div className="mb-3 sm:mb-4 md:mb-6">
              <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "ڈیش بورڈ" : "Dashboard"}
              </h1>
              <p className={`text-xs sm:text-sm md:text-base ${dc ? "text-gray-400" : "text-gray-600"}`}>
                {isUrdu ? `خوش آمدید، ${agentName}!` : `Welcome back, ${agentName}!`}
              </p>
            </div>

            {/* Stats Grid - Mobile: 2 cols (optimized), Tablet: 2 cols, Desktop: 4 cols */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-3 sm:mb-4 md:mb-6">
              {/* My Cases Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 cursor-pointer transition-all ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
                onClick={() => navigate("/agent/cases")}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${dc ? "bg-blue-500/15" : "bg-blue-50"}`}>
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1 text-green-500">
                    <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="text-xs font-semibold">+3</span>
                  </div>
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>{myCases.length || 23}</h3>
                <p className={`text-xs md:text-sm mb-2 ${dc ? "text-gray-400" : "text-gray-600"}`}>{isUrdu ? "میرے کیسز" : "My Cases"}</p>
                <div className={`mt-2 md:mt-3 text-xs space-y-1 ${dc ? "text-gray-500" : "text-gray-500"}`}>
                  <div className="flex justify-between">
                    <span>{isUrdu ? "فعال:" : "Active:"} {activeCases || 18}</span>
                    <span>{isUrdu ? "مکمل:" : "Completed:"} {completedCases || 5}</span>
                  </div>
                </div>
              </motion.div>

              {/* Pending Actions Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/agent/cases")}
                className={`rounded-xl shadow-sm p-4 md:p-6 cursor-pointer transition-all active:opacity-80 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${dc ? "bg-orange-500/15" : "bg-orange-50"}`}>
                    <Clock className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                  </div>
                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>{pendingActions || 7}</h3>
                <p className={`text-xs md:text-sm mb-2 ${dc ? "text-gray-400" : "text-gray-600"}`}>{isUrdu ? "زیر التواء اقدامات" : "Pending Actions"}</p>
                <div className={`mt-2 md:mt-3 text-xs space-y-1 ${dc ? "text-gray-500" : "text-gray-500"}`}>
                  <div className="flex justify-between">
                    <span>{isUrdu ? "دستاویزات:" : "Documents:"} 3</span>
                    <span>{isUrdu ? "میڈیکل:" : "Medical:"} 2</span>
                  </div>
                  <div>{isUrdu ? "ادائیگی:" : "Payments:"} 2</div>
                </div>
              </motion.div>

              {/* Performance Score Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 cursor-pointer transition-all ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
                onClick={() => navigate("/agent/performance")}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${dc ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                    <Target className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                  </div>
                  <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>94%</h3>
                <p className={`text-xs md:text-sm mb-2 ${dc ? "text-gray-400" : "text-gray-600"}`}>{isUrdu ? "کارکردگی سکور" : "Performance Score"}</p>
                <div className={`mt-2 md:mt-3 ${dc ? "text-gray-500" : "text-gray-500"}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <Star className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-500" />
                    <span>{isUrdu ? "ریٹنگ: 4.8/5" : "Rating: 4.8/5"}</span>
                  </div>
                  <div className={`w-full rounded-full h-1.5 mt-2 ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: "94%" }} />
                  </div>
                </div>
              </motion.div>

              {/* Attendance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 cursor-pointer transition-all ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
                onClick={() => navigate("/agent/attendance")}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${dc ? "bg-teal-500/15" : "bg-teal-50"}`}>
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-500">12</span>
                  </div>
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "حاضر" : "Checked-in"}
                </h3>
                <p className={`text-xs md:text-sm mb-2 ${dc ? "text-gray-400" : "text-gray-600"}`}>{isUrdu ? "حاضری کی حالت" : "Attendance Status"}</p>
                <div className={`mt-2 md:mt-3 text-xs space-y-1 ${dc ? "text-gray-500" : "text-gray-500"}`}>
                  <div>{isUrdu ? "چیک ان: 9:15 AM" : "Check-in: 9:15 AM"}</div>
                  <div className="font-semibold text-orange-500">{isUrdu ? "12 دن کی سلسلہ وار حاضری" : "12-day streak"}</div>
                </div>
              </motion.div>
            </div>

            {/* Charts Row - Mobile: 1 col, Desktop: 2 cols */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
              {/* Monthly Cases Closed Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 ${
                  dc
                    ? "bg-gray-800/80 border border-gray-700/50"
                    : "bg-gradient-to-br from-blue-50/80 to-white border border-blue-100/60"
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    dc ? "bg-blue-500/15" : "bg-gradient-to-br from-blue-500 to-blue-600"
                  }`}>
                    <TrendingUp className={`w-5 h-5 ${dc ? "text-blue-400" : "text-white"}`} />
                  </div>
                  <h3 className={`text-lg font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                    {isUrdu ? "ماہانہ کیسز بند (آخری 6 ماہ)" : "Cases Closed (Last 6 Months)"}
                  </h3>
                </div>
                <SimpleLineChart data={monthlyTrend} xKey="month" yKey="closed" color="#3B82F6" height={250} darkMode={dc} />
              </motion.div>

              {/* Case Stage Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
              >
                <h3 className={`text-lg font-semibold mb-4 ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "کیس کے مراحل کی تقسیم" : "Case Stage Distribution"}
                </h3>
                {caseStageData.length > 0 ? (
                  <SimplePieChart data={caseStageData} height={250} darkMode={dc} />
                ) : (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Briefcase className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                      <p className={`text-sm ${dc ? "text-gray-500" : "text-gray-400"}`}>
                        {isUrdu ? "ابھی تک کوئی کیس نہیں" : "No cases assigned yet"}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Weekly Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
              >
                <h3 className={`text-lg font-semibold mb-4 ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "ہفتہ وار سرگرمی" : "Weekly Activity"}
                </h3>
                <SimpleBarChart data={weeklyPerformance} xKey="day" yKey="cases" color="#6366F1" height={250} darkMode={dc} />
              </motion.div>

              {/* Live Activity Feed */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Activity className={`w-5 h-5 ${dc ? "text-blue-400" : "text-blue-600"}`} />
                  <h3 className={`text-lg font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                    {isUrdu ? "حالیہ سرگرمی" : "Recent Activity"}
                  </h3>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      onClick={() => navigate("/agent/cases")}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all active:opacity-80 ${
                        dc ? "bg-gray-700/30 hover:bg-gray-700/60" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          activity.type === "success"
                            ? "bg-green-500"
                            : activity.type === "payment"
                            ? "bg-blue-500"
                            : activity.type === "system"
                            ? "bg-purple-500"
                            : "bg-gray-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${dc ? "text-gray-200" : "text-gray-900"}`}>{activity.text}</p>
                        <p className={`text-xs mt-1 ${dc ? "text-gray-500" : "text-gray-500"}`}>{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* VisaVerse: Leaderboard + Satisfaction + Video Generator */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
              {/* Agent Leaderboard & Badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
                className={`lg:col-span-2 rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}
              >
                <AgentLeaderboardWidget isUrdu={isUrdu} />
              </motion.div>

              {/* Satisfaction Meter + Video Generator */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="space-y-4"
              >
                {/* Satisfaction Widget */}
                <div className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}>
                  <SatisfactionMeter isUrdu={isUrdu} />
                </div>

                {/* Quick Video Update for top client */}
                {myCases.length > 0 && (
                  <div className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}>
                    <VideoGenerator
                      customerName={myCases[0]?.customerName || "Customer"}
                      stageName={(myCases[0] as any)?.stage || "Processing"}
                      nextStage={(myCases[0] as any)?.stage === "Document Collection" ? "Medical Scheduled" : "Next Stage"}
                      isUrdu={isUrdu}
                    />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Today's Tasks */}
            <div className={`rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "آج کے کام" : "Today's Tasks"}
                </h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  dc ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"
                }`}>
                  {tasks.filter(t => !completedTasks.includes(t.id)).length} {isUrdu ? "باقی" : "remaining"}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: completedTasks.includes(task.id) ? 0.5 : 1, y: 0 }}
                    className={`p-4 rounded-lg border-l-4 ${
                      task.priority === "urgent"
                        ? `${dc ? "bg-red-900/15" : "bg-red-50"} border-red-500`
                        : task.priority === "pending"
                        ? `${dc ? "bg-yellow-900/15" : "bg-yellow-50"} border-yellow-500`
                        : `${dc ? "bg-blue-900/15" : "bg-blue-50"} border-blue-500`
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              task.priority === "urgent"
                                ? "bg-red-500"
                                : task.priority === "pending"
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                            }`}
                          />
                          <span className={`text-xs font-semibold uppercase ${dc ? "text-gray-400" : "text-gray-600"}`}>
                            {task.priority === "urgent"
                              ? isUrdu ? "فوری" : "URGENT"
                              : task.priority === "pending"
                              ? isUrdu ? "زیر التواء" : "PENDING"
                              : isUrdu ? "یاد دہانی" : "REMINDER"}
                          </span>
                        </div>
                        <p className={`text-sm mb-3 ${dc ? "text-gray-200" : "text-gray-900"}`}>{task.text}</p>
                        <div className="flex gap-2 flex-wrap">
                          {task.actions.includes("call") && (
                            <button
                              onClick={() => toast.info(isUrdu ? "کال ہو رہی ہے..." : "Calling customer...")}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              {isUrdu ? "کال" : "Call"}
                            </button>
                          )}
                          {task.actions.includes("whatsapp") && (
                            <button
                              onClick={() => toast.info(isUrdu ? "واٹس ایپ کھل رہا ہے..." : "Opening WhatsApp...")}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              {isUrdu ? "واٹس ایپ" : "WhatsApp"}
                            </button>
                          )}
                          {task.actions.includes("done") && (
                            <button
                              onClick={() => {
                                setCompletedTasks((p) => [...p, task.id]);
                                toast.success(isUrdu ? "کام مکمل!" : "Task marked as done!");
                              }}
                              className={`flex items-center gap-1 px-3 py-1 border rounded-lg text-xs transition-colors ${
                                completedTasks.includes(task.id)
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : dc
                                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {completedTasks.includes(task.id) ? (isUrdu ? "مکمل ✓" : "Done ✓") : (isUrdu ? "مکمل" : "Mark Done")}
                            </button>
                          )}
                          {task.actions.includes("review") && (
                            <button
                              onClick={() => navigate("/agent/cases")}
                              className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              {isUrdu ? "جائزہ" : "Review"}
                            </button>
                          )}
                          {task.actions.includes("request") && (
                            <button
                              onClick={() => toast.success(isUrdu ? "دستاویز کی درخواست بھیجی گئی!" : "Document request sent!")}
                              className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs transition-colors"
                            >
                              {isUrdu ? "درخواست" : "Request"}
                            </button>
                          )}
                          {task.actions.includes("email") && (
                            <button
                              onClick={() => toast.success(isUrdu ? "ای میل یاد دہانی بھیجی گئی!" : "Email reminder sent!")}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs transition-colors"
                            >
                              {isUrdu ? "ای میل" : "Email"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Upcoming Appointments / Deadlines Table */}
            <div className={`rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base sm:text-lg font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "آئندہ اپائنٹمنٹس" : "Upcoming Appointments"}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate("/agent/calendar")}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors min-h-[36px] ${
                      dc ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isUrdu ? "کیلنڈر دیکھیں" : "View Calendar"}
                  </button>
                </div>
              </div>

              {/* Mobile: Card View */}
              <div className="block md:hidden space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    onClick={() => navigate(`/agent/cases/${apt.caseId}`)}
                    className={`p-3 rounded-lg border cursor-pointer active:opacity-80 transition-all ${dc ? "bg-gray-700/30 border-gray-700/50 hover:bg-gray-700/60" : "bg-gray-50 border-gray-100 hover:bg-gray-100"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-mono font-semibold ${dc ? "text-blue-400" : "text-blue-600"}`}>{apt.caseId}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        apt.type.includes("Medical") || apt.type.includes("میڈیکل")
                          ? dc ? "bg-orange-500/15 text-orange-400" : "bg-orange-100 text-orange-700"
                          : apt.type.includes("Document") || apt.type.includes("دستاویز")
                          ? dc ? "bg-purple-500/15 text-purple-400" : "bg-purple-100 text-purple-700"
                          : dc ? "bg-teal-500/15 text-teal-400" : "bg-teal-100 text-teal-700"
                      }`}>{apt.type}</span>
                    </div>
                    <p className={`text-sm font-medium mb-1 ${dc ? "text-gray-200" : "text-gray-900"}`}>{apt.customer}</p>
                    <div className="flex items-center justify-between">
                      <div className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                        <span>{apt.time}</span> · <span>{apt.deadline}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/agent/cases/${apt.caseId}`); }}
                        className={`text-xs font-semibold transition-colors min-h-[32px] px-2 ${dc ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                      >
                        {isUrdu ? "دیکھیں →" : "View →"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "کیس آئی ڈی" : "Case ID"}
                      </th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "کسٹمر" : "Customer"}
                      </th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "وقت" : "Time"}
                      </th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "قسم" : "Type"}
                      </th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "تاریخ" : "Deadline"}
                      </th>
                      <th className={`text-left py-3 px-4 text-sm font-semibold ${dc ? "text-gray-300" : "text-gray-700"}`}>
                        {isUrdu ? "عمل" : "Action"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => (
                      <tr key={apt.id} onClick={() => navigate(`/agent/cases/${apt.caseId}`)} className={`border-b transition-colors cursor-pointer active:opacity-80 ${dc ? "border-gray-700/50 hover:bg-gray-700/30" : "border-gray-100 hover:bg-gray-50"}`}>
                        <td className={`py-3 px-4 text-sm font-mono ${dc ? "text-gray-200" : "text-gray-900"}`}>{apt.caseId}</td>
                        <td className={`py-3 px-4 text-sm ${dc ? "text-gray-200" : "text-gray-900"}`}>{apt.customer}</td>
                        <td className={`py-3 px-4 text-sm ${dc ? "text-gray-200" : "text-gray-900"}`}>{apt.time}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            apt.type.includes("Medical") || apt.type.includes("میڈیکل")
                              ? dc ? "bg-orange-500/15 text-orange-400" : "bg-orange-100 text-orange-700"
                              : apt.type.includes("Document") || apt.type.includes("دستاویز")
                              ? dc ? "bg-purple-500/15 text-purple-400" : "bg-purple-100 text-purple-700"
                              : dc ? "bg-teal-500/15 text-teal-400" : "bg-teal-100 text-teal-700"
                          }`}>
                            {apt.type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-sm ${dc ? "text-gray-200" : "text-gray-900"}`}>{apt.deadline}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/agent/cases/${apt.caseId}`); }}
                            className={`text-sm font-semibold transition-colors ${dc ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                          >
                            {isUrdu ? "دیکھیں →" : "View →"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* System Status */}
            <div className={`mt-6 rounded-xl shadow-sm p-4 md:p-6 ${dc ? "bg-gray-800/80 border border-gray-700/50" : "bg-white"}`}>
              <h3 className={`text-lg font-semibold mb-4 ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "سسٹم اسٹیٹس" : "System Status"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "سرور آن لائن" : "Server Online"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "ڈیٹا سنک" : "Data Synced"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "واٹس ایپ API" : "WhatsApp API"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{isUrdu ? "نوٹیفیکیشنز" : "Notifications"}</span>
                </div>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                dc ? "bg-blue-900/15 border border-blue-800/30" : "bg-blue-50 border border-blue-200"
              }`}>
                <Activity className={`w-5 h-5 ${dc ? "text-blue-400" : "text-blue-600"}`} />
                <span className={`text-sm ${dc ? "text-blue-300" : "text-blue-700"}`}>
                  {isUrdu ? "سب سسٹمز فعال ہیں۔ آخری سنک: ابھی" : "All systems operational. Last sync: Just now"}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Quick Action FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate("/agent/cases")}
        className={`fixed bottom-6 ${isUrdu ? "left-6" : "right-6"} w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-40`}
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}