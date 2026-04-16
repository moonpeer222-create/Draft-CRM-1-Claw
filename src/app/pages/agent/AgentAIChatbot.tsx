import { AgentSidebar } from "../../components/AgentSidebar";
import { AgentHeader } from "../../components/AgentHeader";
import { RoleBasedChatbot } from "../../components/visaverse/RoleBasedChatbot";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { Bot, MessageCircle, Sparkles, Zap, Briefcase, Target } from "lucide-react";
import { motion } from "motion/react";

export function AgentAIChatbot() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();

  const features = [
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: isUrdu ? "CRM ایکشنز" : "CRM Actions",
      titleUrdu: "CRM ایکشنز",
      desc: isUrdu ? "کیس بنائیں، اپڈیٹ کریں، ادائیگی ریکارڈ — AI سے" : "Create case, update, record payment — via AI",
      descUrdu: "کیس بنائیں، اپڈیٹ کریں، ادائیگی ریکارڈ — AI سے"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: isUrdu ? "ڈیڈ لائن ریمائنڈر" : "Deadline Reminders",
      titleUrdu: "ڈیڈ لائن ریمائنڈر",
      desc: isUrdu ? "تاخیر والے کیسز اور آنے والی ڈیڈ لائنز" : "Overdue cases and upcoming deadlines",
      descUrdu: "تاخیر والے کیسز اور آنے والی ڈیڈ لائنز"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: isUrdu ? "ورک فلو گائیڈ" : "Workflow Guide",
      titleUrdu: "ورک فلو گائیڈ",
      desc: isUrdu ? "12 مراحل ویزا پروسیس کی مکمل رہنمائی" : "Complete 12-stage visa process guidance",
      descUrdu: "12 مراحل ویزا پروسیس کی مکمل رہنمائی"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: isUrdu ? "واٹس ایپ ٹیمپلیٹس" : "WhatsApp Templates",
      titleUrdu: "واٹس ایپ ٹیمپلیٹس",
      desc: isUrdu ? "کلائنٹ کو پیغامات اور یاد دہانیاں" : "Client messages and reminders",
      descUrdu: "کلائنٹ کو پیغامات اور یاد دہانیاں"
    },
  ];

  const sampleQuestions = [
    { q: "Show my cases", qUrdu: "میرے کیسز دکھائیں" },
    { q: "Create new case", qUrdu: "نیا کیس بناؤ" },
    { q: "Overdue cases", qUrdu: "تاخیر والے کیسز" },
    { q: "Medical process", qUrdu: "میڈیکل کا عمل" },
    { q: "Record payment", qUrdu: "ادائیگی ریکارڈ کرو" },
    { q: "My performance", qUrdu: "میری کارکردگی" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg`}>
                <Bot className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "AI چیٹ بوٹ" : "AI Chatbot"}
                </h1>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? "ایجنٹس کے لیے ذہین اردو/انگریزی اسسٹنٹ" : "Intelligent Urdu/English Assistant for Agents"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-5 rounded-xl border transition-all ${
                  darkMode
                    ? "bg-gray-900 border-gray-800 hover:border-emerald-500/50"
                    : "bg-white border-gray-200 hover:border-emerald-300"
                }`}
              >
                <div className={`mb-3 text-emerald-500`}>
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

          {/* Sample Questions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`p-6 rounded-xl border mb-8 ${
              darkMode
                ? "bg-gray-900 border-gray-800"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className={`w-5 h-5 ${darkMode ? "text-emerald-400" : "text-emerald-600"}`} />
              <h2 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "نمونہ سوالات" : "Sample Questions"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((item, idx) => (
                <span
                  key={idx}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    darkMode
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {isUrdu ? item.qUrdu : item.q}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-6 rounded-xl border ${
              darkMode
                ? "bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/20"
                : "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200"
            }`}
          >
            <h3 className={`font-bold mb-3 ${darkMode ? "text-emerald-400" : "text-emerald-900"}`}>
              {isUrdu ? "کیسے استعمال کریں:" : "How to Use:"}
            </h3>
            <ul className={`space-y-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">1.</span>
                <span>{isUrdu ? "نیچے بائیں جانب چیٹ بٹن پر کلک کریں" : "Click the chat button at the bottom left"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">2.</span>
                <span>{isUrdu ? "اردو یا انگریزی میں اپنا سوال ٹائپ کریں" : "Type your question in Urdu or English"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">3.</span>
                <span>{isUrdu ? "AI فوری طور پر جواب دے گا مفید معلومات کے ساتھ" : "AI will respond instantly with helpful information"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">4.</span>
                <span>{isUrdu ? "فوری کارروائیوں کے لیے کوئیک ایکشن بٹنز استعمال کریں" : "Use quick action buttons for common tasks"}</span>
              </li>
            </ul>
          </motion.div>
        </main>
      </div>

      {/* Chatbot Component */}
      <RoleBasedChatbot role="agent" />
    </div>
  );
}