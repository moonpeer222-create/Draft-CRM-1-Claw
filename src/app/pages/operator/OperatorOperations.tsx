import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  FolderPlus, CheckCircle2, Clock, Calendar, Users, Building2,
  DollarSign, LogOut, Sun, Moon, Globe,
  Plus, Download, RefreshCw, AlertTriangle, X,
  Monitor, Check, ChevronRight,
  Bell, BarChart3, FileDown, CloudOff, Cloud, UserCircle,
  Shield, HardDrive, Wifi, FileText, Eye, Volume2, VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { CRMDataStore, type Case } from "../../lib/mockData";
import {
  DashboardSection, FoldersSection, StatusSection, PaymentsSection, ReportsSection,
  AllCasesSection, DocumentsSection,
  AppointmentsSection, AttendanceSection, AgentSupportSection, VisitsSection, ProfileSection,
  type Notification, type AttendanceEntry, type Appointment, type OfficeVisit,
  STORAGE, load, save,
} from "./OperatorSections";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { supabase } from "../../lib/supabase";
import { OperatorSidebar, type OperatorTabId } from "../../components/OperatorSidebar";
import { OperatorHeader } from "../../components/OperatorHeader";
import { pullOperatorData, pushOperatorData, getLastSyncTime } from "../../lib/operatorSync";
import { notificationSound } from "../../lib/notificationSound";
import { PushPermissionModal } from "../../components/PushPermissionModal";
import {
  pushBridgeNotification,
  isPushEnabled,
  setPushEnabled,
  getPushPermission,
} from "../../lib/pushNotifications";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

// ── Tabs ─────────────────────────────────────────────────
type TabId = OperatorTabId;
const TABS: { id: TabId; icon: any; en: string; ur: string }[] = [
  { id: "dashboard", icon: BarChart3, en: "Dashboard", ur: "ڈیش بورڈ" },
  { id: "folders", icon: FolderPlus, en: "Create Case", ur: "نیا کیس" },
  { id: "all-cases", icon: Eye, en: "All Cases", ur: "تمام کیسز" },
  { id: "documents", icon: FileText, en: "Documents", ur: "دستاویزات" },
  { id: "status", icon: CheckCircle2, en: "Status", ur: "صورتحال" },
  { id: "appointments", icon: Calendar, en: "Appointments", ur: "ملاقاتیں" },
  { id: "agent-support", icon: Users, en: "Agent Help", ur: "ایجنٹ مدد" },
  { id: "attendance", icon: Clock, en: "Attendance", ur: "حاضری" },
  { id: "visits", icon: Building2, en: "Visits", ur: "آفس وزٹ" },
  { id: "payments", icon: DollarSign, en: "Payments", ur: "ادائیگی" },
  { id: "reports", icon: FileDown, en: "Reports", ur: "رپورٹیں" },
  { id: "profile", icon: UserCircle, en: "Profile", ur: "پروفائل" },
];

