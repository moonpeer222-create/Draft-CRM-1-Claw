/**
 * UnifiedSidebar — Single sidebar for ALL portal roles.
 * Shows/hides menu items based on the current role.
 * Desktop: fixed sidebar (collapsible).  Mobile: slide-over drawer with safe-area support.
 */
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft, ChevronRight, LogOut, X, Gem, Sun, Moon,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import {
  getGroupedNav, buildPath, GROUP_LABELS, ROLE_INFO,
  type PortalRole,
} from "../lib/navigationConfig";

// Per-role accent color classes
const ROLE_ACCENTS: Record<PortalRole, { active: string; activeBg: string; dot: string; bar: string; hoverBg: string }> = {
  admin:       { active: "text-emerald-400", activeBg: "bg-emerald-500/12", dot: "bg-emerald-400", bar: "from-emerald-400 to-teal-400", hoverBg: "hover:bg-emerald-500/6" },
  agent:       { active: "text-blue-400",    activeBg: "bg-blue-500/12",    dot: "bg-blue-400",    bar: "from-blue-400 to-cyan-400",    hoverBg: "hover:bg-blue-500/6" },
  customer:    { active: "text-purple-400",  activeBg: "bg-purple-500/12",  dot: "bg-purple-400",  bar: "from-purple-400 to-pink-400",  hoverBg: "hover:bg-purple-500/6" },
  operator:    { active: "text-orange-400",  activeBg: "bg-orange-500/12",  dot: "bg-orange-400",  bar: "from-orange-400 to-amber-400",  hoverBg: "hover:bg-orange-500/6" },
  master_admin:{ active: "text-amber-400",   activeBg: "bg-amber-500/12",   dot: "bg-amber-400",   bar: "from-amber-400 to-rose-400",   hoverBg: "hover:bg-amber-500/6" },
};

const ROLE_ACCENTS_LIGHT: Record<PortalRole, { active: string; activeBg: string; dot: string; bar: string; hoverBg: string }> = {
  admin:       { active: "text-emerald-700", activeBg: "bg-emerald-50",  dot: "bg-emerald-600", bar: "from-emerald-500 to-teal-500", hoverBg: "hover:bg-emerald-50/60" },
  agent:       { active: "text-blue-700",    activeBg: "bg-blue-50",     dot: "bg-blue-600",    bar: "from-blue-500 to-cyan-500",    hoverBg: "hover:bg-blue-50/60" },
  customer:    { active: "text-purple-700",  activeBg: "bg-purple-50",   dot: "bg-purple-600",  bar: "from-purple-500 to-pink-500",  hoverBg: "hover:bg-purple-50/60" },
  operator:    { active: "text-orange-700",  activeBg: "bg-orange-50",   dot: "bg-orange-600",  bar: "from-orange-500 to-amber-500", hoverBg: "hover:bg-orange-50/60" },
  master_admin:{ active: "text-amber-700",   activeBg: "bg-amber-50",    dot: "bg-amber-600",   bar: "from-amber-500 to-rose-500",   hoverBg: "hover:bg-amber-50/60" },
};

