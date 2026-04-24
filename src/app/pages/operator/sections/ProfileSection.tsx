import { useState, useEffect } from "react";
import {
  Monitor, HardDrive, Cloud, Shield, Globe, Sun, Moon, LogOut, Wifi, CloudOff, Bell,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "../../../lib/toast";
import { useNavigate } from "react-router";
import { useTheme } from "../../../lib/ThemeContext";
import { getLastSyncTime, pushOperatorData } from "../../../lib/operatorSync";
import {
  isPushEnabled,
  setPushEnabled,
  getPushPermission,
} from "../../../lib/pushNotifications";

export function ProfileSection({ u, dc, card, txt, sub, bigBtn, session, syncStatus, onLogout }: any) {
  const { darkMode, toggleDarkMode, isUrdu, toggleLanguage } = useTheme();
  const navigate = useNavigate();
  const lastSync = getLastSyncTime();

  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });
  useEffect(() => {
    try {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("emr-")) totalSize += (localStorage.getItem(key) || "").length * 2;
      }
      setStorageInfo({ used: totalSize, total: 5 * 1024 * 1024 });
    } catch {}
  }, []);

  const storagePercent = storageInfo.total > 0 ? Math.round((storageInfo.used / storageInfo.total) * 100) : 0;
  const storageKB = Math.round(storageInfo.used / 1024);

  const handleClearCache = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("emr-op-") && !key.includes("session")) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    toast.success(u("Cache cleared! Reloading...", "کیشے صاف ہو گئی! ری لوڈ ہو رہا ہے..."));
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleForceSync = async () => {
    toast.info(u("Syncing to cloud...", "کلاؤڈ پر بھیج رہے ہیں..."));
    const ok = await pushOperatorData();
    if (ok) toast.success(u("Synced!", "سنک ہو گیا!"));
    else toast.error(u("Sync failed", "سنک ناکام"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={`rounded-2xl border p-5 sm:p-6 ${card}`}>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-bold ${txt}`}>{session?.full_name || session?.fullName || "Operator"}</h2>
            <p className={`text-sm ${sub}`}>{u("Computer Operator", "کمپیوٹر آپریٹر")} — Emerald Tech Partner</p>
            <p className={`text-xs mt-1 ${sub}`}>
              {u("Role", "کردار")}: <span className="text-emerald-500 font-medium">{u("Operator", "آپریٹر")}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`rounded-xl p-3 ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${sub}`}>{u("Status", "حیثیت")}</p>
            <p className={`text-lg font-bold mt-1 ${txt}`}>{u("Active", "فعال")}</p>
          </div>
          <div className={`rounded-xl p-3 ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${sub}`}>{u("Cloud Sync", "کلاؤڈ سنک")}</p>
            <div className="flex items-center gap-2 mt-1">
              {syncStatus === "synced" ? (
                <><Cloud className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-500">{u("Connected", "جڑا ہوا")}</span></>
              ) : syncStatus === "error" ? (
                <><CloudOff className="w-4 h-4 text-red-500" /><span className="text-sm font-bold text-red-500">{u("Error", "خرابی")}</span></>
              ) : (
                <><Wifi className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-amber-500">{u("Syncing", "سنک ہو رہا")}</span></>
              )}
            </div>
          </div>
        </div>
        {lastSync && (
          <p className={`text-xs ${sub}`}>
            {u("Last synced", "آخری سنک")}: {new Date(lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <HardDrive className="w-4 h-4 text-blue-500" /> {u("Local Storage", "مقامی سٹوریج")}
        </h3>
        <div className={`w-full h-3 rounded-full ${dc ? "bg-gray-700" : "bg-gray-200"} mb-2`}>
          <div className={`h-3 rounded-full transition-all ${storagePercent > 80 ? "bg-red-500" : storagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(storagePercent, 100)}%` }} />
        </div>
        <p className={`text-xs ${sub}`}>{storageKB} KB / {Math.round(storageInfo.total / 1024)} KB ({storagePercent}%)</p>
      </div>

      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <Shield className="w-4 h-4 text-purple-500" /> {u("Settings", "ترتیبات")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span className={`text-sm ${txt}`}>{u("Dark Mode", "ڈارک موڈ")}</span>
            </div>
            <button onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? "bg-emerald-600" : "bg-gray-300"}`}>
              <motion.div animate={{ x: darkMode ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-green-500" />
              <span className={`text-sm ${txt}`}>{u("Language", "زبان")}</span>
            </div>
            <button onClick={toggleLanguage}
              className={`px-4 py-2 rounded-xl text-xs font-bold min-h-[36px] ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              {isUrdu ? "Switch to English" : "اردو میں بدلیں"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${isPushEnabled() ? "text-emerald-500" : "text-gray-400"}`} />
              <span className={`text-sm ${txt}`}>{u("Push Notifications", "پش اطلاعات")}</span>
            </div>
            <button onClick={() => { setPushEnabled(!isPushEnabled()); window.location.reload(); }}
              className={`relative w-12 h-6 rounded-full transition-colors ${isPushEnabled() ? "bg-emerald-600" : dc ? "bg-gray-600" : "bg-gray-300"}`}>
              <motion.div animate={{ x: isPushEnabled() ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          {getPushPermission() === "denied" && (
            <p className={`text-[10px] px-2 ${dc ? "text-red-400" : "text-red-500"}`}>
              {u("Browser notifications blocked. Enable in browser settings.", "براؤزر اطلاعات بلاک ہیں۔ براؤزر سیٹنگز میں فعال کریں۔")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleForceSync}
          className={`${bigBtn} bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
          <Cloud className="w-5 h-5" /> {u("Force Sync", "فوری سنک")}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleClearCache}
          className={`${bigBtn} ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}>
          <HardDrive className="w-5 h-5" /> {u("Clear Cache", "کیشے صاف")}
        </motion.button>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
        pushOperatorData().catch(() => {});
        onLogout?.();
        toast.info(u("Logged out", "لاگ آؤٹ ہو گیا"));
      }} className={`${bigBtn} w-full bg-red-600 text-white`}>
        <LogOut className="w-5 h-5" /> {u("Logout", "لاگ آؤٹ")}
      </motion.button>
    </motion.div>
  );
}
