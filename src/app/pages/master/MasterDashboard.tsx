import { useTheme } from "../../lib/ThemeContext";
import { getOverdueInfo, getPipelineStages, getSLAStatus } from "../../lib/mockData";
import { generateSalaryReport, SALARY_CONFIG } from "../../lib/salaryCalculator";
import { motion } from "motion/react";
import {
  Crown, Briefcase, Users, DollarSign, CheckCircle, Clock,
  AlertTriangle, TrendingUp, Activity, Shield, BarChart3,
  ArrowRight, Sparkles, Timer, Calculator,
  ChevronDown, ChevronUp, Bot,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { MasterSidebar } from "../../components/MasterSidebar";
import { MasterHeader } from "../../components/MasterHeader";
import { MasterDataReset } from "../../components/MasterDataReset";
import { useState, useEffect, useMemo } from "react";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";

export function MasterDashboard() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const navigate = useNavigate();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const brd = dc ? "border-gray-700" : "border-gray-200";
  const cardBg = dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";

  const [cases, setCases] = useState<any[]>([]);
  const [expandSLA, setExpandSLA] = useState(true);
  const [expandSalary, setExpandSalary] = useState(true);
  const [salaryMonth] = useState(new Date().getMonth());
  const [salaryYear] = useState(new Date().getFullYear());
  const [users, setUsers] = useState<any[]>([]);
  const { profile } = useSupabaseAuth();

  // Fetch cases and users from Supabase
  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from("cases").select("*");
      if (!error && data) {
        setCases(data.map(mapSupabaseCaseToLocal));
      }
    };
    const fetchUsers = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (!error && data) {
        setUsers(data.map((u: any) => ({ ...u, fullName: u.full_name, status: "active" })));
      }
    };
    fetchCases();
    fetchUsers();
    const iv = setInterval(() => {
      fetchCases();
      fetchUsers();
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Stats — live from real data, no hardcoded percentages ──
  const overdueCount = cases.filter(c => getOverdueInfo(c).isOverdue).length;
  const completedCount = cases.filter(c => c.status === "stamped" || c.status === "visa_completed").length;
  const activeCount = cases.filter(c => c.status !== "stamped" && c.status !== "visa_completed" && c.status !== "rejected" && c.status !== "visa_cancelled" && c.status !== "lead_cancelled").length;
  const leadCount = cases.filter(c => c.pipelineType === "lead").length;
  const visaCount = cases.filter(c => c.pipelineType === "visa").length;

  const stats = [
    { icon: Briefcase, label: isUrdu ? "کل کیسز" : "Total Cases", value: cases.length, color: "from-purple-500 to-purple-600" },
    { icon: CheckCircle, label: isUrdu ? "مکمل" : "Completed", value: completedCount, color: "from-green-500 to-emerald-600" },
    { icon: Clock, label: isUrdu ? "زیر عمل" : "In Progress", value: activeCount, color: "from-blue-500 to-blue-600" },
    { icon: AlertTriangle, label: isUrdu ? "تاخیر شدہ" : "Overdue", value: overdueCount, color: "from-red-500 to-red-600", alert: overdueCount > 0 },
    { icon: TrendingUp, label: isUrdu ? "لیڈز" : "Leads", value: leadCount, color: "from-amber-500 to-amber-600" },
    { icon: Shield, label: isUrdu ? "ویزا کیسز" : "Visa Cases", value: visaCount, color: "from-indigo-500 to-indigo-600" },
  ];

  // ── SLA Alerts — cases with deadlines approaching or overdue ──
  const slaAlerts = useMemo(() => {
    return cases
      .filter(c => {
        if (!c.stageStartedAt) return false;
        const stages = getPipelineStages(c.pipelineType || "visa");
        const stage = stages.find(s => s.key === (c.pipelineStageKey || c.status));
        if (!stage || !stage.deadlineHours) return false;
        const sla = getSLAStatus(c.stageStartedAt, stage.deadlineHours);
        return sla.isOverdue || (sla.hoursRemaining !== null && sla.hoursRemaining < 6);
      })
      .map(c => {
        const stages = getPipelineStages(c.pipelineType || "visa");
        const stage = stages.find(s => s.key === (c.pipelineStageKey || c.status));
        const sla = getSLAStatus(c.stageStartedAt!, stage!.deadlineHours);
        return { ...c, sla, stageName: stage ? (isUrdu ? stage.labelUrdu : stage.label) : c.status };
      })
      .sort((a, b) => (a.sla.hoursRemaining ?? -999) - (b.sla.hoursRemaining ?? -999));
  }, [cases, isUrdu]);

  // ── Salary Calculator — count entries per agent for current month ──
  const salaryReport = useMemo(() => {
    const agentUsers = users.filter(u => u.role === "agent" && u.status === "active");
    const monthStart = new Date(salaryYear, salaryMonth, 1);
    const monthEnd = new Date(salaryYear, salaryMonth + 1, 0, 23, 59, 59);

    const agentEntries = agentUsers.map(agent => {
      const entriesThisMonth = cases.filter(c => {
        const matchAgent = c.agentName === agent.fullName || c.agentId === agent.id;
        if (!matchAgent) return false;
        const created = new Date(c.createdDate);
        return created >= monthStart && created <= monthEnd;
      }).length;

      return {
        id: agent.id,
        name: agent.fullName,
        entries: entriesThisMonth,
        isTeamLead: false,
      };
    });

    return generateSalaryReport(agentEntries);
  }, [cases, users, salaryMonth, salaryYear]);

  const quickActions = [
    { icon: Briefcase, label: isUrdu ? "کیس مینجمنٹ" : "Case Management", path: "/admin/cases", desc: isUrdu ? "تمام کیسز دیکھیں" : "View all cases" },
    { icon: Users, label: isUrdu ? "ٹیم مینجمنٹ" : "Team Management", path: "/admin/team", desc: isUrdu ? "ایجنٹس کا انتظام" : "Manage agents" },
    { icon: BarChart3, label: isUrdu ? "تجزیات" : "Analytics", path: "/admin/analytics", desc: isUrdu ? "تفصیلی رپورٹس" : "Detailed reports" },
    { icon: Bot, label: isUrdu ? "AI چیٹ بوٹ" : "AI Chatbot", path: "/master/ai-chatbot", desc: isUrdu ? "AI اسسٹنٹ" : "AI Assistant" },
    { icon: DollarSign, label: isUrdu ? "مالیات" : "Financials", path: "/admin/financials", desc: isUrdu ? "مالی خلاصہ" : "Financial overview" },
    { icon: Shield, label: isUrdu ? "صارف انتظام" : "User Management", path: "/admin/user-management", desc: isUrdu ? "صارفین کا انتظام" : "Manage all users" },
    { icon: Crown, label: isUrdu ? "ٹیننٹ مینجمنٹ" : "Manage Tenants", path: "/master/tenants", desc: isUrdu ? "تمام ایجنسیاں" : "All registered agencies" },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesUrdu = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <MasterHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-6 md:p-8 ${
              dc
                ? "bg-gradient-to-br from-purple-900/40 to-amber-900/20 border border-purple-500/20"
                : "bg-gradient-to-br from-purple-600 to-amber-500"
            }`}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Crown className={`w-8 h-8 ${dc ? "text-amber-400" : "text-white"}`} />
                <div>
                  <h1 className={`text-2xl md:text-3xl font-bold text-white`}>
                    {isUrdu ? `خوش آمدید، ${profile?.full_name || "ماسٹر ایڈمن"}` : `Welcome, ${profile?.full_name || "Master Admin"}`}
                  </h1>
                  <p className={`text-sm mt-1 ${dc ? "text-purple-300" : "text-white/80"}`}>
                    {isUrdu ? "ایمرالڈ ٹیک پارٹنر - اعلیٰ انتظامیہ ڈیش بورڈ" : "Emerald Tech Partner - Executive Dashboard"}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-white/5 translate-y-1/2" />
          </motion.div>

          {/* Stats Grid — Real-Time Live Data */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`p-4 rounded-xl border ${cardBg} ${stat.alert ? "ring-2 ring-red-500/40" : ""} transition-colors relative group hover:shadow-lg`}
              >
                {/* Live pulse indicator */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <p className={`text-2xl font-bold ${txt} tabular-nums`}>{stat.value}</p>
                <p className={`text-xs ${sub}`}>{stat.label}</p>
                {stat.alert && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1 animate-pulse">
                    {isUrdu ? "⚠ فوری توجہ" : "⚠ Needs attention"}
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          {/* SLA Alerts Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`rounded-xl border ${cardBg} overflow-hidden`}
          >
            <button
              onClick={() => setExpandSLA(!expandSLA)}
              className={`w-full flex items-center justify-between p-5 text-left hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${txt}`}>
                    {isUrdu ? "SLA الرٹس" : "SLA Alerts"}
                  </h2>
                  <p className={`text-xs ${sub}`}>
                    {slaAlerts.length === 0
                      ? (isUrdu ? "کوئی فعال الرٹ نہیں" : "No active alerts")
                      : isUrdu ? `${slaAlerts.length} کیسز کو فوری توجہ چاہیے` : `${slaAlerts.length} case(s) need attention`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {slaAlerts.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                    {slaAlerts.filter(a => a.sla.isOverdue).length} {isUrdu ? "تاخیر" : "overdue"}
                  </span>
                )}
                {expandSLA ? <ChevronUp className={`w-5 h-5 ${sub}`} /> : <ChevronDown className={`w-5 h-5 ${sub}`} />}
              </div>
            </button>

            {expandSLA && (
              <div className={`border-t ${brd}`}>
                {slaAlerts.length === 0 ? (
                  <div className={`p-8 text-center ${sub}`}>
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">{isUrdu ? "سب کچھ ٹھیک ہے!" : "All clear!"}</p>
                    <p className="text-xs mt-1">{isUrdu ? "کوئی کیس تاخیر یا خطرے میں نہیں" : "No cases overdue or at risk"}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
                    {slaAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors`}
                        onClick={() => navigate("/admin/cases")}
                      >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          alert.sla.isOverdue ? "bg-red-500 animate-pulse" : "bg-amber-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${txt}`}>
                            {alert.id} — {alert.customerName}
                          </p>
                          <p className={`text-xs ${sub} truncate`}>
                            {isUrdu ? "مرحلہ:" : "Stage:"} {alert.stageName} • {isUrdu ? "ایجنٹ:" : "Agent:"} {alert.agentName}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          alert.sla.isOverdue
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                        }`}>
                          {alert.sla.timeLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Salary Calculator Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`rounded-xl border ${cardBg} overflow-hidden`}
          >
            <button
              onClick={() => setExpandSalary(!expandSalary)}
              className={`w-full flex items-center justify-between p-5 text-left hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${txt}`}>
                    {isUrdu ? "تنخواہ کیلکولیٹر" : "Salary Calculator"}
                  </h2>
                  <p className={`text-xs ${sub}`}>
                    {isUrdu ? monthNamesUrdu[salaryMonth] : monthNames[salaryMonth]} {salaryYear} — {isUrdu ? "ہدف:" : "Target:"} {SALARY_CONFIG.MONTHLY_TARGET} {isUrdu ? "اندراجات/ماہ" : "entries/month"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${dc ? "text-green-400" : "text-green-600"}`}>
                  PKR {salaryReport.grandTotal.toLocaleString()}
                </span>
                {expandSalary ? <ChevronUp className={`w-5 h-5 ${sub}`} /> : <ChevronDown className={`w-5 h-5 ${sub}`} />}
              </div>
            </button>

            {expandSalary && (
              <div className={`border-t ${brd}`}>
                {salaryReport.agents.length === 0 ? (
                  <div className={`p-8 text-center ${sub}`}>
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{isUrdu ? "کوئی فعال ایجنٹ نہیں" : "No active agents"}</p>
                    <p className="text-xs mt-1">{isUrdu ? "ایجنٹس شامل کریں تنخواہ دیکھنے کے لیے" : "Add agents to see salary calculations"}</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {/* Column headers */}
                    <div className={`grid grid-cols-12 gap-2 text-xs font-semibold ${sub} px-3`}>
                      <span className="col-span-3">{isUrdu ? "ایجنٹ" : "Agent"}</span>
                      <span className="col-span-2 text-center">{isUrdu ? "اندراجات" : "Entries"}</span>
                      <span className="col-span-3 text-center">{isUrdu ? "پیش رفت" : "Progress"}</span>
                      <span className="col-span-2 text-center">{isUrdu ? "بنیادی" : "Base"}</span>
                      <span className="col-span-2 text-right">{isUrdu ? "کل" : "Total"}</span>
                    </div>

                    {salaryReport.agents.map(agent => {
                      const progressPct = Math.min(agent.targetAchievedPercent, 100);
                      return (
                        <div
                          key={agent.id}
                          className={`grid grid-cols-12 gap-2 items-center p-3 rounded-xl ${
                            dc ? "bg-gray-800/50" : "bg-gray-50"
                          }`}
                        >
                          <div className="col-span-3">
                            <p className={`text-sm font-semibold truncate ${txt}`}>{agent.name}</p>
                            {agent.bonusEntries > 0 && (
                              <p className="text-[10px] text-green-500 font-medium">
                                +{agent.bonusEntries} {isUrdu ? "بونس" : "bonus"}
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-sm font-bold ${
                              agent.isAboveThreshold ? (dc ? "text-green-400" : "text-green-600") : (dc ? "text-amber-400" : "text-amber-600")
                            }`}>
                              {agent.entries}
                            </span>
                            <span className={`text-xs ${sub}`}>/{SALARY_CONFIG.MONTHLY_TARGET}</span>
                          </div>
                          <div className="col-span-3">
                            <div className={`h-2 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"} overflow-hidden`}>
                              <div
                                className={`h-full rounded-full transition-all ${
                                  agent.isAboveThreshold ? "bg-green-500" : agent.entries >= 6 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <p className={`text-[10px] text-center mt-0.5 ${sub}`}>{agent.targetAchievedPercent}%</p>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-xs ${sub}`}>
                              {agent.isAboveThreshold ? `PKR ${(agent.baseSalary / 1000).toFixed(0)}K` : `${agent.perEntryRate.toLocaleString()}/ea`}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`text-sm font-bold ${txt}`}>
                              PKR {agent.totalSalary.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Totals */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${
                      dc ? "border-green-500/30 bg-green-950/20" : "border-green-200 bg-green-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <span className={`text-sm font-bold ${txt}`}>{isUrdu ? "کل تنخواہ" : "Grand Total"}</span>
                      </div>
                      <span className={`text-lg font-bold ${dc ? "text-green-400" : "text-green-600"}`}>
                        PKR {salaryReport.grandTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Salary rules summary */}
                    <div className={`text-[10px] space-y-0.5 mt-2 ${sub}`}>
                      <p>{isUrdu ? "اصول:" : "Rules:"} {SALARY_CONFIG.BASE_SALARY_THRESHOLD}+ {isUrdu ? "اندراجات = PKR" : "entries = PKR"} {SALARY_CONFIG.BASE_SALARY.toLocaleString()} {isUrdu ? "بنیادی" : "base"} + PKR {SALARY_CONFIG.BONUS_PER_EXTRA_ENTRY.toLocaleString()}/{isUrdu ? "اضافی" : "extra"}</p>
                      <p>{isUrdu ? "کم سے کم:" : "Below:"} &lt;{SALARY_CONFIG.BASE_SALARY_THRESHOLD} = PKR {SALARY_CONFIG.PER_ENTRY_BELOW_THRESHOLD.toLocaleString()}/{isUrdu ? "اندراج" : "entry"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${txt}`}>
              <Sparkles className="w-5 h-5 text-purple-500" />
              {isUrdu ? "فوری کارروائیاں" : "Quick Actions"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {quickActions.map((action, idx) => (
                <motion.button
                  key={action.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + idx * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(action.path)}
                  className={`p-5 rounded-xl border text-left group ${
                    dc
                      ? "bg-gray-900 border-gray-800 hover:border-purple-500/30"
                      : "bg-white border-gray-200 hover:border-purple-300"
                  } transition-all`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${dc ? "text-purple-400" : "text-purple-500"}`} />
                  </div>
                  <h3 className={`font-semibold text-sm mb-1 ${txt}`}>{action.label}</h3>
                  <p className={`text-xs ${sub}`}>{action.desc}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* System Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className={`p-6 rounded-xl border ${cardBg}`}
          >
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${txt}`}>
              <Activity className="w-5 h-5 text-purple-500" />
              {isUrdu ? "نظام کا جائزہ" : "System Overview"}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: isUrdu ? "کل صارفین" : "Total Users", value: users.length, icon: Users },
                { label: isUrdu ? "فعال ایجنٹس" : "Active Agents", value: users.filter(u => u.role === "agent" && u.status === "active").length, icon: Shield },
                { label: isUrdu ? "کل ایڈمنز" : "Admins", value: users.filter(u => u.role === "admin" || u.role === "master_admin").length, icon: Crown },
                { label: isUrdu ? "فعال کیسز" : "Active Cases", value: activeCount, icon: TrendingUp },
              ].map((item) => (
                <div key={item.label} className={`p-3 rounded-lg ${dc ? "bg-gray-800" : "bg-gray-50"}`}>
                  <item.icon className={`w-4 h-4 mb-2 ${dc ? "text-purple-400" : "text-purple-600"}`} />
                  <p className={`text-xl font-bold ${txt}`}>{item.value}</p>
                  <p className={`text-xs ${sub}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Data Reset Panel — Master Admin Only */}
          <MasterDataReset
            darkMode={dc}
            isUrdu={isUrdu}
            onDataReset={async () => {
              const { data } = await supabase.from("cases").select("*");
              setCases((data || []).map(mapSupabaseCaseToLocal));
            }}
          />
        </main>
      </div>
    </div>
  );
}