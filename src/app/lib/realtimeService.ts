/**
 * Supabase Realtime Service — Emerald Tech Partner
 *
 * Handles:
 * - Live postgres_changes subscriptions on cases, documents, payments, notes
 * - Presence tracking for "who is viewing this case"
 * - Cross-tab broadcast via BroadcastChannel (fallback when Realtime unavailable)
 */

import { supabase } from "./supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeTable = "cases" | "documents" | "payments" | "notes";

export interface RealtimeChangePayload {
  table: RealtimeTable;
  event: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
  caseId?: string;
}

export type ChangeHandler = (payload: RealtimeChangePayload) => void;

export interface PresenceUser {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  joinedAt: string;
}

export type PresenceHandler = (users: PresenceUser[]) => void;

// ── Internal State ──────────────────────────────────────────
const channels = new Map<string, RealtimeChannel>();
const changeCallbacks = new Map<RealtimeTable, Set<ChangeHandler>>();
const presenceCallbacks = new Map<string, Set<PresenceHandler>>();
let isAuthenticated = false;
let pendingTables = new Set<RealtimeTable>();

const BROADCAST_CHANNEL = "emerald-crm-realtime";
let broadcastChannel: BroadcastChannel | null = null;

// ── Auth-aware re-subscription ──────────────────────────────
// Realtime channels must be re-subscribed after auth to send the JWT.
supabase.auth.onAuthStateChange((event, session) => {
  const wasAuth = isAuthenticated;
  isAuthenticated = !!session?.user;

  if (!wasAuth && isAuthenticated && pendingTables.size > 0) {
    pendingTables.forEach((table) => {
      unsubscribeFromTable(table);
      subscribeToTable(table);
    });
    pendingTables.clear();
  }
});

// ── BroadcastChannel Fallback ───────────────────────────────
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event) => {
        const payload = event.data as RealtimeChangePayload;
        notifyChangeCallbacks(payload);
      };
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

function broadcastChange(payload: RealtimeChangePayload) {
  getBroadcastChannel()?.postMessage(payload);
}

// ── Change Notification ─────────────────────────────────────
function notifyChangeCallbacks(payload: RealtimeChangePayload) {
  const callbacks = changeCallbacks.get(payload.table);
  if (callbacks) {
    callbacks.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
      }
    });
  }
}

// ── Subscribe to a table ────────────────────────────────────
export function subscribeToTable(table: RealtimeTable): () => void {
  if (channels.has(table)) {
    return () => unsubscribeFromTable(table);
  }

  // Defer subscription until authenticated — channels created without a JWT
  // won't receive RLS-guarded changes.
  if (!isAuthenticated) {
    pendingTables.add(table);
    return () => {
      pendingTables.delete(table);
      unsubscribeFromTable(table);
    };
  }

  const channel = supabase
    .channel(`${table}-changes`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        const changePayload: RealtimeChangePayload = {
          table,
          event: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          new: payload.new,
          old: payload.old,
          caseId: (payload.new as any)?.case_id || (payload.old as any)?.case_id || (payload.new as any)?.id || (payload.old as any)?.id,
        };
        notifyChangeCallbacks(changePayload);
        broadcastChange(changePayload);
      }
    )
    .subscribe((status) => {
    });

  channels.set(table, channel);

  return () => unsubscribeFromTable(table);
}

function unsubscribeFromTable(table: RealtimeTable) {
  const channel = channels.get(table);
  if (channel) {
    channel.unsubscribe();
    supabase.removeChannel(channel);
    channels.delete(table);
  }
}

// ── Register a change listener ──────────────────────────────
export function onRealtimeChange(table: RealtimeTable, handler: ChangeHandler): () => void {
  // Auto-subscribe if first listener
  if (!changeCallbacks.has(table) || changeCallbacks.get(table)!.size === 0) {
    subscribeToTable(table);
  }

  const set = changeCallbacks.get(table) || new Set();
  set.add(handler);
  changeCallbacks.set(table, set);

  return () => {
    set.delete(handler);
    if (set.size === 0) {
      unsubscribeFromTable(table);
    }
  };
}

// ── Presence: Track who is viewing a case ───────────────────
export function subscribeToCasePresence(
  caseId: string,
  user: PresenceUser,
  onChange: PresenceHandler
): () => void {
  const channelName = `case-presence:${caseId}`;

  if (channels.has(channelName)) {
    return () => unsubscribeFromTable(channelName as RealtimeTable);
  }

  const channel = supabase
    .channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users: PresenceUser[] = Object.values(state)
        .flat()
        .map((p: any) => p.user)
        .filter(Boolean);
      onChange(users);

      const callbacks = presenceCallbacks.get(caseId);
      callbacks?.forEach((cb) => {
        try {
          cb(users);
        } catch (e) {
        }
      });
    })
    .on("presence", { event: "join" }, ({ key, newPresences }) => {
    })
    .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user });
      }
    });

  channels.set(channelName, channel);

  return () => {
    channel.unsubscribe();
    supabase.removeChannel(channel);
    channels.delete(channelName);
  };
}

// ── Batch subscribe to all tables ───────────────────────────
export function subscribeToAllTables(): () => void {
  const unsubscribers = [
    subscribeToTable("cases"),
    subscribeToTable("documents"),
    subscribeToTable("payments"),
    subscribeToTable("notes"),
  ];

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ── Shutdown all realtime channels ──────────────────────────
export function shutdownRealtime(): void {
  channels.forEach((channel, name) => {
    channel.unsubscribe();
    supabase.removeChannel(channel);
  });
  channels.clear();
  changeCallbacks.clear();
  presenceCallbacks.clear();

  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
}

// ── Hook-friendly wrapper ───────────────────────────────────
export function createRealtimeHook(table: RealtimeTable) {
  return {
    subscribe: (handler: ChangeHandler) => onRealtimeChange(table, handler),
  };
}
