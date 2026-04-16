import { useNavigate } from "react-router";
import { useTheme } from "../../lib/ThemeContext";
import { RoleBasedVoiceAssistant } from "../../components/visaverse/RoleBasedVoiceAssistant";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { CustomerMobileMenu } from "../../components/CustomerMobileMenu";
import { NotificationBell } from "../../components/NotificationPanel";
import { motion } from "motion/react";
import {
  Mic, Volume2, Sparkles, Globe, ArrowLeft,
  Languages, Brain, Menu, Moon, Sun, Bot,
} from "lucide-react";
import { useState } from "react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function CustomerVoiceAssistant() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass } = useTheme();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dc = darkMode;

  const features = [
    {
      icon: <Volume2 className="w-6 h-6" />,
      title: isUrdu ? "آواز سے پوچھیں" : "Voice Queries",
      desc: isUrdu ? "مائیک پر ٹیپ کریں اور بولیں" : "Tap the mic and speak naturally",
    },
    {
      icon: <Languages className="w-6 h-6" />,
      title: isUrdu ? "اردو + انگریزی" : "Urdu + English",
      desc: isUrdu ? "دونوں زبانوں میں بولیں" : "Speak in either language",
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: isUrdu ? "ذہین جوابات" : "Smart Answers",
      desc: isUrdu ? "ویزا پراسیس کے بارے میں AI جوابات" : "AI-powered visa process answers",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: isUrdu ? "ٹائپ بھی کریں" : "Type Too",
      desc: isUrdu ? "آواز نہ ہو تو ٹائپ کریں" : "Keyboard fallback if no mic",
    },
  ];

  const voiceExamples = [
    { q: "Check my status", qUrdu: "میری حیثیت چیک کریں" },
    { q: "What documents do I need?", qUrdu: "کون سی دستاویزات چاہیے؟" },
    { q: "How to pay?", qUrdu: "ادائیگی کیسے کریں؟" },
    { q: "Medical process", qUrdu: "میڈیکل کا عمل" },
    { q: "Contact my agent", qUrdu: "ایجنٹ سے رابطہ" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {/* Mobile Header — hidden when inside unified layout */}
      {!insideUnifiedLayout && (
      <div className={`fixed top-0 left-0 right-0 z-30 lg:hidden ${
        dc ? "bg-gray-900/95 border-gray-800" : "bg-white/95 border-gray-200"
      } border-b backdrop-blur-md`}>
        <div className="flex items-center justify-between px-3 h-14">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMobileMenu(true)} className={`p-2 rounded-lg ${dc ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <Mic className={`w-5 h-5 ${dc ? "text-emerald-400" : "text-emerald-600"}`} />
              <span className={`text-sm font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell role="customer" />
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"}`}>
              {dc ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      )}

      <main className={`${insideUnifiedLayout ? "pt-2 lg:pt-4" : "pt-14 lg:pt-6"} p-3 sm:p-4 md:p-6 max-w-4xl mx-auto ${insideUnifiedLayout ? "pb-4" : "pb-24 lg:pb-6"}`}>
        {/* Back button (desktop) */}
        <div className="hidden lg:block mb-4">
          <button
            onClick={() => navigate("/customer")}
            className={`flex items-center gap-2 text-sm ${dc ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" />
            {isUrdu ? "ڈیش بورڈ پر واپس" : "Back to Dashboard"}
          </button>
        </div>

        {/* Hero Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className={`text-2xl sm:text-3xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant"}
              </h1>
              <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-600"}`}>
                {isUrdu ? "آواز سے ویزا سفر کے بارے میں پوچھیں" : "Ask about your visa journey by voice"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 rounded-xl border transition-all ${
                dc ? "bg-gray-900 border-gray-800 hover:border-purple-500/50" : "bg-white border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="mb-2 text-purple-500">{feature.icon}</div>
              <h3 className={`font-semibold text-sm mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                {feature.title}
              </h3>
              <p className={`text-xs ${dc ? "text-gray-400" : "text-gray-600"}`}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Voice Examples */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`p-5 rounded-xl border mb-8 ${
            dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Mic className={`w-5 h-5 ${dc ? "text-purple-400" : "text-purple-600"}`} />
            <h2 className={`text-lg font-bold ${dc ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "یہ بولیں یا ٹائپ کریں" : "Say or Type These"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {voiceExamples.map((item, idx) => (
              <span
                key={idx}
                className={`px-3 py-2 rounded-lg text-sm font-medium cursor-default ${
                  dc
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}
              >
                🎤 {isUrdu ? item.qUrdu : item.q}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`p-5 rounded-xl border ${
            dc
              ? "bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/20"
              : "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200"
          }`}
        >
          <h3 className={`font-bold mb-3 ${dc ? "text-purple-400" : "text-purple-900"}`}>
            {isUrdu ? "کیسے استعمال کریں:" : "How to Use:"}
          </h3>
          <ul className={`space-y-2 text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">1.</span>
              <span>{isUrdu ? "نیچے دائیں جانب مائیک بٹن (🎤) پر کلک کریں" : "Click the mic button (🎤) at the bottom right"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">2.</span>
              <span>{isUrdu ? "اردو یا انگریزی میں بولیں" : "Speak in Urdu or English"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">3.</span>
              <span>{isUrdu ? "AI آپ کا سوال سن کر بول کر جواب دے گا" : "AI will listen and speak the answer back"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">4.</span>
              <span>{isUrdu ? "مائیک نہ ہو تو کی بورڈ آئیکن سے ٹائپ کریں" : "No mic? Use keyboard icon to type instead"}</span>
            </li>
          </ul>
        </motion.div>
      </main>

      {/* Voice Assistant */}
      <RoleBasedVoiceAssistant role="customer" />

      {/* Bottom Nav & Mobile Menu */}
      <MobileBottomNav role="customer" />
      <CustomerMobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
    </div>
  );
}