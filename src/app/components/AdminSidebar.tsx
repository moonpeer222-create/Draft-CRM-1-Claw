import { useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Clock,
  DollarSign,
  Settings,
  Briefcase,
  TrendingUp,
  Shield,
  LogOut,
  UserCircle,
  AlertTriangle,
  Key,
  X,
  Menu,
  Award,
  PieChart,
  ChevronDown,
  FileText,
  Brain,
  FolderOpen,
  Gem,
  ChevronRight,
  Power,
  Sparkles,
  Zap,
  EyeOff,
  ExternalLink,
  BookOpen,
  ClipboardCheck,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
  Database,
  GitMerge,
  MessageCircle,
  Mic,
  Bot,
  Monitor,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { AuditLogService } from "../lib/auditLog";
import { AccessCodeService } from "../lib/accessCode";
import { triggerPanic } from "../lib/panicMode";
import { CRMDataStore, getOverdueInfo } from "../lib/mockData";
import { getAdminProfile, subscribeToProfileUpdates } from "../lib/adminProfile";
import { getPendingConflicts } from "../lib/syncService";
import { useState, useEffect, useRef } from "react";

interface MenuItem {
  name: string;
  nameShort?: string;
  path?: string;
  icon: any;
  label?: string;
  subsections?: { name: string; path: string; icon?: any }[];
  badge?: number;
  badgeColor?: string;
}

// Floating tooltip for collapsed mode
function CollapsedTooltip({ children, label, show }: { children: React.ReactNode; label: string; show: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      <AnimatePresence>
        {show && hovered && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60] px-3 py-1.5 rounded-lg bg-gray-900 text-blue-100 text-xs font-medium shadow-xl shadow-black/30 border border-blue-500/20 whitespace-nowrap pointer-events-none"
          >
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-gray-900 border-l border-b border-blue-500/20" />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminSidebar() {
  // All hooks must be called before any early return
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, t, isUrdu, fontClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["dashboard", "cases"]);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Ctrl+Shift+H to toggle hidden admin panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "H") {
        e.preventDefault();
        setShowHiddenPanel(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Admin profile - reactive to profile edits
  const [adminProfile, setAdminProfile] = useState(getAdminProfile());
  useEffect(() => {
    const unsubscribe = subscribeToProfileUpdates((updated) => setAdminProfile(updated));
    return unsubscribe;
  }, []);

  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    const updateCount = () => {
      const cases = CRMDataStore.getCases();
      setOverdueCount(cases.filter(c => getOverdueInfo(c).isOverdue).length);
    };
    updateCount();
    const interval = setInterval(updateCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const [pendingConflicts, setPendingConflicts] = useState(0);
  useEffect(() => {
    const updateConflicts = () => {
      setPendingConflicts(getPendingConflicts().filter(c => !c.resolved).length);
    };
    updateConflicts();
    const interval = setInterval(updateConflicts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-expand section containing current path
  useEffect(() => {
    if (insideUnifiedLayout) return;
    // Check subsection paths against current location
    const allSubPaths: { sectionName: string; path: string }[] = [
      { sectionName: t("nav.cases") || "Case Management", path: "/admin/cases" },
      { sectionName: t("nav.cases") || "Case Management", path: "/admin/overdue-cases" },
      { sectionName: t("nav.cases") || "Case Management", path: "/admin/passport-tracker" },
      { sectionName: t("nav.cases") || "Case Management", path: "/admin/documents" },
      { sectionName: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control", path: "/admin/team" },
      { sectionName: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control", path: "/admin/agent-codes" },
      { sectionName: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control", path: "/admin/leaderboard" },
      { sectionName: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control", path: "/admin/attendance" },
      { sectionName: isUrdu ? "رپورٹس اور تجزیات" : "Reports & Analytics", path: "/admin/analytics" },
      { sectionName: isUrdu ? "رپورٹس اور تجزیات" : "Reports & Analytics", path: "/admin/reports" },
      { sectionName: isUrdu ? "رپورٹس اور تجزیات" : "Reports & Analytics", path: "/admin/business-intelligence" },
      { sectionName: isUrdu ? "AI ٹولز" : "AI Tools", path: "/admin/ai-chatbot" },
      { sectionName: isUrdu ? "AI ٹولز" : "AI Tools", path: "/admin/voice-assistant" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/approval-queue" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/audit-log" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/backup" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/sync-history" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/user-management" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/settings" },
      { sectionName: isUrdu ? "سسٹم" : "System", path: "/admin/profile" },
    ];
    const match = allSubPaths.find(sp => sp.path === location.pathname);
    if (match && !expandedSections.includes(match.sectionName)) {
      setExpandedSections(prev => [...prev, match.sectionName]);
    }
  }, [location.pathname, insideUnifiedLayout]);

  // Close mobile menu on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  if (insideUnifiedLayout) return null;

  const menuSections: MenuItem[] = [
    {
      name: t("nav.dashboard"),
      nameShort: isUrdu ? "ڈیش" : "Dash",
      path: "/admin",
      icon: LayoutDashboard,
      label: isUrdu ? "مرکزی" : "MAIN",
    },
    {
      name: isUrdu ? "کیس مینجمنٹ" : "Case Management",
      nameShort: isUrdu ? "کیسز" : "Cases",
      icon: Briefcase,
      label: isUrdu ? "آپریشنز" : "OPERATIONS",
      subsections: [
        { name: t("nav.cases"), path: "/admin/cases", icon: Briefcase },
        { name: isUrdu ? "تاخیر شدہ کیسز" : "Overdue Cases", path: "/admin/overdue-cases", icon: AlertTriangle },
        { name: isUrdu ? "پاسپورٹ ٹریکر" : "Passport Tracker", path: "/admin/passport-tracker", icon: BookOpen },
        { name: isUrdu ? "دستاویز مرکز" : "Document Center", path: "/admin/documents", icon: FolderOpen },
      ],
    },
    {
      name: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control",
      nameShort: isUrdu ? "ایجنٹ" : "Agents",
      icon: Users,
      subsections: [
        { name: t("nav.team"), path: "/admin/team", icon: Users },
        { name: isUrdu ? "ایجنٹ کوڈز" : "Agent Codes", path: "/admin/agent-codes", icon: Key },
        { name: isUrdu ? "لیڈر بورڈ" : "Leaderboard", path: "/admin/leaderboard", icon: Award },
        { name: t("nav.attendance"), path: "/admin/attendance", icon: Clock },
      ],
    },
    {
      name: isUrdu ? "رپورٹس اور تجزیات" : "Reports & Analytics",
      nameShort: isUrdu ? "رپورٹس" : "Reports",
      icon: BarChart3,
      label: isUrdu ? "بصیرت" : "INSIGHTS",
      subsections: [
        { name: isUrdu ? "آمدنی تجزیات" : "Analytics", path: "/admin/analytics", icon: PieChart },
        { name: t("nav.reports"), path: "/admin/reports", icon: FileText },
        { name: t("nav.bi"), path: "/admin/business-intelligence", icon: Brain },
      ],
    },
    {
      name: isUrdu ? "مالیات" : "Financials",
      nameShort: isUrdu ? "مالی" : "Finance",
      path: "/admin/financials",
      icon: DollarSign,
    },
    {
      name: isUrdu ? "آپریشنز" : "Operations",
      nameShort: isUrdu ? "آپریشنز" : "Ops",
      path: "/admin/operations",
      icon: Monitor,
      label: isUrdu ? "آپریشنز" : "OPS",
    },
    {
      name: isUrdu ? "AI ٹولز" : "AI Tools",
      nameShort: isUrdu ? "AI" : "AI",
      icon: Bot,
      label: isUrdu ? "مصنوعی ذہانت" : "AI",
      subsections: [
        { name: isUrdu ? "چیٹ بوٹ" : "AI Chatbot", path: "/admin/ai-chatbot", icon: MessageCircle },
        { name: isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant", path: "/admin/voice-assistant", icon: Mic },
      ],
    },
    {
      name: isUrdu ? "سسٹم" : "System",
      nameShort: isUrdu ? "سسٹم" : "System",
      icon: Settings,
      label: isUrdu ? "ترتیبات" : "SYSTEM",
      subsections: [
        { name: isUrdu ? "منظوری کی قطار" : "Approval Queue", path: "/admin/approval-queue", icon: ClipboardCheck },
        { name: isUrdu ? "آڈٹ لاگ" : "Audit Log", path: "/admin/audit-log", icon: ScrollText },
        { name: isUrdu ? "ڈیٹا بیک اپ" : "Data Backup", path: "/admin/backup", icon: Database },
        { name: isUrdu ? "سنک تاریخ" : "Sync History", path: "/admin/sync-history", icon: GitMerge },
        { name: t("nav.userMgmt"), path: "/admin/user-management", icon: Shield },
        { name: t("nav.settings"), path: "/admin/settings", icon: Settings },
        { name: isUrdu ? "پروفائل" : "Profile", path: "/admin/profile", icon: UserCircle },
      ],
    },
  ];

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  // Track which section labels have been shown
  let lastLabel = "";

  const sidebarWidth = collapsed ? 76 : 270;

  return (
    <>
      {/* Mobile Toggle Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? (isUrdu ? "مینو بند کریں" : "Close menu") : (isUrdu ? "مینو کھولیں" : "Open menu")}
        className={`fixed top-3 ${isUrdu ? "right-3" : "left-3"} z-50 lg:hidden p-3 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation active:opacity-80 hidden`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        {/* Three Lines Hamburger - Animates to X */}
        <div className="flex flex-col gap-1 w-5">
          <motion.div
            animate={{ 
              rotate: isOpen ? 45 : 0,
              y: isOpen ? 6 : 0,
            }}
            transition={{ duration: 0.2 }}
            className={`h-0.5 w-full rounded-full ${
              darkMode ? "bg-white" : "bg-white"
            }`}
          />
          <motion.div
            animate={{ 
              opacity: isOpen ? 0 : 1,
              scale: isOpen ? 0.5 : 1,
            }}
            transition={{ duration: 0.2 }}
            className={`h-0.5 w-full rounded-full ${
              darkMode ? "bg-white" : "bg-white"
            }`}
          />
          <motion.div
            animate={{ 
              rotate: isOpen ? -45 : 0,
              y: isOpen ? -6 : 0,
            }}
            transition={{ duration: 0.2 }}
            className={`h-0.5 w-full rounded-full ${
              darkMode ? "bg-white" : "bg-white"
            }`}
          />
        </div>
      </motion.button>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{
          width: isOpen || window.innerWidth >= 1024 ? sidebarWidth : 0,
          x: isOpen || window.innerWidth >= 1024 ? 0 : (isUrdu ? sidebarWidth : -sidebarWidth),
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`${isUrdu ? fontClass : ""} fixed lg:sticky top-0 h-screen flex-col z-40 overflow-hidden hidden lg:flex ${
          isUrdu ? "right-0" : "left-0"
        }`}
        style={{
          background: darkMode
            ? "linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #020617 100%)"
            : "linear-gradient(180deg, #1e3a8a 0%, #1e40af 40%, #1d4ed8 100%)",
        }}
      >
        {/* Animated edge accent */}
        <motion.div
          className={`absolute ${isUrdu ? "left-0" : "right-0"} top-0 bottom-0 w-[1px]`}
          style={{
            background: darkMode
              ? "linear-gradient(180deg, transparent 0%, rgba(96,165,250,0.3) 30%, rgba(96,165,250,0.15) 70%, transparent 100%)"
              : "linear-gradient(180deg, transparent 0%, rgba(147,197,253,0.3) 30%, rgba(147,197,253,0.15) 70%, transparent 100%)",
          }}
        />

        {/* Profile Section */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`${collapsed ? "px-3 pt-5 pb-3" : "px-5 pt-6 pb-4"}`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            {/* Avatar */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="relative flex-shrink-0"
            >
              <div className={`${collapsed ? "w-10 h-10" : "w-10 h-10"} rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20`}>
                <Gem className="w-5 h-5 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-blue-900"
              />
            </motion.div>

            {/* Name - hidden when collapsed */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0 overflow-hidden"
                >
                  <motion.p
                    className={`text-sm font-semibold truncate ${
                      darkMode ? "text-blue-100" : "text-blue-50"
                    }`}
                  >
                    {adminProfile.name}
                  </motion.p>
                  <p className={`truncate text-[13px] font-medium ${darkMode ? "text-blue-500/70" : "text-blue-200/70"}`}>
                    {isUrdu ? "منتظم اعلیٰ" : "Chief Administrator"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Divider */}
        <div className={`${collapsed ? "px-3" : "px-5"}`}>
          <div className={`h-px ${
            darkMode
              ? "bg-gradient-to-r from-transparent via-blue-700/30 to-transparent"
              : "bg-gradient-to-r from-transparent via-blue-400/25 to-transparent"
          }`} />
        </div>

        {/* Navigation */}
        <nav className={`pt-4 pb-3 ${collapsed ? "px-2" : "px-3"} flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin`}>
          {menuSections.map((section, idx) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.includes(section.name) && !collapsed;
            const hasSubsections = section.subsections && section.subsections.length > 0;
            const isDirectActive = section.path === location.pathname;

            const hasActiveSubsection = hasSubsections && section.subsections!.some(
              sub => sub.path === location.pathname
            );

            const sectionBadge = section.subsections?.find(sub => sub.path === "/admin/overdue-cases") && overdueCount > 0
              ? overdueCount
              : section.subsections?.find(sub => sub.path === "/admin/sync-history") && pendingConflicts > 0
                ? pendingConflicts
                : undefined;

            const isActive = isDirectActive || hasActiveSubsection;
            const isHovered = hoveredItem === section.name;

            // Show section label if it's new
            const showLabel = section.label && section.label !== lastLabel && !collapsed;
            if (section.label) lastLabel = section.label;

            return (
              <motion.div
                key={section.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.08 + idx * 0.04,
                  type: "spring",
                  stiffness: 260,
                  damping: 24,
                }}
              >
                {/* Section Category Label */}
                <AnimatePresence>
                  {showLabel && (
                    null
                  )}
                </AnimatePresence>

                {/* Menu Item */}
                <CollapsedTooltip label={section.name} show={collapsed}>
                  <motion.button
                    onMouseEnter={() => setHoveredItem(section.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (collapsed && hasSubsections) {
                        setCollapsed(false);
                        setTimeout(() => {
                          if (!expandedSections.includes(section.name)) {
                            toggleSection(section.name);
                          }
                        }, 300);
                        return;
                      }
                      if (hasSubsections) {
                        toggleSection(section.name);
                      } else if (section.path) {
                        navigate(section.path);
                      }
                    }}
                    className={`relative w-full flex items-center ${collapsed ? "justify-center px-2" : "px-3"} gap-3 py-2.5 rounded-xl transition-colors duration-150 group mb-0.5 ${
                      isActive
                        ? "text-white"
                        : darkMode
                          ? "text-blue-100/80 hover:text-white"
                          : "text-blue-50/80 hover:text-white"
                    }`}
                  >
                    {/* Active/Hover background */}
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : isHovered ? 0.6 : 0,
                        scale: isActive || isHovered ? 1 : 0.95,
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{
                        background: isActive
                          ? darkMode
                            ? "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)"
                          : darkMode
                            ? "rgba(59,130,246,0.06)"
                            : "rgba(255,255,255,0.04)",
                        border: isActive
                          ? `1px solid ${darkMode ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.1)"}`
                          : "1px solid transparent",
                      }}
                    />

                    {/* Active left accent line */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scaleY: 0, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          exit={{ scaleY: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={`absolute ${isUrdu ? "right-0 rounded-l-full" : "left-0 rounded-r-full"} top-1/2 -translate-y-1/2 w-[3px] h-5 origin-center`}
                          style={{
                            background: "linear-gradient(180deg, #60a5fa, #3b82f6)",
                            boxShadow: "0 0 12px rgba(96,165,250,0.6), 0 0 4px rgba(96,165,250,0.8)",
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon */}
                    <motion.div
                      animate={{
                        scale: isActive ? 1 : isHovered ? 1.08 : 1,
                        rotate: isHovered && !isActive ? 3 : 0,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                        isActive
                          ? darkMode
                            ? "bg-blue-500/20 shadow-sm shadow-blue-500/20"
                            : "bg-white/15 shadow-sm"
                          : "group-hover:bg-blue-500/8"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] transition-colors duration-200 ${
                        isActive
                          ? "text-blue-400"
                          : darkMode
                            ? "text-blue-400/60 group-hover:text-blue-300"
                            : "text-blue-200/60 group-hover:text-blue-100"
                      }`} />
                    </motion.div>

                    {/* Label */}
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`relative z-10 truncate flex-1 ${isUrdu ? "text-right" : "text-left"} text-[13.5px] ${
                            isActive ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {section.name}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Badge */}
                    {sectionBadge && !isExpanded && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        className={`relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg shadow-red-500/30 ${collapsed ? "absolute -top-0.5 -right-0.5" : ""}`}
                      >
                        {sectionBadge}
                      </motion.span>
                    )}

                    {/* Chevron */}
                    {hasSubsections && !collapsed && (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="relative z-10"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-colors duration-200 ${
                          isActive
                            ? "text-blue-400/80"
                            : darkMode ? "text-blue-400/40 group-hover:text-blue-300/60" : "text-blue-200/40 group-hover:text-blue-100/50"
                        }`} />
                      </motion.div>
                    )}

                    {/* Active dot for direct items */}
                    {isDirectActive && !collapsed && !hasSubsections && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="relative z-10 w-1.5 h-1.5 rounded-full bg-blue-400"
                        style={{ boxShadow: "0 0 8px rgba(96,165,250,0.6)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      />
                    )}
                  </motion.button>
                </CollapsedTooltip>

                {/* Subsections */}
                <AnimatePresence>
                  {hasSubsections && isExpanded && !collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 },
                      }}
                      className="overflow-hidden"
                    >
                      <div className={`${isUrdu ? "mr-6 pr-3" : "ml-6 pl-3"} mt-0.5 mb-1.5 space-y-0.5 relative`}>
                        {/* Connecting line */}
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          className={`absolute top-0 bottom-2 ${isUrdu ? "right-0" : "left-0"} w-px origin-top ${
                            darkMode
                              ? "bg-gradient-to-b from-blue-600/30 via-blue-700/20 to-transparent"
                              : "bg-gradient-to-b from-blue-400/25 via-blue-400/10 to-transparent"
                          }`}
                        />

                        {section.subsections!.map((subsection, subIdx) => {
                          const SubIcon = subsection.icon || Icon;
                          const isSubActive = location.pathname === subsection.path;
                          const isOverdue = subsection.path === "/admin/overdue-cases";
                          const isSyncHistory = subsection.path === "/admin/sync-history";
                          const badge = isOverdue && overdueCount > 0
                            ? overdueCount
                            : isSyncHistory && pendingConflicts > 0
                              ? pendingConflicts
                              : undefined;
                          const badgeColor = isSyncHistory && pendingConflicts > 0
                            ? "bg-orange-500/90"
                            : "bg-red-500/90";

                          return (
                            <motion.button
                              key={subsection.path}
                              initial={{ opacity: 0, x: isUrdu ? 16 : -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: isUrdu ? 16 : -16 }}
                              transition={{
                                delay: subIdx * 0.04,
                                type: "spring",
                                stiffness: 350,
                                damping: 25,
                              }}
                              whileHover={{ x: isUrdu ? -3 : 3 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(subsection.path)}
                              className={`relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg transition-colors duration-150 group/sub ${
                                isSubActive
                                  ? "text-white"
                                  : darkMode
                                    ? "text-blue-200/60 hover:text-blue-100"
                                    : "text-blue-100/60 hover:text-white/90"
                              }`}
                            >
                              {/* Active sub bg */}
                              {isSubActive && (
                                <motion.div
                                  layoutId="subActiveBg"
                                  className={`absolute inset-0 rounded-lg ${
                                    darkMode
                                      ? "bg-blue-500/12 border border-blue-500/10"
                                      : "bg-white/8 border border-white/8"
                                  }`}
                                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                              )}

                              {/* Hover bg */}
                              {!isSubActive && (
                                <div className={`absolute inset-0 rounded-lg opacity-0 group-hover/sub:opacity-100 transition-opacity duration-150 ${
                                  darkMode ? "bg-blue-900/15" : "bg-white/4"
                                }`} />
                              )}

                              {/* Dot connector */}
                              <motion.div
                                animate={isSubActive ? {
                                  scale: [1, 1.3, 1],
                                } : {}}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className={`absolute ${isUrdu ? "-right-3" : "-left-3"} top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                                  isSubActive
                                    ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]"
                                    : darkMode
                                      ? "bg-blue-800/40 group-hover/sub:bg-blue-600/50"
                                      : "bg-blue-500/20 group-hover/sub:bg-blue-300/40"
                                }`}
                              />

                              <SubIcon className={`relative z-10 w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${
                                isSubActive
                                  ? "text-blue-400"
                                  : isOverdue && badge
                                    ? "text-red-400"
                                    : isSyncHistory && badge
                                      ? "text-orange-400"
                                      : darkMode
                                        ? "text-blue-400/45 group-hover/sub:text-blue-300/80"
                                        : "text-blue-200/45 group-hover/sub:text-blue-100/80"
                              }`} />

                              <span className={`relative z-10 text-[12px] truncate flex-1 ${isUrdu ? "text-right" : "text-left"} ${
                                isSubActive ? "font-medium" : ""
                              }`}>
                                {subsection.name}
                              </span>

                              {badge && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 15, delay: subIdx * 0.05 + 0.1 }}
                                  className={`relative z-10 min-w-[16px] h-4 px-1 rounded-full ${badgeColor} text-white text-[9px] font-bold flex items-center justify-center`}
                                >
                                  {badge}
                                </motion.span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`${collapsed ? "p-2" : "p-3"}`}
        >
          {/* Divider */}
          <div className={`h-px mb-3 mx-2 ${
            darkMode
              ? "bg-gradient-to-r from-transparent via-blue-700/25 to-transparent"
              : "bg-gradient-to-r from-transparent via-blue-400/20 to-transparent"
          }`} />

          {/* Collapse Toggle - Desktop only */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCollapsed(prev => !prev)}
            className={`hidden lg:flex w-full items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2 rounded-xl transition-all duration-200 mb-2 ${
              darkMode
                ? "text-blue-400/50 hover:bg-blue-800/15 hover:text-blue-300"
                : "text-blue-200/50 hover:bg-white/5 hover:text-blue-100"
            }`}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {isUrdu ? (
                <ChevronsRight className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ChevronsLeft className="w-4 h-4 flex-shrink-0" />
              )}
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
                >
                  {isUrdu ? "سائیڈبار بند کریں" : "Collapse"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Version tag - only when expanded */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-1.5 mb-2 overflow-hidden"
              >
                <Sparkles className={`w-3 h-3 ${darkMode ? "text-blue-500/50" : "text-blue-300/40"}`} />
                <span className={`text-[10px] tracking-wider font-medium ${
                  darkMode ? "text-blue-500/50" : "text-blue-300/40"
                }`}>
                  {isUrdu ? "ایمرالڈ CRM v2.0" : "EMERALD CRM v2.0"}
                </span>
                <Sparkles className={`w-3 h-3 ${darkMode ? "text-blue-500/50" : "text-blue-300/40"}`} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout button */}
          <CollapsedTooltip label={isUrdu ? "لاگ آؤٹ" : "Logout"} show={collapsed}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                AuditLogService.logAuth("Imran Khan", "admin", "logout");
                AccessCodeService.adminLogout?.();
                navigate("/");
              }}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2.5 rounded-xl transition-all duration-200 group ${
                darkMode
                  ? "text-blue-300/50 hover:bg-red-900/15 hover:text-red-400"
                  : "text-blue-100/50 hover:bg-red-900/20 hover:text-red-300"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                "group-hover:bg-red-500/10"
              }`}>
                <Power className="w-4 h-4 flex-shrink-0" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                  >
                    {t("logout")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </CollapsedTooltip>
        </motion.div>
      </motion.aside>

      {/* Hidden Admin Panel — Ctrl+Shift+H */}
      <AnimatePresence>
        {showHiddenPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHiddenPanel(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[340px] rounded-2xl border overflow-hidden"
              style={{
                background: darkMode
                  ? "linear-gradient(135deg, rgba(30,58,138,0.95), rgba(23,37,84,0.98))"
                  : "linear-gradient(135deg, rgba(30,58,138,0.97), rgba(23,37,84,0.98))",
                borderColor: "rgba(96,165,250,0.2)",
                boxShadow: "0 0 40px rgba(96,165,250,0.15), 0 25px 50px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-blue-500/20">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"
                  >
                    <Shield className="w-4 h-4 text-blue-400" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-bold text-blue-100">
                      {isUrdu ? "خفیہ ایڈمن ٹولز" : "Hidden Admin Tools"}
                    </p>
                    <p className="text-[10px] text-blue-500/60 tracking-wider">CTRL + SHIFT + H</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowHiddenPanel(false)}
                  className="p-1.5 rounded-lg hover:bg-blue-800/40 transition-colors"
                >
                  <X className="w-4 h-4 text-blue-400/70" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-3">
                {/* Quick Switch / Panic Button */}
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(239,68,68,0.3)" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={triggerPanic}
                  className="w-full relative overflow-hidden rounded-xl border border-red-500/30 p-4 text-left transition-all group"
                  style={{
                    background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.2))",
                  }}
                >
                  {/* Animated scan line */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    animate={{ backgroundPosition: ["200% 0%", "-100% 0%"] }}
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, transparent 30%, rgba(239,68,68,0.4) 50%, transparent 70%)",
                      backgroundSize: "200% 100%",
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Zap className="w-5 h-5 text-red-400" />
                      </motion.div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                        {isUrdu ? "فوری سوئچ" : "Quick Switch"}
                        <ExternalLink className="w-3 h-3 text-red-400/60" />
                      </p>
                      <p className="text-[11px] text-red-400/60 mt-0.5">
                        {isUrdu ? "CRM بند کریں، تاریخ صاف کریں" : "Closes CRM, erases history, opens decoy"}
                      </p>
                    </div>
                  </div>

                  {/* Keyboard shortcut hint */}
                  <div className="mt-3 flex items-center gap-1.5 relative z-10">
                    <EyeOff className="w-3 h-3 text-red-500/40" />
                    <span className="text-[9px] text-red-500/40 tracking-wider uppercase">
                      {isUrdu ? "کوئی نشان نہیں چھوڑتا" : "Full stealth · No trace left behind"}
                    </span>
                  </div>
                </motion.button>

                {/* Info footer */}
                <div className="flex items-center gap-2 px-1 pt-1">
                  <div className="w-1 h-1 rounded-full bg-blue-500/40" />
                  <span className="text-[10px] text-blue-600/50">
                    {isUrdu ? "یہ پینل صرف ایڈمن کو نظر آتا ہے" : "This panel is only visible to admins"}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}