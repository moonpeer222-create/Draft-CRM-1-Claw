import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { NotificationBell } from "./NotificationPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { getPendingConflicts } from "../lib/syncService";
import {
  Moon, Sun, Globe, Shield, User, Settings, HelpCircle, LogOut,
  Briefcase, Users, UserCheck, Activity, CheckCircle, Clock, GitMerge, Menu
} from "lucide-react";
import { AdminMobileMenu } from "./AdminMobileMenu";
import { useUnifiedLayout } from "./UnifiedLayout";

export function AdminHeader() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStatsOrb, setShowStatsOrb] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Pending sync conflicts count
  const [pendingConflictCount, setPendingConflictCount] = useState(0);
  useEffect(() => {
    const count = getPendingConflicts().filter(c => !c.resolved).length;
    setPendingConflictCount(count);
    // Re-check every 15 seconds
    const iv = setInterval(() => {
      setPendingConflictCount(getPendingConflicts().filter(c => !c.resolved).length);
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  // Hidden keyboard shortcut (Ctrl+Shift+H) — must be above early return guard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "H") {
        e.preventDefault();
        setShowHiddenPanel((prev) => !prev);
        if (!showHiddenPanel) {
          toast.success("🔓 Hidden Admin Panel Activated", { duration: 2000 });
        }
      }
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [showHiddenPanel]);

  // Close dropdowns on outside click — must be above early return guard
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileRef.current &&
        !profileRef.current.contains(target) &&
        (!mobileProfileRef.current || !mobileProfileRef.current.contains(target))
      ) {
        setShowProfile(false);
      }
      if (statsRef.current && !statsRef.current.contains(target)) {
        setShowStatsOrb(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live stats from Supabase
  const [cases, setCases] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('cases').select('*').then(({ data }) => {
      setCases((data || []).map(mapSupabaseCaseToLocal));
    });
  }, []);

  // Early return for unified layout — AFTER all hooks
  if (insideUnifiedLayout) return null;
  const stats = {
    total: cases.length,
    agents: new Set(cases.map(c => c.agentId)).size,
    customers: new Set(cases.map(c => c.customerId)).size,
    completed: cases.filter(c => c.status === "stamped").length,
    pending: cases.filter(c => c.status !== "stamped" && c.status !== "rejected").length,
  };

  const handleLanguageToggle = () => {
    toggleLanguage();
    toast.info(`${t("lang.changed")} ${language === "en" ? "اردو" : "English"}`);
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
    toast.info(!darkMode ? t("darkEnabled") : t("lightEnabled"));
  };

  const handleProfile = () => {
    setShowProfile(false);
    navigate("/admin/profile");
  };

  const handleSettings = () => {
    setShowProfile(false);
    navigate("/admin/settings");
  };

  const handleHelp = () => {
    setShowProfile(false);
    toast.info(
      isUrdu
        ? "سپورٹ سے رابطہ کریں: +92 318 6986259"
        : "Contact support: +92 318 6986259"
    );
  };

  const handleLogout = () => {
    setShowProfile(false);
    toast.success(t("loggingOut"));
    setTimeout(() => navigate("/"), 1000);
  };

  return (
    <header
      className={`${isUrdu ? fontClass : ""} border-b px-3 sm:px-4 md:px-6 py-2 sm:py-3 fixed lg:sticky top-0 left-0 right-0 z-50 backdrop-blur-xl transition-colors duration-300 ${
        darkMode
          ? "bg-gradient-to-r from-gray-950 via-blue-950/80 to-gray-950 border-blue-800/40"
          : "bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 border-blue-700/60"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between">
        {/* Left: Mobile Menu Toggle + Brand */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 lg:ml-0">
          {/* Mobile Menu Hamburger — visible below lg */}
          <button
            onClick={() => setShowMobileMenu(true)}
            aria-label={isUrdu ? "مینو کھولیں" : "Open menu"}
            className="lg:hidden p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <p className="text-[10px] sm:text-xs text-blue-200/70 truncate hidden sm:block">
            {isUrdu ? "ایڈمن کنٹرول پینل" : "Admin Control Panel"}
          </p>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 mx-[0px] my-[5px]">
          {/* Cloud Sync Status */}
          <SyncStatusIndicator />

          {/* Pending Conflict Badge */}
          {pendingConflictCount > 0 && (
            <button
              onClick={() => navigate("/admin/sync-history")}
              aria-label={isUrdu ? `${pendingConflictCount} غیر حل شدہ تصادمات` : `${pendingConflictCount} unresolved conflicts`}
              className="relative p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
            >
              <GitMerge className="w-5 h-5 text-orange-400" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-lg px-1">
                {pendingConflictCount > 9 ? "9+" : pendingConflictCount}
              </span>
            </button>
          )}

          {/* Stats Orb Toggle - Desktop only */}
          <div className="relative hidden lg:block" ref={statsRef}>
            <button
              onClick={() => setShowStatsOrb(!showStatsOrb)}
              className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80"
            >
              <Activity className="w-5 h-5 text-blue-100" />
            </button>

            <AnimatePresence>
              {showStatsOrb && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`absolute right-0 mt-2 p-4 rounded-2xl shadow-2xl border min-w-[240px] z-50 ${
                    darkMode
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <h3
                    className={`text-xs font-bold mb-3 uppercase tracking-wider ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {isUrdu ? "سسٹم کا خلاصہ" : "System Summary"}
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        icon: Briefcase,
                        label: isUrdu ? "کل کیسز" : "Total Cases",
                        value: stats.total,
                        color: "text-blue-500",
                      },
                      {
                        icon: CheckCircle,
                        label: isUrdu ? "مکمل" : "Completed",
                        value: stats.completed,
                        color: "text-green-500",
                      },
                      {
                        icon: Clock,
                        label: isUrdu ? "زیر التواء" : "Pending",
                        value: stats.pending,
                        color: "text-orange-500",
                      },
                      {
                        icon: UserCheck,
                        label: isUrdu ? "ایجنٹس" : "Agents",
                        value: stats.agents,
                        color: "text-purple-500",
                      },
                      {
                        icon: Users,
                        label: isUrdu ? "کسٹمرز" : "Customers",
                        value: stats.customers,
                        color: "text-teal-500",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <stat.icon className={`w-4 h-4 ${stat.color}`} />
                          <span
                            className={`text-sm ${
                              darkMode ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {stat.label}
                          </span>
                        </div>
                        <span
                          className={`text-lg font-bold ${stat.color}`}
                        >
                          {stat.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`mt-3 pt-3 border-t ${
                      darkMode ? "border-gray-700" : "border-gray-200"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setShowStatsOrb(false);
                        navigate("/admin/cases");
                      }}
                      className="w-full text-xs text-blue-500 hover:text-blue-600 font-semibold active:opacity-80"
                    >
                      {isUrdu ? "سب دیکھیں →" : "View All Cases →"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notification Bell */}
          <NotificationBell role="admin" />

          {/* Language Toggle */}
          <button
            onClick={handleLanguageToggle}
            aria-label={isUrdu ? "زبان تبدیل کریں" : "Change language"}
            className="hidden sm:flex p-2 md:p-2.5 rounded-xl transition-colors relative min-w-[44px] min-h-[44px] items-center justify-center hover:bg-white/15 active:opacity-80"
          >
            <Globe className="w-4 h-4 md:w-5 md:h-5 text-blue-100" />
            <span
              className={`absolute -bottom-0.5 ${
                isUrdu ? "-left-0.5" : "-right-0.5"
              } text-[8px] md:text-[9px] font-bold text-blue-300`}
            >
              {language === "en" ? "EN" : "UR"}
            </span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={handleDarkModeToggle}
            aria-label={
              darkMode
                ? isUrdu
                  ? "لائٹ موڈ"
                  : "Light mode"
                : isUrdu
                ? "ڈارک موڈ"
                : "Dark mode"
            }
            className="hidden sm:flex p-2 md:p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] items-center justify-center hover:bg-white/15 active:opacity-80"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
            ) : (
              <Moon className="w-4 h-4 md:w-5 md:h-5 text-blue-100" />
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative hidden sm:block" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              aria-label={isUrdu ? "پروفائل مینو" : "Profile menu"}
              className="flex items-center gap-1.5 md:gap-2 p-1 md:p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] active:opacity-80 hover:bg-white/15"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg">
                A
              </div>
              <span className="text-xs md:text-sm font-medium hidden sm:block text-white">
                Admin
              </span>
            </button>

            <AnimatePresence>
              {showProfile && (
                <>
                  {/* Desktop dropdown */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`
                      hidden sm:block
                      absolute inset-auto bottom-auto top-full
                      ${isUrdu ? "left-0" : "right-0"} mt-2
                      w-56 rounded-2xl shadow-2xl border overflow-hidden z-50
                      ${
                        darkMode
                          ? "bg-gray-800 border-gray-700"
                          : "bg-white border-gray-200"
                      }
                    `}
                  >
                    <div
                      className={`px-4 py-3 border-b ${
                        darkMode ? "border-gray-700" : "border-gray-200"
                      }`}
                    >
                      <p
                        className={`font-semibold ${
                          darkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Admin
                      </p>
                      <p className="text-xs text-gray-500">
                        {isUrdu ? "سسٹم ایڈمنسٹریٹر" : "System Administrator"}
                      </p>
                    </div>
                    <button
                      onClick={handleProfile}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors active:opacity-80 ${
                        darkMode
                          ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                          : "text-gray-900 border-gray-100 hover:bg-gray-50"
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span className="text-sm">
                        {isUrdu ? "پروفائل" : "Profile"}
                      </span>
                    </button>
                    <button
                      onClick={handleSettings}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors active:opacity-80 ${
                        darkMode
                          ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                          : "text-gray-900 border-gray-100 hover:bg-gray-50"
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">
                        {isUrdu ? "ترتیبات" : "Settings"}
                      </span>
                    </button>
                    <button
                      onClick={handleHelp}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors active:opacity-80 ${
                        darkMode
                          ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                          : "text-gray-900 border-gray-100 hover:bg-gray-50"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span className="text-sm">
                        {isUrdu ? "مدد" : "Help & Support"}
                      </span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-red-500 transition-colors active:opacity-80 ${
                        darkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">{t("logout")}</span>
                    </button>
                  </motion.div>

                  {/* Mobile bottom sheet via portal */}
                  {createPortal(
                    <AnimatePresence>
                      {showProfile && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] sm:hidden"
                            onClick={() => setShowProfile(false)}
                          />
                          <motion.div
                            ref={mobileProfileRef}
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{
                              type: "spring",
                              damping: 25,
                              stiffness: 300,
                            }}
                            className={`
                              fixed bottom-0 left-0 right-0 z-[9999] sm:hidden
                              rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
                              overflow-hidden
                              ${darkMode ? "bg-gray-800" : "bg-white"}
                            `}
                            style={{
                              paddingBottom:
                                "env(safe-area-inset-bottom, 0px)",
                            }}
                          >
                            {/* Drag handle */}
                            <div
                              className="w-full flex justify-center py-2"
                              onClick={() => setShowProfile(false)}
                            >
                              <div
                                className={`w-12 h-1.5 rounded-full ${
                                  darkMode ? "bg-gray-600" : "bg-gray-300"
                                }`}
                              />
                            </div>
                            <div
                              className={`px-4 py-3 border-b ${
                                darkMode
                                  ? "border-gray-700"
                                  : "border-gray-200"
                              }`}
                            >
                              <p
                                className={`font-semibold ${
                                  darkMode ? "text-white" : "text-gray-900"
                                }`}
                              >
                                Admin
                              </p>
                              <p className="text-xs text-gray-500">
                                {isUrdu
                                  ? "سسٹم ایڈمنسٹریٹر"
                                  : "System Administrator"}
                              </p>
                            </div>
                            <button
                              onClick={handleProfile}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 border-b transition-colors min-h-[48px] active:opacity-80 ${
                                darkMode
                                  ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                                  : "text-gray-900 border-gray-100 hover:bg-gray-50"
                              }`}
                            >
                              <User className="w-5 h-5" />
                              <span className="text-base">
                                {isUrdu ? "پروفائل" : "Profile"}
                              </span>
                            </button>
                            <button
                              onClick={handleSettings}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 border-b transition-colors min-h-[48px] active:opacity-80 ${
                                darkMode
                                  ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                                  : "text-gray-900 border-gray-100 hover:bg-gray-50"
                              }`}
                            >
                              <Settings className="w-5 h-5" />
                              <span className="text-base">
                                {isUrdu ? "ترتیبات" : "Settings"}
                              </span>
                            </button>
                            <button
                              onClick={handleHelp}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 border-b transition-colors min-h-[48px] active:opacity-80 ${
                                darkMode
                                  ? "text-gray-200 border-gray-700 hover:bg-gray-700/50"
                                  : "text-gray-900 border-gray-100 hover:bg-gray-50"
                              }`}
                            >
                              <HelpCircle className="w-5 h-5" />
                              <span className="text-base">
                                {isUrdu ? "مدد" : "Help & Support"}
                              </span>
                            </button>
                            <button
                              onClick={handleLogout}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 text-red-500 transition-colors min-h-[48px] active:opacity-80 ${
                                darkMode
                                  ? "hover:bg-red-900/20"
                                  : "hover:bg-red-50"
                              }`}
                            >
                              <LogOut className="w-5 h-5" />
                              <span className="text-base">{t("logout")}</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>,
                    document.body
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hidden Admin Panel (Ctrl+Shift+H) */}
      <AnimatePresence>
        {showHiddenPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div
              className={`rounded-xl border-2 p-4 ${
                darkMode
                  ? "bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/50"
                  : "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3
                  className={`font-bold ${
                    darkMode ? "text-purple-400" : "text-purple-700"
                  }`}
                >
                  🔐 Hidden Admin Tools
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    localStorage.clear();
                    toast.success("All cache cleared!");
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium active:opacity-80 min-h-[44px] ${
                    darkMode
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  Clear Cache
                </button>
                <button
                  onClick={() => {
                    console.log("System Stats:", stats);
                    toast.info("Stats logged to console");
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium active:opacity-80 min-h-[44px] ${
                    darkMode
                      ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  System Stats
                </button>
                <button
                  onClick={() => navigate("/admin/settings")}
                  className={`px-3 py-2 rounded-lg text-xs font-medium active:opacity-80 min-h-[44px] ${
                    darkMode
                      ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  Admin Settings
                </button>
                <button
                  onClick={() => setShowHiddenPanel(false)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium active:opacity-80 min-h-[44px] ${
                    darkMode
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Close Panel
                </button>
              </div>
              <p className="text-[10px] mt-2 text-gray-500">
                💡 Tip: Press Ctrl+Shift+H to toggle this panel
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Full Menu */}
      <AdminMobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
    </header>
  );
}