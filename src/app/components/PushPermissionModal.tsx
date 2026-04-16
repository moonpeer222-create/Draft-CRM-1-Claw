import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, BellOff, X } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import {
  getPushPermission,
  requestPushPermission,
  hasAskedPushPermission,
  markPushPermissionAsked,
  setPushEnabled,
} from "../lib/pushNotifications";

export function PushPermissionModal() {
  const { darkMode: dc, isUrdu } = useTheme();
  const u = (en: string, ur: string) => (isUrdu ? ur : en);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show modal after 2s if permission hasn't been asked yet
    const timer = setTimeout(() => {
      const perm = getPushPermission();
      if (perm === "default" && !hasAskedPushPermission()) {
        setShow(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    markPushPermissionAsked();
    const result = await requestPushPermission();
    setPushEnabled(result === "granted");
    setShow(false);
  };

  const handleLater = () => {
    markPushPermissionAsked();
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl relative ${
              dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            {/* Close */}
            <button
              onClick={handleLater}
              className={`absolute top-4 end-4 p-1.5 rounded-lg ${
                dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Bell className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-lg font-bold text-center mb-2 ${dc ? "text-white" : "text-gray-900"}`}>
              {u("Enable Notifications?", "اطلاعات فعال کریں؟")}
            </h2>

            <p className={`text-sm text-center mb-6 ${dc ? "text-gray-400" : "text-gray-500"}`}>
              {u(
                "Get instant alerts when cases are updated, payments confirmed, or urgent flags raised.",
                "کیس اپ ڈیٹ، ادائیگی تصدیق، یا فوری اطلاعات کے لیے الرٹ حاصل کریں۔"
              )}
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAllow}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm min-h-[48px] shadow-lg"
              >
                <Bell className="w-4 h-4" />
                {u("Allow", "اجازت دیں")}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLater}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm min-h-[48px] ${
                  dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                }`}
              >
                <BellOff className="w-4 h-4" />
                {u("Later", "بعد میں")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}