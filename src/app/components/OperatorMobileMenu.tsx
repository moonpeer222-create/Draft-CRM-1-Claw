import { useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { UserDB } from "../lib/userDatabase";
import { toast } from "../lib/toast";
import {
  BarChart3, FolderPlus, CheckCircle2, Calendar, Users, Clock,
  Building2, DollarSign, FileDown, Monitor, X, Power,
  Moon, Sun, Globe, UserCircle, FileText, Eye,
} from "lucide-react";
import type { OperatorTabId } from "./OperatorSidebar";

interface OperatorMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: OperatorTabId;
  onTabChange: (tab: OperatorTabId) => void;
}

const MENU_ITEMS: { id: OperatorTabId; icon: any; en: string; ur: string }[] = [
  { id: "dashboard", icon: BarChart3, en: "Dashboard", ur: "ڈیش بورڈ" },
  { id: "folders", icon: FolderPlus, en: "Create Case", ur: "نیا کیس" },
  { id: "all-cases", icon: Eye, en: "All Cases", ur: "تمام کیسز" },
  { id: "documents", icon: FileText, en: "Documents", ur: "دستاویزات" },
  { id: "status", icon: CheckCircle2, en: "Status", ur: "صورتحال" },
  { id: "appointments", icon: Calendar, en: "Appointments", ur: "ملاقاتیں" },
  { id: "agent-support", icon: Users, en: "Agent Help", ur: "ایجنٹ مدد" },
  { id: "attendance", icon: Clock, en: "Attendance", ur: "حاضری" },
  { id: "visits", icon: Building2, en: "Office Visits", ur: "آفس وزٹ" },
  { id: "payments", icon: DollarSign, en: "Payments", ur: "ادائیگی" },
  { id: "reports", icon: FileDown, en: "Reports", ur: "رپورٹیں" },
  { id: "profile", icon: UserCircle, en: "Profile", ur: "پروفائل" },
];

export function OperatorMobileMenu({ isOpen, onClose, activeTab, onTabChange }: OperatorMobileMenuProps) {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, toggleLanguage, isUrdu, fontClass } = useTheme();
  const u = (en: string, ur: string) => (isUrdu ? ur : en);
  const session = UserDB.getOperatorSession();

  const handleLogout = () => {
    onClose();
    UserDB.operatorLogout();
    toast.success(u("Logged out", "لاگ آؤٹ ہو گیا"));
    setTimeout(() => navigate("/"), 500);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ x: isUrdu ? "100%" : "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isUrdu ? "100%" : "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`${isUrdu ? fontClass : ""} fixed top-0 ${isUrdu ? "right-0" : "left-0"} h-full w-[85%] max-w-[340px] z-[91] overflow-y-auto`}
            style={{
              background: darkMode
                ? "linear-gradient(180deg, #0f172a 0%, #064e3b 40%, #022c22 100%)"
                : "linear-gradient(180deg, #064e3b 0%, #047857 40%, #059669 100%)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-50">{session?.fullName || "Operator"}</p>
                  <p className="text-[11px] text-emerald-200/60">{u("Computer Operator", "کمپیوٹر آپریٹر")}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-emerald-200" />
              </button>
            </div>

            {/* Divider */}
            <div className="px-5">
              <div className={`h-px ${
                darkMode
                  ? "bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent"
                  : "bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent"
              }`} />
            </div>

            {/* Navigation */}
            <nav className="px-3 pt-4 pb-3 space-y-1">
              {MENU_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: isUrdu ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onTabChange(item.id)}
                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl min-h-[48px] transition-all ${
                      isActive
                        ? "text-white"
                        : "text-emerald-100/70 hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobileActiveTab"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: darkMode
                            ? "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(20,184,166,0.1) 100%)"
                            : "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                          border: `1px solid ${darkMode ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.15)"}`,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {isActive && (
                      <motion.div
                        className={`absolute ${isUrdu ? "right-0 rounded-l-full" : "left-0 rounded-r-full"} top-1/2 -translate-y-1/2 w-[3px] h-5`}
                        style={{
                          background: "linear-gradient(180deg, #34d399, #10b981)",
                          boxShadow: "0 0 12px rgba(52,211,153,0.6)",
                        }}
                      />
                    )}
                    <div className={`relative z-10 w-9 h-9 rounded-lg flex items-center justify-center ${
                      isActive
                        ? darkMode ? "bg-emerald-500/20" : "bg-white/15"
                        : ""
                    }`}>
                      <Icon className={`w-[18px] h-[18px] ${
                        isActive ? "text-emerald-400" : darkMode ? "text-emerald-400/50" : "text-emerald-200/50"
                      }`} />
                    </div>
                    <span className={`relative z-10 text-[14px] ${isActive ? "font-semibold" : "font-medium"}`}>
                      {isUrdu ? item.ur : item.en}
                    </span>
                  </motion.button>
                );
              })}
            </nav>

            {/* Bottom Controls */}
            <div className="px-3 pb-6 mt-4">
              <div className={`h-px mb-4 mx-2 ${
                darkMode
                  ? "bg-gradient-to-r from-transparent via-emerald-700/25 to-transparent"
                  : "bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
              }`} />

              <div className="flex gap-2 px-2 mb-3">
                <button
                  onClick={() => { toggleLanguage(); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl min-h-[48px] bg-white/10 text-emerald-100 text-sm font-medium"
                >
                  <Globe className="w-4 h-4" />
                  {isUrdu ? "English" : "اردو"}
                </button>
                <button
                  onClick={() => { toggleDarkMode(); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl min-h-[48px] bg-white/10 text-emerald-100 text-sm font-medium"
                >
                  {darkMode ? <Sun className="w-4 h-4 text-yellow-300" /> : <Moon className="w-4 h-4" />}
                  {darkMode ? u("Light", "لائٹ") : u("Dark", "ڈارک")}
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl min-h-[48px] bg-red-500/15 text-red-400 text-sm font-bold"
              >
                <Power className="w-4 h-4" />
                {u("Logout", "لاگ آؤٹ")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}