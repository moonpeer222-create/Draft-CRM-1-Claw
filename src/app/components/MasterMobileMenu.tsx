/**
 * MasterMobileMenu — Full-screen mobile navigation for Master Admin portal.
 * Purple/gold themed, portaled to document.body.
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { UserDB } from "../lib/userDatabase";
import { AuditLogService } from "../lib/auditLog";
import { CRMDataStore, getOverdueInfo } from "../lib/mockData";
import {
  LayoutDashboard, Users, DollarSign, Settings, Briefcase, Shield,
  UserCircle, AlertTriangle, Key, Award, Clock, BarChart3, FileText,
  Brain, FolderOpen, Crown, BookOpen, ClipboardCheck, ScrollText,
  Database, GitMerge, MessageCircle, Mic, Bot, PieChart,
  X, LogOut, Moon, Sun, Globe, ChevronDown, Sparkles, ArrowRightLeft,
  Monitor,
} from "lucide-react";

interface MasterMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuSection {
  name: string;
  icon: any;
  items: { name: string; path: string; icon: any; badge?: number }[];
}

export function MasterMobileMenu({ isOpen, onClose }: MasterMobileMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode, toggleLanguage, isUrdu, fontClass } = useTheme();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const session = UserDB.getMasterSession();
  const dc = darkMode;

  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    const cases = CRMDataStore.getCases();
    setOverdueCount(cases.filter(c => getOverdueInfo(c).isOverdue).length);
  }, [isOpen]);

  useEffect(() => { if (isOpen) onClose(); }, [location.pathname]);

  const sections: MenuSection[] = [
    {
      name: isUrdu ? "مرکزی" : "Main",
      icon: LayoutDashboard,
      items: [
        { name: isUrdu ? "ڈیش بورڈ" : "Dashboard", path: "/master", icon: LayoutDashboard },
      ],
    },
    {
      name: isUrdu ? "آپریشنز" : "Operations",
      icon: Briefcase,
      items: [
        { name: isUrdu ? "کیسز" : "Cases", path: "/admin/cases", icon: Briefcase },
        { name: isUrdu ? "تاخیر شدہ" : "Overdue", path: "/admin/overdue-cases", icon: AlertTriangle, badge: overdueCount || undefined },
        { name: isUrdu ? "پاسپورٹ" : "Passport", path: "/admin/passport-tracker", icon: BookOpen },
        { name: isUrdu ? "دستاویزات" : "Documents", path: "/admin/documents", icon: FolderOpen },
      ],
    },
    {
      name: isUrdu ? "ٹیم" : "Team",
      icon: Users,
      items: [
        { name: isUrdu ? "ٹیم" : "Team", path: "/admin/team", icon: Users },
        { name: isUrdu ? "کوڈز" : "Codes", path: "/admin/agent-codes", icon: Key },
        { name: isUrdu ? "لیڈر بورڈ" : "Leaderboard", path: "/admin/leaderboard", icon: Award },
        { name: isUrdu ? "حاضری" : "Attendance", path: "/admin/attendance", icon: Clock },
        { name: isUrdu ? "صارفین" : "Users", path: "/admin/user-management", icon: Shield },
      ],
    },
    {
      name: isUrdu ? "بصیرت" : "Insights",
      icon: BarChart3,
      items: [
        { name: isUrdu ? "تجزیات" : "Analytics", path: "/admin/analytics", icon: PieChart },
        { name: isUrdu ? "رپورٹس" : "Reports", path: "/admin/reports", icon: FileText },
        { name: isUrdu ? "BI" : "BI", path: "/admin/business-intelligence", icon: Brain },
        { name: isUrdu ? "مالیات" : "Financials", path: "/admin/financials", icon: DollarSign },
        { name: isUrdu ? "آپریشنز سینٹر" : "Operations Center", path: "/admin/operations", icon: Monitor },
      ],
    },
    {
      name: isUrdu ? "AI ٹولز" : "AI Tools",
      icon: Bot,
      items: [
        { name: isUrdu ? "AI ہب" : "AI Tools Hub", path: "/master/ai-tools", icon: Sparkles },
        { name: isUrdu ? "چیٹ بوٹ" : "AI Chatbot", path: "/master/ai-chatbot", icon: MessageCircle },
        { name: isUrdu ? "آواز" : "Voice Assistant", path: "/master/voice-assistant", icon: Mic },
      ],
    },
    {
      name: isUrdu ? "سسٹم" : "System",
      icon: Settings,
      items: [
        { name: isUrdu ? "منظوری" : "Approvals", path: "/admin/approval-queue", icon: ClipboardCheck },
        { name: isUrdu ? "آڈٹ" : "Audit Log", path: "/admin/audit-log", icon: ScrollText },
        { name: isUrdu ? "بیک اپ" : "Backup", path: "/admin/backup", icon: Database },
        { name: isUrdu ? "سنک" : "Sync", path: "/admin/sync-history", icon: GitMerge },
        { name: isUrdu ? "ترتیبات" : "Settings", path: "/admin/settings", icon: Settings },
        { name: isUrdu ? "پروفائل" : "Profile", path: "/master/profile", icon: UserCircle },
      ],
    },
  ];

  const handleLogout = () => {
    AuditLogService.logAuth(session?.fullName || "Master Admin", "master_admin", "logout");
    UserDB.masterLogout();
    onClose();
    navigate("/master/login");
  };

  const toggleSection = (name: string) => {
    setExpandedSections(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${isUrdu ? fontClass : ""} fixed inset-0 z-[9999] flex flex-col ${
            dc ? "bg-gray-950" : "bg-white"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dc ? "border-gray-800" : "border-gray-200"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-sm font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                  {session?.fullName || "Master Admin"}
                </p>
                <p className={`text-xs ${dc ? "text-purple-400" : "text-purple-600"}`}>
                  {isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg ${dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${dc ? "border-gray-800" : "border-gray-100"}`}>
            <button onClick={toggleLanguage} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium ${dc ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              <Globe className="w-3.5 h-3.5" /> {isUrdu ? "English" : "اردو"}
            </button>
            <button onClick={toggleDarkMode} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium ${dc ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              {dc ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {dc ? (isUrdu ? "لائٹ" : "Light") : (isUrdu ? "ڈارک" : "Dark")}
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.includes(section.name);
              const hasActive = section.items.some(i => i.path === location.pathname);

              if (section.items.length === 1) {
                const item = section.items[0];
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={section.name}
                    onClick={() => { navigate(item.path); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl min-h-[48px] ${
                      isActive
                        ? dc ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-purple-700"
                        : dc ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <SectionIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>
                );
              }

              return (
                <div key={section.name}>
                  <button
                    onClick={() => toggleSection(section.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl min-h-[48px] ${
                      hasActive
                        ? dc ? "bg-purple-500/10 text-purple-300" : "bg-purple-50 text-purple-700"
                        : dc ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <SectionIcon className="w-5 h-5" />
                    <span className="text-sm font-medium flex-1 text-left">{section.name}</span>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`${isUrdu ? "mr-5 pr-3" : "ml-5 pl-3"} py-1 space-y-0.5`}>
                          {section.items.map((item) => {
                            const ItemIcon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                              <button
                                key={item.path}
                                onClick={() => { navigate(item.path); onClose(); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg min-h-[44px] ${
                                  isActive
                                    ? dc ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-purple-700"
                                    : dc ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                <ItemIcon className="w-4 h-4" />
                                <span className="text-sm">{item.name}</span>
                                {item.badge && (
                                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[20px] text-center">
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className={`px-4 py-3 border-t space-y-2 ${dc ? "border-gray-800" : "border-gray-200"}`}>
            <button
              onClick={() => { navigate("/admin"); onClose(); }}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium min-h-[48px] ${
                dc ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {isUrdu ? "ایڈمن پورٹل پر جائیں" : "Switch to Admin Portal"}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 font-medium min-h-[48px]"
            >
              <LogOut className="w-4 h-4" />
              {isUrdu ? "لاگ آؤٹ" : "Logout"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(menuContent, document.body);
}