export function UnifiedSidebar() {
  const { darkMode, isUrdu, toggleDarkMode } = useTheme();
  const {
    role, sidebarCollapsed, setSidebarCollapsed,
    mobileSidebarOpen, setMobileSidebarOpen,
  } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();

  const dc = darkMode;
  const groups = getGroupedNav(role);
  const roleInfo = ROLE_INFO[role];
  const prefix = role === "master_admin" ? "/master" : `/${role}`;
  const accent = dc ? ROLE_ACCENTS[role] : ROLE_ACCENTS_LIGHT[role];

  const isActive = (path: string) => {
    if (path === prefix) return location.pathname === prefix || location.pathname === prefix + "/";
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    navigate(`${prefix}/login`);
  };

  // ── Sidebar content (shared between desktop + mobile drawer) ──────
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo / brand header */}
      <div
        className={`flex items-center gap-3 ${sidebarCollapsed && !isMobile ? "px-3 py-5 justify-center" : "px-5 py-5"} border-b ${
          dc ? "border-white/[0.06]" : "border-gray-100"
        }`}
        style={isMobile ? { paddingTop: "max(env(safe-area-inset-top, 12px), 12px)" } : undefined}
      >
        <motion.div
          whileHover={{ scale: 1.08, rotate: -3 }}
          whileTap={{ scale: 0.95 }}
          className="relative shrink-0"
        >
          <div className={`w-10 h-10 rounded-xl ${roleInfo.bgClass} flex items-center justify-center shadow-lg`}>
            <Gem className="w-5 h-5 text-white" />
          </div>
          {/* Subtle glow */}
          <div className={`absolute inset-0 rounded-xl ${roleInfo.bgClass} blur-lg opacity-30`} />
        </motion.div>
        {(!sidebarCollapsed || isMobile) && (
          <div className="min-w-0 flex-1">
            <h1 className={`text-sm font-bold truncate ${dc ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "ایمرالڈ ٹیک پارٹنر" : "Emerald Tech Partner"}
            </h1>
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
              dc ? "bg-white/8 text-gray-400" : "bg-gray-100 text-gray-500"
            }`}>
              {isUrdu ? roleInfo.labelUrdu : roleInfo.label}
            </span>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className={`p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${dc ? "hover:bg-white/10 text-gray-400 active:bg-white/15" : "hover:bg-gray-100 text-gray-500 active:bg-gray-200"}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation items — momentum scrolling on mobile */}
      <nav className={`flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 ${isMobile ? "overscroll-contain" : ""}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {(["main", "documents", "management", "tools", "system"] as const).map(groupKey => {
          const items = groups[groupKey];
          if (!items || items.length === 0) return null;
          const groupLabel = GROUP_LABELS[groupKey];

          return (
            <div key={groupKey} className="mb-1">
              {(!sidebarCollapsed || isMobile) && (
                <p className={`text-[10px] font-bold uppercase tracking-widest px-3 pt-4 pb-2 ${
                  dc ? "text-gray-600" : "text-gray-400"
                }`}>
                  {isUrdu ? groupLabel.ur : groupLabel.en}
                </p>
              )}
              {sidebarCollapsed && !isMobile && groupKey !== "main" && (
                <div className={`mx-auto my-3 w-5 h-px ${dc ? "bg-white/[0.06]" : "bg-gray-100"}`} />
              )}
              {items.map(item => {
                const fullPath = buildPath(role, item);
                const active = isActive(fullPath);
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => handleNav(fullPath)}
                    title={sidebarCollapsed && !isMobile ? (isUrdu ? item.labelUrdu : item.label) : undefined}
                    whileHover={!isMobile ? { x: active ? 0 : (isUrdu ? -2 : 2) } : undefined}
                    whileTap={{ scale: 0.97 }}
                    className={`relative w-full flex items-center gap-3 rounded-xl transition-all duration-150 group select-none touch-manipulation
                      ${sidebarCollapsed && !isMobile ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}
                      ${isMobile ? "min-h-[44px]" : ""}
                      ${active
                        ? `${accent.activeBg} ${accent.active} font-semibold`
                        : dc
                          ? `text-gray-400 ${accent.hoverBg} hover:text-gray-200`
                          : `text-gray-600 ${accent.hoverBg} hover:text-gray-900`
                      }`}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <motion.div
                        layoutId={isMobile ? "mob-sidebar-active" : "sidebar-active"}
                        className={`absolute ${isUrdu ? "right-0 rounded-l-full" : "left-0 rounded-r-full"} top-1.5 bottom-1.5 w-[3px] bg-gradient-to-b ${accent.bar}`}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className={`shrink-0 w-[19px] h-[19px] transition-colors ${
                      active
                        ? ""
                        : dc ? "text-gray-500 group-hover:text-gray-300" : "text-gray-400 group-hover:text-gray-600"
                    }`} />
                    {(!sidebarCollapsed || isMobile) && (
                      <span className="text-[13px] truncate">
                        {isUrdu ? item.labelUrdu : item.label}
                      </span>
                    )}
                    {active && (!sidebarCollapsed || isMobile) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`ml-auto w-1.5 h-1.5 rounded-full ${accent.dot}`}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer: dark mode toggle (mobile only) + collapse button (desktop) + logout */}
      <div className={`border-t px-2.5 py-3 space-y-1 ${dc ? "border-white/[0.06]" : "border-gray-100"}`}
        style={isMobile ? { paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)" } : undefined}
      >
        {/* Mobile-only dark mode toggle */}
        {isMobile && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={toggleDarkMode}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors min-h-[44px] ${
              dc ? "text-gray-400 hover:bg-white/5 hover:text-gray-300" : "text-gray-500 hover:bg-gray-50 hover:text-gray-600"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {dc ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            {isUrdu ? (dc ? "لائٹ موڈ" : "ڈارک موڈ") : (dc ? "Light Mode" : "Dark Mode")}
          </motion.button>
        )}
        {!isMobile && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
              dc ? "text-gray-500 hover:bg-white/5 hover:text-gray-300" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            } ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            {sidebarCollapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
            {!sidebarCollapsed && (isUrdu ? "سکیڑیں" : "Collapse")}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors min-h-[44px] ${
            dc ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400" : "text-red-500/80 hover:bg-red-50 hover:text-red-600"
          } ${sidebarCollapsed && !isMobile ? "justify-center" : ""}`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <LogOut className="w-4 h-4" />
          {(!sidebarCollapsed || isMobile) && (isUrdu ? "لاگ آؤٹ" : "Logout")}
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 bottom-0 z-30 transition-all duration-300 ease-out border-r ${
          dc
            ? "bg-gray-950/95 backdrop-blur-xl border-white/[0.06]"
            : "bg-white/95 backdrop-blur-xl border-gray-100"
        } ${sidebarCollapsed ? "w-[68px]" : "w-[260px]"}`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.aside
            initial={{ x: isUrdu ? 304 : -304 }}
            animate={{ x: 0 }}
            exit={{ x: isUrdu ? 304 : -304 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className={`fixed top-0 bottom-0 z-50 w-[304px] max-w-[85vw] lg:hidden shadow-2xl ${
              isUrdu ? "right-0" : "left-0"
            } ${dc
              ? "bg-gray-950 border-white/[0.06]"
              : "bg-white border-gray-100"
            } ${isUrdu ? "border-l" : "border-r"}`}
          >
            <SidebarContent isMobile />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}