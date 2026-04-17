import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard, Users, DollarSign, Settings, Briefcase, Shield, LogOut,
  UserCircle, AlertTriangle, Key, Award, Clock, BarChart3, FileText,
  Brain, FolderOpen, ChevronRight, Crown, Sparkles, BookOpen,
  ClipboardCheck, ScrollText, Database, GitMerge, MessageCircle, Mic, Bot,
  PieChart, ChevronsLeft, ChevronsRight, ArrowRightLeft, Monitor,
  Zap, Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { UserDB } from "../lib/userDatabase";
import { AuditLogService } from "../lib/auditLog";
import { getOverdueInfo } from "../lib/mockData";
import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";

interface MenuItem {
  name: string;
  path?: string;
  icon: any;
  label?: string;
  subsections?: { name: string; path: string; icon?: any }[];
  badge?: number;
}

export function MasterSidebar() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, t, isUrdu, fontClass } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["dashboard"]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const session = UserDB.getMasterSession();

  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    const updateCount = async () => {
      const { data } = await supabase.from('cases').select('*');
      const cases = (data || []).map(mapSupabaseCaseToLocal);
      setOverdueCount(cases.filter(c => getOverdueInfo(c).isOverdue).length);
    };
    updateCount();
    const interval = setInterval(updateCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (insideUnifiedLayout) return null;

  const menuSections: MenuItem[] = [
    {
      name: isUrdu ? "\u0688\u06CC\u0634 \u0628\u0648\u0631\u0688" : "Dashboard",
      path: "/master",
      icon: LayoutDashboard,
      label: isUrdu ? "\u0645\u0631\u06A9\u0632\u06CC" : "MAIN",
    },
    {
      name: isUrdu ? "\u06A9\u06CC\u0633 \u0645\u06CC\u0646\u062C\u0645\u0646\u0679" : "Case Management",
      icon: Briefcase,
      label: isUrdu ? "\u0622\u067E\u0631\u06CC\u0634\u0646\u0632" : "OPERATIONS",
      subsections: [
        { name: isUrdu ? "\u062A\u0645\u0627\u0645 \u06A9\u06CC\u0633\u0632" : "All Cases", path: "/admin/cases", icon: Briefcase },
        { name: isUrdu ? "\u062A\u0627\u062E\u06CC\u0631 \u0634\u062F\u06C1" : "Overdue Cases", path: "/admin/overdue-cases", icon: AlertTriangle },
        { name: isUrdu ? "\u067E\u0627\u0633\u067E\u0648\u0631\u0679 \u0679\u0631\u06CC\u06A9\u0631" : "Passport Tracker", path: "/admin/passport-tracker", icon: BookOpen },
        { name: isUrdu ? "\u062F\u0633\u062A\u0627\u0648\u06CC\u0632\u0627\u062A" : "Documents", path: "/admin/documents", icon: FolderOpen },
      ],
    },
    {
      name: isUrdu ? "\u0679\u06CC\u0645 \u0645\u06CC\u0646\u062C\u0645\u0646\u0679" : "Team Management",
      icon: Users,
      subsections: [
        { name: isUrdu ? "\u0679\u06CC\u0645" : "Team", path: "/admin/team", icon: Users },
        { name: isUrdu ? "\u0627\u06CC\u062C\u0646\u0679 \u06A9\u0648\u0688\u0632" : "Agent Codes", path: "/admin/agent-codes", icon: Key },
        { name: isUrdu ? "\u0644\u06CC\u0688\u0631 \u0628\u0648\u0631\u0688" : "Leaderboard", path: "/admin/leaderboard", icon: Award },
        { name: isUrdu ? "\u062D\u0627\u0636\u0631\u06CC" : "Attendance", path: "/admin/attendance", icon: Clock },
        { name: isUrdu ? "\u0635\u0627\u0631\u0641 \u0627\u0646\u062A\u0638\u0627\u0645" : "User Management", path: "/admin/user-management", icon: Shield },
      ],
    },
    {
      name: isUrdu ? "\u0631\u067E\u0648\u0631\u0679\u0633 \u0648 \u062A\u062C\u0632\u06CC\u0627\u062A" : "Reports & Analytics",
      icon: BarChart3,
      label: isUrdu ? "\u0628\u0635\u06CC\u0631\u062A" : "INSIGHTS",
      subsections: [
        { name: isUrdu ? "\u062A\u062C\u0632\u06CC\u0627\u062A" : "Analytics", path: "/admin/analytics", icon: PieChart },
        { name: isUrdu ? "\u0631\u067E\u0648\u0631\u0679\u0633" : "Reports", path: "/admin/reports", icon: FileText },
        { name: isUrdu ? "\u0628\u0632\u0646\u0633 \u0627\u0646\u0679\u06CC\u0644\u06CC\u062C\u0646\u0633" : "Business Intelligence", path: "/admin/business-intelligence", icon: Brain },
      ],
    },
    {
      name: isUrdu ? "\u0645\u0627\u0644\u06CC\u0627\u062A" : "Financials",
      path: "/admin/financials",
      icon: DollarSign,
    },
    {
      name: isUrdu ? "\u0622\u067E\u0631\u06CC\u0634\u0646\u0632" : "Operations",
      path: "/admin/operations",
      icon: Monitor,
    },
    {
      name: isUrdu ? "AI \u0679\u0648\u0644\u0632" : "AI Tools",
      icon: Bot,
      label: isUrdu ? "\u0645\u0635\u0646\u0648\u0639\u06CC \u0630\u06C1\u0627\u0646\u062A" : "AI",
      subsections: [
        { name: isUrdu ? "AI \u06C1\u0628" : "AI Tools Hub", path: "/master/ai-tools", icon: Sparkles },
        { name: isUrdu ? "\u0686\u06CC\u0679 \u0628\u0648\u0679" : "AI Chatbot", path: "/master/ai-chatbot", icon: MessageCircle },
        { name: isUrdu ? "\u0622\u0648\u0627\u0632 \u0627\u0633\u0633\u0679\u0646\u0679" : "Voice Assistant", path: "/master/voice-assistant", icon: Mic },
        { name: isUrdu ? "\u067E\u0627\u0626\u06CC\u067E \u0644\u0627\u0626\u0646 \u0679\u06CC\u0633\u0679" : "StepFun Pipeline Test", path: "/master/stepfun-test", icon: Zap },
      ],
    },
    {
      name: isUrdu ? "\u0633\u0633\u0679\u0645" : "System",
      icon: Settings,
      label: isUrdu ? "\u062A\u0631\u062A\u06CC\u0628\u0627\u062A" : "SYSTEM",
      subsections: [
        { name: isUrdu ? "\u0645\u0646\u0638\u0648\u0631\u06CC \u0642\u0637\u0627\u0631" : "Approval Queue", path: "/admin/approval-queue", icon: ClipboardCheck },
        { name: isUrdu ? "\u0622\u0688\u0679 \u0644\u0627\u06AF" : "Audit Log", path: "/admin/audit-log", icon: ScrollText },
        { name: isUrdu ? "\u0622\u0688\u0679 \u0688\u06CC\u0634 \u0628\u0648\u0631\u0688" : "Audit Dashboard", path: "/master/audit-dashboard", icon: Shield },
        { name: isUrdu ? "\u0628\u06CC\u06A9 \u0627\u067E" : "Data Backup", path: "/admin/backup", icon: Database },
        { name: isUrdu ? "API \u06C1\u06CC\u0644\u062A\u06BE" : "API Health", path: "/admin/health", icon: Activity },
        { name: isUrdu ? "\u0633\u0646\u06A9 \u062A\u0627\u0631\u06CC\u062E" : "Sync History", path: "/admin/sync-history", icon: GitMerge },
        { name: isUrdu ? "\u062A\u0631\u062A\u06CC\u0628\u0627\u062A" : "Settings", path: "/admin/settings", icon: Settings },
        { name: isUrdu ? "\u067E\u0631\u0648\u0641\u0627\u0626\u0644" : "Profile", path: "/master/profile", icon: UserCircle },
      ],
    },
  ];

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName) ? prev.filter(s => s !== sectionName) : [...prev, sectionName]
    );
  };

  useEffect(() => {
    menuSections.forEach(section => {
      if (section.subsections) {
        const hasActive = section.subsections.some(sub => sub.path === location.pathname);
        if (hasActive && !expandedSections.includes(section.name)) {
          setExpandedSections(prev => [...prev, section.name]);
        }
      }
    });
  }, [location.pathname]);

  const handleLogout = () => {
    AuditLogService.logAuth(session?.fullName || "Master Admin", "master_admin", "logout");
    UserDB.masterLogout();
    navigate("/master/login");
  };

  const sidebarWidth = collapsed ? 76 : 270;

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`${isUrdu ? fontClass : ""} fixed lg:sticky top-0 h-screen flex-col z-40 overflow-hidden hidden lg:flex ${
        isUrdu ? "right-0" : "left-0"
      }`}
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 40%, #0f0520 100%)"
          : "linear-gradient(180deg, #6b21a8 0%, #7c3aed 40%, #8b5cf6 100%)",
      }}
    >
      {/* Edge accent */}
      <motion.div
        className={`absolute ${isUrdu ? "left-0" : "right-0"} top-0 bottom-0 w-[1px]`}
        style={{
          background: darkMode
            ? "linear-gradient(180deg, transparent 0%, rgba(168,85,247,0.3) 30%, rgba(168,85,247,0.15) 70%, transparent 100%)"
            : "linear-gradient(180deg, transparent 0%, rgba(196,181,253,0.3) 30%, rgba(196,181,253,0.15) 70%, transparent 100%)",
        }}
      />

      {/* Profile Section */}
      <div className={`${collapsed ? "px-3 pt-5 pb-3" : "px-5 pt-6 pb-4"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <motion.div whileHover={{ scale: 1.1 }} className="relative flex-shrink-0">
            <div className={`${collapsed ? "w-10 h-10" : "w-10 h-10"} rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20`}>
              <Crown className="w-5 h-5 text-white" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-purple-900"
            />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex-1 min-w-0 overflow-hidden">
                <p className={`text-sm font-semibold truncate ${darkMode ? "text-purple-100" : "text-purple-50"}`}>
                  {session?.fullName || "Master Admin"}
                </p>
                <p className={`truncate text-[13px] font-medium ${darkMode ? "text-purple-500/70" : "text-purple-200/70"}`}>
                  {isUrdu ? "\u0645\u0627\u0633\u0679\u0631 \u0627\u06CC\u0688\u0645\u0646" : "Master Admin"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Divider */}
      <div className={`${collapsed ? "px-3" : "px-5"} mb-2`}>
        <div className={`h-px ${darkMode ? "bg-gradient-to-r from-transparent via-purple-700/30 to-transparent" : "bg-gradient-to-r from-transparent via-purple-400/25 to-transparent"}`} />
      </div>

      {/* Navigation */}
      <nav className={`pt-4 pb-3 ${collapsed ? "px-2" : "px-3"} flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin`}>
        {menuSections.map((section, idx) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.includes(section.name) && !collapsed;
          const hasSubsections = section.subsections && section.subsections.length > 0;
          const isDirectActive = section.path === location.pathname;
          const hasActiveSubsection = hasSubsections && section.subsections!.some(sub => sub.path === location.pathname);
          const isActive = isDirectActive || hasActiveSubsection;
          const isHovered = hoveredItem === section.name;

          const sectionBadge = section.subsections?.find(sub => sub.path === "/admin/overdue-cases") && overdueCount > 0 ? overdueCount : undefined;

          return (
            <motion.div
              key={section.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + idx * 0.04, type: "spring", stiffness: 260, damping: 24 }}
            >
              <motion.button
                onMouseEnter={() => setHoveredItem(section.name)}
                onMouseLeave={() => setHoveredItem(null)}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (collapsed && hasSubsections) {
                    setCollapsed(false);
                    setTimeout(() => { if (!expandedSections.includes(section.name)) toggleSection(section.name); }, 300);
                    return;
                  }
                  if (hasSubsections) toggleSection(section.name);
                  else if (section.path) navigate(section.path);
                }}
                className={`relative w-full flex items-center ${collapsed ? "justify-center px-2" : "px-3"} gap-3 py-2.5 rounded-xl transition-colors duration-150 group mb-0.5 ${
                  isActive ? "text-white" : darkMode ? "text-purple-100/80 hover:text-white" : "text-purple-50/80 hover:text-white"
                }`}
              >
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  initial={false}
                  animate={{ opacity: isActive ? 1 : isHovered ? 0.6 : 0, scale: isActive || isHovered ? 1 : 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  style={{
                    background: isActive
                      ? darkMode
                        ? "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(217,70,239,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)"
                      : darkMode ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.04)",
                    border: isActive ? `1px solid ${darkMode ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.1)"}` : "1px solid transparent",
                  }}
                />

                {isActive && (
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    className={`absolute ${isUrdu ? "right-0 rounded-l-full" : "left-0 rounded-r-full"} top-1/2 -translate-y-1/2 w-[3px] h-5 origin-center`}
                    style={{ background: "linear-gradient(180deg, #d8b4fe, #a855f7)", boxShadow: "0 0 12px rgba(168,85,247,0.6)" }}
                  />
                )}

                <motion.div
                  animate={{ scale: isActive ? 1 : isHovered ? 1.08 : 1 }}
                  className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? darkMode ? "bg-purple-500/20" : "bg-white/15" : ""
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] ${
                    isActive ? "text-purple-400" : darkMode ? "text-purple-400/60 group-hover:text-purple-300" : "text-purple-200/60 group-hover:text-purple-100"
                  }`} />
                </motion.div>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                      className={`relative z-10 truncate flex-1 ${isUrdu ? "text-right" : "text-left"} text-[13.5px] ${isActive ? "font-semibold" : "font-medium"}`}
                    >
                      {section.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {sectionBadge && !isExpanded && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className={`relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ${collapsed ? "absolute -top-0.5 -right-0.5" : ""}`}
                  >
                    {sectionBadge}
                  </motion.span>
                )}

                {hasSubsections && !collapsed && (
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} className="relative z-10">
                    <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "text-purple-400/80" : darkMode ? "text-purple-400/40" : "text-purple-200/40"}`} />
                  </motion.div>
                )}
              </motion.button>

              {/* Subsections */}
              <AnimatePresence>
                {hasSubsections && isExpanded && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ height: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                    className="overflow-hidden"
                  >
                    <div className={`${isUrdu ? "mr-6 pr-3" : "ml-6 pl-3"} mt-0.5 mb-1.5 space-y-0.5 relative`}>
                      <motion.div
                        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                        className={`absolute top-0 bottom-2 ${isUrdu ? "right-0" : "left-0"} w-px origin-top ${
                          darkMode ? "bg-gradient-to-b from-purple-600/30 via-purple-700/20 to-transparent" : "bg-gradient-to-b from-purple-400/25 via-purple-400/10 to-transparent"
                        }`}
                      />
                      {section.subsections!.map((sub, subIdx) => {
                        const SubIcon = sub.icon || Icon;
                        const isSubActive = location.pathname === sub.path;
                        const isOverdue = sub.path === "/admin/overdue-cases";
                        const badge = isOverdue && overdueCount > 0 ? overdueCount : undefined;

                        return (
                          <motion.button
                            key={sub.path}
                            initial={{ opacity: 0, x: isUrdu ? 16 : -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: subIdx * 0.04, type: "spring", stiffness: 350, damping: 25 }}
                            whileHover={{ x: isUrdu ? -3 : 3 }}
                            onClick={() => navigate(sub.path)}
                            className={`relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg transition-colors group/sub ${
                              isSubActive
                                ? darkMode ? "bg-purple-500/15 text-white" : "bg-white/12 text-white"
                                : darkMode ? "text-purple-200/60 hover:text-purple-100 hover:bg-purple-500/8" : "text-purple-100/60 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <SubIcon className={`w-4 h-4 flex-shrink-0 ${isSubActive ? "text-purple-400" : ""}`} />
                            <span className={`text-[12.5px] truncate ${isSubActive ? "font-semibold" : "font-medium"}`}>{sub.name}</span>
                            {badge && (
                              <span className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-red-500/90 text-white text-[9px] font-bold flex items-center justify-center">
                                {badge}
                              </span>
                            )}
                            {isSubActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" style={{ boxShadow: "0 0 6px rgba(168,85,247,0.6)" }} />
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
      <div className={`${collapsed ? "px-2" : "px-3"} pb-4 space-y-1`}>
        <div className={`${collapsed ? "px-3" : "px-5"} mb-2`}>
          <div className={`h-px ${darkMode ? "bg-purple-700/30" : "bg-purple-400/25"}`} />
        </div>

        {/* Switch to Admin Portal */}
        <button
          onClick={() => navigate("/admin")}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "px-3"} gap-3 py-2 rounded-xl transition-colors ${
            darkMode ? "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10" : "text-amber-200/70 hover:text-amber-100 hover:bg-amber-500/10"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          {!collapsed && <span className="text-[13px] font-medium">{isUrdu ? "\u0627\u06CC\u0688\u0645\u0646 \u067E\u0648\u0631\u0679\u0644" : "Admin Portal"}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "px-3"} gap-3 py-2 rounded-xl transition-colors ${
            darkMode ? "text-purple-300/60 hover:text-purple-200 hover:bg-purple-500/10" : "text-purple-100/60 hover:text-white hover:bg-white/5"
          }`}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-[13px] font-medium">{isUrdu ? "\u0633\u0645\u06CC\u0679\u06CC\u06BA" : "Collapse"}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "px-3"} gap-3 py-2 rounded-xl transition-colors text-red-400/70 hover:text-red-400 hover:bg-red-500/10`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-[13px] font-medium">{isUrdu ? "\u0644\u0627\u06AF \u0622\u0624\u0679" : "Logout"}</span>}
        </button>
      </div>
    </motion.aside>
  );
}