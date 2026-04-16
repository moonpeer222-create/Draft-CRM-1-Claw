import { useNavigate } from "react-router";
import { useTheme } from "../../lib/ThemeContext";
import { RoleBasedChatbot } from "../../components/visaverse/RoleBasedChatbot";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { CustomerMobileMenu } from "../../components/CustomerMobileMenu";
import { NotificationBell } from "../../components/NotificationPanel";
import { motion } from "motion/react";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import {
  Bot, MessageCircle, Sparkles, FileText, DollarSign,
  Globe, ArrowLeft, Shield, Menu, Moon, Sun, LogOut,
} from "lucide-react";
import { useState } from "react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function CustomerAIChatbot() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, isUrdu, fontClass } = useTheme();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dc = darkMode;
  const { profile } = useSupabaseAuth();

  const features = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: isUrdu ? "کیس سٹیٹس" : "Case Status",
      desc: isUrdu ? "اپنے ویزا کیس کی حیثیت فوری جانیں" : "Instantly check your visa case progress",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: isUrdu ? "دستاویزات گائیڈ" : "Documents Guide",
      desc: isUrdu ? "کون سی دستاویزات درکار ہیں جانیں" : "Learn what documents you need",
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: isUrdu ? "ادائیگی معلومات" : "Payment Info",
      desc: isUrdu ? "فیس، طریقے اور ادائیگی کی حیثیت" : "Fees, methods & payment status",
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: isUrdu ? "اردو + انگریزی" : "Urdu + English",
      desc: isUrdu ? "دونوں زبانوں میں بات کریں" : "Chat in both languages fluently",
    },
  ];

  const sampleQuestions = [
    { q: "My visa status", qUrdu: "میرا ویزا سٹیٹس کیا ہے؟" },
    { q: "What documents needed?", qUrdu: "میڈیکل کے لیے کیا لے کر جاؤں؟" },
    { q: "Payment methods", qUrdu: "ادائیگی کیسے کروں؟" },
    { q: "Medical process", qUrdu: "میڈیکل کا طریقہ بتائیں" },
    { q: "Visa stages", qUrdu: "ویزا کے مراحل بتائیں" },
    { q: "Contact agent", qUrdu: "ایجنٹ سے بات کرنی ہے" },
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
              <Bot className={`w-5 h-5 ${dc ? "text-emerald-400" : "text-emerald-600"}`} />
              <span className={`text-sm font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "AI مدد" : "AI Help"}
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
              <Bot className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className={`text-2xl sm:text-3xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "AI چیٹ اسسٹنٹ" : "AI Chat Assistant"}
              </h1>
              <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-600"}`}>
                {isUrdu ? "ویزا سفر کے بارے میں اردو/انگریزی میں پوچھیں" : "Ask about your visa journey in Urdu or English"}
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

        {/* Sample Questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`p-5 rounded-xl border mb-8 ${
            dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className={`w-5 h-5 ${dc ? "text-purple-400" : "text-purple-600"}`} />
            <h2 className={`text-lg font-bold ${dc ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "نمونہ سوالات — ابھی پوچھیں!" : "Sample Questions - Try These!"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((item, idx) => (
              <span
                key={idx}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-default ${
                  dc
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
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
              <span>{isUrdu ? "نیچے بائیں جانب چیٹ بٹن (💬) پر کلک کریں" : "Click the chat button (💬) at the bottom left"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">2.</span>
              <span>{isUrdu ? "اردو یا انگریزی میں اپنا سوال ٹائپ کریں" : "Type your question in Urdu or English"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">3.</span>
              <span>{isUrdu ? "AI فوری طور پر جواب دے گا" : "AI will respond instantly with helpful info"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">4.</span>
              <span>{isUrdu ? "\"مزید بتاؤ\" بول کر تفصیل حاصل کریں" : "Say \"tell me more\" for deeper details"}</span>
            </li>
          </ul>
        </motion.div>
      </main>

      {/* Chatbot */}
      <RoleBasedChatbot role="customer" />

      {/* Bottom Nav & Mobile Menu */}
      <MobileBottomNav role="customer" />
      <CustomerMobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
    </div>
  );
}