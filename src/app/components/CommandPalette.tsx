// Command Palette — Ctrl+K / Cmd+K to open, search anything
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, ArrowRight, LayoutDashboard, Briefcase, DollarSign,
  Users, BarChart3, Clock, Settings, FileText, Brain, Award,
  Calendar, Shield, UserCircle, Monitor, Mic, Keyboard,
  Moon, Sun, Globe, LogOut,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { CRMDataStore } from "../lib/mockData";
import { UserDB } from "../lib/userDatabase";

interface CommandItem {
  id: string;
  label: string;
  labelUr: string;
  icon: any;
  action: () => void;
  category: string;
  categoryUr: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  role: "admin" | "agent" | "customer" | "operator" | "master";
}

export function CommandPalette({ role }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { darkMode, isUrdu, toggleDarkMode, toggleLanguage } = useTheme();
  const dc = darkMode;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list based on role
  const commands: CommandItem[] = useMemo(() => {
    const nav = (path: string) => () => { navigate(path); setIsOpen(false); };
    const items: CommandItem[] = [];

    // Global actions
    items.push(
      { id: "dark-mode", label: darkMode ? "Light Mode" : "Dark Mode", labelUr: darkMode ? "لائٹ موڈ" : "ڈارک موڈ", icon: darkMode ? Sun : Moon, action: () => { toggleDarkMode(); setIsOpen(false); }, category: "Settings", categoryUr: "ترتیبات", keywords: ["theme", "dark", "light"] },
      { id: "language", label: isUrdu ? "Switch to English" : "اردو میں بدلیں", labelUr: isUrdu ? "انگلش میں بدلیں" : "اردو میں بدلیں", icon: Globe, action: () => { toggleLanguage(); setIsOpen(false); }, category: "Settings", categoryUr: "ترتیبات", keywords: ["language", "urdu", "english", "زبان"] },
      { id: "shortcuts", label: "Keyboard Shortcuts", labelUr: "کی بورڈ شارٹ کٹس", icon: Keyboard, action: () => { setIsOpen(false); document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })); }, category: "Help", categoryUr: "مدد", keywords: ["shortcut", "keys", "help"] },
    );

    if (role === "admin") {
      items.push(
        { id: "admin-dash", label: "Dashboard", labelUr: "ڈیش بورڈ", icon: LayoutDashboard, action: nav("/admin"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["home", "main"] },
        { id: "admin-cases", label: "Case Management", labelUr: "کیس مینجمنٹ", icon: Briefcase, action: nav("/admin/cases"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["cases", "folder"] },
        { id: "admin-fin", label: "Financials", labelUr: "مالیات", icon: DollarSign, action: nav("/admin/financials"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["money", "payment", "finance"] },
        { id: "admin-team", label: "Team Management", labelUr: "ٹیم مینجمنٹ", icon: Users, action: nav("/admin/team"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["agents", "staff"] },
        { id: "admin-reports", label: "Reports", labelUr: "رپورٹیں", icon: BarChart3, action: nav("/admin/reports"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["analytics", "data"] },
        { id: "admin-attendance", label: "Attendance", labelUr: "حاضری", icon: Clock, action: nav("/admin/attendance"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["present", "absent"] },
        { id: "admin-docs", label: "Documents", labelUr: "دستاویزات", icon: FileText, action: nav("/admin/documents"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["files", "upload"] },
        { id: "admin-analytics", label: "Analytics", labelUr: "تجزیات", icon: BarChart3, action: nav("/admin/analytics"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["charts", "graphs"] },
        { id: "admin-leaderboard", label: "Leaderboard", labelUr: "لیڈر بورڈ", icon: Award, action: nav("/admin/leaderboard"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["ranking", "top"] },
        { id: "admin-passport", label: "Passport Tracker", labelUr: "پاسپورٹ ٹریکر", icon: Shield, action: nav("/admin/passport-tracker"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["passport", "location"] },
        { id: "admin-audit", label: "Audit Log", labelUr: "آڈٹ لاگ", icon: FileText, action: nav("/admin/audit-log"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["history", "log"] },
        { id: "admin-settings", label: "Settings", labelUr: "ترتیبات", icon: Settings, action: nav("/admin/settings"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["config", "preferences"] },
        { id: "admin-profile", label: "Profile", labelUr: "پروفائل", icon: UserCircle, action: nav("/admin/profile"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "admin-ai", label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", icon: Brain, action: nav("/admin/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["gemini", "arcee", "chat", "bot", "ai"] },
        { id: "admin-voice", label: "Voice Assistant", labelUr: "وائس اسسٹنٹ", icon: Mic, action: nav("/admin/voice-assistant"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["speak", "voice"] },
        { id: "admin-ops", label: "Operations Center", labelUr: "آپریشنز سینٹر", icon: Monitor, action: nav("/admin/operations"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["operator"] },
      );
    }

    if (role === "agent") {
      items.push(
        { id: "agent-dash", label: "Dashboard", labelUr: "ڈیش بورڈ", icon: LayoutDashboard, action: nav("/agent"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "agent-cases", label: "My Cases", labelUr: "میرے کیسز", icon: Briefcase, action: nav("/agent/cases"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["folder", "case"] },
        { id: "agent-calendar", label: "Calendar", labelUr: "کیلنڈر", icon: Calendar, action: nav("/agent/calendar"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["date", "schedule"] },
        { id: "agent-perf", label: "Performance", labelUr: "کارکردگی", icon: BarChart3, action: nav("/agent/performance"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["stats", "metrics"] },
        { id: "agent-attendance", label: "Attendance", labelUr: "حاضری", icon: Clock, action: nav("/agent/attendance"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "agent-profile", label: "Profile", labelUr: "پروفائل", icon: UserCircle, action: nav("/agent/profile"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "agent-ai", label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", icon: Brain, action: nav("/agent/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      );
    }

    if (role === "customer") {
      items.push(
        { id: "cust-dash", label: "Dashboard", labelUr: "ڈیش بورڈ", icon: LayoutDashboard, action: nav("/customer"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "cust-docs", label: "Documents", labelUr: "دستاویزات", icon: FileText, action: nav("/customer/documents"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "cust-pay", label: "Payments", labelUr: "ادائیگی", icon: DollarSign, action: nav("/customer/payments"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "cust-ai", label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", icon: Brain, action: nav("/customer/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      );
    }

    if (role === "master") {
      items.push(
        { id: "master-dash", label: "Dashboard", labelUr: "ڈیش بورڈ", icon: LayoutDashboard, action: nav("/master"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["home", "main"] },
        { id: "master-cases", label: "Case Management", labelUr: "کیس مینجمنٹ", icon: Briefcase, action: nav("/master/cases"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["cases", "folder"] },
        { id: "master-fin", label: "Financials", labelUr: "مالیات", icon: DollarSign, action: nav("/master/financials"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["money", "payment", "finance"] },
        { id: "master-team", label: "Team Management", labelUr: "ٹیم مینجمنٹ", icon: Users, action: nav("/master/team"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["agents", "staff"] },
        { id: "master-reports", label: "Reports", labelUr: "رپورٹیں", icon: BarChart3, action: nav("/master/reports"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["analytics", "data"] },
        { id: "master-attendance", label: "Attendance", labelUr: "حاضری", icon: Clock, action: nav("/master/attendance"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["present", "absent"] },
        { id: "master-docs", label: "Documents", labelUr: "دستاویزات", icon: FileText, action: nav("/master/documents"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["files", "upload"] },
        { id: "master-analytics", label: "Analytics", labelUr: "تجزیات", icon: BarChart3, action: nav("/master/analytics"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["charts", "graphs"] },
        { id: "master-leaderboard", label: "Leaderboard", labelUr: "لیڈر بورڈ", icon: Award, action: nav("/master/leaderboard"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["ranking", "top"] },
        { id: "master-passport", label: "Passport Tracker", labelUr: "پاسپورٹ ٹریکر", icon: Shield, action: nav("/master/passport-tracker"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["passport", "location"] },
        { id: "master-audit", label: "Audit Log", labelUr: "آڈٹ لاگ", icon: FileText, action: nav("/master/audit-log"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["history", "log"] },
        { id: "master-settings", label: "Settings", labelUr: "ترتیبات", icon: Settings, action: nav("/master/settings"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["config", "preferences"] },
        { id: "master-profile", label: "Profile", labelUr: "پروفائل", icon: UserCircle, action: nav("/master/profile"), category: "Navigation", categoryUr: "نیویگیشن" },
        { id: "master-ops", label: "Operations Center", labelUr: "آپریشنز سینٹر", icon: Monitor, action: nav("/master/operations"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["operator"] },
        { id: "master-ai", label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", icon: Brain, action: nav("/master/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["gemini", "arcee", "chat", "bot", "ai"] },
        { id: "master-voice", label: "Voice Assistant", labelUr: "وائس اسسٹنٹ", icon: Mic, action: nav("/master/voice-assistant"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["speak", "voice"] },
        { id: "master-tools", label: "AI Tools", labelUr: "اے آئی ٹولز", icon: Brain, action: nav("/master/ai-tools"), category: "AI Tools", categoryUr: "اے آئی ٹولز" },
      );
    }

    if (role === "operator") {
      items.push(
        { id: "op-dash", label: "Operations", labelUr: "آپریشنز", icon: Monitor, action: nav("/operator"), category: "Navigation", categoryUr: "نیویگیشن", keywords: ["home", "main"] },
        { id: "op-ai", label: "AI Chatbot", labelUr: "اے آئی چیٹ بوٹ", icon: Brain, action: nav("/operator/ai-chatbot"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["chat", "bot", "ai"] },
        { id: "op-voice", label: "Voice Assistant", labelUr: "وائس اسسٹنٹ", icon: Mic, action: nav("/operator/voice-assistant"), category: "AI Tools", categoryUr: "اے آئی ٹولز", keywords: ["speak", "voice"] },
      );
    }

    // Dynamic case search items
    const cases = CRMDataStore.getCases();
    cases.forEach(c => {
      items.push({
        id: `case-${c.id}`,
        label: `${c.id} — ${c.customerName}`,
        labelUr: `${c.id} — ${c.customerName}`,
        icon: Briefcase,
        action: () => {
          const basePath = role === "agent" ? "/agent/cases" : role === "customer" ? "/customer" : role === "master" ? "/master/cases" : "/admin/cases";
          navigate(`${basePath}/${c.id}`);
          setIsOpen(false);
        },
        category: "Cases",
        categoryUr: "کیسز",
        keywords: [(c.customerName || "").toLowerCase(), (c.id || "").toLowerCase(), (c.agentName || "").toLowerCase(), (c.destination || "").toLowerCase()],
      });
    });

    return items;
  }, [role, darkMode, isUrdu, navigate]);

  // Filter commands based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 15);
    const q = query.toLowerCase();
    return commands.filter(cmd => {
      const searchable = [
        cmd.label.toLowerCase(),
        cmd.labelUr,
        ...(cmd.keywords || []),
        cmd.category.toLowerCase(),
      ].join(" ");
      return searchable.includes(q);
    }).slice(0, 15);
  }, [commands, query]);

  // Group filtered items by category
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
      const cat = isUrdu ? item.categoryUr : item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [filtered, isUrdu]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  // Global Ctrl+K / Cmd+K handler
  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setQuery("");
      setSelectedIdx(0);
    }
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [handleGlobalKey]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].action();
    }
  };

  let flatIdx = -1;

  // Detect mobile for layout adjustments (reactive to resize)
  const [isMobileView, setIsMobileView] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 640);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`fixed inset-0 z-[10001] flex ${
            isMobileView
              ? "flex-col"
              : "items-start justify-center pt-[15vh]"
          } bg-black/50 backdrop-blur-md p-0 sm:p-4`}
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={isMobileView ? { y: "100%" } : { scale: 0.96, y: -8, opacity: 0 }}
            animate={isMobileView ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
            exit={isMobileView ? { y: "100%" } : { scale: 0.96, y: -8, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: isMobileView ? 300 : 500 }}
            onClick={e => e.stopPropagation()}
            className={`overflow-hidden ${
              isMobileView
                ? `w-full flex-1 mt-auto rounded-t-2xl ${dc ? "bg-gray-950" : "bg-white"}`
                : `w-full max-w-lg rounded-2xl shadow-2xl border ${dc ? "bg-gray-900 border-white/10" : "bg-white border-gray-200/80"}`
            }`}
            style={isMobileView ? { maxHeight: "90dvh" } : undefined}
          >
            {/* Mobile handle bar */}
            {isMobileView && (
              <div className="flex justify-center py-2">
                <div className={`w-10 h-1 rounded-full ${dc ? "bg-white/20" : "bg-gray-300"}`} />
              </div>
            )}

            {/* Search Input */}
            <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${dc ? "border-white/[0.06]" : "border-gray-100"}`}>
              <Search className={`w-5 h-5 flex-shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isUrdu ? "تلاش کریں یا کہیں جائیں..." : "Search or jump to..."}
                className={`flex-1 bg-transparent text-base sm:text-[15px] outline-none ${dc ? "text-white placeholder-gray-600" : "text-gray-900 placeholder-gray-400"}`}
              />
              {isMobileView ? (
                <button
                  onClick={() => setIsOpen(false)}
                  className={`text-sm font-medium px-2 py-1 rounded-lg ${dc ? "text-emerald-400 active:bg-white/5" : "text-emerald-600 active:bg-gray-50"}`}
                >
                  {isUrdu ? "بند" : "Cancel"}
                </button>
              ) : (
                <kbd className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono ${
                  dc ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400"
                }`}>
                  ESC
                </kbd>
              )}
            </div>

            {/* Results */}
            <div ref={listRef} className={`overflow-y-auto py-1.5 overscroll-contain ${isMobileView ? "flex-1" : "max-h-[50vh]"}`}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filtered.length === 0 ? (
                <div className={`px-4 py-10 text-center ${dc ? "text-gray-600" : "text-gray-400"}`}>
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">{isUrdu ? "کوئی نتیجہ نہیں ملا" : "No results found"}</p>
                  <p className="text-xs mt-1 opacity-60">{isUrdu ? "دوسرے الفاظ آزمائیں" : "Try different keywords"}</p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <div className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${dc ? "text-gray-600" : "text-gray-400"}`}>
                      {category}
                    </div>
                    {items.map(item => {
                      flatIdx++;
                      const idx = flatIdx;
                      const Icon = item.icon;
                      const isSelected = idx === selectedIdx;
                      return (
                        <button
                          key={item.id}
                          data-idx={idx}
                          onClick={item.action}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-all duration-100 select-none touch-manipulation ${
                            isSelected
                              ? dc ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                              : dc ? "text-gray-300 hover:bg-white/[0.03] active:bg-white/5" : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                          <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? dc ? "bg-emerald-500/15" : "bg-emerald-100"
                              : dc ? "bg-white/5" : "bg-gray-50"
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="flex-1 text-[14px] sm:text-[13px] font-medium truncate">
                            {isUrdu ? item.labelUr : item.label}
                          </span>
                          {isSelected && !isMobileView && <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-60" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer — hidden on mobile to save space */}
            {!isMobileView && (
              <div className={`flex items-center justify-between px-4 py-2.5 border-t text-[10px] font-medium ${
                dc ? "border-white/[0.06] text-gray-600" : "border-gray-100 text-gray-400"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className={`px-1.5 py-0.5 rounded ${dc ? "bg-white/5" : "bg-gray-100"}`}>↑↓</kbd>
                    {isUrdu ? "منتخب کریں" : "Navigate"}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className={`px-1.5 py-0.5 rounded ${dc ? "bg-white/5" : "bg-gray-100"}`}>↵</kbd>
                    {isUrdu ? "کھولیں" : "Open"}
                  </span>
                </div>
                <span>
                  {filtered.length} {isUrdu ? "نتائج" : "results"}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}