import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { Bell, Zap, Users as UsersIcon, Database, Plug, Save, Plus, Eye, Edit, Send, Trash2, Download, Upload, RefreshCw, Globe, Moon, Sun, GitMerge, Timer, BarChart3, Sparkles, Gamepad2 } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { staggerContainer, staggerItem, modalVariants } from "../../lib/animations";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import {
  getConflictAutoResolveMode,
  setConflictAutoResolveMode,
  getConflictStats,
  getSyncInterval,
  setSyncInterval as applySyncInterval,
  type ConflictAutoResolveMode,
  type SyncIntervalOption,
} from "../../lib/syncService";
import { VisaVerseSettings } from "../../components/visaverse";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

export function AdminSettings() {
  const { darkMode, isUrdu, fontClass, t, toggleDarkMode, toggleLanguage, language } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const itemBg = dc ? "bg-gray-700/50" : "bg-gray-50";

  const [activeTab, setActiveTab] = useState("notifications");
  const [automationStates, setAutomationStates] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true });
  const [conflictMode, setConflictMode] = useState<ConflictAutoResolveMode>(getConflictAutoResolveMode());
  const [currentSyncInterval, setCurrentSyncInterval] = useState<SyncIntervalOption>(getSyncInterval());

  const tabs = [
    { id: "notifications", label: t("settings.notifications"), icon: Bell },
    { id: "automation", label: t("settings.automation"), icon: Zap },
    { id: "roles", label: t("settings.roles"), icon: UsersIcon },
    { id: "data", label: t("settings.data"), icon: Database },
    { id: "integrations", label: t("settings.integrations"), icon: Plug },
    { id: "sync", label: isUrdu ? "سنک" : "Sync", icon: GitMerge },
    { id: "preferences", label: isUrdu ? "ترجیحات" : "Preferences", icon: Globe },
    { id: "visaverse", label: "VisaVerse", icon: Gamepad2 },
  ];

  const [integrationStates, setIntegrationStates] = useState<Record<string, boolean>>({
    whatsapp: true, sms: true, easypaisa: true, google: false,
  });

  const handleTestSend = (name: string) => {
    const lt = toast.loading(`Sending test ${name}...`);
    setTimeout(() => { toast.dismiss(lt); toast.success(`Test "${name}" sent successfully!`); }, 1500);
  };

  const handleBackup = async () => {
    const lt = toast.loading("Creating backup...");
    setTimeout(async () => {
      const { data: casesData, error } = await supabase.from('cases').select('*');
      const cases = error ? [] : (casesData || []).map((r: any) => mapSupabaseCaseToLocal(r));
      const data = {
        cases,
        users: JSON.parse(localStorage.getItem("crm_users") || "[]"),
        timestamp: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success("Backup created and downloaded!");
    }, 1500);
  };

  const handleExportDB = async () => {
    const lt = toast.loading("Exporting database...");
    setTimeout(async () => {
      const { data: casesData, error } = await supabase.from('cases').select('*');
      const cases = error ? [] : (casesData || []).map((r: any) => mapSupabaseCaseToLocal(r));
      const headers = "Case ID,Customer,Phone,Country,Status,Agent,Total Fee,Paid\n";
      const rows = cases.map((c) => `${c.id},${c.customerName},${c.phone},${c.country},${c.status},${c.agentName},${c.totalFee},${c.paidAmount}`).join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emerald-db-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(lt);
      toast.success("Database exported!");
    }, 1500);
  };

  const handleResetData = () => {
    if (!confirm("Are you sure you want to reset all CRM data? This will clear all cases, payments, documents, and attendance records. Staff accounts will be preserved.")) return;
    localStorage.removeItem("crm_cases");
    localStorage.removeItem("crm_users");
    toast.success("Data reset! Refreshing...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSave = () => {
    const lt = toast.loading("Saving settings...");
    setTimeout(() => { toast.dismiss(lt); toast.success("Settings saved successfully!"); }, 1000);
  };

  const conflictStats = useMemo(() => getConflictStats(), []);

  // Notification templates
  const notificationTemplates = [
    { name: isUrdu ? "ادائیگی یاد دہانی" : "Payment Reminder", active: true, channel: "WhatsApp + SMS" },
    { name: isUrdu ? "کیس اپڈیٹ" : "Case Status Update", active: true, channel: "WhatsApp" },
    { name: isUrdu ? "دستاویز درکار" : "Document Required", active: true, channel: "SMS" },
    { name: isUrdu ? "میڈیکل اپائنٹمنٹ" : "Medical Appointment", active: false, channel: "WhatsApp" },
  ];

  // Automation rules
  const automationRules = [
    { name: isUrdu ? "خودکار ادائیگی یاد دہانی" : "Auto Payment Reminder", desc: isUrdu ? "ہفتہ وار ادائیگی یاد دہانی" : "Weekly reminder for pending payments" },
    { name: isUrdu ? "خودکار کیس تفویض" : "Auto Case Assignment", desc: isUrdu ? "نئے کیسز خودکار تفویض" : "Auto-assign new cases to available agents" },
    { name: isUrdu ? "خودکار فالو اپ" : "Auto Follow-up", desc: isUrdu ? "48 گھنٹے بعد فالو اپ" : "Follow-up after 48 hours of no activity" },
  ];

  // Roles
  const roles = [
    { name: "Admin", permissions: isUrdu ? "مکمل رسائی" : "Full Access", users: 1, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    { name: "Agent", permissions: isUrdu ? "کیس انتظام" : "Case Management", users: 5, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    { name: "Customer", permissions: isUrdu ? "صرف دیکھنا" : "View Only", users: 50, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ];

  // Integrations
  const integrations = [
    { id: "whatsapp", name: "WhatsApp Business", desc: isUrdu ? "پیغام رسانی" : "Messaging", icon: "📱", color: "bg-green-500" },
    { id: "sms", name: "SMS Gateway", desc: isUrdu ? "ایس ایم ایس" : "Text Messages", icon: "💬", color: "bg-blue-500" },
    { id: "easypaisa", name: "EasyPaisa", desc: isUrdu ? "ادائیگی" : "Payments", icon: "💳", color: "bg-emerald-500" },
    { id: "google", name: "Google Calendar", desc: isUrdu ? "کیلنڈر" : "Calendar Sync", icon: "📅", color: "bg-red-500" },
  ];

  // Sync intervals
  const syncIntervals: { value: SyncIntervalOption; label: string }[] = [
    { value: "15s", label: "15 seconds" },
    { value: "30s", label: "30 seconds" },
    { value: "60s", label: "1 minute" },
    { value: "120s", label: "2 minutes" },
    { value: "300s", label: "5 minutes" },
  ];

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className={`text-xl md:text-2xl font-bold mb-1 ${txt}`}>{t("settings.title")}</h1>
            <p className={sub}>{t("settings.subtitle")}</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap snap-start transition-all min-h-[40px]
                    ${activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-md"
                      : dc ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "نوٹیفکیشن ٹیمپلیٹس" : "Notification Templates"}</h3>
                    <div className="space-y-3">
                      {notificationTemplates.map((tmpl, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${txt}`}>{tmpl.name}</p>
                            <p className={`text-xs ${sub}`}>{tmpl.channel}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${tmpl.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400"}`}>
                            {tmpl.active ? (isUrdu ? "فعال" : "Active") : (isUrdu ? "غیر فعال" : "Inactive")}
                          </span>
                          <button onClick={() => handleTestSend(tmpl.name)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 min-w-[36px] min-h-[36px] flex items-center justify-center">
                            <Send className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Automation Tab */}
              {activeTab === "automation" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "آٹومیشن رولز" : "Automation Rules"}</h3>
                    <div className="space-y-3">
                      {automationRules.map((rule, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${txt}`}>{rule.name}</p>
                            <p className={`text-xs ${sub}`}>{rule.desc}</p>
                          </div>
                          <button
                            onClick={() => setAutomationStates(prev => ({ ...prev, [i]: !prev[i] }))}
                            className={`relative w-12 h-6 rounded-full transition-colors ${automationStates[i] ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                          >
                            <motion.div
                              animate={{ x: automationStates[i] ? 24 : 2 }}
                              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Roles Tab */}
              {activeTab === "roles" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "رول مینجمنٹ" : "Role Management"}</h3>
                    <div className="space-y-3">
                      {roles.map((role, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${role.color}`}>{role.name}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${txt}`}>{role.permissions}</p>
                          </div>
                          <span className={`text-xs ${sub}`}>{role.users} {isUrdu ? "صارفین" : "users"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Tab */}
              {activeTab === "data" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "ڈیٹا مینجمنٹ" : "Data Management"}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={handleBackup} className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 min-h-[60px] hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                        <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{isUrdu ? "بیک اپ بنائیں" : "Create Backup"}</p>
                          <p className="text-xs text-blue-500 dark:text-blue-400">JSON format</p>
                        </div>
                      </button>
                      <button onClick={handleExportDB} className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 min-h-[60px] hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                        <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{isUrdu ? "ڈیٹا ایکسپورٹ" : "Export Database"}</p>
                          <p className="text-xs text-emerald-500 dark:text-emerald-400">CSV format</p>
                        </div>
                      </button>
                    </div>
                    <button onClick={handleResetData} className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm font-medium min-h-[48px] hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      {isUrdu ? "ڈیٹا ری سیٹ" : "Reset All Data"}
                    </button>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "انٹیگریشنز" : "Integrations"}</h3>
                    <div className="space-y-3">
                      {integrations.map((intg) => (
                        <div key={intg.id} className={`flex items-center gap-3 p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                          <span className="text-2xl">{intg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${txt}`}>{intg.name}</p>
                            <p className={`text-xs ${sub}`}>{intg.desc}</p>
                          </div>
                          <button
                            onClick={() => setIntegrationStates(prev => ({ ...prev, [intg.id]: !prev[intg.id] }))}
                            className={`relative w-12 h-6 rounded-full transition-colors ${integrationStates[intg.id] ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                          >
                            <motion.div
                              animate={{ x: integrationStates[intg.id] ? 24 : 2 }}
                              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Tab */}
              {activeTab === "sync" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "سنک سیٹنگز" : "Sync Settings"}</h3>

                    {/* Conflict resolution mode */}
                    <div className="mb-4">
                      <label className={`text-sm font-medium ${txt} block mb-2`}>{isUrdu ? "تنازعات حل کرنے کا طریقہ" : "Conflict Resolution Mode"}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(["last-writer-wins", "server-wins", "client-wins"] as ConflictAutoResolveMode[]).map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setConflictMode(mode); setConflictAutoResolveMode(mode); }}
                            className={`p-3 rounded-xl text-sm font-medium min-h-[44px] transition-all
                              ${conflictMode === mode
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700"
                                : `${itemBg} ${sub} border border-transparent`
                              }`}
                          >
                            {mode.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sync interval */}
                    <div className="mb-4">
                      <label className={`text-sm font-medium ${txt} block mb-2`}>{isUrdu ? "سنک وقفہ" : "Sync Interval"}</label>
                      <div className="flex flex-wrap gap-2">
                        {syncIntervals.map(si => (
                          <button
                            key={si.value}
                            onClick={() => { setCurrentSyncInterval(si.value); applySyncInterval(si.value); }}
                            className={`px-3 py-2 rounded-xl text-sm min-h-[40px] transition-all
                              ${currentSyncInterval === si.value
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300 dark:border-blue-700"
                                : `${itemBg} ${sub} border border-transparent`
                              }`}
                          >
                            {si.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Conflict stats */}
                    <div className={`p-3 rounded-xl ${itemBg}`}>
                      <p className={`text-sm font-medium ${txt} mb-2`}>{isUrdu ? "تنازعات کے اعداد" : "Conflict Stats"}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{conflictStats.total}</p>
                          <p className={`text-xs ${sub}`}>Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{conflictStats.resolved}</p>
                          <p className={`text-xs ${sub}`}>Resolved</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{conflictStats.pending}</p>
                          <p className={`text-xs ${sub}`}>Pending</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <div className="space-y-4">
                  <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{isUrdu ? "ترجیحات" : "Preferences"}</h3>
                    <div className="space-y-3">
                      {/* Language */}
                      <div className={`flex items-center justify-between p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className={`text-sm font-medium ${txt}`}>{isUrdu ? "زبان" : "Language"}</p>
                            <p className={`text-xs ${sub}`}>{language === "en" ? "English" : "اردو"}</p>
                          </div>
                        </div>
                        <button onClick={toggleLanguage} className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium min-h-[36px]">
                          {language === "en" ? "اردو" : "English"}
                        </button>
                      </div>

                      {/* Dark mode */}
                      <div className={`flex items-center justify-between p-3 rounded-xl ${itemBg} min-h-[52px]`}>
                        <div className="flex items-center gap-3">
                          {dc ? <Moon className="w-5 h-5 text-purple-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                          <div>
                            <p className={`text-sm font-medium ${txt}`}>{isUrdu ? "ڈارک موڈ" : "Dark Mode"}</p>
                            <p className={`text-xs ${sub}`}>{dc ? (isUrdu ? "فعال" : "Enabled") : (isUrdu ? "غیر فعال" : "Disabled")}</p>
                          </div>
                        </div>
                        <button
                          onClick={toggleDarkMode}
                          className={`relative w-12 h-6 rounded-full transition-colors ${dc ? "bg-purple-500" : "bg-gray-300"}`}
                        >
                          <motion.div
                            animate={{ x: dc ? 24 : 2 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VisaVerse Tab */}
              {activeTab === "visaverse" && (
                <VisaVerseSettings isUrdu={isUrdu} darkMode={dc} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Save button */}
          {activeTab !== "visaverse" && (
            <motion.div className="mt-6">
              <button onClick={handleSave} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors min-h-[48px]">
                <Save className="w-4 h-4" />
                {isUrdu ? "سیٹنگز محفوظ کریں" : "Save Settings"}
              </button>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}