import { useEffect, useState } from "react";
import { Wifi, Users, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeCase } from "../lib/useRealtime";
import { toast } from "sonner";

interface RealtimeIndicatorProps {
  caseId?: string;
  onRefresh?: () => void;
}

export function RealtimeIndicator({ caseId, onRefresh }: RealtimeIndicatorProps) {
  const { lastChange, activeViewers } = useRealtimeCase(caseId);
  const [showRefresh, setShowRefresh] = useState(false);

  useEffect(() => {
    if (lastChange) {
      setShowRefresh(true);
      const timer = setTimeout(() => setShowRefresh(false), 30000);

      const tableName = lastChange.table;
      const action = lastChange.event === "INSERT" ? "added" : lastChange.event === "UPDATE" ? "updated" : "deleted";
      toast.info(
        `Case ${action}: ${tableName} was modified by another user`,
        {
          action: onRefresh
            ? {
                label: "Refresh",
                onClick: () => {
                  onRefresh();
                  setShowRefresh(false);
                },
              }
            : undefined,
          duration: 8000,
        }
      );

      return () => clearTimeout(timer);
    }
  }, [lastChange, onRefresh]);

  if (!caseId) return null;

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {showRefresh && onRefresh && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              onRefresh();
              setShowRefresh(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-colors border border-emerald-200"
          >
            <RefreshCw className="w-3 h-3" />
            Updated — Refresh
          </motion.button>
        )}
      </AnimatePresence>

      {activeViewers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full border border-blue-200"
          title={activeViewers.map((u) => u.full_name).join(", ")}
        >
          <Users className="w-3 h-3" />
          {activeViewers.length} viewing
        </motion.div>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-400" title="Realtime sync active">
        <Wifi className="w-3 h-3" />
        <span className="hidden sm:inline">Live</span>
      </div>
    </div>
  );
}
