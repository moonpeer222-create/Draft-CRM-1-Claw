import { useTheme } from "../../lib/ThemeContext";
import { Bot, MessageCircle, Sparkles, Zap, Brain, Crown } from "lucide-react";
import { motion } from "motion/react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { RoleBasedChatbot } from "../../components/visaverse/RoleBasedChatbot";

export function MasterAIChatbot() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "System Intelligence",
      titleUrdu: "سسٹم انٹیلی جنس",
      desc: "Full CRM oversight, cross-admin analytics, system health",
      descUrdu: "مکمل CRM نگرانی، کراس ایڈمن تجزیات، سسٹم صحت"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Advanced Analytics",
      titleUrdu: "ایڈوانسڈ تجزیات",
      desc: "Organization-wide reports, trend analysis, forecasting",
      descUrdu: "تنظیمی رپورٹس، رجحان تجزیہ، پیش گوئی"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Quick Commands",
      titleUrdu: "فوری احکامات",
      desc: "Manage admins, audit logs, system configuration",
      descUrdu: "ایڈمنز کا انتظام، آڈٹ لاگز، سسٹم کنفیگریشن"
    },
    {
      icon: <Crown className="w-6 h-6" />,
      title: "Master Controls",
      titleUrdu: "ماسٹر کنٹرولز",
      desc: "Full access, override capabilities, emergency actions",
      descUrdu: "مکمل رسائی، اوور رائیڈ صلاحیتیں، ہنگامی اقدامات"
    },
  ];

  const sampleQuestions = [
    { q: "Show all admins", qUrdu: "تمام ایڈمنز دکھاؤ" },
    { q: "System health check", qUrdu: "سسٹم ہیلتھ چیک" },
    { q: "Organization analytics", qUrdu: "تنظیمی تجزیات" },
    { q: "Audit trail", qUrdu: "آڈٹ ٹریل" },
    { q: "Revenue overview", qUrdu: "آمدنی کا جائزہ" },
    { q: "Agent performance", qUrdu: "ایجنٹ کارکردگی" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                <Bot className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "AI چیٹ بوٹ" : "AI Chatbot"}
                </h1>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? "ماسٹر ایڈمن کے لیے ذہین اسسٹنٹ" : "Intelligent Assistant for Master Admin"}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-5 rounded-xl border transition-all ${
                  darkMode
                    ? "bg-gray-900 border-gray-800 hover:border-purple-500/50"
                    : "bg-white border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="mb-3 text-purple-500">
                  {feature.icon}
                </div>
                <h3 className={`font-semibold mb-1.5 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? feature.titleUrdu : feature.title}
                </h3>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? feature.descUrdu : feature.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`p-6 rounded-xl border mb-8 ${
              darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            }`}
          >
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
              <MessageCircle className="w-5 h-5 text-purple-500" />
              {isUrdu ? "نمونہ سوالات" : "Sample Questions"}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sampleQuestions.map((sq, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-sm cursor-pointer transition-all ${
                    darkMode
                      ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                      : "bg-gray-50 hover:bg-purple-50 text-gray-700"
                  }`}
                >
                  {isUrdu ? sq.qUrdu : sq.q}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl overflow-hidden"
          >
            <RoleBasedChatbot role="master_admin" />
          </motion.div>
        </main>
      </div>
    </div>
  );
}