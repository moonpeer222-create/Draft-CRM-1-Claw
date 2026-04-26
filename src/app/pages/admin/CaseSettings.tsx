import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Save, Briefcase, FileText, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { supabase } from "../../lib/supabase";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";

interface CaseSettingsData {
  // Case numbering
  casePrefix: string;
  caseNumberStart: number;
  
  // Pipeline settings
  autoAdvanceStages: boolean;
  requireDocumentChecklist: boolean;
  requirePaymentBeforeAdvance: boolean;
  
  // SLA settings
  defaultSLAHours: number;
  overdueAlertHours: number;
  autoEscalateOverdue: boolean;
  
  // Payment settings
  defaultFeeAmount: number;
  paymentReminderDays: number;
  
  // Document settings
  mandatoryDocuments: string[];
  allowDocumentReupload: boolean;
  verifyDocumentsBeforeAdvance: boolean;
  
  // Notification settings
  notifyOnStatusChange: boolean;
  notifyOnPayment: boolean;
  notifyOnDocumentUpload: boolean;
  
  // Assignment settings
  autoAssignNewCases: boolean;
  roundRobinAssignment: boolean;
  
  // Cancellation settings
  allowCancellation: boolean;
  cancellationReasons: string[];
  
  // Reopen settings
  allowReopen: boolean;
  maxReopenDays: number;
}

const DEFAULT_SETTINGS: CaseSettingsData = {
  casePrefix: "EMR",
  caseNumberStart: 1001,
  autoAdvanceStages: false,
  requireDocumentChecklist: true,
  requirePaymentBeforeAdvance: true,
  defaultSLAHours: 24,
  overdueAlertHours: 48,
  autoEscalateOverdue: true,
  defaultFeeAmount: 200000,
  paymentReminderDays: 7,
  mandatoryDocuments: ["Passport", "CNIC", "Photo", "Medical Report"],
  allowDocumentReupload: true,
  verifyDocumentsBeforeAdvance: true,
  notifyOnStatusChange: true,
  notifyOnPayment: true,
  notifyOnDocumentUpload: true,
  autoAssignNewCases: false,
  roundRobinAssignment: false,
  allowCancellation: true,
  cancellationReasons: ["Customer Request", "Payment Default", "Document Fraud", "Medical Unfit", "Other"],
  allowReopen: true,
  maxReopenDays: 30,
};

const SETTINGS_KEY = "case_settings";

