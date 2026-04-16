/**
 * SyncDiffViewer — side-by-side comparison modal for manual conflict resolution.
 * Shows local vs server versions of a conflicting record, highlights differing fields,
 * and lets the admin pick which version to keep.
 */
import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Monitor, Server, Check, ChevronDown, ChevronUp,
  AlertTriangle, GitMerge, ArrowRight, Trash2, CheckCheck, Filter,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import {
  getPendingConflicts,
  resolveConflict,
  resolveConflictWithCustomMerge,
  dismissConflict,
  clearResolvedConflicts,
  pushCases,
  pushNotifications,
  pushUsers,
  pushAttendance,
  pushLeaveRequests,
  pushPassportTracking,
  type PendingConflict,
} from "../lib/syncService";
import { toast } from "../lib/toast";

const ENTITY_STORAGE_MAP: Record<string, string> = {
  cases: "crm_cases",
  notifications: "crm_notifications",
  users: "crm_users_db",
  attendance: "crm_attendance",
  leaveRequests: "crm_leave_requests",
  passportTracking: "crm_passport_tracking",
};

const ENTITY_PUSH_MAP: Record<string, () => Promise<void>> = {
  cases: pushCases,
  notifications: pushNotifications,
  users: pushUsers,
  attendance: pushAttendance,
  leaveRequests: pushLeaveRequests,
  passportTracking: pushPassportTracking,
};

/** Fields to show prominently in the diff (entity -> field list) */
const KEY_FIELDS: Record<string, string[]> = {
  cases: ["customerName", "status", "currentStage", "paidAmount", "totalFee", "updatedDate", "agentName", "priority"],
  users: ["fullName", "email", "role", "status", "updatedAt", "lastLogin"],
  notifications: ["title", "message", "read", "priority", "timestamp"],
  attendance: ["agentId", "date", "checkIn", "checkOut", "status"],
  leaveRequests: ["agentId", "type", "status", "submittedAt", "reviewedAt"],
  passportTracking: ["passportNumber", "customerName", "currentLocation", "status", "checkedOutAt"],
};

interface Props {
  onClose: () => void;
  onResolved?: () => void;
}

