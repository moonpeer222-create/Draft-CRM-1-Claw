import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { toast } from "../lib/toast";
import { UserDB } from "../lib/userDatabase";
import {
  Moon, Sun, Globe, User, LogOut, Menu, Monitor, Bell,
  HelpCircle, ChevronDown,
  BarChart3, FolderPlus, CheckCircle2, Calendar, Users, Clock,
  Building2, DollarSign, FileDown, FileText, Eye, UserCircle,
} from "lucide-react";
import { OperatorMobileMenu } from "./OperatorMobileMenu";
import type { OperatorTabId } from "./OperatorSidebar";

interface OperatorHeaderProps {
  activeTab: OperatorTabId;
  onTabChange: (tab: OperatorTabId) => void;
  bellButton?: React.ReactNode;
}

const TAB_META: Record<OperatorTabId, { icon: any; en: string; ur: string }> = {
  dashboard: { icon: BarChart3, en: "Dashboard", ur: "ڈیش بورڈ" },
  folders: { icon: FolderPlus, en: "Create Case", ur: "نیا کیس" },
  "all-cases": { icon: Eye, en: "All Cases", ur: "تمام کیسز" },
  documents: { icon: FileText, en: "Documents", ur: "دستاویزات" },
  status: { icon: CheckCircle2, en: "Status", ur: "صورتحال" },
  appointments: { icon: Calendar, en: "Appointments", ur: "ملاقاتیں" },
  "agent-support": { icon: Users, en: "Agent Help", ur: "ایجنٹ مدد" },
  attendance: { icon: Clock, en: "Attendance", ur: "حاضری" },
  visits: { icon: Building2, en: "Office Visits", ur: "آفس وزٹ" },
  payments: { icon: DollarSign, en: "Payments", ur: "ادائیگی" },
  reports: { icon: FileDown, en: "Reports", ur: "رپورٹیں" },
  profile: { icon: UserCircle, en: "Profile", ur: "پروفائل" },
};

export function OperatorHeader({ activeTab, onTabChange, bellButton }: OperatorHeaderProps) {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, toggleLanguage, isUrdu, fontClass } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const u = (en: string, ur: string) => (isUrdu ? ur : en);
  const session = UserDB.getOperatorSession();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (insideUnifiedLayout) return null;

  const handleLanguageToggle = () => {
    toggleLanguage();
    toast.info(`${u("Language changed to", "زبان تبدیل ہوئی")} ${language === "en" ? "اردو" : "English"}`);
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
    toast.info(!darkMode ? u("Dark mode enabled", "ڈارک موڈ آن") : u("Light mode enabled", "لائٹ موڈ آن"));
  };

  const handleLogout = () => {
    setShowProfile(false);
    UserDB.operatorLogout();
    toast.success(u("Logging out...", "لاگ آؤٹ ہو رہا ہے..."));
    setTimeout(() => navigate("/"), 1000);
  };

  return (
    <>
      <header
        className={`${isUrdu ? fontClass : ""} border-b px-3 sm:px-4 md:px-6 py-2 sm:py-3 fixed lg:sticky top-0 left-0 right-0 z-50 backdrop-blur-xl transition-colors duration-300 ${
          darkMode
            ? "bg-gradient-to-r from-gray-950 via-emerald-950/80 to-gray-950 border-emerald-800/40"
            : "bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 border-emerald-700/60"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between">
          {/* Left: Mobile Menu Toggle + Brand */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 lg:ml-0">
            <button
              onClick={() => setShowMobileMenu(true)}
              aria-label={u("Open menu", "مینو کھولیں")}
              className="lg:hidden p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            {/* Active Section Indicator */}
            <div className="hidden lg:flex items-center gap-2">
              {(() => {
                const meta = TAB_META[activeTab];
                const ActiveIcon = meta.icon;
                return (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                      <ActiveIcon className="w-4 h-4 text-emerald-300" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-50">
                      {u(meta.en, meta.ur)}
                    </span>
                  </>
                );
              })()}
            </div>
            {/* Mobile active section label */}
            <div className="lg:hidden flex items-center gap-1.5 min-w-0">
              {(() => {
                const meta = TAB_META[activeTab];
                const ActiveIcon = meta.icon;
                return (
                  <>
                    <ActiveIcon className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-100 truncate">
                      {u(meta.en, meta.ur)}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 mx-[0px] my-[5px]">
            {/* Notification Bell */}
            {bellButton}

            {/* Language Toggle */}
            <button
              onClick={handleLanguageToggle}
              aria-label={u("Toggle language", "زبان تبدیل کریں")}
              className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
            >
              <Globe className="w-5 h-5 text-emerald-100" />
            </button>

            {/* Dark Mode */}
            <button
              onClick={handleDarkModeToggle}
              aria-label={u("Toggle dark mode", "ڈارک موڈ تبدیل کریں")}
              className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-300" />
              ) : (
                <Moon className="w-5 h-5 text-emerald-100" />
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative hidden sm:block" ref={profileRef}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 p-1.5 rounded-xl transition-colors hover:bg-white/10 active:opacity-80"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-emerald-200/70 transition-transform ${showProfile ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`absolute ${isUrdu ? "left-0" : "right-0"} mt-2 w-56 rounded-2xl shadow-2xl border overflow-hidden z-50 ${
                      darkMode
                        ? "bg-gray-900 border-emerald-700/30"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    {/* Profile Info */}
                    <div className={`px-4 py-3 border-b ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
                      <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {session?.fullName || "Operator"}
                      </p>
                      <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {u("Computer Operator", "کمپیوٹر آپریٹر")}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setShowProfile(false);
                          toast.info(u("Contact support: +92 318 6986259", "سپورٹ سے رابطہ کریں: +92 318 6986259"));
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                          darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                        {u("Help & Support", "مدد اور سپورٹ")}
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                      >
                        <LogOut className="w-4 h-4" />
                        {u("Logout", "لاگ آؤٹ")}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <OperatorMobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          onTabChange(tab);
          setShowMobileMenu(false);
        }}
      />
    </>
  );
}