export function CaseSettings() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const dc = darkMode;
  
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}`;
  const itemBg = dc ? "bg-gray-700/50" : "bg-gray-50";
  
  const [settings, setSettings] = useState<CaseSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .single();
      
      if (error && error.code !== "PGRST116") { // PGRST116 = no rows
        console.error("Failed to load case settings:", error);
        toast.error("Failed to load case settings");
        return;
      }
      
      if (data?.value) {
        const loaded = { ...DEFAULT_SETTINGS, ...data.value };
        setSettings(loaded);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = <K extends keyof CaseSettingsData>(
    key: K,
    value: CaseSettingsData[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("settings")
        .upsert({
          key: SETTINGS_KEY,
          value: settings as any,
          description: "Case management configuration settings",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      
      if (error) {
        console.error("Save error:", error);
        toast.error("Failed to save settings: " + error.message);
        return;
      }
      
      setDirty(false);
      toast.success("Case settings saved successfully");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all case settings to defaults? This cannot be undone.")) return;
    
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
    toast.success("Settings reset to defaults. Click Save to apply.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-3">
              <Briefcase className="w-6 h-6 text-emerald-500" />
              <h1 className={`text-xl md:text-2xl font-bold ${txt}`}>{isUrdu ? "کیس سیٹنگز" : "Case Settings"}</h1>
            </div>
            <p className={sub}>{isUrdu ? "کیس مینجمنٹ کی ترتیبات" : "Configure case management behavior, SLA, and pipeline rules"}</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Case Numbering */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <FileText className="w-5 h-5 text-blue-500" />
                {isUrdu ? "کیس نمبرنگ" : "Case Numbering"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "پریفکس" : "Prefix"}</label>
                  <input
                    type="text"
                    value={settings.casePrefix}
                    onChange={e => updateSetting("casePrefix", e.target.value)}
                    className={inputCls}
                    placeholder="EMR"
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "شروعاتی نمبر" : "Starting Number"}</label>
                  <input
                    type="number"
                    value={settings.caseNumberStart}
                    onChange={e => updateSetting("caseNumberStart", parseInt(e.target.value) || 1001)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Pipeline Rules */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <Clock className="w-5 h-5 text-purple-500" />
                {isUrdu ? "پائپ لائن رولز" : "Pipeline Rules"}
              </h3>
              <div className="space-y-3">
                {[
                  { key: "autoAdvanceStages" as const, label: isUrdu ? "خودکار اسٹیج ایڈوانس" : "Auto-advance stages", desc: isUrdu ? "اگلا اسٹیج خودکار" : "Automatically move to next stage when conditions met" },
                  { key: "requireDocumentChecklist" as const, label: isUrdu ? "دستاویز چیک لسٹ لازمی" : "Require document checklist", desc: isUrdu ? "ایڈوانس سے پہلے چیک لسٹ" : "All documents must be checked before advancing" },
                  { key: "requirePaymentBeforeAdvance" as const, label: isUrdu ? "ادائیگی لازمی" : "Require payment before advance", desc: isUrdu ? "ایڈوانس سے پہلے ادائیگی" : "Payment must be complete before stage advance" },
                  { key: "verifyDocumentsBeforeAdvance" as const, label: isUrdu ? "دستاویز تصدیق" : "Verify documents before advance", desc: isUrdu ? "ایڈوانس سے پہلے تصدیق" : "Documents must be verified by admin" },
                ].map(item => (
                  <div key={item.key} className={`flex items-center justify-between p-3 rounded-xl ${itemBg}`}>
                    <div>
                      <p className={`text-sm font-medium ${txt}`}>{item.label}</p>
                      <p className={`text-xs ${sub}`}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => updateSetting(item.key, !settings[item.key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <motion.div
                        animate={{ x: settings[item.key] ? 24 : 2 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Settings */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {isUrdu ? "SLA سیٹنگز" : "SLA Settings"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "طے شدہ SLA (گھنٹے)" : "Default SLA (hours)"}</label>
                  <input
                    type="number"
                    value={settings.defaultSLAHours}
                    onChange={e => updateSetting("defaultSLAHours", parseInt(e.target.value) || 24)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "اوورڈیو الرٹ (گھنٹے)" : "Overdue alert (hours)"}</label>
                  <input
                    type="number"
                    value={settings.overdueAlertHours}
                    onChange={e => updateSetting("overdueAlertHours", parseInt(e.target.value) || 48)}
                    className={inputCls}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl ${itemBg}`}>
                  <div>
                    <p className={`text-sm font-medium ${txt}`}>{isUrdu ? "خودکار ایسکلیشن" : "Auto-escalate overdue"}</p>
                    <p className={`text-xs ${sub}`}>{isUrdu ? "اوورڈیو کیسز خودکار ایسکلیٹ" : "Automatically escalate overdue cases"}</p>
                  </div>
                  <button
                    onClick={() => updateSetting("autoEscalateOverdue", !settings.autoEscalateOverdue)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.autoEscalateOverdue ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <motion.div
                      animate={{ x: settings.autoEscalateOverdue ? 24 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Settings */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <DollarSign className="w-5 h-5 text-emerald-500" />
                {isUrdu ? "ادائیگی سیٹنگز" : "Payment Settings"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "طے شدہ فیس (روپے)" : "Default fee (PKR)"}</label>
                  <input
                    type="number"
                    value={settings.defaultFeeAmount}
                    onChange={e => updateSetting("defaultFeeAmount", parseInt(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "ادائیگی یاد دہانی (دن)" : "Payment reminder (days)"}</label>
                  <input
                    type="number"
                    value={settings.paymentReminderDays}
                    onChange={e => updateSetting("paymentReminderDays", parseInt(e.target.value) || 7)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Assignment Settings */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <CheckCircle className="w-5 h-5 text-blue-500" />
                {isUrdu ? "تفویض سیٹنگز" : "Assignment Settings"}
              </h3>
              <div className="space-y-3">
                {[
                  { key: "autoAssignNewCases" as const, label: isUrdu ? "خودکار تفویض" : "Auto-assign new cases", desc: isUrdu ? "نئے کیسز خودکار" : "New cases automatically assigned to agents" },
                  { key: "roundRobinAssignment" as const, label: isUrdu ? "راؤنڈ روبن" : "Round-robin assignment", desc: isUrdu ?"ایجنٹس کے درمیان برابر" : "Distribute cases evenly among agents" },
                ].map(item => (
                  <div key={item.key} className={`flex items-center justify-between p-3 rounded-xl ${itemBg}`}>
                    <div>
                      <p className={`text-sm font-medium ${txt}`}>{item.label}</p>
                      <p className={`text-xs ${sub}`}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => updateSetting(item.key, !settings[item.key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <motion.div
                        animate={{ x: settings[item.key] ? 24 : 2 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancellation & Reopen */}
            <div className={`${card} rounded-xl border ${dc ? "border-gray-700" : "border-gray-200"} p-4 sm:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt} flex items-center gap-2`}>
                <XCircle className="w-5 h-5 text-red-500" />
                {isUrdu ? "منسوخی / دوبارہ کھولنا" : "Cancellation & Reopen"}
              </h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-xl ${itemBg}`}>
                  <div>
                    <p className={`text-sm font-medium ${txt}`}>{isUrdu ? "منسوخی کی اجازت" : "Allow cancellation"}</p>
                  </div>
                  <button
                    onClick={() => updateSetting("allowCancellation", !settings.allowCancellation)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.allowCancellation ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <motion.div
                      animate={{ x: settings.allowCancellation ? 24 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl ${itemBg}`}>
                  <div>
                    <p className={`text-sm font-medium ${txt}`}>{isUrdu ? "دوبارہ کھولنے کی اجازت" : "Allow reopen"}</p>
                  </div>
                  <button
                    onClick={() => updateSetting("allowReopen", !settings.allowReopen)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.allowReopen ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <motion.div
                      animate={{ x: settings.allowReopen ? 24 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
                <div>
                  <label className={`text-sm font-medium ${txt} block mb-1`}>{isUrdu ? "دوبارہ کھولنے کی زیادہ سے زیادہ مدت (دن)" : "Max reopen days"}</label>
                  <input
                    type="number"
                    value={settings.maxReopenDays}
                    onChange={e => updateSetting("maxReopenDays", parseInt(e.target.value) || 30)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium min-h-[48px] transition-colors ${
                dirty 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isUrdu ? "محفوظ کریں" : "Save Settings"}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[48px]"
            >
              {isUrdu ? "ری سیٹ" : "Reset to Defaults"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