export function SyncDiffViewer({ onClose, onResolved }: Props) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const card = dc ? "bg-gray-800" : "bg-white";

  const [conflicts, setConflicts] = useState<PendingConflict[]>(getPendingConflicts());
  const [expandedId, setExpandedId] = useState<string | null>(conflicts[0]?.id || null);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [entityExclusions, setEntityExclusions] = useState<Set<string>>(new Set());

  // Swipe-to-dismiss state
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [sheetOpacity, setSheetOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const DISMISS_THRESHOLD = 120; // px to dismiss
  const VELOCITY_THRESHOLD = 0.5; // px/ms for fast flick

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow drag from the handle area or when at scroll top
    const target = e.target as HTMLElement;
    const isHandle = target.closest("[data-drag-handle]");
    const scrollContainer = sheetRef.current?.querySelector("[data-scroll-body]") as HTMLElement | null;
    const isAtScrollTop = !scrollContainer || scrollContainer.scrollTop <= 0;

    if (!isHandle && !isAtScrollTop) return;

    touchStartRef.current = { y: e.touches[0].clientY, time: Date.now() };
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // Only drag downward
    if (deltaY < 0) {
      setSheetTranslateY(0);
      setSheetOpacity(1);
      return;
    }

    setIsDragging(true);
    setSheetTranslateY(deltaY);
    setSheetOpacity(Math.max(0.3, 1 - deltaY / 400));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !isDragging) {
      touchStartRef.current = null;
      return;
    }

    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = sheetTranslateY / Math.max(1, elapsed);
    const shouldDismiss = sheetTranslateY > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (shouldDismiss) {
      // Animate out then close
      setSheetTranslateY(window.innerHeight);
      setSheetOpacity(0);
      setTimeout(() => onClose(), 200);
    } else {
      // Snap back
      setSheetTranslateY(0);
      setSheetOpacity(1);
    }

    touchStartRef.current = null;
    setIsDragging(false);
  }, [sheetTranslateY, onClose]);

  const unresolved = conflicts.filter(c => !c.resolved);
  const resolved = conflicts.filter(c => c.resolved);
  const visibleConflicts = showResolved ? conflicts : unresolved;

  // Unique entity types in unresolved conflicts
  const unresolvedEntities = useMemo(() => {
    const entities: Record<string, number> = {};
    unresolved.forEach(c => { entities[c.entity] = (entities[c.entity] || 0) + 1; });
    return entities;
  }, [unresolved]);

  const toggleEntityExclusion = (entity: string) => {
    setEntityExclusions(prev => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
  };

  const handleResolve = async (conflictId: string, choice: "local" | "server") => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const storageKey = ENTITY_STORAGE_MAP[conflict.entity];
    if (!storageKey) {
      toast.error(`Unknown entity: ${conflict.entity}`);
      return;
    }

    resolveConflict(conflictId, choice, storageKey);

    // Push the updated entity to server
    const pushFn = ENTITY_PUSH_MAP[conflict.entity];
    if (pushFn) {
      try { await pushFn(); } catch { /* ignore */ }
    }

    setConflicts(getPendingConflicts());
    toast.success(
      isUrdu
        ? `${choice === "local" ? "مقامی" : "سرور"} ورژن لاگو ہو گیا`
        : `Applied ${choice === "local" ? "local" : "server"} version for ${conflict.entity} #${conflict.recordId}`
    );
    onResolved?.();
  };

  const handleCherryPickResolve = async (conflictId: string, mergedRecord: any) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const storageKey = ENTITY_STORAGE_MAP[conflict.entity];
    if (!storageKey) {
      toast.error(`Unknown entity: ${conflict.entity}`);
      return;
    }

    resolveConflictWithCustomMerge(conflictId, mergedRecord, storageKey);

    const pushFn = ENTITY_PUSH_MAP[conflict.entity];
    if (pushFn) {
      try { await pushFn(); } catch { /* ignore */ }
    }

    setConflicts(getPendingConflicts());
    toast.success(
      isUrdu
        ? "حسب ضرورت ضم لاگو ہو گیا"
        : `Custom cherry-picked merge applied for ${conflict.entity} #${conflict.recordId}`
    );
    onResolved?.();
  };

  const handleResolveAll = async (choice: "local" | "server") => {
    if (unresolved.length === 0) return;
    setResolvingAll(true);

    const entitiesToPush = new Set<string>();

    for (const conflict of unresolved) {
      const storageKey = ENTITY_STORAGE_MAP[conflict.entity];
      if (!storageKey) continue;
      resolveConflict(conflict.id, choice, storageKey);
      entitiesToPush.add(conflict.entity);
    }

    // Push all affected entities
    for (const entity of entitiesToPush) {
      const pushFn = ENTITY_PUSH_MAP[entity];
      if (pushFn) {
        try { await pushFn(); } catch { /* ignore */ }
      }
    }

    setConflicts(getPendingConflicts());
    setResolvingAll(false);
    toast.success(
      isUrdu
        ? `${unresolved.length} تصادمات ${choice === "local" ? "مقامی" : "سرور"} ورژن سے حل ہو گئے`
        : `Resolved ${unresolved.length} conflict${unresolved.length !== 1 ? "s" : ""} using ${choice} version`
    );
    onResolved?.();
  };

  const handleSelectiveResolve = async (choice: "local" | "server") => {
    const toResolve = unresolved.filter(c => !entityExclusions.has(c.entity));
    if (toResolve.length === 0) return;
    setResolvingAll(true);

    const entitiesToPush = new Set<string>();

    for (const conflict of toResolve) {
      const storageKey = ENTITY_STORAGE_MAP[conflict.entity];
      if (!storageKey) continue;
      resolveConflict(conflict.id, choice, storageKey);
      entitiesToPush.add(conflict.entity);
    }

    for (const entity of entitiesToPush) {
      const pushFn = ENTITY_PUSH_MAP[entity];
      if (pushFn) {
        try { await pushFn(); } catch { /* ignore */ }
      }
    }

    setConflicts(getPendingConflicts());
    setResolvingAll(false);
    setBatchSelectMode(false);
    setEntityExclusions(new Set());
    const skipped = unresolved.length - toResolve.length;
    toast.success(
      isUrdu
        ? `${toResolve.length} تصادمات ${choice === "local" ? "مقامی" : "سرور"} ورژن سے حل ہو گئے${skipped > 0 ? ` (${skipped} چھوڑے گئے)` : ""}`
        : `Resolved ${toResolve.length} conflict${toResolve.length !== 1 ? "s" : ""} using ${choice} version${skipped > 0 ? ` (${skipped} skipped)` : ""}`
    );
    onResolved?.();
  };

  const handleDismiss = (conflictId: string) => {
    dismissConflict(conflictId);
    setConflicts(getPendingConflicts());
  };

  const handleClearResolved = () => {
    clearResolvedConflicts();
    setConflicts(getPendingConflicts());
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 40 }}
          className={`${card} rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border-t sm:border ${dc ? "border-gray-700" : "border-gray-200"}`}
          ref={sheetRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${sheetTranslateY}px)`,
            opacity: sheetOpacity,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease',
          }}
        >
          {/* Mobile drag handle indicator */}
          <div
            data-drag-handle
            className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className={`w-10 h-1 rounded-full ${dc ? "bg-gray-600" : "bg-gray-300"}`} />
          </div>

          {/* Header */}
          <div className={`flex items-center justify-between p-4 sm:p-5 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                <GitMerge className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${txt}`}>
                  {isUrdu ? "تصادم حل کریں" : "Conflict Resolution"}
                </h2>
                <p className={`text-xs ${sub}`}>
                  {unresolved.length > 0
                    ? isUrdu ? `${unresolved.length} غیر حل شدہ تصادمات` : `${unresolved.length} unresolved conflict${unresolved.length !== 1 ? "s" : ""}`
                    : isUrdu ? "تمام تصادمات حل ہو گئے" : "All conflicts resolved"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {resolved.length > 0 && (
                <button
                  onClick={() => setShowResolved(!showResolved)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    showResolved
                      ? "bg-blue-600 text-white"
                      : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {showResolved ? (isUrdu ? "غیر حل شدہ" : "Unresolved") : (isUrdu ? `حل شدہ (${resolved.length})` : `Resolved (${resolved.length})`)}
                </button>
              )}
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Batch Resolve All Bar */}
          {unresolved.length >= 2 && !showResolved && (
            <div className={`px-4 sm:px-5 py-3 border-b ${dc ? "border-gray-700 bg-gray-900/40" : "border-gray-200 bg-gray-50"}`}>
              {!batchSelectMode ? (
                /* Standard batch mode */
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className={`text-xs font-medium ${sub} mr-auto whitespace-nowrap`}>
                    {isUrdu ? "سب حل کریں:" : "Resolve all at once:"}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={resolvingAll}
                    onClick={() => handleResolveAll("server")}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-h-[38px] bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {resolvingAll
                      ? (isUrdu ? "حل ہو رہا ہے..." : "Resolving...")
                      : (isUrdu ? `سب سرور رکھیں (${unresolved.length})` : `Keep All Server (${unresolved.length})`)}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={resolvingAll}
                    onClick={() => handleResolveAll("local")}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-h-[38px] bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {isUrdu ? `سب مقامی رکھیں (${unresolved.length})` : `Keep All Local (${unresolved.length})`}
                  </motion.button>
                  {Object.keys(unresolvedEntities).length > 1 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setBatchSelectMode(true); setEntityExclusions(new Set()); }}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium min-h-[38px] ${
                        dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {isUrdu ? "منتخب" : "Selective"}
                    </motion.button>
                  )}
                </div>
              ) : (
                /* Selective batch mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${txt}`}>
                      {isUrdu ? "کون سے اداروں کو حل کریں:" : "Select entities to resolve:"}
                    </span>
                    <button
                      onClick={() => { setBatchSelectMode(false); setEntityExclusions(new Set()); }}
                      className={`text-xs px-2 py-1 rounded-lg ${dc ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                      {isUrdu ? "واپس" : "Back"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(unresolvedEntities).map(([entity, count]) => {
                      const included = !entityExclusions.has(entity);
                      return (
                        <button
                          key={entity}
                          onClick={() => toggleEntityExclusion(entity)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            included
                              ? dc ? "bg-emerald-900/30 border-emerald-600 text-emerald-400" : "bg-emerald-50 border-emerald-400 text-emerald-700"
                              : dc ? "bg-gray-800 border-gray-600 text-gray-500 line-through" : "bg-gray-100 border-gray-300 text-gray-400 line-through"
                          }`}
                        >
                          <div className={`w-3 h-3 rounded flex items-center justify-center ${
                            included
                              ? dc ? "bg-emerald-500" : "bg-emerald-500"
                              : dc ? "bg-gray-600" : "bg-gray-300"
                          }`}>
                            {included && <Check className="w-2 h-2 text-white" />}
                          </div>
                          <span className="capitalize">{entity}</span>
                          <span className={`${included ? (dc ? "text-emerald-500" : "text-emerald-600") : (dc ? "text-gray-600" : "text-gray-400")}`}>
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const selectedCount = unresolved.filter(c => !entityExclusions.has(c.entity)).length;
                    return (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <span className={`text-[10px] mr-auto ${sub}`}>
                          {selectedCount} / {unresolved.length} {isUrdu ? "تصادمات منتخب" : "conflicts selected"}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={resolvingAll || selectedCount === 0}
                          onClick={() => handleSelectiveResolve("server")}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-h-[38px] bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          <Server className="w-3.5 h-3.5" />
                          {resolvingAll ? (isUrdu ? "حل ہو رہا ہے..." : "Resolving...") : (isUrdu ? `سرور (${selectedCount})` : `Server (${selectedCount})`)}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={resolvingAll || selectedCount === 0}
                          onClick={() => handleSelectiveResolve("local")}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-h-[38px] bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          {isUrdu ? `مقامی (${selectedCount})` : `Local (${selectedCount})`}
                        </motion.button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3" data-scroll-body>
            {visibleConflicts.length === 0 ? (
              <div className="text-center py-16">
                <GitMerge className={`w-12 h-12 mx-auto mb-3 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                <p className={`text-sm font-medium ${txt}`}>
                  {isUrdu ? "کوئی تصادم نہیں" : "No conflicts to resolve"}
                </p>
                <p className={`text-xs mt-1 ${sub}`}>
                  {isUrdu ? "جب سنک کے دوران تصادم پایا جائے گا تو یہاں نظر آئے گا" : "Conflicts detected during sync will appear here"}
                </p>
              </div>
            ) : (
              visibleConflicts.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  isExpanded={expandedId === conflict.id}
                  onToggle={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
                  onResolve={(choice) => handleResolve(conflict.id, choice)}
                  onCherryPick={(merged) => handleCherryPickResolve(conflict.id, merged)}
                  onDismiss={() => handleDismiss(conflict.id)}
                  darkMode={dc}
                  isUrdu={isUrdu}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {resolved.length > 0 && (
            <div className={`p-4 border-t ${dc ? "border-gray-700" : "border-gray-200"} flex justify-end`}>
              <button
                onClick={handleClearResolved}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium ${
                  dc ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-50"
                }`}
              >
                <Trash2 className="w-3 h-3" />
                {isUrdu ? "حل شدہ صاف کریں" : "Clear Resolved"}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Single Conflict Card ────────────────────────────────────
function ConflictCard({
  conflict,
  isExpanded,
  onToggle,
  onResolve,
  onCherryPick,
  onDismiss,
  darkMode,
  isUrdu,
}: {
  conflict: PendingConflict;
  isExpanded: boolean;
  onToggle: () => void;
  onResolve: (choice: "local" | "server") => void;
  onCherryPick: (merged: any) => void;
  onDismiss: () => void;
  darkMode: boolean;
  isUrdu: boolean;
}) {
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  // Cherry-pick mode state
  const [cherryPickMode, setCherryPickMode] = useState(false);
  // Per-field selection: field name -> "local" | "server"
  const [fieldSelections, setFieldSelections] = useState<Record<string, "local" | "server">>({});

  // Compute differing fields
  const keyFields = KEY_FIELDS[conflict.entity] || Object.keys(conflict.localVersion || {}).slice(0, 8);
  const diffs = useMemo(() => {
    const result: { field: string; local: any; server: any; changed: boolean }[] = [];
    const allFields = new Set([...keyFields, ...Object.keys(conflict.localVersion || {}), ...Object.keys(conflict.serverVersion || {})]);
    const ordered = [...keyFields, ...Array.from(allFields).filter(f => !keyFields.includes(f))];
    const seen = new Set<string>();
    for (const field of ordered) {
      if (seen.has(field)) continue;
      seen.add(field);
      if (field === "id" || field === "password") continue;
      const lv = conflict.localVersion?.[field];
      const sv = conflict.serverVersion?.[field];
      const changed = JSON.stringify(lv) !== JSON.stringify(sv);
      result.push({ field, local: lv, server: sv, changed });
    }
    return result;
  }, [conflict]);

  const changedFields = diffs.filter(d => d.changed);
  const changedCount = changedFields.length;

  // Initialize field selections when entering cherry-pick mode (default to server)
  const enterCherryPickMode = () => {
    const initial: Record<string, "local" | "server"> = {};
    changedFields.forEach(d => { initial[d.field] = "server"; });
    setFieldSelections(initial);
    setCherryPickMode(true);
  };

  const toggleFieldSelection = (field: string) => {
    // Haptic feedback for mobile cherry-pick toggle
    try { navigator?.vibrate?.(10); } catch { /* not supported */ }
    setFieldSelections(prev => ({
      ...prev,
      [field]: prev[field] === "local" ? "server" : "local",
    }));
  };

  const applyCherryPick = () => {
    // Start with server version as base, then overlay selected local fields
    const merged = { ...conflict.serverVersion };
    Object.entries(fieldSelections).forEach(([field, choice]) => {
      if (choice === "local") {
        merged[field] = conflict.localVersion?.[field];
      } else {
        merged[field] = conflict.serverVersion?.[field];
      }
    });
    // Copy over unchanged fields from whichever side has them
    diffs.forEach(d => {
      if (!d.changed && !(d.field in merged)) {
        merged[d.field] = d.local ?? d.server;
      }
    });
    // Ensure ID is preserved
    merged.id = conflict.recordId;
    onCherryPick(merged);
    setCherryPickMode(false);
  };

  const localPickCount = Object.values(fieldSelections).filter(v => v === "local").length;
  const serverPickCount = Object.values(fieldSelections).filter(v => v === "server").length;

  const formatValue = (val: any): string => {
    if (val === undefined || val === null) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === "object") return JSON.stringify(val).slice(0, 60) + "...";
    const str = String(val);
    return str.length > 50 ? str.slice(0, 50) + "..." : str;
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      conflict.resolved
        ? dc ? "border-green-800/30 bg-green-900/10" : "border-green-200 bg-green-50/50"
        : cherryPickMode
          ? dc ? "border-purple-700/50 bg-purple-900/10" : "border-purple-300 bg-purple-50/30"
          : dc ? "border-orange-800/30 bg-gray-800/50" : "border-orange-200 bg-orange-50/30"
    }`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 sm:p-4 text-left"
      >
        <div className="flex items-center gap-3">
          {conflict.resolved ? (
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold capitalize ${txt}`}>{conflict.entity}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}`}>
                {conflict.recordId}
              </span>
              {conflict.resolved && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${dc ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}>
                  {isUrdu ? "حل شدہ" : "RESOLVED"}
                </span>
              )}
              {cherryPickMode && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${dc ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700"}`}>
                  {isUrdu ? "چیری پک" : "CHERRY PICK"}
                </span>
              )}
            </div>
            <p className={`text-[10px] mt-0.5 ${sub}`}>
              {cherryPickMode
                ? `${localPickCount} local + ${serverPickCount} server fields selected`
                : `${changedCount} ${isUrdu ? "مختلف فیلڈز" : "differing fields"} | ${new Date(conflict.detectedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              }
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className={`w-4 h-4 ${sub}`} /> : <ChevronDown className={`w-4 h-4 ${sub}`} />}
      </button>

      {/* Expanded Diff */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
              {/* Column Headers — hidden on mobile, shown as grid on sm+ */}
              <div className={`hidden sm:grid ${cherryPickMode ? "grid-cols-[20px_minmax(90px,1fr)_1fr_1fr]" : "grid-cols-[minmax(100px,1fr)_1fr_1fr]"} gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                dc ? "bg-gray-900/50 text-gray-500" : "bg-gray-100 text-gray-500"
              }`}>
                {cherryPickMode && <span></span>}
                <span>{isUrdu ? "فیلڈ" : "Field"}</span>
                <span className="flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-blue-400" />
                  {isUrdu ? "مقامی" : "Local"}
                </span>
                <span className="flex items-center gap-1">
                  <Server className="w-3 h-3 text-indigo-400" />
                  {isUrdu ? "سرور" : "Server"}
                </span>
              </div>

              {/* Mobile header label */}
              <div className={`sm:hidden flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                dc ? "bg-gray-900/50 text-gray-500" : "bg-gray-100 text-gray-500"
              }`}>
                {isUrdu ? "فیلڈ کی تبدیلیاں" : "Field Changes"}
                {cherryPickMode && (
                  <span className={`text-[9px] font-normal normal-case ${dc ? "text-purple-400" : "text-purple-600"}`}>
                    — {isUrdu ? "ٹیپ کر کے تبدیل کریں" : "tap to toggle"}
                  </span>
                )}
              </div>

              {/* Diff Rows */}
              <div className="max-h-64 sm:max-h-72 overflow-y-auto">
                {diffs
                  .sort((a, b) => (a.changed === b.changed ? 0 : a.changed ? -1 : 1))
                  .slice(0, 20)
                  .map((diff) => {
                    const selection = fieldSelections[diff.field];
                    const isPickable = cherryPickMode && diff.changed;

                    const borderColor = diff.changed
                      ? isPickable && selection === "local"
                        ? "border-blue-500"
                        : isPickable && selection === "server"
                          ? "border-indigo-500"
                          : "border-orange-500"
                      : "border-transparent";

                    const bgColor = diff.changed
                      ? isPickable && selection === "local"
                        ? dc ? "bg-blue-900/15" : "bg-blue-50"
                        : isPickable && selection === "server"
                          ? dc ? "bg-indigo-900/15" : "bg-indigo-50"
                          : dc ? "bg-orange-900/10" : "bg-orange-50"
                      : "";

                    return (
                      <div key={diff.field}>
                        {/* Desktop grid row — hidden on mobile */}
                        <div
                          onClick={isPickable ? () => toggleFieldSelection(diff.field) : undefined}
                          className={`hidden sm:grid ${cherryPickMode ? "grid-cols-[20px_minmax(90px,1fr)_1fr_1fr]" : "grid-cols-[minmax(100px,1fr)_1fr_1fr]"} gap-1 px-3 py-1.5 text-xs transition-colors ${
                            isPickable ? "cursor-pointer hover:bg-purple-500/5" : ""
                          } border-l-2 ${borderColor} ${bgColor}`}
                        >
                          {cherryPickMode && (
                            <div className="flex items-center">
                              {diff.changed ? (
                                <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold ${
                                  selection === "local" ? "bg-blue-500 text-white" : "bg-indigo-500 text-white"
                                }`}>
                                  {selection === "local" ? "L" : "S"}
                                </div>
                              ) : (
                                <div className={`w-4 h-4 rounded flex items-center justify-center ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                                  <span className={`text-[8px] ${dc ? "text-gray-500" : "text-gray-400"}`}>=</span>
                                </div>
                              )}
                            </div>
                          )}
                          <span className={`font-medium truncate ${
                            diff.changed
                              ? isPickable && selection === "local"
                                ? dc ? "text-blue-300" : "text-blue-700"
                                : isPickable && selection === "server"
                                  ? dc ? "text-indigo-300" : "text-indigo-700"
                                  : dc ? "text-orange-300" : "text-orange-700"
                              : sub
                          }`}>
                            {diff.field}
                          </span>
                          <span className={`truncate ${
                            isPickable && selection === "local"
                              ? "font-bold " + (dc ? "text-blue-300" : "text-blue-700")
                              : diff.changed ? (dc ? "text-blue-300/60" : "text-blue-600/60") : sub
                          }`}>
                            {formatValue(diff.local)}
                          </span>
                          <span className={`truncate ${
                            isPickable && selection === "server"
                              ? "font-bold " + (dc ? "text-indigo-300" : "text-indigo-700")
                              : diff.changed ? (dc ? "text-indigo-300/60" : "text-indigo-600/60") : sub
                          }`}>
                            {formatValue(diff.server)}
                          </span>
                        </div>

                        {/* Mobile stacked card row — shown only on mobile */}
                        <div
                          onClick={isPickable ? () => toggleFieldSelection(diff.field) : undefined}
                          className={`sm:hidden px-3 py-2.5 border-l-2 ${borderColor} ${bgColor} ${
                            isPickable ? "cursor-pointer active:bg-purple-500/10" : ""
                          } transition-colors`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${
                              diff.changed
                                ? isPickable && selection === "local"
                                  ? dc ? "text-blue-300" : "text-blue-700"
                                  : isPickable && selection === "server"
                                    ? dc ? "text-indigo-300" : "text-indigo-700"
                                    : dc ? "text-orange-300" : "text-orange-700"
                                : sub
                            }`}>
                              {diff.field}
                            </span>
                            {isPickable && (
                              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                selection === "local"
                                  ? "bg-blue-500 text-white"
                                  : "bg-indigo-500 text-white"
                              }`}>
                                {selection === "local" ? (isUrdu ? "مقامی" : "LOCAL") : (isUrdu ? "سرور" : "SERVER")}
                              </div>
                            )}
                            {!isPickable && !diff.changed && (
                              <span className={`text-[9px] ${dc ? "text-gray-600" : "text-gray-400"}`}>{isUrdu ? "ایک جیسے" : "identical"}</span>
                            )}
                          </div>
                          {diff.changed && (
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div className={`rounded-lg px-2 py-1.5 ${
                                isPickable && selection === "local"
                                  ? dc ? "bg-blue-500/20 ring-1 ring-blue-500" : "bg-blue-100 ring-1 ring-blue-400"
                                  : dc ? "bg-gray-700/50" : "bg-gray-100"
                              }`}>
                                <div className={`text-[9px] font-medium uppercase mb-0.5 flex items-center gap-1 ${
                                  isPickable && selection === "local" ? (dc ? "text-blue-300" : "text-blue-600") : sub
                                }`}>
                                  <Monitor className="w-2.5 h-2.5" /> {isUrdu ? "مقامی" : "Local"}
                                </div>
                                <div className={`text-[11px] break-all ${
                                  isPickable && selection === "local"
                                    ? "font-bold " + (dc ? "text-blue-200" : "text-blue-800")
                                    : dc ? "text-gray-300" : "text-gray-700"
                                }`}>
                                  {formatValue(diff.local)}
                                </div>
                              </div>
                              <div className={`rounded-lg px-2 py-1.5 ${
                                isPickable && selection === "server"
                                  ? dc ? "bg-indigo-500/20 ring-1 ring-indigo-500" : "bg-indigo-100 ring-1 ring-indigo-400"
                                  : dc ? "bg-gray-700/50" : "bg-gray-100"
                              }`}>
                                <div className={`text-[9px] font-medium uppercase mb-0.5 flex items-center gap-1 ${
                                  isPickable && selection === "server" ? (dc ? "text-indigo-300" : "text-indigo-600") : sub
                                }`}>
                                  <Server className="w-2.5 h-2.5" /> {isUrdu ? "سرور" : "Server"}
                                </div>
                                <div className={`text-[11px] break-all ${
                                  isPickable && selection === "server"
                                    ? "font-bold " + (dc ? "text-indigo-200" : "text-indigo-800")
                                    : dc ? "text-gray-300" : "text-gray-700"
                                }`}>
                                  {formatValue(diff.server)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Action Buttons */}
              {!conflict.resolved && (
                <div className={`p-3 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                  {cherryPickMode ? (
                    /* Cherry Pick Mode Actions */
                    <div className="space-y-2">
                      <div className={`flex items-center justify-between text-[10px] px-1 ${sub}`}>
                        <span>
                          {isUrdu ? "ہر فیلڈ پر کلک کر کے مقامی یا سرور منتخب کریں" : "Click each row to toggle between Local (L) and Server (S)"}
                        </span>
                        <span className="font-medium">
                          <span className="text-blue-400">{localPickCount}L</span>
                          {" / "}
                          <span className="text-indigo-400">{serverPickCount}S</span>
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={applyCherryPick}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-colors"
                        >
                          <GitMerge className="w-4 h-4" />
                          {isUrdu ? "حسب ضرورت ضم لاگو کریں" : "Apply Custom Merge"}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCherryPickMode(false)}
                          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${
                            dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {isUrdu ? "واپس" : "Cancel"}
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Mode Actions */
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onResolve("local")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <Monitor className="w-4 h-4" />
                        {isUrdu ? "مقامی رکھیں" : "Keep Local"}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onResolve("server")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        <Server className="w-4 h-4" />
                        {isUrdu ? "سرور رکھیں" : "Keep Server"}
                      </motion.button>
                      {changedCount > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={enterCherryPickMode}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-colors"
                        >
                          <GitMerge className="w-4 h-4" />
                          {isUrdu ? "چیری پک" : "Cherry Pick"}
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onDismiss}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${
                          dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <X className="w-4 h-4" />
                        {isUrdu ? "نظرانداز" : "Dismiss"}
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}