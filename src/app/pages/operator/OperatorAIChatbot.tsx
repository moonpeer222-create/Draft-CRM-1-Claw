import { OperatorSidebar } from "../../components/OperatorSidebar";
import { OperatorHeader } from "../../components/OperatorHeader";
import { RoleBasedChatbot } from "../../components/visaverse/RoleBasedChatbot";
import { useTheme } from "../../lib/ThemeContext";
import { Bot, Brain, Shield, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function OperatorAIChatbot() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const navigate = useNavigate();
  const { insideUnifiedLayout } = useUnifiedLayout();

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: isUrdu ? "CRM ایکشنز" : "CRM Actions",
      desc: isUrdu ? "کیسز تلاش، اسٹیٹس اپڈیٹ، ادائیگی ریکارڈ، نوٹ شامل — AI سے" : "Search, update status, record payments, add notes — via AI",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: isUrdu ? "ڈیٹا انٹری مدد" : "Data Entry Help",
      desc: isUrdu ? "فارم خودکار، دستاویزات چیک، ڈیٹا تصدیق" : "Auto-fill forms, document checks, data validation",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: isUrdu ? "فوری رپورٹس" : "Quick Reports",
      desc: isUrdu ? "روزانہ رپورٹ، حاضری خلاصہ، کیس اعدادوشمار" : "Daily reports, attendance summary, case stats",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: isUrdu ? "ورک فلو رہنمائی" : "Workflow Guidance",
      desc: isUrdu ? "14 مراحل رہنمائی، اگلا قدم تجاویز، ڈیڈ لائن ریمائنڈرز" : "14-stage guidance, next-step suggestions, deadline reminders",
    },
  ];

  const sampleQuestions = [
    { q: "Show all cases", qUrdu: "تمام کیسز دکھاؤ" },
    { q: "Create a new case", qUrdu: "نیا کیس بناؤ" },
    { q: "Update status EMR-2026-0001", qUrdu: "EMR-2026-0001 اسٹیٹس اپڈیٹ" },
    { q: "Daily report", qUrdu: "روزانہ رپورٹ" },
    { q: "Overdue cases", qUrdu: "تاخیر والے کیسز" },
    { q: "Payment record", qUrdu: "ادائیگی ریکارڈ" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <OperatorSidebar activeTab="dashboard" onTabChange={() => navigate("/operator")} />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <OperatorHeader activeTab="dashboard" onTabChange={() => navigate("/operator")} />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 rounded-2xl overflow-hidden ${darkMode ? "bg-gradient-to-r from-teal-900/40 to-cyan-900/40 border border-teal-700/30" : "bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200"}`}
          >
            <div className="px-4 sm:px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${darkMode ? "bg-teal-500/20" : "bg-teal-100"}`}>
                  <Bot className={`w-6 h-6 ${darkMode ? "text-teal-400" : "text-teal-600"}`} />
                </div>
                <div>
                  <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {isUrdu ? "آپریٹر AI اسسٹنٹ" : "Operator AI Assistant"}
                  </h1>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "ڈیٹا انٹری اور کیس مینجمنٹ — AI مدد سے" : "Data entry & case management — powered by AI"}
                  </p>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {features.map((f, i) => (
                  <div key={i} className={`p-3 rounded-xl ${darkMode ? "bg-gray-800/50" : "bg-white/70"}`}>
                    <div className={`mb-2 ${darkMode ? "text-teal-400" : "text-teal-600"}`}>{f.icon}</div>
                    <p className={`text-xs font-semibold mb-0.5 ${darkMode ? "text-white" : "text-gray-900"}`}>{f.title}</p>
                    <p className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Sample Questions */}
              <div className="mt-4">
                <p className={`text-xs font-medium mb-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {isUrdu ? "تجربہ کریں:" : "Try asking:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sampleQuestions.map((sq, i) => (
                    <span
                      key={i}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${darkMode ? "bg-teal-500/10 text-teal-300 border border-teal-500/20" : "bg-teal-100 text-teal-700"}`}
                    >
                      {isUrdu ? sq.qUrdu : sq.q}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* AI Chatbot — operator role */}
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <RoleBasedChatbot role="operator" />
          </div>
        </main>
      </div>
    </div>
  );
}