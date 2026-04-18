import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HardDrive, Cloud, Upload, Loader2, CheckCircle, Database, ArrowUpCircle } from "lucide-react";
import { DocumentFileStore } from "../lib/documentStore";
import { useTheme } from "../lib/ThemeContext";
import { toast } from "../lib/toast";
import { useSyncStatus } from "./SyncProvider";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function StorageUsageWidget() {
  const { darkMode, isUrdu } = useTheme();
  const { serverAvailable } = useSyncStatus();
  const [stats, setStats] = useState(DocumentFileStore.getStats());
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const refresh = () => setStats(DocumentFileStore.getStats());
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMigrate = async () => {
    if (!serverAvailable) {
      toast.error(isUrdu ? "سرور دستیاب نہیں - پہلے کلاؤڈ سنک کریں" : "Server not available — try Cloud Sync first");
      return;
    }

    setIsMigrating(true);
    setMigrationProgress({ done: 0, total: stats.legacyLargeFiles });

    const lt = toast.loading(
      isUrdu ? "بڑی فائلیں کلاؤڈ اسٹوریج میں منتقل ہو رہی ہیں..." : "Migrating large files to cloud storage..."
    );

    try {
      const count = await DocumentFileStore.migrateLegacyFiles((done, total) => {
        setMigrationProgress({ done, total });
      });

      toast.dismiss(lt);
      if (count > 0) {
        toast.success(
          isUrdu
            ? `${count} فائلیں کلاؤڈ اسٹوریج میں منتقل ہو گئیں`
            : `${count} file${count !== 1 ? "s" : ""} migrated to cloud storage`
        );
      } else {
        toast.info(isUrdu ? "منتقلی کے لیے کوئی فائل نہیں" : "No files to migrate");
      }
      setStats(DocumentFileStore.getStats());
    } catch (err) {
      toast.dismiss(lt);
      toast.error(isUrdu ? "منتقلی ناکام" : "Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  const dc = darkMode;
  const localPct = stats.total > 0 ? Math.round((stats.local / stats.total) * 100) : 0;
  const cloudPct = stats.total > 0 ? Math.round((stats.cloud / stats.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className={`${dc ? "bg-gray-800" : "bg-white"} rounded-2xl shadow-lg p-4 md:p-6`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${dc ? "text-white" : "text-gray-900"}`}>
          <Database className="w-5 h-5 text-indigo-600" />
          {isUrdu ? "اسٹوریج کی حالت" : "Storage Usage"}
        </h3>
        {stats.total > 0 && (
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
            {formatBytes(stats.totalSizeBytes)}
          </span>
        )}
      </div>

      {stats.total === 0 ? (
        <div className={`text-center py-6 ${dc ? "text-gray-500" : "text-gray-400"}`}>
          <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{isUrdu ? "ابھی تک کوئی فائل اپ لوڈ نہیں ہوئی" : "No files uploaded yet"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Distribution bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={dc ? "text-gray-400" : "text-gray-500"}>
                {isUrdu ? "تقسیم" : "Distribution"}
              </span>
              <span className={`font-semibold ${dc ? "text-white" : "text-gray-900"}`}>
                {stats.total} {isUrdu ? "فائلیں" : "files"}
              </span>
            </div>
            <div className={`w-full h-3 rounded-full overflow-hidden flex ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
              {stats.local > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${localPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-3 bg-gradient-to-r from-blue-500 to-blue-400"
                />
              )}
              {stats.cloud > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cloudPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className="h-3 bg-gradient-to-r from-indigo-500 to-purple-500"
                />
              )}
            </div>
          </div>

          {/* Local vs Cloud counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl ${dc ? "bg-blue-900/20" : "bg-blue-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-blue-500" />
                <span className={`text-xs font-medium ${dc ? "text-blue-400" : "text-blue-700"}`}>
                  {isUrdu ? "مقامی" : "Local"}
                </span>
              </div>
              <p className={`text-xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>{stats.local}</p>
              <p className={`text-[10px] ${dc ? "text-gray-500" : "text-gray-400"}`}>
                {isUrdu ? "براؤزر میں" : "In browser"}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${dc ? "bg-indigo-900/20" : "bg-indigo-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="w-4 h-4 text-indigo-500" />
                <span className={`text-xs font-medium ${dc ? "text-indigo-400" : "text-indigo-700"}`}>
                  {isUrdu ? "کلاؤڈ" : "Cloud"}
                </span>
              </div>
              <p className={`text-xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>{stats.cloud}</p>
              <p className={`text-[10px] ${dc ? "text-gray-500" : "text-gray-400"}`}>
                {isUrdu ? "سپابیس اسٹوریج" : "Supabase Storage"}
              </p>
            </div>
          </div>

          {/* Migration banner */}
          <AnimatePresence>
            {stats.legacyLargeFiles > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-xl border-l-4 border-l-orange-500 ${dc ? "bg-orange-900/10" : "bg-orange-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`text-xs font-semibold ${dc ? "text-orange-400" : "text-orange-700"}`}>
                      <ArrowUpCircle className="w-3.5 h-3.5 inline mr-1" />
                      {isUrdu
                        ? `${stats.legacyLargeFiles} بڑی فائلیں مقامی طور پر محفوظ ہیں`
                        : `${stats.legacyLargeFiles} large file${stats.legacyLargeFiles !== 1 ? "s" : ""} stored locally`}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${dc ? "text-gray-500" : "text-gray-500"}`}>
                      {isUrdu
                        ? "بہتر کارکردگی کے لیے کلاؤڈ اسٹوریج میں منتقل کریں"
                        : "Migrate to cloud storage for better performance"}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMigrate}
                    disabled={isMigrating || !serverAvailable}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${
                      isMigrating || !serverAvailable
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                        : "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {migrationProgress.done}/{migrationProgress.total}
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        {isUrdu ? "منتقل" : "Migrate"}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* All migrated success */}
          {stats.total > 0 && stats.legacyLargeFiles === 0 && stats.cloud > 0 && (
            <div className={`p-2.5 rounded-lg text-center ${dc ? "bg-green-900/10" : "bg-green-50"}`}>
              <p className={`text-[11px] flex items-center justify-center gap-1 ${dc ? "text-green-400" : "text-green-700"}`}>
                <CheckCircle className="w-3.5 h-3.5" />
                {isUrdu ? "تمام بڑی فائلیں کلاؤڈ پر ہیں" : "All large files in cloud storage"}
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
