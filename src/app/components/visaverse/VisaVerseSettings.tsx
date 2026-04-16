import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Gamepad2, Eye, EyeOff, BarChart3, Download, ToggleLeft, ToggleRight } from "lucide-react";
import { useVisaVerse, type VisaVerseFeatures } from "./VisaVerseContext";
import { toast } from "../../lib/toast";

interface VisaVerseSettingsProps {
  isUrdu?: boolean;
  darkMode?: boolean;
}

const FEATURE_CONFIG: { key: keyof VisaVerseFeatures; label: string; labelUrdu: string; icon: string; desc: string; descUrdu: string }[] = [
  { key: "aiPredictor", label: "AI Visa Predictor", labelUrdu: "AI ویزا پیشنگوئی", icon: "🎯", desc: "Show approval probability on cases", descUrdu: "کیسز پر منظوری کا امکان دکھائیں" },
  { key: "journeyMap", label: "Gamified Journey Map", labelUrdu: "گیمیفائیڈ جرنی میپ", icon: "🗺️", desc: "Interactive adventure map for stages", descUrdu: "مراحل کے لیے انٹرایکٹو میپ" },
  { key: "arScanner", label: "AR Document Scanner", labelUrdu: "AR دستاویز اسکینر", icon: "📱", desc: "Camera-based document scanning", descUrdu: "کیمرے سے دستاویز اسکین" },
  { key: "voiceAssistant", label: "Voice Assistant", labelUrdu: "وائس اسسٹنٹ", icon: "🎙️", desc: "Voice commands for agents", descUrdu: "ایجنٹس کے لیے وائس کمانڈز" },
  { key: "emojiTracker", label: "Emoji Mood Tracker", labelUrdu: "ایموجی موڈ ٹریکر", icon: "💬", desc: "Client satisfaction feedback", descUrdu: "کسٹمر اطمینان فیڈبیک" },
  { key: "trustTrail", label: "Trust Trail", labelUrdu: "ٹرسٹ ٹریل", icon: "🔗", desc: "Blockchain-style audit chain", descUrdu: "بلاکچین طرز کی آڈٹ چین" },
  { key: "videoGenerator", label: "AI Video Generator", labelUrdu: "AI ویڈیو جنریٹر", icon: "🎬", desc: "Personalized video updates", descUrdu: "ذاتی ویڈیو اپڈیٹس" },
  { key: "agentLeaderboard", label: "Agent Leaderboard", labelUrdu: "ایجنٹ لیڈربورڈ", icon: "🏆", desc: "Competitive rankings & badges", descUrdu: "مسابقتی درجہ بندی اور بیجز" },
  { key: "dynamicTheme", label: "Dynamic Themes", labelUrdu: "متحرک تھیمز", icon: "🌙", desc: "Case-based background effects", descUrdu: "کیس پر مبنی پس منظر اثرات" },
  { key: "chatbot", label: "Emerald Chatbot", labelUrdu: "ایمرلڈ چیٹ بوٹ", icon: "🤖", desc: "AI chatbot with personality", descUrdu: "شخصیت والا AI چیٹ بوٹ" },
];

export function VisaVerseSettings({ isUrdu = false, darkMode = false }: VisaVerseSettingsProps) {
  const { features, toggleFeature, classicMode, toggleClassicMode, xp, badges, satisfaction } = useVisaVerse();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const itemBg = dc ? "bg-gray-700/50" : "bg-gray-50";

  const handleExportAnalytics = () => {
    const data = {
      exportDate: new Date().toISOString(),
      features,
      classicMode,
      totalXP: xp,
      badgesEarned: badges,
      satisfactionResponses: satisfaction.length,
      avgSatisfaction: satisfaction.length > 0
        ? (satisfaction.reduce((a, b) => a + b, 0) / satisfaction.length).toFixed(2)
        : "N/A",
      featureAdoption: Object.entries(features).filter(([, v]) => v).length + "/" + Object.keys(features).length,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visaverse-analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isUrdu ? "تجزیات ایکسپورٹ ہو گئیں" : "Analytics exported!");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* VisaVerse Header */}
      <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">VisaVerse</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isUrdu ? "گیمیفیکیشن اور AI تجربہ" : "Gamification & AI Experience"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={`${itemBg} rounded-xl p-3 text-center`}>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{xp}</p>
            <p className="text-[10px] text-gray-500">Total XP</p>
          </div>
          <div className={`${itemBg} rounded-xl p-3 text-center`}>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{badges.length}</p>
            <p className="text-[10px] text-gray-500">{isUrdu ? "بیجز" : "Badges"}</p>
          </div>
          <div className={`${itemBg} rounded-xl p-3 text-center`}>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{satisfaction.length}</p>
            <p className="text-[10px] text-gray-500">{isUrdu ? "فیڈبیک" : "Feedback"}</p>
          </div>
        </div>

        {/* Classic Mode Toggle */}
        <button
          onClick={toggleClassicMode}
          className={`w-full flex items-center justify-between p-3 rounded-xl min-h-[52px] transition-all
            ${classicMode
              ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40"
              : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40"
            }`}
        >
          <div className="flex items-center gap-2">
            {classicMode ? <EyeOff className="w-5 h-5 text-amber-600 dark:text-amber-400" /> : <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {isUrdu ? "کلاسک موڈ" : "Classic Mode"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {classicMode
                  ? (isUrdu ? "تمام گیمیفیکیشن غیر فعال" : "All gamification disabled")
                  : (isUrdu ? "گیمیفیکیشن فعال ہے" : "Gamification active")}
              </p>
            </div>
          </div>
          {classicMode
            ? <ToggleLeft className="w-8 h-8 text-amber-500" />
            : <ToggleRight className="w-8 h-8 text-emerald-500" />
          }
        </button>
      </div>

      {/* Feature Toggles */}
      {!classicMode && (
        <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            {isUrdu ? "فیچر کنٹرولز" : "Feature Controls"}
          </h4>

          <div className="space-y-2">
            {FEATURE_CONFIG.map((feat, idx) => (
              <motion.button
                key={feat.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => toggleFeature(feat.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl min-h-[52px] transition-all
                  ${features[feat.key]
                    ? `${itemBg} border border-emerald-200/30 dark:border-emerald-700/20`
                    : `${itemBg} opacity-60 border border-transparent`
                  }`}
              >
                <span className="text-xl shrink-0">{feat.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {isUrdu ? feat.labelUrdu : feat.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {isUrdu ? feat.descUrdu : feat.desc}
                  </p>
                </div>
                <div className="shrink-0">
                  {features[feat.key]
                    ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                    : <ToggleLeft className="w-7 h-7 text-gray-400" />
                  }
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Export Analytics */}
      <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
        <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          {isUrdu ? "تجزیات" : "Analytics"}
        </h4>
        <button
          onClick={handleExportAnalytics}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
            bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium min-h-[48px]
            active:from-emerald-600 active:to-teal-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {isUrdu ? "گیمیفیکیشن تجزیات ایکسپورٹ" : "Export Gamification Analytics"}
        </button>
      </div>
    </div>
  );
}
