import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  BarChart3, FolderPlus, CheckCircle2, Calendar, Users, Clock,
  Building2, DollarSign, FileDown, Monitor, Gem, Power,
  ChevronsLeft, ChevronsRight, ChevronRight, Sparkles, UserCircle,
  FileText, Eye, Bot, Mic,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { UserDB } from "../lib/userDatabase";

export type OperatorTabId = "dashboard" | "folders" | "status" | "appointments" | "agent-support" | "attendance" | "visits" | "payments" | "reports" | "profile" | "documents" | "all-cases";

interface OperatorSidebarProps {
  activeTab: OperatorTabId;
  onTabChange: (tab: OperatorTabId) => void;
}

interface MenuItem {
  id: OperatorTabId;
  name: string;
  nameShort?: string;
  icon: any;
  label?: string;
}

// Floating tooltip for collapsed mode
function CollapsedTooltip({ children, label, show, isRtl }: { children: React.ReactNode; label: string; show: boolean; isRtl?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      <AnimatePresence>
        {show && hovered && (
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 8 : -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: isRtl ? 8 : -8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`absolute ${isRtl ? "right-full mr-3" : "left-full ml-3"} top-1/2 -translate-y-1/2 z-[60] px-3 py-1.5 rounded-lg bg-gray-900 text-emerald-100 text-xs font-medium shadow-xl shadow-black/30 border border-emerald-500/20 whitespace-nowrap pointer-events-none`}
          >
            <div className={`absolute ${isRtl ? "-right-1" : "-left-1"} top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-gray-900 ${isRtl ? "border-r border-t" : "border-l border-b"} border-emerald-500/20`} />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OperatorSidebar({ activeTab, onTabChange }: OperatorSidebarProps) {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (insideUnifiedLayout) return null;

  const session = UserDB.getOperatorSession();
  const u = (en: string, ur: string) => (isUrdu ? ur : en);

  const menuItems: MenuItem[] = [
    { id: "dashboard", name: u("Dashboard", "ڈیش بورڈ"), nameShort: u("Dash", "ڈیش"), icon: BarChart3, label: u("MAIN", "مرکزی") },
    { id: "folders", name: u("Create Case", "نیا کیس"), nameShort: u("Create", "بنائیں"), icon: FolderPlus, label: u("CASE MANAGEMENT", "کیس مینجمنٹ") },
    { id: "all-cases", name: u("All Cases", "تمام کیسز"), nameShort: u("All", "تمام"), icon: Eye },
    { id: "documents", name: u("Documents", "دستاویزات"), nameShort: u("Docs", "دستاویز"), icon: FileText },
    { id: "status", name: u("Status", "صورتحال"), nameShort: u("Status", "حالت"), icon: CheckCircle2, label: u("OPERATIONS", "آپریشنز") },
    { id: "appointments", name: u("Appointments", "ملاقاتیں"), nameShort: u("Appts", "ملاقات"), icon: Calendar },
    { id: "agent-support", name: u("Agent Help", "ایجنٹ مدد"), nameShort: u("Help", "مدد"), icon: Users },
    { id: "attendance", name: u("Attendance", "حاضری"), nameShort: u("Attend", "حاضری"), icon: Clock, label: u("TRACKING", "ٹریکنگ") },
    { id: "visits", name: u("Office Visits", "آفس وزٹ"), nameShort: u("Visits", "وزٹ"), icon: Building2 },
    { id: "payments", name: u("Payments", "ادائیگی"), nameShort: u("Pay", "ادائیگی"), icon: DollarSign, label: u("FINANCE", "مالیات") },
    { id: "reports", name: u("Reports", "رپورٹیں"), nameShort: u("Reports", "رپورٹ"), icon: FileDown },
    { id: "profile", name: u("Profile", "پروفائل"), nameShort: u("Profile", "پروفائل"), icon: UserCircle, label: u("ACCOUNT", "اکاؤنٹ") },
  ];

  let lastLabel = "";
  const sidebarWidth = collapsed ? 76 : 270;

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`${isUrdu ? fontClass : ""} sticky top-0 h-screen flex-col z-40 overflow-hidden hidden lg:flex ${
          isUrdu ? "right-0" : "left-0"
        }`}
        style={{
          background: darkMode
            ? "linear-gradient(180deg, #0f172a 0%, #064e3b 40%, #022c22 100%)"
            : "linear-gradient(180deg, #064e3b 0%, #047857 40%, #059669 100%)",
        }}
      >
        {/* Animated edge accent */}
        <motion.div
          className={`absolute ${isUrdu ? "left-0" : "right-0"} top-0 bottom-0 w-[1px]`}
          style={{
            background: darkMode
              ? "linear-gradient(180deg, transparent 0%, rgba(52,211,153,0.3) 30%, rgba(52,211,153,0.15) 70%, transparent 100%)"
              : "linear-gradient(180deg, transparent 0%, rgba(110,231,183,0.3) 30%, rgba(110,231,183,0.15) 70%, transparent 100%)",
          }}
        />

        {/* Profile Section */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`${collapsed ? "px-3 pt-5 pb-3" : "px-5 pt-6 pb-4"}`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="relative flex-shrink-0"
            >
              <div className={`${collapsed ? "w-10 h-10" : "w-10 h-10"} rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20`}>
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-900"
              />
            </motion.div>

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
                      darkMode ? "text-emerald-100" : "text-emerald-50"
                    }`}
                  >
                    {session?.fullName || "Operator"}
                  </motion.p>
                  <p className={`truncate text-[13px] font-medium ${darkMode ? "text-emerald-500/70" : "text-emerald-200/70"}`}>
                    {u("Computer Operator", "کمپیوٹر آپریٹر")}
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
              ? "bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent"
              : "bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent"
          }`} />
        </div>

        {/* Navigation */}
        <nav className={`pt-4 pb-3 ${collapsed ? "px-2" : "px-3"} flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin`}>
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isHovered = hoveredItem === item.id;

            const showLabel = item.label && item.label !== lastLabel && !collapsed;
            if (item.label) lastLabel = item.label;

            return (
              <motion.div
                key={item.id}
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
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className={`text-[10px] font-bold tracking-widest uppercase px-3 pt-4 pb-1.5 ${
                        darkMode ? "text-emerald-500/40" : "text-emerald-200/50"
                      }`}
                    >
                      {item.label}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Menu Item */}
                <CollapsedTooltip label={item.name} show={collapsed} isRtl={isUrdu}>
                  <motion.button
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onTabChange(item.id)}
                    className={`relative w-full flex items-center ${collapsed ? "justify-center px-2" : "px-3"} gap-3 py-2.5 rounded-xl transition-colors duration-150 group mb-0.5 ${
                      isActive
                        ? "text-white"
                        : darkMode
                          ? "text-emerald-100/80 hover:text-white"
                          : "text-emerald-50/80 hover:text-white"
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
                            ? "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(20,184,166,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)"
                          : darkMode
                            ? "rgba(16,185,129,0.06)"
                            : "rgba(255,255,255,0.04)",
                        border: isActive
                          ? `1px solid ${darkMode ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.1)"}`
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
                            background: "linear-gradient(180deg, #34d399, #10b981)",
                            boxShadow: "0 0 12px rgba(52,211,153,0.6), 0 0 4px rgba(52,211,153,0.8)",
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
                            ? "bg-emerald-500/20 shadow-sm shadow-emerald-500/20"
                            : "bg-white/15 shadow-sm"
                          : "group-hover:bg-emerald-500/8"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] transition-colors duration-200 ${
                        isActive
                          ? "text-emerald-400"
                          : darkMode
                            ? "text-emerald-400/60 group-hover:text-emerald-300"
                            : "text-emerald-200/60 group-hover:text-emerald-100"
                      }`} />

                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-lg"
                          animate={{
                            boxShadow: [
                              "0 0 0px rgba(52,211,153,0)",
                              "0 0 8px rgba(52,211,153,0.3)",
                              "0 0 0px rgba(52,211,153,0)",
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
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
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Active dot */}
                    {isActive && !collapsed && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="relative z-10 w-1.5 h-1.5 rounded-full bg-emerald-400"
                        style={{ boxShadow: "0 0 8px rgba(52,211,153,0.6)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      />
                    )}
                  </motion.button>
                </CollapsedTooltip>
              </motion.div>
            );
          })}
        </nav>

        {/* AI Tools Navigation */}
        <div className={`${collapsed ? "px-2" : "px-3"} space-y-0.5 mb-2`}>
          <CollapsedTooltip label={u("AI Chatbot", "AI چیٹ بوٹ")} show={collapsed} isRtl={isUrdu}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/operator/ai-chatbot")}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2 rounded-xl transition-all duration-200 ${
                darkMode ? "text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-500/10" : "text-emerald-100/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 flex-shrink-0" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="text-[12.5px] font-medium whitespace-nowrap overflow-hidden">
                    {u("AI Chatbot", "AI چیٹ بوٹ")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </CollapsedTooltip>
          <CollapsedTooltip label={u("Voice Assistant", "آواز اسسٹنٹ")} show={collapsed} isRtl={isUrdu}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/operator/voice-assistant")}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2 rounded-xl transition-all duration-200 ${
                darkMode ? "text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-500/10" : "text-emerald-100/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 flex-shrink-0" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="text-[12.5px] font-medium whitespace-nowrap overflow-hidden">
                    {u("Voice Assistant", "آواز اسسٹنٹ")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </CollapsedTooltip>
        </div>

        {/* Footer */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`${collapsed ? "p-2" : "p-3"}`}
        >
          {/* Divider */}
          <div className={`h-px mb-3 mx-2 ${
            darkMode
              ? "bg-gradient-to-r from-transparent via-emerald-700/25 to-transparent"
              : "bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
          }`} />

          {/* Collapse Toggle */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCollapsed(prev => !prev)}
            className={`hidden lg:flex w-full items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2 rounded-xl transition-all duration-200 mb-2 ${
              darkMode
                ? "text-emerald-400/50 hover:bg-emerald-800/15 hover:text-emerald-300"
                : "text-emerald-200/50 hover:bg-white/5 hover:text-emerald-100"
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
                  {u("Collapse", "سائیڈبار بند کریں")}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Version tag */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-1.5 mb-2 overflow-hidden"
              >
                <Sparkles className={`w-3 h-3 ${darkMode ? "text-emerald-500/50" : "text-emerald-300/40"}`} />
                <span className={`text-[10px] tracking-wider font-medium ${
                  darkMode ? "text-emerald-500/50" : "text-emerald-300/40"
                }`}>
                  {u("EMERALD OPS v2.0", "ایمرالڈ آپریشنز v2.0")}
                </span>
                <Sparkles className={`w-3 h-3 ${darkMode ? "text-emerald-500/50" : "text-emerald-300/40"}`} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout button */}
          <CollapsedTooltip label={u("Logout", "لاگ آؤٹ")} show={collapsed} isRtl={isUrdu}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                UserDB.operatorLogout();
                navigate("/");
              }}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3.5"} py-2.5 rounded-xl transition-all duration-200 group ${
                darkMode
                  ? "text-emerald-300/50 hover:bg-red-900/15 hover:text-red-400"
                  : "text-emerald-100/50 hover:bg-red-900/20 hover:text-red-300"
              }`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:bg-red-500/10">
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
                    {u("Logout", "لاگ آؤٹ")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </CollapsedTooltip>
        </motion.div>
      </motion.aside>
    </>
  );
}