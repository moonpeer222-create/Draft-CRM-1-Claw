import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { RoleBasedVoiceAssistant } from "../../components/visaverse/RoleBasedVoiceAssistant";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { Mic, Volume2, Sparkles, Zap, Brain, Languages } from "lucide-react";
import { motion } from "motion/react";

export function AdminVoiceAssistant() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();

  const features = [
    {
      icon: <Volume2 className="w-6 h-6" />,
      title: isUrdu ? "آواز سے کنٹرول" : "Voice Control",
      titleUrdu: "آواز سے کنٹرول",
      desc: isUrdu ? "ہاتھ استعمال کیے بغیر CRM چلائیں" : "Operate CRM hands-free",
      descUrdu: "ہاتھ استعمال کیے بغیر CRM چلائیں"
    },
    {
      icon: <Languages className="w-6 h-6" />,
      title: isUrdu ? "اردو پہچان" : "Urdu Recognition",
      titleUrdu: "اردو پہچان",
      desc: isUrdu ? "اردو میں بولیں، اردو میں جواب پائیں" : "Speak in Urdu, get responses in Urdu",
      descUrdu: "اردو میں بولیں، اردو میں جواب پائیں"
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: isUrdu ? "سمارٹ تفہیم" : "Smart Understanding",
      titleUrdu: "سمارٹ تفہیم",
      desc: isUrdu ? "قدرتی زبان میں احکامات سمجھتا ہے" : "Understands natural language commands",
      descUrdu: "قدرتی زبان میں احکامات سمجھتا ہے"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: isUrdu ? "فوری جواب" : "Instant Response",
      titleUrdu: "فوری جواب",
      desc: isUrdu ? "حقیقی وقت آواز کا جواب" : "Real-time voice feedback",
      descUrdu: "حقیقی وقت آواز کا جواب"
    },
  ];

  const voiceCommands = [
    { cmd: "Show team overview", cmdUrdu: "ٹیم کا جائزہ دکھائیں", result: isUrdu ? "ٹیم کی تفصیلات" : "Team details" },
    { cmd: "System statistics", cmdUrdu: "سسٹم کے اعداد و شمار", result: isUrdu ? "CRM اعداد و شمار" : "CRM stats" },
    { cmd: "Pending approvals", cmdUrdu: "زیر التواء منظوریاں", result: isUrdu ? "منظوری کی فہرست" : "Approval list" },
    { cmd: "Financial summary", cmdUrdu: "مالیاتی خلاصہ", result: isUrdu ? "مالیاتی رپورٹ" : "Financial report" },
    { cmd: "Agent performance", cmdUrdu: "ایجنٹ کی کارکردگی", result: isUrdu ? "کارکردگی کا جائزہ" : "Performance overview" },
  ];

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${darkMode ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg`}>
                <Mic className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant"}
                </h1>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {isUrdu ? "ہاتھ استعمال کیے بغیر اردو/انگریزی میں CRM چلائیں" : "Hands-free Urdu/English CRM Control"}
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
                    ? "bg-gray-900 border-gray-800 hover:border-blue-500/50"
                    : "bg-white border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className={`mb-3 text-blue-500`}>
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

          {/* Voice Commands Table */}
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
              <Mic className={`w-5 h-5 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
              <h2 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "آواز کے احکامات" : "Voice Commands"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {isUrdu ? "حکم (انگریزی)" : "Command (English)"}
                    </th>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {isUrdu ? "حکم (اردو)" : "Command (Urdu)"}
                    </th>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {isUrdu ? "نتیجہ" : "Result"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {voiceCommands.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`border-b ${darkMode ? "border-gray-800/50" : "border-gray-100"}`}
                    >
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        "{item.cmd}"
                      </td>
                      <td className={`py-3 px-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"} ${fontClass}`}>
                        "{item.cmdUrdu}"
                      </td>
                      <td className={`py-3 px-4`}>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                        }`}>
                          {item.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-6 rounded-xl border ${
              darkMode
                ? "bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-500/20"
                : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
            }`}
          >
            <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? "text-blue-400" : "text-blue-900"}`}>
              <Volume2 className="w-5 h-5" />
              {isUrdu ? "کیسے استعمال کریں:" : "How to Use:"}
            </h3>
            <ul className={`space-y-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">1.</span>
                <span>{isUrdu ? "نیچے دائیں جانب مائیک بٹن پر کلک کریں" : "Click the mic button at the bottom right"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">2.</span>
                <span>{isUrdu ? "مائیک کے ساتھ بولیں - اردو یا انگریزی" : "Speak into the mic - Urdu or English"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">3.</span>
                <span>{isUrdu ? "AI آپ کی آواز کو پہچان لے گا اور عمل کرے گا" : "AI will recognize and process your voice"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">4.</span>
                <span>{isUrdu ? "آپ کی زبان میں فوری جواب سنیں" : "Hear instant response in your language"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">💡</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{isUrdu ? "تجویز: واضح طور پر بولیں اور شور سے بچیں" : "Tip: Speak clearly and avoid background noise"}</span>
              </li>
            </ul>
          </motion.div>
        </main>
      </div>

      {/* Voice Assistant Component */}
      <RoleBasedVoiceAssistant role="admin" />
    </div>
  );
}