import { MasterSidebar } from "../../components/MasterSidebar";
import { MasterHeader } from "../../components/MasterHeader";
import { useTheme } from "../../lib/ThemeContext";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bot, MessageCircle, Mic, Sparkles, Brain, Crown,
  Zap, Globe, Volume2, Languages, ArrowRight, Shield,
  Briefcase, FileText, Search, BarChart3, BookOpen, FlaskConical,
} from "lucide-react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function MasterAITools() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const navigate = useNavigate();
  const dc = darkMode;
  const { insideUnifiedLayout } = useUnifiedLayout();

  const aiToolCards = [
    {
      id: "chatbot",
      icon: MessageCircle,
      title: isUrdu ? "AI چیٹ بوٹ" : "AI Chatbot",
      desc: isUrdu
        ? "ذہین اردو/انگریزی چیٹ اسسٹنٹ جو CRM ڈیٹا، ویزا پراسیس، ٹیم مینجمنٹ اور مالیاتی جائزے میں مدد کرتا ہے۔"
        : "Intelligent Urdu/English chat assistant trained on CRM data, 12-stage visa process, team management, and financial overview.",
      path: "/master/ai-chatbot",
      gradient: "from-purple-500 to-indigo-600",
      glowColor: "shadow-purple-500/20",
      features: [
        isUrdu ? "17+ ایڈمن زمرے" : "17+ Admin Categories",
        isUrdu ? "اردو + انگریزی" : "Urdu + English",
        isUrdu ? "فوری کارروائی بٹنز" : "Quick Action Buttons",
        isUrdu ? "حقیقی CRM ڈیٹا" : "Real CRM Data",
      ],
    },
    {
      id: "voice",
      icon: Mic,
      title: isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant",
      desc: isUrdu
        ? "ہاتھ استعمال کیے بغیر CRM چلائیں۔ اردو یا انگریزی میں بولیں، فوری جواب سنیں۔ ویب اسپیچ API سے تقویت یافتہ۔"
        : "Operate CRM hands-free. Speak in Urdu or English, hear instant responses. Powered by Web Speech API for real-time recognition.",
      path: "/master/voice-assistant",
      gradient: "from-amber-500 to-orange-600",
      glowColor: "shadow-amber-500/20",
      features: [
        isUrdu ? "اردو آواز پہچان" : "Urdu Voice Recognition",
        isUrdu ? "ہینڈز فری آپریشن" : "Hands-Free Operation",
        isUrdu ? "فوری جوابات" : "Instant Responses",
        isUrdu ? "آواز خودکار لکھائی" : "Voice Transcription",
      ],
    },
    {
      id: "qwen-test",
      icon: FlaskConical,
      title: isUrdu ? "StepFun AI پائپ لائن ٹیسٹ" : "StepFun AI Pipeline Test",
      desc: isUrdu
        ? "StepFun AI انضمام کی مکمل جانچ: اسٹریمنگ، CRM ایکشنز، Brevo ای میل، اور آف لائن قطار۔"
        : "End-to-end diagnostics: streaming, CRM actions, Brevo email notifications, and offline queue status.",
      path: "/master/stepfun-test",
      gradient: "from-violet-500 to-indigo-600",
      glowColor: "shadow-violet-500/20",
      features: [
        "SSE Streaming",
        "CRM Action Parsing",
        "Brevo Email",
        "Offline Queue",
      ],
    },
  ];

  const capabilities = [
    {
      icon: Crown,
      title: isUrdu ? "اعلیٰ انتظامیہ کنٹرول" : "Executive Control",
      desc: isUrdu ? "مکمل CRM نگرانی اور فیصلے" : "Full CRM oversight & decisions",
    },
    {
      icon: Brain,
      title: isUrdu ? "ویزا پراسیس ماہر" : "Visa Process Expert",
      desc: isUrdu ? "مکمل 12 مراحل کی تفصیل" : "Complete 12-stage workflow detail",
    },
    {
      icon: Shield,
      title: isUrdu ? "ٹیم و ایجنٹ مینجمنٹ" : "Team & Agent Management",
      desc: isUrdu ? "کارکردگی، حاضری، لیڈر بورڈ" : "Performance, attendance, leaderboard",
    },
    {
      icon: BarChart3,
      title: isUrdu ? "مالیات و تجزیات" : "Financials & Analytics",
      desc: isUrdu ? "آمدنی، کمیشن، ادائیگی رپورٹس" : "Revenue, commission, payment reports",
    },
    {
      icon: BookOpen,
      title: isUrdu ? "کاروباری اصول" : "Business Rules & SOPs",
      desc: isUrdu ? "اصول، ذمہ داریاں، SOPs" : "Rules, responsibilities, SOPs",
    },
    {
      icon: Globe,
      title: isUrdu ? "دو زبانی سپورٹ" : "Bilingual Support",
      desc: isUrdu ? "اردو اور انگریزی دونوں زبانوں میں" : "Full Urdu and English support",
    },
  ];

  const quickTips = [
    { q: isUrdu ? "ٹیم کا جائزہ دکھائیں" : "Show team overview", icon: "👥" },
    { q: isUrdu ? "سسٹم کے اعداد و شمار" : "System statistics", icon: "📊" },
    { q: isUrdu ? "ایجنٹ کارکردگی رپورٹ" : "Agent performance report", icon: "🏆" },
    { q: isUrdu ? "مالیاتی خلاصہ" : "Financial summary", icon: "💰" },
    { q: isUrdu ? "ویزا پراسیس مراحل" : "Visa process stages", icon: "🔄" },
    { q: isUrdu ? "زیر التواء منظوریاں" : "Pending approvals", icon: "📋" },
    { q: isUrdu ? "کاروباری اصول" : "Business rules", icon: "🔑" },
    { q: isUrdu ? "پاسپورٹ سٹاک" : "Passport stock", icon: "📦" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <MasterHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">

          {/* Hero Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-6 md:p-8 mb-8 ${
              dc
                ? "bg-gradient-to-br from-purple-900/50 to-amber-900/30 border border-purple-500/20"
                : "bg-gradient-to-br from-purple-600 via-purple-700 to-amber-600"
            }`}
          >
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {isUrdu ? "AI ٹولز ہب" : "AI Tools Hub"}
                </h1>
                <p className={`text-sm md:text-base ${dc ? "text-purple-200" : "text-white/80"}`}>
                  {isUrdu
                    ? "ایمرالڈ ویزا CRM کے لیے مصنوعی ذہانت سے تقویت یافتہ ٹولز — چیٹ بوٹ اور آواز اسسٹنٹ دونوں ہر صفحے پر دستیاب ہیں"
                    : "AI-powered tools for Emerald Visa CRM — both the chatbot and voice assistant are available on every page via floating buttons"}
                </p>
              </div>
              <div className="flex gap-2">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
                >
                  <MessageCircle className="w-5 h-5 text-white/70" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
                >
                  <Mic className="w-5 h-5 text-white/70" />
                </motion.div>
              </div>
            </div>
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-white/5 translate-y-1/2" />
          </motion.div>

          {/* Access Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`p-4 rounded-xl border mb-8 flex items-start gap-3 ${
              dc
                ? "bg-amber-900/15 border-amber-500/20 text-amber-200"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <Sparkles className={`w-5 h-5 mt-0.5 flex-shrink-0 ${dc ? "text-amber-400" : "text-amber-600"}`} />
            <div>
              <p className="text-sm font-semibold mb-1">
                {isUrdu ? "AI ٹولز ہر جگہ دستیاب ہیں!" : "AI Tools are available everywhere!"}
              </p>
              <p className={`text-xs ${dc ? "text-amber-300/70" : "text-amber-700"}`}>
                {isUrdu
                  ? "نیچے بائیں جانب 💬 چیٹ بٹن اور نیچے دائیں جانب 🎙️ مائیک بٹن ہر صفحے پر نظر آتا ہے۔ آپ کسی بھی صفحے سے AI سے بات کر سکتے ہیں!"
                  : "The 💬 chat button (bottom-left) and 🎙️ mic button (bottom-right) appear on every master portal page. You can talk to AI from any screen!"}
              </p>
            </div>
          </motion.div>

          {/* Tool Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-8">
            {aiToolCards.map((tool, idx) => {
              const Icon = tool.icon;
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className={`group relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg ${tool.glowColor} ${
                    dc ? "bg-gray-900 border-gray-800 hover:border-purple-500/30" : "bg-white border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-6 pb-4`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-lg font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                          {tool.title}
                        </h3>
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed mb-4 ${dc ? "text-gray-400" : "text-gray-600"}`}>
                      {tool.desc}
                    </p>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {tool.features.map((feat, fi) => (
                        <div
                          key={fi}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                            dc ? "bg-gray-800 text-gray-300" : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          <Zap className={`w-3 h-3 flex-shrink-0 ${dc ? "text-purple-400" : "text-purple-500"}`} />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(tool.path)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r ${tool.gradient} text-white shadow-md hover:shadow-lg`}
                    >
                      {isUrdu ? "کھولیں" : "Open"}
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Capabilities Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${dc ? "text-white" : "text-gray-900"}`}>
              <Brain className="w-5 h-5 text-purple-500" />
              {isUrdu ? "AI صلاحیتیں" : "AI Capabilities"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {capabilities.map((cap, idx) => {
                const CapIcon = cap.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + idx * 0.06 }}
                    className={`p-4 rounded-xl border ${
                      dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
                    }`}
                  >
                    <CapIcon className={`w-5 h-5 mb-2 ${dc ? "text-purple-400" : "text-purple-600"}`} />
                    <h4 className={`text-sm font-semibold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                      {cap.title}
                    </h4>
                    <p className={`text-xs ${dc ? "text-gray-500" : "text-gray-500"}`}>{cap.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick Tips / Example Questions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`p-6 rounded-xl border ${
              dc
                ? "bg-gradient-to-br from-purple-900/20 to-amber-900/15 border-purple-500/20"
                : "bg-gradient-to-br from-purple-50 to-amber-50 border-purple-200"
            }`}
          >
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${dc ? "text-purple-300" : "text-purple-900"}`}>
              <Search className="w-5 h-5" />
              {isUrdu ? "یہ پوچھ کر دیکھیں" : "Try Asking These"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {quickTips.map((tip, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium cursor-default ${
                    dc
                      ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                      : "bg-white text-purple-700 border border-purple-200 shadow-sm"
                  }`}
                >
                  <span>{tip.icon}</span>
                  {tip.q}
                </span>
              ))}
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}