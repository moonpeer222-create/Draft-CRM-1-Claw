/**
 * ImportPreviewModal — shows a visual diff before importing data,
 * listing what will be overwritten, added, or left unchanged.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../lib/ThemeContext";
import { importData, generateImportDiff, type ImportDiffPreview, type DiffEntry } from "../lib/storageQuota";
import { AlertTriangle, ArrowRight, Check, X, Plus, RefreshCw, Minus, FileJson, Loader2 } from "lucide-react";

interface Props {
  exportJson: any;
  onClose: () => void;
  onImported: () => void;
}

export function ImportPreviewModal({ exportJson, onClose, onImported }: Props) {
  const { darkMode, isUrdu } = useTheme();
  const [importing, setImporting] = useState(false);
  const diff = generateImportDiff(exportJson);

  const handleConfirmImport = () => {
    setImporting(true);
    try {
      const result = importData(exportJson);
      if (result.success) {
        onImported();
      } else {
        alert(isUrdu ? `درآمد ناکام: ${result.error}` : `Import failed: ${result.error}`);
        setImporting(false);
      }
    } catch (err) {
      alert(isUrdu ? `خرابی: ${err}` : `Error: ${err}`);
      setImporting(false);
    }
  };

  const getActionIcon = (action: DiffEntry["action"]) => {
    switch (action) {
      case "new": return <Plus className="w-3 h-3 text-green-500" />;
      case "overwrite": return <RefreshCw className="w-3 h-3 text-orange-500" />;
      case "remove": return <Minus className="w-3 h-3 text-red-500" />;
      case "unchanged": return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  const getActionLabel = (action: DiffEntry["action"]) => {
    switch (action) {
      case "new": return isUrdu ? "نیا" : "New";
      case "overwrite": return isUrdu ? "اپ ڈیٹ" : "Overwrite";
      case "remove": return isUrdu ? "ہٹائیں" : "Remove";
      case "unchanged": return isUrdu ? "بدلاؤ نہیں" : "No Change";
    }
  };

  const getActionColor = (action: DiffEntry["action"]) => {
    switch (action) {
      case "new": return darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700";
      case "overwrite": return darkMode ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-700";
      case "remove": return darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700";
      case "unchanged": return darkMode ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500";
    }
  };

  const changedEntries = diff.entries.filter(e => e.action !== "unchanged");
  const unchangedEntries = diff.entries.filter(e => e.action === "unchanged");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`relative w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden ${
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${darkMode ? "bg-blue-900/30" : "bg-blue-50"}`}>
                <FileJson className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? "درآمد پیش نظارہ" : "Import Preview"}
                </h3>
                <p className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {isUrdu ? "ایکسپورٹ شدہ" : "Exported"}: {new Date(diff.exportedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Warning banner */}
          <div className={`mx-4 mt-3 p-2.5 rounded-lg flex items-start gap-2 ${
            darkMode ? "bg-amber-900/20 border border-amber-800/30" : "bg-amber-50 border border-amber-200"
          }`}>
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className={`text-[10px] leading-relaxed ${darkMode ? "text-amber-300" : "text-amber-700"}`}>
              {isUrdu
                ? "درآمد کرنے سے موجودہ مقامی ڈیٹا اوور رائٹ ہو جائے گا۔ پہلے ایکسپورٹ کرنے کی سفارش کی جاتی ہے۔"
                : "Importing will overwrite your current local data. We recommend exporting first as a backup."}
            </p>
          </div>

          {/* Summary */}
          <div className={`mx-4 mt-3 flex items-center gap-3 text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-500 font-bold">
              {changedEntries.length} {isUrdu ? "تبدیلیاں" : "changes"}
            </span>
            <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 font-bold">
              {unchangedEntries.length} {isUrdu ? "بدلاؤ نہیں" : "unchanged"}
            </span>
          </div>

          {/* Diff list */}
          <div className="px-4 py-3 overflow-y-auto max-h-[40vh] space-y-1.5">
            {/* Changed entries first */}
            {changedEntries.map((entry, idx) => (
              <div key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                darkMode ? "bg-gray-900/50" : "bg-gray-50"
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  {getActionIcon(entry.action)}
                  <span className={`text-xs font-medium truncate ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
                    {entry.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {entry.currentCount}
                  </span>
                  <ArrowRight className={`w-3 h-3 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
                  <span className={`text-[10px] font-semibold ${
                    entry.action === "new" ? "text-green-500" :
                    entry.action === "overwrite" ? "text-orange-500" :
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    {entry.importCount}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getActionColor(entry.action)}`}>
                    {getActionLabel(entry.action)}
                  </span>
                </div>
              </div>
            ))}

            {/* Unchanged entries (collapsed) */}
            {unchangedEntries.length > 0 && (
              <div className={`pt-2 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <p className={`text-[10px] mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                  {isUrdu ? "بدلاؤ نہیں" : "Unchanged"} ({unchangedEntries.length})
                </p>
                {unchangedEntries.map((entry, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-1 px-3 text-[10px] ${
                    darkMode ? "text-gray-600" : "text-gray-400"
                  }`}>
                    <span>{entry.label}</span>
                    <span>{entry.currentCount} items</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className={`flex gap-2 px-4 py-3 border-t ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                darkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {isUrdu ? "منسوخ" : "Cancel"}
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || changedEntries.length === 0}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                importing || changedEntries.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {isUrdu ? "درآمد ہو رہا ہے..." : "Importing..."}
                </>
              ) : (
                <>
                  {isUrdu ? `${changedEntries.length} تبدیلیاں لاگو کریں` : `Apply ${changedEntries.length} Changes`}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
