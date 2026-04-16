// Global Keyboard Shortcuts with Help Modal
// Press ? to show shortcuts, Escape to close
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Keyboard, X, Command, ArrowRight } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

interface ShortcutDef {
  keys: string[];
  label: string;
  labelUr: string;
  action?: () => void;
  category: string;
  categoryUr: string;
}

interface KeyboardShortcutsProps {
  role: "admin" | "agent" | "customer" | "operator" | "master";
}

export function KeyboardShortcuts({ role }: KeyboardShortcutsProps) {
  const navigate = useNavigate();
  const { darkMode, isUrdu, toggleDarkMode, toggleLanguage } = useTheme();
  const dc = darkMode;
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: ShortcutDef[] = (() => {
    const global: ShortcutDef[] = [
      { keys: ["?"], label: "Show keyboard shortcuts", labelUr: "شارٹ کٹ دکھائیں", category: "General", categoryUr: "عمومی" },
      { keys: ["Esc"], label: "Close modal / Go back", labelUr: "بند کریں / واپس جائیں", category: "General", categoryUr: "عمومی" },
      { keys: ["Alt", "D"], label: "Toggle dark mode", labelUr: "ڈارک موڈ بدلیں", action: toggleDarkMode, category: "General", categoryUr: "عمومی" },
      { keys: ["Alt", "L"], label: "Toggle language", labelUr: "زبان بدلیں", action: toggleLanguage, category: "General", categoryUr: "عمومی" },
      { keys: ["Alt", "H"], label: "Go to dashboard", labelUr: "ڈیش بورڈ پر جائیں", action: () => navigate(`/${role}`), category: "Navigation", categoryUr: "نیویگیشن" },
    ];

    if (role === "admin") {
      return [
        ...global,
        { keys: ["Alt", "C"], label: "Cases", labelUr: "کیسز", action: () => navigate("/admin/cases"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "F"], label: "Financials", labelUr: "مالیات", action: () => navigate("/admin/financials"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "T"], label: "Team", labelUr: "ٹیم", action: () => navigate("/admin/team"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "R"], label: "Reports", labelUr: "رپورٹیں", action: () => navigate("/admin/reports"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "A"], label: "Analytics", labelUr: "تجزیات", action: () => navigate("/admin/analytics"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "P"], label: "Profile", labelUr: "پروفائل", action: () => navigate("/admin/profile"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "I"], label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", action: () => navigate("/admin/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      ];
    }
    if (role === "agent") {
      return [
        ...global,
        { keys: ["Alt", "C"], label: "My Cases", labelUr: "میرے کیسز", action: () => navigate("/agent/cases"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "K"], label: "Calendar", labelUr: "کیلنڈر", action: () => navigate("/agent/calendar"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "P"], label: "Performance", labelUr: "کارکردگی", action: () => navigate("/agent/performance"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "A"], label: "Attendance", labelUr: "حاضری", action: () => navigate("/agent/attendance"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "I"], label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", action: () => navigate("/agent/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      ];
    }
    if (role === "customer") {
      return [
        ...global,
        { keys: ["Alt", "O"], label: "Documents", labelUr: "دستاویزات", action: () => navigate("/customer/documents"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "Y"], label: "Payments", labelUr: "ادائیگی", action: () => navigate("/customer/payments"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "I"], label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", action: () => navigate("/customer/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      ];
    }
    if (role === "master") {
      return [
        ...global,
        { keys: ["Alt", "C"], label: "Cases", labelUr: "کیسز", action: () => navigate("/master/cases"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "F"], label: "Financials", labelUr: "مالیات", action: () => navigate("/master/financials"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "T"], label: "Team", labelUr: "ٹیم", action: () => navigate("/master/team"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "R"], label: "Reports", labelUr: "رپورٹیں", action: () => navigate("/master/reports"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "A"], label: "Analytics", labelUr: "تجزیات", action: () => navigate("/master/analytics"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "P"], label: "Profile", labelUr: "پروفائل", action: () => navigate("/master/profile"), category: "Navigation", categoryUr: "نیویگیشن" },
        { keys: ["Alt", "I"], label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", action: () => navigate("/master/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      ];
    }
    // operator
    return [
      ...global,
      { keys: ["Alt", "O"], label: "Operations", labelUr: "آپریشنز", action: () => navigate("/operator/operations"), category: "Navigation", categoryUr: "نیویگیشن" },
      { keys: ["Alt", "I"], label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", action: () => navigate("/operator/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
    ];
  })();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't fire when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
      return;
    }

    // ? key to show help
    if (e.key === "?" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Escape to close
    if (e.key === "Escape" && showHelp) {
      setShowHelp(false);
      return;
    }

    // Alt + key shortcuts
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = e.key.toUpperCase();
      const match = shortcuts.find(s => s.keys.length === 2 && s.keys[0] === "Alt" && s.keys[1] === key);
      if (match?.action) {
        e.preventDefault();
        match.action();
        setShowHelp(false);
      }
    }
  }, [shortcuts, showHelp]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Group shortcuts by category
  const grouped = shortcuts.reduce<Record<string, ShortcutDef[]>>((acc, s) => {
    const cat = isUrdu ? s.categoryUr : s.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
          onClick={() => setShowHelp(false)}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className={`w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
              dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className={`w-10 h-1 rounded-full ${dc ? "bg-white/20" : "bg-gray-300"}`} />
            </div>

            {/* Header */}
            <div className={`flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${dc ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  <Keyboard className={`w-5 h-5 ${dc ? "text-blue-400" : "text-blue-600"}`} />
                </div>
                <div>
                  <h2 className={`text-base font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                    {isUrdu ? "کی بورڈ شارٹ کٹس" : "Keyboard Shortcuts"}
                  </h2>
                  <p className={`text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                    {isUrdu ? "تیز رسائی کے لیے" : "Quick access keys"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className={`p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${dc ? "hover:bg-gray-700 text-gray-400 active:bg-gray-600" : "hover:bg-gray-100 text-gray-500 active:bg-gray-200"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5" style={{ WebkitOverflowScrolling: "touch" }}>
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {items.map((s, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-2.5 sm:py-2 rounded-xl sm:rounded-lg min-h-[44px] sm:min-h-0 ${
                          dc ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? s.labelUr : s.label}
                        </span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((key, ki) => (
                            <span key={ki} className="flex items-center gap-1">
                              {ki > 0 && <span className={`text-[10px] ${dc ? "text-gray-600" : "text-gray-300"}`}>+</span>}
                              <kbd className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-mono font-medium border shadow-sm ${
                                dc
                                  ? "bg-gray-700 border-gray-600 text-gray-300"
                                  : "bg-gray-100 border-gray-200 text-gray-600"
                              }`}>
                                {key === "Alt" ? (
                                  <span className="flex items-center gap-0.5">
                                    {navigator.platform.includes("Mac") ? <Command className="w-3 h-3" /> : "Alt"}
                                  </span>
                                ) : key}
                              </kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t text-center ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <p className={`text-[10px] ${dc ? "text-gray-600" : "text-gray-400"}`}>
                {isUrdu ? "بند کرنے کے لیے ? یا Esc دبائیں" : "Press ? or Esc to close"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}