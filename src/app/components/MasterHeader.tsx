import { supabase } from "../lib/supabase";
import { mapSupabaseCaseToLocal } from "../lib/caseMappers";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { NotificationBell } from "./NotificationPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { UserDB } from "../lib/userDatabase";
import { AuditLogService } from "../lib/auditLog";
import {
  Moon, Sun, Globe, Crown, User, Settings, LogOut,
  Briefcase, CheckCircle, Clock, Menu
} from "lucide-react";
import { MasterMobileMenu } from "./MasterMobileMenu";
import { RoleBasedVoiceAssistant } from "./visaverse/RoleBasedVoiceAssistant";

export function MasterHeader() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const session = UserDB.getMasterSession();

  const [cases, setCases] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('cases').select('*').then(({ data }) => {
      setCases((data || []).map((raw: any) => mapSupabaseCaseToLocal(raw)));
    });
  }, []);

  const stats = {
    total: cases.length,
    agents: new Set(cases.map(c => c.agentId)).size,
    completed: cases.filter(c => c.status === "stamped").length,
    pending: cases.filter(c => c.status !== "stamped" && c.status !== "rejected").length,
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (insideUnifiedLayout) return null;

  const handleLogout = () => {
    AuditLogService.logAuth(session?.fullName || "Master Admin", "master_admin", "logout");
    UserDB.masterLogout();
    navigate("/master/login");
  };

  const dc = darkMode;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className={`fixed top-0 left-0 right-0 z-30 lg:hidden ${
        dc ? "bg-gray-900/95 border-gray-800" : "bg-white/95 border-gray-200"
      } border-b backdrop-blur-md`}>
        <div className="flex items-center justify-between px-3 h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileMenu(true)}
              className={`p-2 rounded-lg ${dc ? "text-purple-400 hover:bg-purple-500/10" : "text-purple-600 hover:bg-purple-50"}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <Crown className={`w-5 h-5 ${dc ? "text-amber-400" : "text-purple-600"}`} />
              <span className={`text-sm font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "ماسٹر" : "Master"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <SyncStatusIndicator />
            <NotificationBell role="admin" />
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"}`}>
              {dc ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <header className={`hidden lg:flex sticky top-0 z-20 items-center justify-between px-6 py-3 border-b transition-colors ${
        dc ? "bg-gray-900/80 border-gray-800 backdrop-blur-xl" : "bg-white/80 border-gray-200 backdrop-blur-xl"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            dc ? "bg-purple-900/20 border-purple-500/20" : "bg-purple-50 border-purple-200"
          }`}>
            <Crown className={`w-4 h-4 ${dc ? "text-amber-400" : "text-purple-600"}`} />
            <span className={`text-sm font-bold ${dc ? "text-purple-300" : "text-purple-700"}`}>
              {isUrdu ? "ماسٹر ایڈمن پورٹل" : "Master Admin Portal"}
            </span>
          </div>

          {/* Quick Stats */}
          <div className="hidden xl:flex items-center gap-3">
            {[
              { icon: Briefcase, label: isUrdu ? "کل کیسز" : "Cases", value: stats.total, color: "text-purple-500" },
              { icon: CheckCircle, label: isUrdu ? "مکمل" : "Done", value: stats.completed, color: "text-green-500" },
              { icon: Clock, label: isUrdu ? "زیر عمل" : "Active", value: stats.pending, color: "text-amber-500" },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-1.5 text-xs ${dc ? "text-gray-400" : "text-gray-500"}`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusIndicator />
          <NotificationBell role="admin" />

          <button onClick={toggleLanguage} className={`p-2 rounded-lg transition-colors ${dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"}`}>
            <Globe className="w-4 h-4" />
          </button>
          <button onClick={toggleDarkMode} className={`p-2 rounded-lg transition-colors ${dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"}`}>
            {dc ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {(session?.fullName || "M")[0]}
              </div>
              <span className={`text-sm font-medium hidden xl:block ${dc ? "text-gray-300" : "text-gray-700"}`}>
                {session?.fullName || "Master Admin"}
              </span>
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className={`absolute ${isUrdu ? "left-0" : "right-0"} top-full mt-2 w-56 rounded-xl border shadow-xl ${
                    dc ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
                  }`}
                >
                  <div className={`p-3 border-b ${dc ? "border-gray-800" : "border-gray-100"}`}>
                    <p className={`text-sm font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                      {session?.fullName || "Master Admin"}
                    </p>
                    <p className={`text-xs ${dc ? "text-purple-400" : "text-purple-600"}`}>
                      {isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={() => { setShowProfile(false); navigate("/master/profile"); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${dc ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"}`}>
                      <User className="w-4 h-4" /> {isUrdu ? "پروفائل" : "Profile"}
                    </button>
                    <button onClick={() => { setShowProfile(false); navigate("/master/settings"); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${dc ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"}`}>
                      <Settings className="w-4 h-4" /> {isUrdu ? "ترتیبات" : "Settings"}
                    </button>
                    <div className={`my-1 h-px ${dc ? "bg-gray-800" : "bg-gray-100"}`} />
                    <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10">
                      <LogOut className="w-4 h-4" /> {isUrdu ? "لاگ آؤٹ" : "Logout"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MasterMobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />

      {/* Global Floating AI Tools — now handled by GlobalAIChatbot in RootLayout */}
      {/* <RoleBasedChatbot role="master_admin" /> */}
      <RoleBasedVoiceAssistant role="master_admin" />
    </>
  );
}