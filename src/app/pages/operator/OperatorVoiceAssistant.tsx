import { OperatorSidebar } from "../../components/OperatorSidebar";
import { OperatorHeader } from "../../components/OperatorHeader";
import { RoleBasedVoiceAssistant } from "../../components/visaverse/RoleBasedVoiceAssistant";
import { useTheme } from "../../lib/ThemeContext";
import { Mic, Volume2, Sparkles, Brain, Languages } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function OperatorVoiceAssistant() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const navigate = useNavigate();
  const { insideUnifiedLayout } = useUnifiedLayout();

  const features = [
    {
      icon: <Volume2 className="w-6 h-6" />,
      title: isUrdu ? "آواز سے کنٹرول" : "Voice Control",
      desc: isUrdu ? "ہاتھ استعمال کیے بغیر CRM چلائیں" : "Operate CRM hands-free",
    },
    {
      icon: <Languages className="w-6 h-6" />,
      title: isUrdu ? "اردو پہچان" : "Urdu Recognition",
      desc: isUrdu ? "اردو میں بولیں، اردو میں جواب پائیں" : "Speak in Urdu, get responses in Urdu",
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: isUrdu ? "سمارٹ تفہیم" : "Smart Understanding",
      desc: isUrdu ? "قدرتی زبان میں احکامات سمجھتا ہے" : "Understands natural language commands",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: isUrdu ? "ڈیٹا انٹری" : "Data Entry",
      desc: isUrdu ? "آواز سے کیس بنائیں اور اپڈیٹ کریں" : "Create and update cases by voice",
    },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <OperatorSidebar activeTab="dashboard" onTabChange={() => navigate("/operator")} />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <OperatorHeader activeTab="dashboard" onTabChange={() => navigate("/operator")} />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 rounded-2xl overflow-hidden ${darkMode ? "bg-gradient-to-r from-teal-900/40 to-cyan-900/40 border border-teal-700/30" : "bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200"}`}
          >
            <div className="px-4 sm:px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${darkMode ? "bg-teal-500/20" : "bg-teal-100"}`}>
                  <Mic className={`w-6 h-6 ${darkMode ? "text-teal-400" : "text-teal-600"}`} />
                </div>
                <div>
                  <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {isUrdu ? "آپریٹر وائس اسسٹنٹ" : "Operator Voice Assistant"}
                  </h1>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {isUrdu ? "آواز سے CRM کنٹرول — بولیں اور کام ہو جائے" : "Voice-controlled CRM — speak and it's done"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {features.map((f, i) => (
                  <div key={i} className={`p-3 rounded-xl ${darkMode ? "bg-gray-800/50" : "bg-white/70"}`}>
                    <div className={`mb-2 ${darkMode ? "text-teal-400" : "text-teal-600"}`}>{f.icon}</div>
                    <p className={`text-xs font-semibold mb-0.5 ${darkMode ? "text-white" : "text-gray-900"}`}>{f.title}</p>
                    <p className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="rounded-2xl overflow-hidden shadow-lg">
            <RoleBasedVoiceAssistant role="operator" />
          </div>
        </main>
      </div>
    </div>
  );
}