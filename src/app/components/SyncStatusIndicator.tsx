import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { CloudSyncService, SyncStatus } from '../lib/cloudSync';
import { useTheme } from '../lib/ThemeContext';

export function SyncStatusIndicator() {
  const { darkMode, isUrdu } = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(CloudSyncService.getSyncStatus());
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState(CloudSyncService.getSyncStats());
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Update status from localStorage
    const updateStatus = () => {
      setSyncStatus(CloudSyncService.getSyncStatus());
      setStats(CloudSyncService.getSyncStats());
    };

    // Listen for sync status changes
    const handleStatusChange = (event: CustomEvent) => {
      setSyncStatus(event.detail);
      setStats(CloudSyncService.getSyncStats());
    };

    window.addEventListener('sync-status-change', handleStatusChange as any);
    
    // Poll every 5 seconds for status updates
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('sync-status-change', handleStatusChange as any);
      clearInterval(interval);
    };
  }, []);

  const handleForceSync = () => {
    CloudSyncService.forceSyncNow();
  };

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return darkMode ? 'text-gray-500' : 'text-gray-400';
    if (syncStatus.syncError) return 'text-red-500';
    if (syncStatus.isSyncing) return 'text-blue-500';
    if (syncStatus.pendingChanges > 0) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <CloudOff className="w-4 h-4" />;
    if (syncStatus.syncError) return <AlertCircle className="w-4 h-4" />;
    if (syncStatus.isSyncing) return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <RefreshCw className="w-4 h-4" />
      </motion.div>
    );
    if (syncStatus.pendingChanges > 0) return <Cloud className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return isUrdu ? 'آف لائن' : 'Offline';
    if (syncStatus.isSyncing) return isUrdu ? 'ہم آہنگ ہو رہا ہے...' : 'Syncing...';
    if (syncStatus.pendingChanges > 0) {
      return isUrdu 
        ? `${syncStatus.pendingChanges} تبدیلیاں زیر التواء` 
        : `${syncStatus.pendingChanges} pending`;
    }
    if (syncStatus.lastSyncAt) {
      const ago = formatTimeAgo(syncStatus.lastSyncAt);
      return isUrdu ? `ہم آہنگ ${ago}` : `Synced ${ago}`;
    }
    return isUrdu ? 'تیار' : 'Ready';
  };

  const formatTimeAgo = (isoDate: string): string => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return isUrdu ? 'ابھی' : 'now';
    if (minutes < 60) return isUrdu ? `${minutes} منٹ پہلے` : `${minutes}m ago`;
    if (hours < 24) return isUrdu ? `${hours} گھنٹے پہلے` : `${hours}h ago`;
    return isUrdu ? 'کل' : 'yesterday';
  };

  // Close on outside click
  useEffect(() => {
    if (!showDetails) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!mobileSheetRef.current || !mobileSheetRef.current.contains(target))
      ) {
        setShowDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetails]);

  const renderSyncContent = () => (
    <>
      {/* Header */}
      <div className={`
        px-4 py-3 border-b flex items-center justify-between
        ${darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}
      `}>
        <div className="flex items-center gap-2">
          {syncStatus.isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-500" />
          )}
          <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isUrdu ? 'ہم آہنگی کی حیثیت' : 'Sync Status'}
          </h3>
        </div>
        
        {/* Force Sync Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleForceSync}
          disabled={syncStatus.isSyncing || !syncStatus.isOnline}
          className={`
            p-1.5 rounded-lg transition-colors
            ${syncStatus.isSyncing || !syncStatus.isOnline
              ? 'opacity-50 cursor-not-allowed'
              : darkMode
              ? 'hover:bg-gray-700 text-blue-400'
              : 'hover:bg-gray-200 text-blue-600'
            }
          `}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        {/* Online Status */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isUrdu ? 'کنکشن' : 'Connection'}
          </span>
          <span className={`text-sm font-semibold ${
            syncStatus.isOnline 
              ? 'text-green-500' 
              : 'text-gray-500'
          }`}>
            {syncStatus.isOnline 
              ? (isUrdu ? 'آن لائن' : 'Online') 
              : (isUrdu ? 'آف لائن' : 'Offline')}
          </span>
        </div>

        {/* Device ID */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isUrdu ? 'ڈیوائس' : 'Device'}
          </span>
          <span className={`text-xs font-mono ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {stats.deviceId.slice(-8)}
          </span>
        </div>

        {/* Last Sync */}
        {stats.lastSyncAt && (
          <div className="flex items-center justify-between">
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isUrdu ? 'آخری ہم آہنگی' : 'Last Sync'}
            </span>
            <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {formatTimeAgo(stats.lastSyncAt)}
            </span>
          </div>
        )}

        {/* Pending Changes */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isUrdu ? 'زیر التواء' : 'Pending'}
          </span>
          <span className={`text-sm font-bold ${
            stats.pendingUploads > 0 ? 'text-orange-500' : 'text-green-500'
          }`}>
            {stats.pendingUploads}
          </span>
        </div>

        {/* Conflicts */}
        {stats.conflicts > 0 && (
          <div className="flex items-center justify-between">
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isUrdu ? 'تنازعات' : 'Conflicts'}
            </span>
            <span className="text-sm font-bold text-red-500">
              {stats.conflicts}
            </span>
          </div>
        )}

        {/* Error Message */}
        {syncStatus.syncError && (
          <div className={`
            mt-3 p-3 rounded-lg border-l-4 border-red-500
            ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}
          `}>
            <p className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
              {syncStatus.syncError}
            </p>
          </div>
        )}

        {/* Success Message */}
        {!syncStatus.syncError && syncStatus.isOnline && stats.pendingUploads === 0 && (
          <div className={`
            mt-3 p-3 rounded-lg border-l-4 border-green-500
            ${darkMode ? 'bg-green-900/20' : 'bg-green-50'}
          `}>
            <p className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
              {isUrdu 
                ? '✓ تمام ڈیٹا ہم آہنگ ہے' 
                : '✓ All data is synced'}
            </p>
          </div>
        )}

        {/* Offline Info */}
        {!syncStatus.isOnline && (
          <div className={`
            mt-3 p-3 rounded-lg border-l-4 border-gray-500
            ${darkMode ? 'bg-gray-700/30' : 'bg-gray-100'}
          `}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isUrdu 
                ? 'آف لائن موڈ۔ تبدیلیاں کنکشن واپس آنے پر ہم آہنگ ہوں گی۔'
                : 'Working offline. Changes will sync when connection is restored.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer - Sync Info */}
      <div className={`
        px-4 py-2.5 border-t text-xs text-center
        ${darkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-500'}
      `}>
        {isUrdu 
          ? 'ہر 30 سیکنڈ میں خودکار ہم آہنگی'
          : 'Auto-sync every 30 seconds'}
      </div>
    </>
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Main Indicator Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        aria-label={isUrdu ? 'ہم آہنگی کی حیثیت' : 'Sync status'}
        className={`flex items-center gap-1.5 p-2 md:p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] justify-center ${getStatusColor()} ${
          darkMode ? 'hover:bg-white/10' : 'hover:bg-white/15'
        } active:opacity-80`}
      >
        {getStatusIcon()}
        <span className="hidden lg:inline text-xs font-medium">
          {getStatusText()}
        </span>
        {syncStatus.pendingChanges > 0 && (
          <span className="bg-orange-500 text-white text-[9px] px-1 py-0.5 rounded-full font-bold min-w-[16px] text-center">
            {syncStatus.pendingChanges}
          </span>
        )}
      </button>

      {/* Details Dropdown */}
      <AnimatePresence>
        {showDetails && (
          <>
            {/* Desktop dropdown (rendered in place) */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`
                hidden sm:block
                absolute inset-auto bottom-auto top-full
                ${isUrdu ? 'left-0' : 'right-0'} mt-2
                w-80 rounded-2xl shadow-2xl border
                overflow-hidden
                ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
              `}
            >
              {renderSyncContent()}
            </motion.div>

            {/* Mobile bottom sheet via portal to escape transform containment from motion.header */}
            {createPortal(
              <AnimatePresence>
                {showDetails && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] sm:hidden"
                      onClick={() => setShowDetails(false)}
                    />
                    <motion.div
                      ref={mobileSheetRef}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className={`
                        fixed bottom-0 left-0 right-0 z-[9999] flex flex-col sm:hidden
                        rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
                        overflow-hidden
                        ${darkMode ? 'bg-gray-800' : 'bg-white'}
                      `}
                      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                    >
                      {/* Drag handle */}
                      <div className="w-full flex justify-center py-2" onClick={() => setShowDetails(false)}>
                        <div className={`w-12 h-1.5 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-300"}`} />
                      </div>
                      {renderSyncContent()}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}