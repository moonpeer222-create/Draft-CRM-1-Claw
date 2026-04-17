import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { 
  Globe, 
  Sun, 
  Moon, 
  LogOut, 
  User, 
  Settings, 
  HelpCircle, 
  Sparkles,
  Briefcase,
  CheckCircle,
  Clock,
  Activity,
  UserCheck,
  LogIn,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { toast } from "../lib/toast";
import { headerDrop } from "../lib/animations";
import { NotificationBell } from "./NotificationPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { AccessCodeService } from "../lib/accessCode";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { AgentSessionTimer } from "./AgentSessionTimer";
import { getAgentAvatar } from "../pages/agent/AgentProfile";
import { AgentMobileMenu } from "./AgentMobileMenu";

// Sparkle particle component
function SparkleParticle({ index, active }: { index: number; active: boolean }) {
  const angle = (index * 137.5) % 360;
  const distance = 28 + (index % 3) * 8;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const size = 2 + (index % 3);
  const delay = index * 0.12;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: index % 2 === 0
          ? "radial-gradient(circle, #3b82f6, transparent)"
          : "radial-gradient(circle, #93c5fd, transparent)",
        top: "50%",
        left: "50%",
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={active ? {
        x: [0, x * 0.5, x],
        y: [0, y * 0.5, y],
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      } : { x: 0, y: 0, opacity: 0, scale: 0 }}
      transition={{
        duration: 1.2,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

// Tagline phrases that cycle
const taglines = [
  { en: "Emerald Visa Consultancy", ur: "ایمرالڈ ویزا کنسلٹنسی" },
  { en: "Your Gateway to the World", ur: "دنیا کا آپ کا دروازہ" },
  { en: "Dream. Apply. Fly.", ur: "خواب۔ درخواست۔ پرواز۔" },
  { en: "Agent Excellence Portal", ur: "ایجنٹ تفوق پورٹل" },
];

export function AgentHeader() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showStatsOrb, setShowStatsOrb] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const [gemMood, setGemMood] = useState<"idle" | "happy" | "energized">("idle");
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ===== All useEffect hooks MUST be above the early return guard =====
  // (React rules of hooks: hooks cannot be called conditionally)

  // Mobile scroll detection - hide header on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;
      
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const lastScrollY = lastScrollYRef.current;
        
        if (window.innerWidth < 1024) {
          const delta = currentScrollY - lastScrollY;
          if (delta > 8 && currentScrollY > 60) {
            setIsHeaderVisible(false);
          } else if (delta < -5) {
            setIsHeaderVisible(true);
          }
        } else {
          setIsHeaderVisible(true);
        }
        
        lastScrollYRef.current = currentScrollY;
        scrollTickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Typewriter effect for taglines
  useEffect(() => {
    const fullText = isUrdu ? taglines[taglineIndex].ur : taglines[taglineIndex].en;
    let charIndex = 0;
    setIsTyping(true);
    setDisplayedText("");

    const typeInterval = setInterval(() => {
      if (charIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        setTimeout(() => {
          setTaglineIndex((prev) => (prev + 1) % taglines.length);
        }, 2800);
      }
    }, 60);

    return () => clearInterval(typeInterval);
  }, [taglineIndex, isUrdu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileRef.current && !profileRef.current.contains(target) &&
        (!mobileProfileRef.current || !mobileProfileRef.current.contains(target))
      ) {
        setShowProfile(false);
      }
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) {
        setShowStatsOrb(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live stats for agent's cases from Supabase
  const [cases, setCases] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('cases').select('*').then(({ data }) => {
      setCases((data || []).map(mapSupabaseCaseToLocal));
    });
  }, []);

  // Early return for unified layout — AFTER all hooks
  if (insideUnifiedLayout) return null;

  const session = AccessCodeService.getAgentSession();

  // Get agent avatar from localStorage
  const agentAvatar = session?.agentName ? getAgentAvatar(session.agentName) : null;
  const myCases = cases.filter(c => c.agentId === session?.agentId);
  const stats = {
    total: myCases.length,
    completed: myCases.filter(c => c.status === "stamped").length,
    pending: myCases.filter(c => c.status !== "stamped" && c.status !== "rejected").length,
  };

  const handleLanguageToggle = () => {
    toggleLanguage();
    toast.info(`${t("lang.changed")} ${language === "en" ? "اردو" : "English"}`);
  };

  const handleProfile = () => {
    setShowProfile(false);
    navigate("/agent/profile");
  };

  const handleSettings = () => {
    setShowProfile(false);
    toast.info(isUrdu ? "ایجنٹ ترتیبات کھل رہی ہیں..." : "Opening agent settings...");
  };

  const handleHelp = () => {
    setShowProfile(false);
    toast.info(isUrdu ? "سپورٹ سے رابطہ کریں: +92 318 6986259" : "Contact support: +92 318 6986259");
  };

  const handleLogout = () => {
    setShowProfile(false);
    toast.success(t("loggingOut"));
    AccessCodeService.agentLogout();
    setTimeout(() => navigate("/agent/login"), 1000);
  };

  const handleGemClick = () => {
    setClickCount((prev) => prev + 1);
    if (clickCount % 3 === 0) {
      setGemMood("idle");
    } else if (clickCount % 3 === 1) {
      setGemMood("happy");
    } else {
      setGemMood("energized");
    }
    setShowStatsOrb(!showStatsOrb);
  };

  return (
    <>
    <motion.header
      {...headerDrop}
      animate={{
        y: isHeaderVisible ? 0 : -100,
        opacity: isHeaderVisible ? 1 : 0,
      }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ willChange: "transform, opacity" }}
      className={`${isUrdu ? fontClass : ""} border-b px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 fixed lg:sticky top-0 left-0 right-0 z-50 backdrop-blur-xl transition-colors duration-300 ${
        darkMode ? "bg-gray-900/90 border-gray-700/60" : "bg-white/90 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {/* Left: Mobile Menu Toggle + Logo */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* Mobile Sidebar Hamburger — visible below lg */}
          <button
            onClick={() => setShowMobileMenu(true)}
            aria-label={isUrdu ? "مینو کھولیں" : "Open menu"}
            className={`lg:hidden p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active:opacity-80 ${
              darkMode ? "hover:bg-gray-700/60" : "hover:bg-gray-200/80"
            }`}
          >
            <Menu className={`w-5 h-5 ${darkMode ? "text-gray-200" : "text-gray-700"}`} />
          </button>
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.5 }}
            onClick={handleGemClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="relative cursor-pointer flex-shrink-0"
          >
            
            <AnimatePresence>
              {isHovering && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`absolute right-0 mt-2 p-4 rounded-2xl shadow-2xl border min-w-[240px] ${
                    darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                  }`}
                >
                  <h3 className={`text-xs font-bold mb-3 uppercase tracking-wider ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}>
                    {isUrdu ? "میرے کیسز کا خلاصہ" : "My Cases Summary"}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className={`w-4 h-4 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "کل کیسز" : "Total"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {stats.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "مکمل" : "Completed"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold text-green-500`}>{stats.completed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "زیر التواء" : "Pending"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold text-orange-500`}>{stats.pending}</span>
                    </div>
                  </div>
                  <div className={`mt-3 pt-3 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <button
                      onClick={() => {
                        setShowStatsOrb(false);
                        navigate("/agent/cases");
                      }}
                      className="w-full text-xs text-blue-500 hover:text-blue-600 font-semibold"
                    >
                      {isUrdu ? "سب دیکھیں →" : "View All →"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <div className="min-w-0 flex-1">
            
            <div className="flex items-center gap-2">
              
              
              
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* Cloud Sync Status Indicator */}
          <SyncStatusIndicator />

          {/* Agent Session Timer — Desktop only; mobile uses AgentMobileMenu */}
          <AgentSessionTimer />

          {/* Stats Orb Toggle - Desktop */}
          <div className="relative hidden lg:block" ref={statsRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowStatsOrb(!showStatsOrb)}
              className={`p-2 rounded-xl transition-colors ${
                darkMode ? "hover:bg-gray-700/60" : "hover:bg-gray-100"
              }`}
            >
              <Activity className={`w-5 h-5 ${darkMode ? "text-gray-300" : "text-gray-700"}`} />
            </motion.button>

            <AnimatePresence>
              {showStatsOrb && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`absolute right-0 mt-2 p-4 rounded-2xl shadow-2xl border min-w-[240px] ${
                    darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                  }`}
                >
                  <h3 className={`text-xs font-bold mb-3 uppercase tracking-wider ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}>
                    {isUrdu ? "میرے کیسز کا خلاصہ" : "My Cases Summary"}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className={`w-4 h-4 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "کل کیسز" : "Total"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {stats.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "مکمل" : "Completed"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold text-green-500`}>{stats.completed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? "زیر التواء" : "Pending"}
                        </span>
                      </div>
                      <span className={`text-lg font-bold text-orange-500`}>{stats.pending}</span>
                    </div>
                  </div>
                  <div className={`mt-3 pt-3 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <button
                      onClick={() => {
                        setShowStatsOrb(false);
                        navigate("/agent/cases");
                      }}
                      className="w-full text-xs text-blue-500 hover:text-blue-600 font-semibold"
                    >
                      {isUrdu ? "سب دیکھیں →" : "View All →"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notification Bell */}
          <NotificationBell role="agent" userId={session?.agentId} />

          {/* Language Toggle - Hidden on mobile, consolidated into AgentMobileMenu */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleLanguageToggle}
            aria-label={isUrdu ? "زبان تبدیل کریں" : "Change language"}
            className={`hidden lg:flex p-2 md:p-2.5 rounded-xl transition-colors relative min-w-[44px] min-h-[44px] items-center justify-center ${
              darkMode ? "hover:bg-gray-700/60" : "hover:bg-gray-100"
            }`}
          >
            <Globe className={`w-4 h-4 md:w-5 md:h-5 ${darkMode ? "text-gray-300" : "text-gray-700"}`} />
            <span
              className={`absolute -bottom-0.5 ${isUrdu ? "-left-0.5" : "-right-0.5"} text-[8px] md:text-[9px] font-bold ${
                darkMode ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {language === "en" ? "EN" : "UR"}
            </span>
          </motion.button>

          {/* Dark Mode Toggle - Hidden on mobile, consolidated into AgentMobileMenu */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={() => {
              toggleDarkMode();
              toast.info(!darkMode ? t("darkEnabled") : t("lightEnabled"));
            }}
            aria-label={darkMode ? (isUrdu ? "لائٹ موڈ" : "Light mode") : (isUrdu ? "ڈارک موڈ" : "Dark mode")}
            className={`hidden lg:flex p-2 md:p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] items-center justify-center ${
              darkMode ? "hover:bg-gray-700/60" : "hover:bg-gray-100"
            }`}
          >
            <AnimatePresence mode="wait">
              {darkMode ? (
                <motion.div
                  key="sun"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Profile Dropdown - Hidden on mobile, consolidated into AgentMobileMenu */}
          <div className="relative hidden lg:block" ref={profileRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProfile(!showProfile)}
              aria-label={isUrdu ? "پروفائل مینو" : "Profile menu"}
              className={`flex items-center gap-1.5 md:gap-2 p-1 md:p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] active:opacity-80 ${
                darkMode ? "hover:bg-gray-700/60" : "hover:bg-gray-100"
              }`}
            >
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center overflow-hidden ${
                darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
              }`}>
                {agentAvatar ? (
                  <img src={agentAvatar} alt={session?.agentName || "Agent"} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <span className={`text-xs md:text-sm font-medium hidden sm:block ${darkMode ? "text-gray-200" : "text-gray-900"}`}>
                {session?.agentName || "Agent"}
              </span>
            </motion.button>

            <AnimatePresence>
              {showProfile && (
                <>
                  {/* Desktop dropdown (rendered in place) */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`
                      hidden sm:block
                      absolute inset-auto bottom-auto top-full
                      ${isUrdu ? "left-0" : "right-0"} mt-2
                      w-56 rounded-2xl shadow-2xl border
                      overflow-hidden
                      ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}
                    `}
                  >
                    <div className={`px-4 py-3 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                      <p className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {session?.agentName || "Agent"}
                      </p>
                      <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                        {session?.agentId || "agent"}
                      </p>
                    </div>
                    <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleProfile}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors ${darkMode ? "text-gray-200 border-gray-700 hover:bg-gray-700/50" : "text-gray-900 border-gray-100 hover:bg-gray-50"}`}>
                      <User className="w-4 h-4" /><span className="text-sm">{isUrdu ? "پروفائل" : "Profile"}</span>
                    </motion.button>
                    <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleSettings}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors ${darkMode ? "text-gray-200 border-gray-700 hover:bg-gray-700/50" : "text-gray-900 border-gray-100 hover:bg-gray-50"}`}>
                      <Settings className="w-4 h-4" /><span className="text-sm">{isUrdu ? "ترتیبات" : "Settings"}</span>
                    </motion.button>
                    <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleHelp}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b transition-colors ${darkMode ? "text-gray-200 border-gray-700 hover:bg-gray-700/50" : "text-gray-900 border-gray-100 hover:bg-gray-50"}`}>
                      <HelpCircle className="w-4 h-4" /><span className="text-sm">{isUrdu ? "مدد" : "Help & Support"}</span>
                    </motion.button>
                    <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleLogout}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-red-500 transition-colors ${darkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"}`}>
                      <LogOut className="w-4 h-4" /><span className="text-sm">{t("logout")}</span>
                    </motion.button>
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
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className={`
                              fixed bottom-0 left-0 right-0 z-[9999] sm:hidden
                              rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
                              overflow-hidden
                              ${darkMode ? "bg-gray-800" : "bg-white"}
                            `}
                            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                          >
                            <div className="w-full flex justify-center py-2" onClick={() => setShowProfile(false)}>
                              <div className={`w-12 h-1.5 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-300"}`} />
                            </div>
                            <div className={`px-4 py-3 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                              <p className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                                {session?.agentName || "Agent"}
                              </p>
                              <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                                {session?.agentId || "agent"}
                              </p>
                            </div>
                            
                            
                            <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleHelp}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 border-b transition-colors min-h-[48px] active:opacity-80 ${darkMode ? "text-gray-200 border-gray-700 hover:bg-gray-700/50" : "text-gray-900 border-gray-100 hover:bg-gray-50"}`}>
                              <HelpCircle className="w-5 h-5" /><span className="text-base">{isUrdu ? "مدد" : "Help & Support"}</span>
                            </motion.button>
                            <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={handleLogout}
                              className={`w-full px-4 py-3.5 text-left flex items-center gap-3 text-red-500 transition-colors min-h-[48px] active:opacity-80 ${darkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"}`}>
                              <LogOut className="w-5 h-5" /><span className="text-base">{t("logout")}</span>
                            </motion.button>
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
    </motion.header>

    {/* Mobile Full Menu */}
    <AgentMobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
    </>
  );
}