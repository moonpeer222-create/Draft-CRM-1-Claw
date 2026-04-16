/**
 * CustomerMobileMenu — Full-screen mobile navigation overlay for the customer portal.
 * Mirrors the AdminMobileMenu/AgentMobileMenu pattern: portaled to document.body,
 * slides down from top with spring animation, quick-access cards (case status,
 * documents pending, payment balance), profile header with logout, search/filter,
 * active route highlighting, 48px+ touch targets, dark mode & Urdu support.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { supabase } from "../lib/supabase";
import { CRMDataStore, Case, getStageLabel, getStageNumber, getOverdueInfo, WORKFLOW_STAGES } from "../lib/mockData";
import { AuditLogService } from "../lib/auditLog";
import { toast } from "../lib/toast";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  UserCircle,
  X,
  Search,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  Power,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  DollarSign,
  Shield,
  Phone,
  Bot,
  Mic,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerMobileMenu({ isOpen, onClose }: Props) {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();
  const { profile } = useSupabaseAuth();
  const dc = darkMode;

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const customerName = profile?.full_name || "Customer";

  // Live case data
  const [myCase, setMyCase] = useState<Case | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase.from('cases').select('*').eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        const mapped: Case = {
          id: data.id,
          clientName: profile.full_name || profile.email || "Customer",
          clientPhone: "-",
          clientEmail: profile.email || "-",
          country: data.destination_country || "",
          jobType: data.visa_type || "",
          status: (data.status as any) || "submitted",
          stage: (data.status as any) || "submitted",
          agentId: data.agent_id || "",
          totalFee: data.metadata?.totalFee ?? 0,
          paidAmount: data.metadata?.paidAmount ?? 0,
          submittedAt: data.created_at,
          updatedAt: data.updated_at,
          documents: data.metadata?.documents || [],
          stages: data.metadata?.stages || [],
          priority: data.priority || "normal",
          notes: data.metadata?.notes || "",
        };
        setMyCase(mapped);
      } else {
        const allCases = CRMDataStore.getCases();
        const found = allCases.find(c => c.clientEmail === profile.email);
        setMyCase(found || null);
      }
    };
    load();
  }, [isOpen, profile]);

  // Reset search on close
  useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  if (insideUnifiedLayout) return null;

  // Derived data
  const currentStage = myCase ? getStageLabel(myCase.status, isUrdu) : (isUrdu ? "نامعلوم" : "Unknown");
  const stageNumber = myCase ? getStageNumber(myCase.status) : 0;
  const totalStages = WORKFLOW_STAGES.filter(s => s.key !== "rejected").length;
  const progressPct = totalStages > 0 ? Math.round((stageNumber / totalStages) * 100) : 0;
  const overdueInfo = myCase ? getOverdueInfo(myCase) : null;
  const isOverdue = overdueInfo?.isOverdue ?? false;

  // Docs pending
  const pendingDocs = myCase?.documents?.filter(d => !d.uploadedAt)?.length ?? 0;
  const totalDocs = myCase?.documents?.length ?? 0;
  const uploadedDocs = totalDocs - pendingDocs;

  // Payment
  const totalFee = myCase?.totalFee || 0;
  const paidAmount = myCase?.paidAmount || 0;
  const remainingAmount = totalFee - paidAmount;
  const paymentPct = totalFee > 0 ? Math.round((paidAmount / totalFee) * 100) : 0;

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    AuditLogService.logAuth(customerName, "customer", "logout");
    await supabase.auth.signOut();
    toast.success(t("loggingOut"));
    setTimeout(() => navigate("/customer/login"), 500);
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

  const navItems = useMemo(() => [
    {
      name: isUrdu ? "ڈیش بورڈ" : "Dashboard",
      path: "/customer",
      icon: LayoutDashboard,
      label: isUrdu ? "مرکزی" : "MAIN",
    },
    {
      name: isUrdu ? "دستاویزات" : "Documents",
      path: "/customer/documents",
      icon: FileText,
      badge: pendingDocs > 0 ? pendingDocs : undefined,
      badgeColor: "bg-orange-500",
      label: isUrdu ? "خدمات" : "SERVICES",
    },
    {
      name: isUrdu ? "ادائیگیاں" : "Payments",
      path: "/customer/payments",
      icon: CreditCard,
      badge: remainingAmount > 0 ? 1 : undefined,
      badgeColor: "bg-red-500",
    },
    {
      name: isUrdu ? "AI چیٹ بوٹ" : "AI Chatbot",
      path: "/customer/ai-chatbot",
      icon: Bot,
      label: isUrdu ? "AI ٹولز" : "AI TOOLS",
    },
    {
      name: isUrdu ? "آواز اسسٹنٹ" : "Voice Assistant",
      path: "/customer/voice-assistant",
      icon: Mic,
    },
  ], [isUrdu, pendingDocs, remainingAmount]);

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return navItems.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  }, [searchQuery, navItems]);

  const isSearching = searchQuery.trim().length > 0;

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

          {/* Menu Panel */}
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
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {customerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {customerName}
                  </p>
                  <p className="text-[11px] text-blue-300/60">
                    {isUrdu ? "کسٹمر پورٹل" : "Customer Portal"} • {caseId}
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

            {/* Quick Actions Row */}
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
                  const msg = encodeURIComponent("Assalamualaikum, I need help with my visa case.");
                  window.open(`https://wa.me/923186986259?text=${msg}`, "_blank");
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 active:bg-white/10 transition-colors min-h-[40px]"
              >
                <Phone className="w-4 h-4 text-green-300" />
                <span className="text-[11px] font-medium text-blue-100/80">
                  {isUrdu ? "مدد" : "Help"}
                </span>
              </button>
            </div>

            {/* Quick-Access Cards */}
            <div className="px-4 pt-2.5 pb-1">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
                {/* Case Status Card */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => handleNav("/customer")}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border active:bg-white/10 transition-colors min-w-[130px] ${
                    isOverdue
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-white/5 border-white/8"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOverdue ? "bg-red-500/15" : "bg-blue-500/15"
                  }`}>
                    {isOverdue ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Shield className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-semibold leading-tight truncate ${
                      isOverdue ? "text-red-300" : "text-white"
                    }`}>
                      {currentStage}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isOverdue ? "bg-red-400" : "bg-blue-400"}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-blue-300/50 font-medium">{progressPct}%</span>
                    </div>
                  </div>
                </motion.button>

                {/* Documents Pending Card */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => handleNav("/customer/documents")}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 active:bg-white/10 transition-colors min-w-[120px]"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    pendingDocs > 0 ? "bg-orange-500/15" : "bg-green-500/15"
                  }`}>
                    {pendingDocs > 0 ? (
                      <Upload className="w-4 h-4 text-orange-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-bold leading-tight ${
                      pendingDocs > 0 ? "text-orange-400" : "text-green-400"
                    }`}>
                      {pendingDocs > 0 ? pendingDocs : uploadedDocs}
                    </p>
                    <p className="text-[10px] text-blue-300/50 font-medium leading-tight">
                      {pendingDocs > 0
                        ? (isUrdu ? "اپلوڈ باقی" : "Pending")
                        : (isUrdu ? "مکمل" : "Uploaded")}
                    </p>
                  </div>
                </motion.button>

                {/* Payment Balance Card */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  onClick={() => handleNav("/customer/payments")}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 active:bg-white/10 transition-colors min-w-[120px]"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    remainingAmount > 0 ? "bg-red-500/15" : "bg-green-500/15"
                  }`}>
                    <DollarSign className={`w-4 h-4 ${
                      remainingAmount > 0 ? "text-red-400" : "text-green-400"
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold leading-tight ${
                      remainingAmount > 0 ? "text-red-400" : "text-green-400"
                    }`}>
                      {remainingAmount > 0
                        ? `${(remainingAmount / 1000).toFixed(0)}K`
                        : (isUrdu ? "مکمل" : "Paid")}
                    </p>
                    <p className="text-[10px] text-blue-300/50 font-medium leading-tight">
                      {remainingAmount > 0
                        ? (isUrdu ? "باقی" : "Balance")
                        : (isUrdu ? "ادائیگی" : "Payment")}
                    </p>
                  </div>
                </motion.button>

                {/* WhatsApp Support Card */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => {
                    const msg = encodeURIComponent(`Assalamualaikum, I need an update on my case ${caseId}.`);
                    window.open(`https://wa.me/923186986259?text=${msg}`, "_blank");
                  }}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/15 active:bg-green-500/15 transition-colors min-w-[110px]"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-green-300 leading-tight">
                      {isUrdu ? "رابطہ" : "Contact"}
                    </p>
                    <p className="text-[10px] text-green-400/50 font-medium leading-tight">WhatsApp</p>
                  </div>
                </motion.button>
              </div>
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
                        const active = location.pathname === item.path;
                        return (
                          <motion.button
                            key={item.path}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => handleNav(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all min-h-[48px] active:scale-[0.98] ${
                              active
                                ? dc ? "bg-blue-500/15 text-white" : "bg-white/15 text-white"
                                : "text-blue-100/80 active:bg-white/5"
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              active ? (dc ? "bg-blue-500/20" : "bg-white/10") : "bg-white/5"
                            }`}>
                              <Icon className={`w-[18px] h-[18px] ${
                                active ? "text-blue-400" : dc ? "text-blue-400/60" : "text-blue-200/60"
                              }`} />
                            </div>
                            <span className={`flex-1 ${isUrdu ? "text-right" : "text-left"} text-[14px] ${
                              active ? "font-semibold" : "font-medium"
                            }`}>
                              {item.name}
                            </span>
                            {item.badge && (
                              <span className={`min-w-[18px] h-[18px] px-1 rounded-full ${item.badgeColor || "bg-red-500"} text-white text-[9px] font-bold flex items-center justify-center`}>
                                {item.badge}
                              </span>
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
                <>
                  {/* Section Label */}
                  {navItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = item.path === "/customer"
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path);

                    // Show label if defined and different from previous
                    const showLabel = item.label && (idx === 0 || item.label !== navItems[idx - 1]?.label);

                    return (
                      <div key={item.path}>
                        {showLabel && (
                          <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50">
                              {item.label}
                            </span>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                        )}

                        <motion.button
                          initial={{ opacity: 0, x: isUrdu ? 12 : -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04, duration: 0.2 }}
                          onClick={() => handleNav(item.path)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all min-h-[48px] active:scale-[0.98] relative ${
                            isActive
                              ? dc ? "bg-blue-500/15 text-white" : "bg-white/15 text-white"
                              : "text-blue-100/80 active:bg-white/5"
                          }`}
                        >
                          {/* Active accent */}
                          {isActive && (
                            <div
                              className={`absolute ${isUrdu ? "right-0" : "left-0"} w-[3px] h-6 rounded-full bg-blue-400`}
                              style={{ boxShadow: "0 0 10px rgba(96,165,250,0.5)" }}
                            />
                          )}

                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? (dc ? "bg-blue-500/20" : "bg-white/10") : "bg-white/5"
                          }`}>
                            <Icon className={`w-[18px] h-[18px] ${
                              isActive ? "text-blue-400" : dc ? "text-blue-400/60" : "text-blue-200/60"
                            }`} />
                          </div>

                          <span className={`flex-1 ${isUrdu ? "text-right" : "text-left"} text-[14px] ${
                            isActive ? "font-semibold" : "font-medium"
                          }`}>
                            {item.name}
                          </span>

                          {item.badge && (
                            <span className={`min-w-[20px] h-5 px-1.5 rounded-full ${item.badgeColor || "bg-red-500"} text-white text-[10px] font-bold flex items-center justify-center`}>
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
                      </div>
                    );
                  })}
                </>
              )}
            </nav>

            {/* Footer — Logout */}
            <div className="px-4 py-3 border-t border-white/10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 active:bg-red-500/20 transition-colors min-h-[48px]"
              >
                <Power className="w-4.5 h-4.5" />
                <span className="text-sm font-semibold">{isUrdu ? "لاگ آؤٹ" : "Logout"}</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}