// ── Main Component ───────────────────────────────────────
export function OperatorOperations() {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode, isUrdu, toggleLanguage, fontClass } = useTheme();
  const dc = darkMode;
  const u = (en: string, ur: string) => (isUrdu ? ur : en);
  const dir = isUrdu ? "rtl" : "ltr";
  const brd = dc ? "border-gray-700" : "border-gray-200";

  const isEmbedded = location.pathname.startsWith("/admin") || location.pathname.startsWith("/master");

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const cases = CRMDataStore.getCases();
  const [agents, setAgents] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);

  // Shared styles
  const card = dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full px-4 py-3.5 rounded-xl border text-base min-h-[52px] ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-300 placeholder-gray-400"} focus:ring-2 focus:ring-emerald-500 focus:border-transparent`;
  const bigBtn = "flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-base min-h-[56px] shadow-lg transition-all active:scale-[0.97]";

  const { profile, signOut } = useSupabaseAuth();
  const [casesVersion, setCasesVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  // Fetch staff from Supabase
  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (!error && data) {
        const mapped = data.map((u: any) => ({ ...u, fullName: u.full_name, status: "active" }));
        setAgents(mapped.filter((x: any) => x.role === "agent"));
        setAllStaff(mapped.filter((x: any) => ["agent", "operator"].includes(x.role)));
      }
    };
    fetchStaff();
  }, []);

  // ── Sync operator data from cloud on mount ──
  useEffect(() => {
    if (isEmbedded) return; // Skip sync when embedded in admin
    setSyncStatus("syncing");
    pullOperatorData().then(restored => {
      if (restored) {
        toast.info(u("☁️ Data restored from cloud", "☁️ کلاؤڈ سے ڈیٹا بحال ہوا"));
        setCasesVersion(v => v + 1); // Force re-render with fresh localStorage data
      }
      setSyncStatus("synced");
    }).catch(() => setSyncStatus("error"));
  }, []);

  // Callback for when StatusSection changes a case's status
  const onCaseUpdated = useCallback(() => {
    setCasesVersion(v => v + 1);
  }, []);

  // Re-read cases when version changes (after status change or sync restore)
  const latestCases = CRMDataStore.getCases();
  const activeCases = casesVersion >= 0 ? latestCases : cases; // always use latest

  // ── Notifications System ──
  const [notifications, setNotifications] = useState<Notification[]>(() => load(STORAGE.notifications, []));
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifPermission, setNotifPermission] = useState<"granted" | "denied" | "default">("default");
  const [showPermModal, setShowPermModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => notificationSound.isEnabled());
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission as any);
      if (Notification.permission === "default") {
        const timer = setTimeout(() => setShowPermModal(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addNotification = useCallback((msg: string, msgUr: string, type: Notification["type"]) => {
    const n: Notification = { id: `N-${Date.now()}`, message: msg, messageUr: msgUr, type, time: new Date().toISOString(), read: false };
    setNotifications(prev => {
      const updated = [n, ...prev].slice(0, 50);
      save(STORAGE.notifications, updated);
      return updated;
    });
    // Browser notification
    if ("Notification" in window && window.Notification.permission === "granted" && isPushEnabled()) {
      try { new window.Notification("Emerald CRM", { body: isUrdu ? msgUr : msg }); } catch {}
    }
    // Cross-portal bridge → notify admin of operator actions
    const bridgeType = type === "status" ? "status_confirmed" as const
      : type === "flag" ? "flag" as const
      : type === "payment" ? "payment_recorded" as const
      : type === "report" ? "report_sent" as const
      : "status_confirmed" as const;
    pushBridgeNotification({
      fromRole: "operator",
      toRole: "admin",
      type: bridgeType,
      messageEn: msg,
      messageUr: msgUr,
    });
  }, [isUrdu]);

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    save(STORAGE.notifications, updated);
  };

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setNotifPermission(result as any);
      setShowPermModal(false);
      if (result === "granted") toast.success(u("Notifications enabled!", "اطلاعات آن ہو گئیں!"));
    }
  };

  const handleLogout = async () => {
    // Push data to cloud before logging out
    pushOperatorData().catch(() => {});
    await supabase.auth.signOut();
    toast.info(u("Logged out", "لاگ آؤٹ ہو گیا"));
    navigate("/");
  };

  // Notification dropdown component
  const NotifDropdown = () => (
    <AnimatePresence>
      {showNotifDropdown && (
        <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className={`absolute ${isUrdu ? "left-0" : "right-0"} top-12 w-80 sm:w-96 rounded-2xl shadow-2xl border overflow-hidden z-50 ${dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${brd}`}>
            <h4 className={`text-sm font-bold ${txt}`}><Bell className="w-4 h-4 inline" /> {u("Notifications", "اطلاعات")}</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  notificationSound.setEnabled(next);
                  if (next) notificationSound.success();
                  toast.info(next ? u("Sound on", "آواز آن") : u("Sound off", "آواز بند"));
                }}
                className={`p-1.5 rounded-lg transition-colors ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                title={soundEnabled ? u("Mute sounds", "آواز بند کریں") : u("Unmute sounds", "آواز آن کریں")}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
              </button>
              {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-emerald-500 font-medium">{u("Mark all read", "سب پڑھ لیں")}</button>}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className={`text-center py-8 text-sm ${sub}`}>{u("No notifications yet", "ابھی کوئی اطلاع نہیں")}</p>
            ) : notifications.slice(0, 20).map(n => (
              <div key={n.id} className={`px-4 py-3 border-b ${brd} ${!n.read ? (dc ? "bg-emerald-900/10" : "bg-emerald-50/50") : ""}`}>
                <p className={`text-xs font-medium ${txt}`}>
                  {n.type === "status" ? "✅" : n.type === "payment" ? "💰" : n.type === "flag" ? "⚠️" : "📊"}{" "}
                  {isUrdu ? n.messageUr : n.message}
                </p>
                <p className={`text-[10px] mt-1 ${sub}`}>
                  {new Date(n.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  {" — "}{new Date(n.time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const BellButton = () => (
    <div className="relative" ref={notifRef}>
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNotifDropdown(!showNotifDropdown)}
        className="relative p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/15 active:opacity-80">
        <Bell className="w-5 h-5 text-emerald-100" />
        {unreadCount > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>
      <NotifDropdown />
    </div>
  );

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "min-h-screen"} ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"} transition-colors duration-300`} dir={dir}>
      {/* Notification Permission Modal */}
      <AnimatePresence>
        {showPermModal && notifPermission === "default" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${dc ? "bg-gray-800" : "bg-white"}`}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${txt}`}>{u("Enable Notifications?", "اطلاعات آن کریں؟")}</h3>
                <p className={`text-sm mb-6 ${sub}`}>
                  {u("Get instant alerts when statuses are confirmed or payments are verified.",
                    "جب صورتحال کی تصدیق ہو یا ادائیگی ویریفائی ہو تو فوری اطلاع ملے گی۔")}
                </p>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={requestPermission}
                    className={`${bigBtn} flex-1 bg-emerald-600 text-white !py-3 !min-h-[48px]`}>
                    <Bell className="w-4 h-4" /> {u("Allow", "اجازت دیں")}
                  </motion.button>
                  <button onClick={() => setShowPermModal(false)}
                    className={`flex-1 py-3 rounded-xl font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                    {u("Later", "بعد میں")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Admin-like Layout with Sidebar + Header ── */}
      {!isEmbedded ? (
        <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"}`}>
          {!insideUnifiedLayout && <OperatorSidebar activeTab={activeTab} onTabChange={setActiveTab} />}
          <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
            {!insideUnifiedLayout && <OperatorHeader activeTab={activeTab} onTabChange={setActiveTab} bellButton={<BellButton />} />}
             <main className={`p-3 sm:p-4 md:p-6 ${insideUnifiedLayout ? "pb-4" : "pb-20 lg:pb-6"}`}>
              {/* Session Timer */}
              {sessionTimeLeft && (
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs font-medium ${
                  parseInt(sessionTimeLeft) <= 0 ? "bg-red-100 text-red-700" :
                  sessionTimeLeft.startsWith("0h") ? "bg-amber-100 text-amber-700" :
                  dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {u("Session", "سیشن")}: {sessionTimeLeft}
                  {syncStatus === "synced" && <Cloud className="w-3.5 h-3.5 text-emerald-500 ms-auto" />}
                  {syncStatus === "error" && <CloudOff className="w-3.5 h-3.5 text-red-400 ms-auto" />}
                </div>
              )}
              <AnimatePresence mode="wait">
                {activeTab === "dashboard" && <DashboardSection key="d" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} agents={agents} allStaff={allStaff} notifications={notifications} addNotification={addNotification} />}
                {activeTab === "folders" && <FoldersSection key="f" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} agents={agents} addNotification={addNotification} onCaseCreated={onCaseUpdated} />}
                {activeTab === "all-cases" && <AllCasesSection key="ac" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} agents={agents} />}
                {activeTab === "documents" && <DocumentsSection key="doc" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} onCaseUpdated={onCaseUpdated} />}
                {activeTab === "status" && <StatusSection key="s" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} onCaseUpdated={onCaseUpdated} />}
                {activeTab === "appointments" && <AppointmentsSection key="a" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} />}
                {activeTab === "agent-support" && <AgentSupportSection key="as" u={u} dc={dc} card={card} txt={txt} sub={sub} cases={activeCases} agents={agents} />}
                {activeTab === "attendance" && <AttendanceSection key="at" u={u} dc={dc} card={card} txt={txt} sub={sub} allStaff={allStaff} />}
                {activeTab === "visits" && <VisitsSection key="v" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} />}
                {activeTab === "payments" && <PaymentsSection key="p" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} />}
                {activeTab === "reports" && <ReportsSection key="r" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} allStaff={allStaff} addNotification={addNotification} />}
                {activeTab === "profile" && <ProfileSection key="prof" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} session={profile} syncStatus={syncStatus} onLogout={() => { signOut(); navigate("/operator/login"); }} />}
              </AnimatePresence>
            </main>
          </div>
          {/* Floating AI Chatbot — now handled globally by GlobalAIChatbot in RootLayout */}
          {/* <OperatorChatbot /> */}
          {/* Push Notification Permission Modal */}
          <PushPermissionModal />
        </div>
      ) : (
        <>
          {/* ── Embedded Header (inside admin) ── */}
          <div className="px-4 pt-4 pb-2">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div>
                <h2 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${txt}`}>
                  <Monitor className="w-5 h-5 text-emerald-500" />
                  {u("Operations Center", "آپریشنز سینٹر")}
                </h2>
                <p className={`text-xs mt-0.5 ${sub}`}>{u("Computer Operator daily tasks", "کمپیوٹر آپریٹر کے روزمرہ کام")}</p>
              </div>
              <BellButton />
            </div>
          </div>

          {/* ── Tab Navigation (embedded) ── */}
          <nav className={`sticky top-0 z-30 border-b ${dc ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-200"} backdrop-blur-md`}>
            <div className="max-w-5xl mx-auto flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide" dir="ltr">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <motion.button key={tab.id} whileTap={{ scale: 0.93 }} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl whitespace-nowrap text-xs sm:text-sm font-medium min-h-[40px] transition-all ${
                      active ? "bg-emerald-600 text-white shadow-md" : dc ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"
                    }`}>
                    <Icon className="w-4 h-4" />
                    {isUrdu ? tab.ur : tab.en}
                  </motion.button>
                );
              })}
            </div>
          </nav>

          {/* ── Content (embedded) ── */}
          <main className="max-w-5xl mx-auto p-3 sm:p-4 pb-24">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && <DashboardSection key="d" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} agents={agents} allStaff={allStaff} notifications={notifications} addNotification={addNotification} />}
              {activeTab === "folders" && <FoldersSection key="f" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} agents={agents} addNotification={addNotification} onCaseCreated={onCaseUpdated} />}
              {activeTab === "all-cases" && <AllCasesSection key="ac" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} agents={agents} />}
              {activeTab === "documents" && <DocumentsSection key="doc" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} onCaseUpdated={onCaseUpdated} />}
              {activeTab === "status" && <StatusSection key="s" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} onCaseUpdated={onCaseUpdated} />}
              {activeTab === "appointments" && <AppointmentsSection key="a" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} />}
              {activeTab === "agent-support" && <AgentSupportSection key="as" u={u} dc={dc} card={card} txt={txt} sub={sub} cases={activeCases} agents={agents} />}
              {activeTab === "attendance" && <AttendanceSection key="at" u={u} dc={dc} card={card} txt={txt} sub={sub} allStaff={allStaff} />}
              {activeTab === "visits" && <VisitsSection key="v" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} />}
              {activeTab === "payments" && <PaymentsSection key="p" u={u} dc={dc} card={card} txt={txt} sub={sub} inputCls={inputCls} bigBtn={bigBtn} cases={activeCases} addNotification={addNotification} />}
              {activeTab === "reports" && <ReportsSection key="r" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} cases={activeCases} allStaff={allStaff} addNotification={addNotification} />}
              {activeTab === "profile" && <ProfileSection key="prof" u={u} dc={dc} card={card} txt={txt} sub={sub} bigBtn={bigBtn} session={session} sessionTimeLeft={sessionTimeLeft} syncStatus={syncStatus} />}
            </AnimatePresence>
          </main>
        </>
      )}
    </div>
  );
}