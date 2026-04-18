/**
 * React Hook for Supabase Realtime
 *
 * Usage:
 *   const { changes, activeViewers } = useRealtimeCase(caseId, currentUser);
 *   useEffect(() => {
 *     if (changes.length > 0) {
 *       toast.info('This case was updated by another user');
 *     }
 *   }, [changes]);
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  onRealtimeChange,
  subscribeToCasePresence,
  RealtimeChangePayload,
  PresenceUser,
  RealtimeTable,
} from "./realtimeService";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";

export interface UseRealtimeOptions {
  tables?: RealtimeTable[];
  caseId?: string;
  enabled?: boolean;
}

export function useRealtimeChanges(options: UseRealtimeOptions = {}) {
  const { tables = ["cases"], enabled = true } = options;
  const [changes, setChanges] = useState<RealtimeChangePayload[]>([]);
  const changesRef = useRef<RealtimeChangePayload[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribers = tables.map((table) =>
      onRealtimeChange(table, (payload) => {
        changesRef.current = [...changesRef.current, payload];
        setChanges([...changesRef.current]);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, tables.join(",")]);

  const clearChanges = useCallback(() => {
    changesRef.current = [];
    setChanges([]);
  }, []);

  return { changes, clearChanges };
}

export function useRealtimeCase(caseId?: string) {
  const { profile } = useSupabaseAuth();
  const [activeViewers, setActiveViewers] = useState<PresenceUser[]>([]);
  const [lastChange, setLastChange] = useState<RealtimeChangePayload | null>(null);

  // Subscribe to case-level changes
  useEffect(() => {
    if (!caseId) return;

    const unsubCases = onRealtimeChange("cases", (payload) => {
      const newData = payload.new as any;
      const oldData = payload.old as any;
      // Case ID can be either UUID (from DB) or case_number (from mapper)
      const changedId = newData?.id || oldData?.id;
      const changedCaseNumber = newData?.case_number || oldData?.case_number;
      if (changedId === caseId || changedCaseNumber === caseId) {
        setLastChange(payload);
      }
    });

    const unsubNotes = onRealtimeChange("notes", (payload) => {
      if ((payload.new as any)?.case_id === caseId) {
        setLastChange(payload);
      }
    });

    const unsubDocs = onRealtimeChange("documents", (payload) => {
      if ((payload.new as any)?.case_id === caseId) {
        setLastChange(payload);
      }
    });

    const unsubPayments = onRealtimeChange("payments", (payload) => {
      if ((payload.new as any)?.case_id === caseId) {
        setLastChange(payload);
      }
    });

    return () => {
      unsubCases();
      unsubNotes();
      unsubDocs();
      unsubPayments();
    };
  }, [caseId]);

  // Subscribe to presence (who is viewing this case)
  useEffect(() => {
    if (!caseId || !profile) return;

    const user: PresenceUser = {
      id: profile.id,
      full_name: profile.full_name || "Unknown",
      role: profile.role,
      avatar_url: profile.avatar_url,
      joinedAt: new Date().toISOString(),
    };

    const unsubscribe = subscribeToCasePresence(caseId, user, (users) => {
      // Filter out current user
      setActiveViewers(users.filter((u) => u.id !== profile.id));
    });

    return () => {
      unsubscribe();
    };
  }, [caseId, profile]);

  return { lastChange, activeViewers };
}
