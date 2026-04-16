/**
 * useConflictPolling — Real-time conflict detection hook
 * 
 * Polls DataSyncService at a configurable interval to detect when another
 * role modifies a case while the current user has the modal open.
 * Returns conflict state and a dismiss function.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { DataSyncService, ConflictInfo } from "./dataSync";

interface UseConflictPollingOptions {
  entityId: string | null;
  currentUserId: string;
  enabled?: boolean;
  intervalMs?: number;
}

interface ConflictState extends ConflictInfo {
  dismissed: boolean;
  dismiss: () => void;
  refresh: () => void;
  lastChecked: number;
}

export function useConflictPolling({
  entityId,
  currentUserId,
  enabled = true,
  intervalMs = 5000, // Check every 5 seconds
}: UseConflictPollingOptions): ConflictState {
  const [conflict, setConflict] = useState<ConflictInfo>({
    hasConflict: false,
    record: null,
    timeSince: "",
    modifiedByOther: false,
  });
  const [dismissed, setDismissed] = useState(false);
  const [lastChecked, setLastChecked] = useState(Date.now());
  const lastConflictTimestamp = useRef<string | null>(null);

  const checkConflict = useCallback(() => {
    if (!entityId || !enabled) return;

    const result = DataSyncService.checkConflict(entityId, currentUserId);
    setLastChecked(Date.now());

    // If there's a NEW conflict (different timestamp from what we already know),
    // reset dismissed state so the banner reappears
    if (
      result.hasConflict &&
      result.record &&
      result.record.lastModifiedAt !== lastConflictTimestamp.current
    ) {
      lastConflictTimestamp.current = result.record.lastModifiedAt;
      setDismissed(false);
    }

    setConflict(result);
  }, [entityId, currentUserId, enabled]);

  // Initial check
  useEffect(() => {
    checkConflict();
  }, [checkConflict]);

  // Polling interval
  useEffect(() => {
    if (!entityId || !enabled) return;

    const interval = setInterval(checkConflict, intervalMs);
    return () => clearInterval(interval);
  }, [entityId, enabled, intervalMs, checkConflict]);

  // Reset when entityId changes (new modal opened)
  useEffect(() => {
    setDismissed(false);
    lastConflictTimestamp.current = null;
  }, [entityId]);

  const dismiss = useCallback(() => {
    if (entityId) {
      DataSyncService.markViewed(entityId, currentUserId);
    }
    setDismissed(true);
  }, [entityId, currentUserId]);

  const refresh = useCallback(() => {
    if (entityId) {
      DataSyncService.markViewed(entityId, currentUserId);
    }
    setDismissed(true);
    checkConflict();
  }, [entityId, currentUserId, checkConflict]);

  return {
    ...conflict,
    dismissed,
    dismiss,
    refresh,
    lastChecked,
  };
}
