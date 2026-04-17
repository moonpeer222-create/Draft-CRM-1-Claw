import { useNavigate, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar, 
  BarChart3, 
  Clock, 
  LogOut, 
  UserCircle,
  ChevronRight,
  TrendingUp,
  Lock,
  CreditCard,
  FolderOpen,
  Sparkles,
  Power,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  BookOpen,
  DollarSign,
  Users,
  MessageCircle,
  Mic,
  Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { AuditLogService } from "../lib/auditLog";
import { AccessCodeService } from "../lib/accessCode";
// (no mockData imports needed)
import { useState, useEffect } from "react";

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

export function AgentSidebar() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, t, isUrdu, fontClass } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview"]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Auto-expand section containing current path — must be above early return guard
  useEffect(() => {
    if (insideUnifiedLayout) return; // skip logic when not rendering
    const subsectionPaths = [
      { paths: ["/agent/cases", "/agent/calendar"], section: isUrdu ? "کام" : "Work" },
      { paths: ["/agent/performance", "/agent/attendance"], section: isUrdu ? "کارکردگی" : "Performance" },
      { paths: ["/agent/ai-chatbot", "/agent/voice-assistant"], section: isUrdu ? "AI ٹولز" : "AI Tools" },
    ];
    subsectionPaths.forEach(({ paths, section }) => {
      if (paths.includes(location.pathname)) {
        setExpandedSections(prev => prev.includes(section) ? prev : [...prev, section]);
      }
    });
  }, [location.pathname, insideUnifiedLayout, isUrdu]);

  if (insideUnifiedLayout) return null;

  const menuSections: MenuItem[] = [
    {
      name: t("nav.dashboard"),
      path: "/agent",
      icon: LayoutDashboard,
    },
    {
      name: isUrdu ? "کام" : "Work",
      icon: Briefcase,
      subsections: [
        { name: t("nav.myCases"), path: "/agent/cases", icon: Briefcase },
        { name: t("nav.calendar"), path: "/agent/calendar", icon: Calendar },
      ],
    },
    {
      name: isUrdu ? "کارکردگی" : "Performance",
      icon: BarChart3,
      subsections: [
        { name: t("nav.performance"), path: "/agent/performance", icon: TrendingUp },
        { name: t("nav.attendance"), path: "/agent/attendance", icon: Clock },
      ],
    },
    {
      name: isUrdu ? "AI ٹولز" : "AI Tools",
      icon: Bot,
      subsections: [
        { name: isUrdu ? "چیٹ بوٹ" : "AI Chatbot", path: "/agent/ai-chatbot", icon: MessageCircle },
        { name: isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant", path: "/agent/voice-assistant", icon: Mic },
      ],
    },
    {
      name: isUrdu ? "پروفائل" : "Profile",
      path: "/agent/profile",
      icon: UserCircle,
    },
  ];

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  return (
    <>
      {/* Sidebar — desktop only; mobile nav is handled by AgentMobileMenu */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? 80 : 264,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`${isUrdu ? fontClass : ""} fixed lg:sticky top-0 h-screen flex-col z-40 hidden lg:flex ${
          isUrdu ? "right-0" : "left-0"
        }`}
        style={{
          background: darkMode
            ? "linear-gradient(180deg, #111827 0%, #0f172a 50%, #0c1220 100%)"
            : "linear-gradient(180deg, #ffffff 0%, #f9fafb 50%, #f3f4f6 100%)",
          borderRight: darkMode ? "1px solid rgba(55,65,81,0.5)" : "1px solid rgba(229,231,235,1)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Desktop Toggle Button - Collapse/Expand */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:flex absolute ${isUrdu ? "left-0" : "right-0"} top-20 ${
            isUrdu ? "-translate-x-1/2" : "translate-x-1/2"
          } z-50 w-7 h-7 items-center justify-center rounded-full shadow-lg border transition-colors ${
            darkMode 
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? (isUrdu ? 180 : 0) : (isUrdu ? 0 : 180) }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {isUrdu ? (
              <ChevronsRight className={`w-3.5 h-3.5 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
            ) : (
              <ChevronsLeft className={`w-3.5 h-3.5 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
            )}
          </motion.div>
        </motion.button>

        {/* Top accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="h-[2px] origin-left bg-gradient-to-r from-blue-500 via-indigo-400 to-transparent"
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className={`p-5 pb-4`}
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="relative"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/25">
                E
              </div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 ${darkMode ? "border-gray-900" : "border-white"}`}
              />
            </motion.div>
            
          </div>
        </motion.div>

        {/* Divider */}
        <div className="px-5">
          <div className={`h-px ${
            darkMode
              ? "bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"
              : "bg-gradient-to-r from-transparent via-gray-200 to-transparent"
          }`} />
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {menuSections.map((section, idx) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.includes(section.name);
            const hasSubsections = section.subsections && section.subsections.length > 0;
            const isDirectActive = section.path === location.pathname;
            const hasActiveSubsection = hasSubsections && section.subsections!.some(
              sub => sub.path === location.pathname
            );
            const isActive = isDirectActive || hasActiveSubsection;
            const isHovered = hoveredItem === section.name;

            return (
              <motion.div
                key={section.name}
                initial={{ opacity: 0, x: isUrdu ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.1 + idx * 0.05,
                  type: "spring",
                  stiffness: 260,
                  damping: 24,
                }}
              >
                {/* Section Header */}
                <CollapsedTooltip label={section.name} show={isCollapsed}>
                  <motion.button
                    onMouseEnter={() => setHoveredItem(section.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (hasSubsections && !isCollapsed) {
                        toggleSection(section.name);
                      } else if (section.path) {
                        navigate(section.path);
                      } else if (hasSubsections && isCollapsed && section.subsections![0]) {
                        // Navigate to first subsection when collapsed
                        navigate(section.subsections![0].path);
                      }
                    }}
                    className={`relative w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3.5 py-2.5 rounded-xl transition-colors duration-150 group ${
                      isActive
                        ? darkMode
                          ? "text-blue-400"
                          : "text-blue-700"
                        : darkMode
                          ? "text-gray-400 hover:text-gray-200"
                          : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {/* Background */}
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : isHovered ? 0.5 : 0,
                        scale: isActive || isHovered ? 1 : 0.97,
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{
                        background: isActive
                          ? darkMode
                            ? "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.06) 100%)"
                            : "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.03) 100%)"
                          : darkMode
                            ? "rgba(55,65,81,0.15)"
                            : "rgba(243,244,246,0.8)",
                        border: isActive
                          ? `1px solid ${darkMode ? "rgba(96,165,250,0.15)" : "rgba(59,130,246,0.15)"}`
                          : "1px solid transparent",
                      }}
                    />

                    {/* Active left bar */}
                    <AnimatePresence>
                      {isActive && !isCollapsed && (
                        <motion.div
                          initial={{ scaleY: 0, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          exit={{ scaleY: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={`absolute ${isUrdu ? "right-0 rounded-l-full" : "left-0 rounded-r-full"} top-1/2 -translate-y-1/2 w-[3px] h-5 origin-center`}
                          style={{
                            background: "linear-gradient(180deg, #3b82f6, #6366f1)",
                            boxShadow: "0 0 10px rgba(59,130,246,0.5)",
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon */}
                    <motion.div
                      animate={{
                        scale: isHovered && !isActive ? 1.1 : 1,
                        rotate: isHovered && !isActive ? 4 : 0,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                        isActive
                          ? darkMode
                            ? "bg-blue-500/15"
                            : "bg-blue-100"
                          : ""
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200 ${
                        isActive
                          ? "text-blue-500"
                          : darkMode
                            ? "text-gray-500 group-hover:text-gray-300"
                            : "text-gray-400 group-hover:text-gray-600"
                      }`} />
                    </motion.div>

                    {/* Text - Hidden when collapsed */}
                    {!isCollapsed && (
                      <>
                        <span className={`relative z-10 text-[13.5px] truncate flex-1 text-left transition-all duration-200 ${
                          isActive ? "font-semibold" : "font-medium"
                        }`}>{section.name}</span>
                        
                        {hasSubsections && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="relative z-10"
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-colors ${
                              isActive
                                ? darkMode ? "text-blue-400/70" : "text-blue-600/70"
                                : darkMode ? "text-gray-600" : "text-gray-400"
                            }`} />
                          </motion.div>
                        )}

                        {isDirectActive && !hasSubsections && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="relative z-10 w-1.5 h-1.5 rounded-full bg-blue-500"
                            style={{ boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          />
                        )}
                      </>
                    )}

                    {/* Active dot when collapsed */}
                    {isCollapsed && isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500"
                        style={{ boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      />
                    )}
                  </motion.button>
                </CollapsedTooltip>

                {/* Subsections - Hidden when collapsed */}
                {!isCollapsed && (
                  <AnimatePresence>
                    {hasSubsections && isExpanded && (
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
                        <div className={`${isUrdu ? "mr-6 pr-3" : "ml-6 pl-3"} mt-0.5 mb-1 space-y-0.5 relative`}>
                          {/* Connecting line */}
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ duration: 0.3, delay: 0.05 }}
                            className={`absolute top-0 bottom-2 ${isUrdu ? "right-0" : "left-0"} w-px origin-top ${
                              darkMode
                                ? "bg-gradient-to-b from-gray-700/50 via-gray-700/25 to-transparent"
                                : "bg-gradient-to-b from-gray-200 via-gray-200/50 to-transparent"
                            }`}
                          />

                          {section.subsections!.map((subsection, subIdx) => {
                            const SubIcon = subsection.icon || Icon;
                            const isSubActive = location.pathname === subsection.path;

                            return (
                              <motion.button
                                key={subsection.path}
                                initial={{ opacity: 0, x: isUrdu ? 14 : -14 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isUrdu ? 14 : -14 }}
                                transition={{
                                  delay: subIdx * 0.04,
                                  type: "spring",
                                  stiffness: 350,
                                  damping: 25,
                                }}
                                whileHover={{ x: isUrdu ? -3 : 3 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(subsection.path)}
                                className={`relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-colors duration-150 group/sub ${
                                  isSubActive
                                    ? darkMode
                                      ? "text-blue-300"
                                      : "text-blue-700"
                                    : darkMode
                                      ? "text-gray-500 hover:text-gray-300"
                                      : "text-gray-500 hover:text-gray-700"
                                }`}
                              >
                                {/* Active bg */}
                                {isSubActive && (
                                  <motion.div
                                    layoutId="agentSubActiveBg"
                                    className={`absolute inset-0 rounded-lg ${
                                      darkMode
                                        ? "bg-blue-500/10 border border-blue-500/10"
                                        : "bg-blue-50 border border-blue-100"
                                    }`}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                  />
                                )}

                                {/* Hover bg */}
                                {!isSubActive && (
                                  <div className={`absolute inset-0 rounded-lg opacity-0 group-hover/sub:opacity-100 transition-opacity duration-150 ${
                                    darkMode ? "bg-gray-800/30" : "bg-gray-100/80"
                                  }`} />
                                )}

                                {/* Dot */}
                                <motion.div
                                  animate={isSubActive ? { scale: [1, 1.3, 1] } : {}}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                  className={`absolute ${isUrdu ? "-right-3" : "-left-3"} top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                                    isSubActive
                                      ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"
                                      : darkMode
                                        ? "bg-gray-700 group-hover/sub:bg-gray-500"
                                        : "bg-gray-300 group-hover/sub:bg-gray-400"
                                  }`}
                                />

                                <SubIcon className={`relative z-10 w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${
                                  isSubActive
                                    ? "text-blue-500"
                                    : darkMode
                                      ? "text-gray-600 group-hover/sub:text-gray-400"
                                      : "text-gray-400 group-hover/sub:text-gray-600"
                                }`} />
                                <span className={`relative z-10 text-[12.5px] truncate flex-1 text-left ${
                                  isSubActive ? "font-medium" : ""
                                }`}>
                                  {subsection.name}
                                </span>
                                
                                {isSubActive && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="relative z-10 w-1 h-1 rounded-full bg-blue-500"
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                  />
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            );
          })}

          {/* Restricted Admin-Only Items */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`mt-5 pt-3 border-t ${darkMode ? "border-gray-800" : "border-gray-100"}`}
          >
            
            {[
              { name: isUrdu ? "ادائیگیاں" : "Payments", icon: CreditCard, badge: isUrdu ? "ایڈمن منوری" : "Admin Approval" },
              { name: isUrdu ? "دستاویزات" : "Documents", icon: FolderOpen, badge: isUrdu ? "صرف ایڈمن" : "Admin Only" },
            ].map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                null
              );
            })}
          </motion.div>
        </nav>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3"
        >
          {/* Divider */}
          <div className={`h-px mb-3 mx-2 ${
            darkMode
              ? "bg-gradient-to-r from-transparent via-gray-700/40 to-transparent"
              : "bg-gradient-to-r from-transparent via-gray-200 to-transparent"
          }`} />

          {/* Version */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Sparkles className={`w-3 h-3 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
            
          </div>

          {/* Logout */}
          <CollapsedTooltip label={t("logout")} show={isCollapsed}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                const session = AccessCodeService.getAgentSession();
                const agentName = session?.agentName || "Agent";
                AuditLogService.logAuth(agentName, "agent", "logout");
                AccessCodeService.agentLogout();
                navigate("/");
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                darkMode
                  ? "text-gray-500 hover:bg-red-900/15 hover:text-red-400"
                  : "text-gray-500 hover:bg-red-50 hover:text-red-600"
              }`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                <Power className="w-4 h-4 flex-shrink-0" />
              </div>
              {!isCollapsed && (
                <span className="text-[13px] font-medium">{t("logout")}</span>
              )}
            </motion.button>
          </CollapsedTooltip>
        </motion.div>
      </motion.aside>
    </>
  );
}