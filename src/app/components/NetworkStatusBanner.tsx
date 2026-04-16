// Offline/Online Detection Banner — shows persistent banner when network is lost
// Improvement #5: Shows pending offline mutation count
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WifiOff, Wifi, RefreshCw, CloudUpload, Loader2 } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { getPendingCount } from "../lib/offlineQueue";
import { forceSync } from "../lib/syncService";

export function NetworkStatusBanner() {
  const { isUrdu } = useTheme();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Poll pending offline mutation count
  useEffect(() => {
    const checkPending = async () => {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch {
        // IndexedDB not available
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 4000);
      }
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await forceSync();
      // Re-check pending count
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return (
    <AnimatePresence>
      {/* Offline banner */}
      {!isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-medium shadow-lg"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
        >
          <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>
            {isUrdu
              ? "انٹرنیٹ کنکشن نہیں ہے — آف لائن موڈ میں کام جاری ہے"
              : "No internet connection — working in offline mode"}
          </span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
              {pendingCount} {isUrdu ? "زیر التوا" : "queued"}
            </span>
          )}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            {isUrdu ? "ری ٹرائی" : "Retry"}
          </button>
        </motion.div>
      )}

      {/* Reconnected banner */}
      {showReconnected && isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium shadow-lg"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
        >
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>
            {isUrdu
              ? "انٹرنیٹ واپس آ گیا — ڈیٹا سنک ہو رہا ہے"
              : "Back online — syncing data"}
          </span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
              {pendingCount} {isUrdu ? "ابھی سنک ہو رہے ہیں" : "syncing now"}
            </span>
          )}
        </motion.div>
      )}

      {/* Pending offline mutations badge (when online but queue has items) */}
      {isOnline && !showReconnected && pendingCount > 0 && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium shadow-lg"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
        >
          <CloudUpload className="w-4 h-4 flex-shrink-0" />
          <span>
            {isUrdu
              ? `${pendingCount} آف لائن تبدیلیاں سنک ہونے کا انتظار`
              : `${pendingCount} offline change${pendingCount > 1 ? "s" : ""} pending sync`}
          </span>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {isUrdu ? "ابھی سنک کریں" : "Sync Now"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}