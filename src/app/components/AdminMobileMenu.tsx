/**
 * AdminMobileMenu — Full-screen mobile navigation overlay.
 * Contains the same menu items as the desktop AdminSidebar,
 * with search/filter, consolidated profile section, and
 * mobile-optimized 48px+ touch targets.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { getOverdueInfo } from "../lib/mockData";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { getPendingConflicts } from "../lib/syncService";
import { getAdminProfile, subscribeToProfileUpdates } from "../lib/adminProfile";
import { toast } from "../lib/toast";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Clock,
  DollarSign,
  Settings,
  Briefcase,
  Shield,
  UserCircle,
  AlertTriangle,
  Key,
  X,
  Award,
  PieChart,
  ChevronDown,
  FileText,
  Brain,
  FolderOpen,
  Gem,
  BookOpen,
  ClipboardCheck,
  ScrollText,
  Database,
  GitMerge,
  Power,
  Sparkles,
  Search,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  User,
  CheckCircle,
  Activity,
  Monitor,
} from "lucide-react";
import { AuditLogService } from "../lib/auditLog";
import { AccessCodeService } from "../lib/accessCode";

interface SubItem {
  name: string;
  path: string;
  icon: any;
  badge?: number;
  badgeColor?: string;
}

interface MenuSection {
  name: string;
  icon: any;
  label?: string;
  path?: string;
  subsections?: SubItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminMobileMenu({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();
  const dc = darkMode;

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Admin profile
  const [adminProfile, setAdminProfile] = useState(getAdminProfile());
  useEffect(() => {
    const unsub = subscribeToProfileUpdates((p) => setAdminProfile(p));
    return unsub;
  }, []);

  // Badges + Admin Quick Stats
  const [overdueCount, setOverdueCount] = useState(0);
  const [pendingConflicts, setPendingConflicts] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [completedCases, setCompletedCases] = useState(0);
  const [activeAgents, setActiveAgents] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCases = async () => {
      const { data } = await supabase.from('cases').select('*');
      const cases = (data || []).map(mapSupabaseCaseToLocal);
      setTotalCases(cases.length);
      setCompletedCases(cases.filter(c => c.status === "stamped").length);
      setOverdueCount(cases.filter((c) => getOverdueInfo(c).isOverdue).length);
      setPendingConflicts(getPendingConflicts().filter((c) => !c.resolved).length);
      // Unique agents with active (non-completed/rejected) cases
      const agentIds = new Set(
        cases
          .filter(c => c.status !== "stamped" && c.status !== "rejected" && c.agentId)
          .map(c => c.agentId)
      );
      setActiveAgents(agentIds.size);
    };
    fetchCases();
  }, [isOpen]);

  // Reset search when menu closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Auto-expand active section
  useEffect(() => {
    if (!isOpen) return;
    menuSections.forEach((sec) => {
      if (sec.subsections?.some((sub) => sub.path === location.pathname)) {
        setExpandedSections((prev) =>
          prev.includes(sec.name) ? prev : [...prev, sec.name]
        );
      }
    });
  }, [isOpen, location.pathname]);

  // Close on nav
  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    AuditLogService.logAuth("Admin", "admin", "logout");
    AccessCodeService.adminLogout?.();
    navigate("/");
    onClose();
  };

  const handleLanguageToggle = () => {
    toggleLanguage();
    toast.info(`${t("lang.changed")} ${language === "en" ? "اردو" : "English"}`);
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
    toast.info(!darkMode ? t("darkEnabled") : t("lightEnabled"));
  };

  const toggleSection = (name: string) => {
    setExpandedSections((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        name: t("nav.dashboard"),
        path: "/admin",
        icon: LayoutDashboard,
        label: isUrdu ? "مرکزی" : "MAIN",
      },
      {
        name: isUrdu ? "کیس مینجمنٹ" : "Case Management",
        icon: Briefcase,
        label: isUrdu ? "آپریشنز" : "OPERATIONS",
        subsections: [
          { name: t("nav.cases"), path: "/admin/cases", icon: Briefcase },
          {
            name: isUrdu ? "تاخیر شدہ کیسز" : "Overdue Cases",
            path: "/admin/overdue-cases",
            icon: AlertTriangle,
            badge: overdueCount > 0 ? overdueCount : undefined,
            badgeColor: "bg-red-500",
          },
          {
            name: isUrdu ? "پاسپورٹ ٹریکر" : "Passport Tracker",
            path: "/admin/passport-tracker",
            icon: BookOpen,
          },
          {
            name: isUrdu ? "دستاویزات" : "Documents",
            path: "/admin/documents",
            icon: FolderOpen,
          },
        ],
      },
      {
        name: isUrdu ? "ایجنٹ کنٹرول" : "Agent Control",
        icon: Users,
        subsections: [
          { name: t("nav.team"), path: "/admin/team", icon: Users },
          {
            name: isUrdu ? "ایجنٹ کوڈز" : "Agent Codes",
            path: "/admin/agent-codes",
            icon: Key,
          },
          {
            name: isUrdu ? "لیڈر بورڈ" : "Leaderboard",
            path: "/admin/leaderboard",
            icon: Award,
          },
          {
            name: t("nav.attendance"),
            path: "/admin/attendance",
            icon: Clock,
          },
        ],
      },
      {
        name: isUrdu ? "رپورٹس اور تجزیات" : "Reports & Analytics",
        icon: BarChart3,
        label: isUrdu ? "بصیرت" : "INSIGHTS",
        subsections: [
          {
            name: isUrdu ? "آمدنی تجزیات" : "Analytics",
            path: "/admin/analytics",
            icon: PieChart,
          },
          {
            name: t("nav.reports"),
            path: "/admin/reports",
            icon: FileText,
          },
          {
            name: t("nav.bi"),
            path: "/admin/business-intelligence",
            icon: Brain,
          },
        ],
      },
      {
        name: isUrdu ? "مالیات" : "Financials",
        path: "/admin/financials",
        icon: DollarSign,
      },
      {
        name: isUrdu ? "آپریشنز" : "Operations",
        path: "/admin/operations",
        icon: Monitor,
        label: isUrdu ? "آپریشنز" : "OPS",
      },
      {
        name: isUrdu ? "سسٹم" : "System",
        icon: Settings,
        label: isUrdu ? "ترتیبات" : "SYSTEM",
        subsections: [
          {
            name: isUrdu ? "منظوری کی قطار" : "Approval Queue",
            path: "/admin/approval-queue",
            icon: ClipboardCheck,
          },
          {
            name: isUrdu ? "آڈٹ لاگ" : "Audit Log",
            path: "/admin/audit-log",
            icon: ScrollText,
          },
          {
            name: isUrdu ? "ڈیٹا بیک اپ" : "Data Backup",
            path: "/admin/backup",
            icon: Database,
          },
          {
            name: isUrdu ? "سنک تاریخ" : "Sync History",
            path: "/admin/sync-history",
            icon: GitMerge,
            badge: pendingConflicts > 0 ? pendingConflicts : undefined,
            badgeColor: "bg-orange-500",
          },
          {
            name: t("nav.userMgmt"),
            path: "/admin/user-management",
            icon: Shield,
          },
          {
            name: t("nav.settings"),
            path: "/admin/settings",
            icon: Settings,
          },
          {
            name: isUrdu ? "پروفائل" : "Profile",
            path: "/admin/profile",
            icon: UserCircle,
          },
        ],
      },
    ],
    [isUrdu, t, overdueCount, pendingConflicts]
  );

  // Flatten all navigable items for search
  const allNavItems = useMemo(() => {
    const items: { name: string; path: string; icon: any; sectionName: string; badge?: number; badgeColor?: string }[] = [];
    menuSections.forEach((sec) => {
      if (sec.path) {
        items.push({ name: sec.name, path: sec.path, icon: sec.icon, sectionName: sec.name });
      }
      sec.subsections?.forEach((sub) => {
        items.push({ name: sub.name, path: sub.path, icon: sub.icon, sectionName: sec.name, badge: sub.badge, badgeColor: sub.badgeColor });
      });
    });
    return items;
  }, [menuSections]);

  // Filter by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return allNavItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sectionName.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  }, [searchQuery, allNavItems]);

  const isSearching = searchQuery.trim().length > 0;

  let lastLabel = "";

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[199]"
            onClick={onClose}
          />

          {/* Menu Panel — slides down from top */}
          <motion.div
            initial={{ y: "-100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className={`fixed inset-x-0 top-0 z-[200] max-h-[100dvh] flex flex-col ${
              dc
                ? "bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950"
                : "bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950"
            }`}
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
            }}
          >
            {/* Header — Profile + Close */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-80"
                onClick={() => handleNav("/admin/profile")}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                  <Gem className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {adminProfile.name}
                  </p>
                  <p className="text-[11px] text-blue-300/60">
                    {isUrdu ? "سسٹم ایڈمنسٹریٹر" : "System Administrator"}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-white" />
              </motion.button>
            </div>

            {/* Quick Actions Row — Theme toggle, Language, Help */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
              <button
                onClick={handleDarkModeToggle}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 active:bg-white/10 transition-colors min-h-[40px]"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-yellow-300" />
                ) : (
                  <Moon className="w-4 h-4 text-blue-200" />
                )}
                <span className="text-[11px] font-medium text-blue-100/80">
                  {darkMode ? (isUrdu ? "لائٹ" : "Light") : (isUrdu ? "ڈارک" : "Dark")}
                </span>
              </button>
              <button
                onClick={handleLanguageToggle}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 active:bg-white/10 transition-colors min-h-[40px]"
              >
                <Globe className="w-4 h-4 text-blue-200" />
                <span className="text-[11px] font-medium text-blue-100/80">
                  {language === "en" ? "اردو" : "EN"}
                </span>
              </button>
              <button
                onClick={() => {
                  toast.info(
                    isUrdu
                      ? "سپورٹ سے رابطہ کریں: +92 318 6986259"
                      : "Contact support: +92 318 6986259"
                  );
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 active:bg-white/10 transition-colors min-h-[40px]"
              >
                <HelpCircle className="w-4 h-4 text-blue-200" />
                <span className="text-[11px] font-medium text-blue-100/80">
                  {isUrdu ? "مدد" : "Help"}
                </span>
              </button>
            </div>

            {/* Admin Quick Stats Dashboard */}
            <div className="px-4 pt-2.5 pb-1">
              
            </div>

            {/* Search Bar */}
            <div className="px-4 py-2.5">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                dc
                  ? "bg-white/5 border-white/10 focus-within:border-blue-500/40"
                  : "bg-white/8 border-white/10 focus-within:border-blue-300/40"
              }`}>
                <Search className="w-4 h-4 text-blue-300/50 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUrdu ? "مینو تلاش کریں..." : "Search menu..."}
                  className="flex-1 bg-transparent text-sm text-white placeholder-blue-300/40 outline-none min-w-0"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-blue-300/60" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Nav */}
            <nav
              className={`${isUrdu ? fontClass : ""} flex-1 overflow-y-auto overscroll-contain px-3 pb-3 space-y-1`}
              style={{
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* Search Results Mode */}
              {isSearching ? (
                <>
                  {searchResults && searchResults.length > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 px-3 pt-1 pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50">
                          {isUrdu
                            ? `${searchResults.length} نتائج`
                            : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
                        </span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      {searchResults.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <motion.button
                            key={item.path}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => handleNav(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all min-h-[48px] active:scale-[0.98] ${
                              isActive
                                ? dc
                                  ? "bg-blue-500/15 text-white"
                                  : "bg-white/15 text-white"
                                : "text-blue-100/80 active:bg-white/5"
                            }`}
                          >
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isActive
                                  ? dc ? "bg-blue-500/20" : "bg-white/10"
                                  : "bg-white/5"
                              }`}
                            >
                              <Icon
                                className={`w-[18px] h-[18px] ${
                                  isActive ? "text-blue-400" : dc ? "text-blue-400/60" : "text-blue-200/60"
                                }`}
                              />
                            </div>
                            <div className={`flex-1 min-w-0 ${isUrdu ? "text-right" : "text-left"}`}>
                              <span className={`text-[14px] block truncate ${isActive ? "font-semibold" : "font-medium"}`}>
                                {item.name}
                              </span>
                              <span className="text-[10px] text-blue-400/40 block truncate">
                                {item.sectionName !== item.name ? item.sectionName + " → " : ""}{item.path}
                              </span>
                            </div>
                            {item.badge && (
                              <span
                                className={`min-w-[18px] h-[18px] px-1 rounded-full ${item.badgeColor || "bg-red-500"} text-white text-[9px] font-bold flex items-center justify-center`}
                              >
                                {item.badge}
                              </span>
                            )}
                            {isActive && (
                              <div
                                className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"
                                style={{ boxShadow: "0 0 8px rgba(96,165,250,0.6)" }}
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                        <Search className="w-5 h-5 text-blue-400/30" />
                      </div>
                      <p className="text-sm text-blue-300/40 text-center">
                        {isUrdu
                          ? `"${searchQuery}" کے لیے کوئی نتیجہ نہیں ملا`
                          : `No results for "${searchQuery}"`}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Normal Menu Mode */
                menuSections.map((section, idx) => {
                  const Icon = section.icon;
                  const hasSubsections =
                    section.subsections && section.subsections.length > 0;
                  const isExpanded = expandedSections.includes(section.name);
                  const isDirectActive = section.path === location.pathname;
                  const hasActiveSubsection =
                    hasSubsections &&
                    section.subsections!.some(
                      (sub) => sub.path === location.pathname
                    );
                  const isActive = isDirectActive || hasActiveSubsection;

                  // Section label
                  const showLabel =
                    section.label && section.label !== lastLabel;
                  if (section.label) lastLabel = section.label;

                  // Aggregate badge for collapsed section
                  const sectionBadge = hasSubsections
                    ? section.subsections!.reduce(
                        (sum, sub) => sum + (sub.badge || 0),
                        0
                      )
                    : 0;

                  return (
                    <div key={section.name}>
                      {/* Section label divider */}
                      {showLabel && (
                        null
                      )}

                      {/* Menu item */}
                      <motion.button
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        onClick={() => {
                          if (hasSubsections) {
                            toggleSection(section.name);
                          } else if (section.path) {
                            handleNav(section.path);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all min-h-[48px] active:scale-[0.98] relative ${
                          isActive
                            ? dc
                              ? "bg-blue-500/15 text-white"
                              : "bg-white/15 text-white"
                            : "text-blue-100/80 active:bg-white/5"
                        }`}
                      >
                        {/* Active accent */}
                        {isActive && (
                          <div
                            className={`absolute ${isUrdu ? "right-0" : "left-0"} w-[3px] h-6 rounded-full bg-blue-400`}
                            style={{
                              boxShadow: "0 0 10px rgba(96,165,250,0.5)",
                            }}
                          />
                        )}

                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? dc
                                ? "bg-blue-500/20"
                                : "bg-white/10"
                              : "bg-white/5"
                          }`}
                        >
                          <Icon
                            className={`w-[18px] h-[18px] ${
                              isActive
                                ? "text-blue-400"
                                : dc
                                ? "text-blue-400/60"
                                : "text-blue-200/60"
                            }`}
                          />
                        </div>

                        <span
                          className={`flex-1 ${isUrdu ? "text-right" : "text-left"} text-[14px] ${
                            isActive ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {section.name}
                        </span>

                        {/* Section badge */}
                        {sectionBadge > 0 && !isExpanded && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {sectionBadge}
                          </span>
                        )}

                        {/* Chevron */}
                        {hasSubsections && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-blue-400/40" />
                          </motion.div>
                        )}

                        {/* Direct active dot */}
                        {isDirectActive && !hasSubsections && (
                          <div
                            className="w-2 h-2 rounded-full bg-blue-400"
                            style={{
                              boxShadow: "0 0 8px rgba(96,165,250,0.6)",
                            }}
                          />
                        )}
                      </motion.button>

                      {/* Subsections */}
                      <AnimatePresence>
                        {hasSubsections && isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              height: {
                                type: "spring",
                                stiffness: 300,
                                damping: 28,
                              },
                              opacity: { duration: 0.15 },
                            }}
                            className="overflow-hidden"
                          >
                            <div
                              className={`${isUrdu ? "mr-5 pr-3" : "ml-5 pl-3"} py-1 space-y-0.5 relative`}
                            >
                              {/* Connecting line */}
                              <div
                                className={`absolute top-0 bottom-2 ${isUrdu ? "right-0" : "left-0"} w-px ${
                                  dc
                                    ? "bg-gradient-to-b from-blue-600/25 to-transparent"
                                    : "bg-gradient-to-b from-blue-400/20 to-transparent"
                                }`}
                              />

                              {section.subsections!.map((sub, subIdx) => {
                                const SubIcon = sub.icon;
                                const isSubActive =
                                  location.pathname === sub.path;

                                return (
                                  <motion.button
                                    key={sub.path}
                                    initial={{
                                      opacity: 0,
                                      x: isUrdu ? 10 : -10,
                                    }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                      delay: subIdx * 0.04,
                                      duration: 0.15,
                                    }}
                                    onClick={() => handleNav(sub.path)}
                                    className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all min-h-[44px] active:scale-[0.98] ${
                                      isSubActive
                                        ? "text-white " +
                                          (dc
                                            ? "bg-blue-500/12"
                                            : "bg-white/8")
                                        : dc
                                        ? "text-blue-200/60 active:text-blue-100"
                                        : "text-blue-100/60 active:text-white/90"
                                    }`}
                                  >
                                    {/* Dot connector */}
                                    <div
                                      className={`absolute ${isUrdu ? "-right-3" : "-left-3"} top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                                        isSubActive
                                          ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]"
                                          : dc
                                          ? "bg-blue-800/40"
                                          : "bg-blue-500/20"
                                      }`}
                                    />

                                    <SubIcon
                                      className={`w-4 h-4 flex-shrink-0 ${
                                        isSubActive
                                          ? "text-blue-400"
                                          : sub.badge
                                          ? sub.badgeColor === "bg-orange-500"
                                            ? "text-orange-400"
                                            : "text-red-400"
                                          : dc
                                          ? "text-blue-400/45"
                                          : "text-blue-200/45"
                                      }`}
                                    />

                                    <span
                                      className={`flex-1 text-[13px] ${isUrdu ? "text-right" : "text-left"} ${
                                        isSubActive ? "font-medium" : ""
                                      }`}
                                    >
                                      {sub.name}
                                    </span>

                                    {sub.badge && (
                                      <span
                                        className={`min-w-[18px] h-[18px] px-1 rounded-full ${sub.badgeColor || "bg-red-500"} text-white text-[9px] font-bold flex items-center justify-center`}
                                      >
                                        {sub.badge}
                                      </span>
                                    )}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </nav>

            {/* Footer */}
            <div
              className="border-t border-white/10 px-3 py-3 space-y-2"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              }}
            >
              {/* Version */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                <Sparkles className="w-3 h-3 text-blue-500/40" />
                <span className="text-[10px] tracking-wider font-medium text-blue-500/40">
                  {isUrdu ? "ایمرالڈ CRM v2.0" : "EMERALD CRM v2.0"}
                </span>
                <Sparkles className="w-3 h-3 text-blue-500/40" />
              </div>

              {/* Logout */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors min-h-[48px] bg-red-500/10 border border-red-500/20 text-red-400 active:bg-red-500/20"
              >
                <Power className="w-4 h-4" />
                <span className="text-sm font-medium">{t("logout")}</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}