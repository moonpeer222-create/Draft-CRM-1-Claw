/**
 * Push Notification Permission & Cross-Portal Notification Bridge
 * for Emerald Visa CRM
 * 
 * Handles:
 * - Browser push notification permission
 * - In-app notification bridge between portals (operator → admin)
 * - Notification persistence via localStorage
 */

// ── Permission State ─────────────────────────────────────────────
export type PushPermission = "granted" | "denied" | "default" | "unsupported";

export function getPushPermission(): PushPermission {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as PushPermission;
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!("Notification" in window)) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result as PushPermission;
  } catch {
    return "denied";
  }
}

export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (getPushPermission() !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: `emr-${Date.now()}`,
    });
  } catch (e) {
    console.log("Browser notification error:", e);
  }
}

// ── User preference ─────────────────────────────────────────────
const PUSH_PREF_KEY = "emr-push-notifications-enabled";
const PUSH_ASKED_KEY = "emr-push-permission-asked";

export function isPushEnabled(): boolean {
  const pref = localStorage.getItem(PUSH_PREF_KEY);
  return pref === null ? true : pref === "true";
}

export function setPushEnabled(enabled: boolean) {
  localStorage.setItem(PUSH_PREF_KEY, String(enabled));
}

export function hasAskedPushPermission(): boolean {
  return localStorage.getItem(PUSH_ASKED_KEY) === "true";
}

export function markPushPermissionAsked() {
  localStorage.setItem(PUSH_ASKED_KEY, "true");
}

// ── Cross-Portal Notification Bridge ─────────────────────────────
// Stores notifications in localStorage so they're accessible from any portal
export interface BridgeNotification {
  id: string;
  fromRole: "operator" | "admin" | "agent" | "customer";
  toRole: "admin" | "operator" | "agent" | "customer";
  type: "status_confirmed" | "flag" | "payment_recorded" | "report_sent" | "document_flagged";
  messageEn: string;
  messageUr: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

const BRIDGE_KEY = "emr-notification-bridge";

function loadBridge(): BridgeNotification[] {
  try {
    return JSON.parse(localStorage.getItem(BRIDGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBridge(notifications: BridgeNotification[]) {
  // Keep only last 100 notifications
  localStorage.setItem(BRIDGE_KEY, JSON.stringify(notifications.slice(0, 100)));
}

export function pushBridgeNotification(notification: Omit<BridgeNotification, "id" | "timestamp" | "read">) {
  const bridge = loadBridge();
  const entry: BridgeNotification = {
    ...notification,
    id: `BN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  bridge.unshift(entry);
  saveBridge(bridge);

  // Also send browser notification if enabled
  if (isPushEnabled()) {
    sendBrowserNotification(
      "Emerald Visa CRM",
      notification.messageEn,
    );
  }

  return entry;
}

export function getBridgeNotificationsForRole(role: string): BridgeNotification[] {
  return loadBridge().filter(n => n.toRole === role);
}

export function getUnreadBridgeCount(role: string): number {
  return loadBridge().filter(n => n.toRole === role && !n.read).length;
}

export function markBridgeNotificationRead(id: string) {
  const bridge = loadBridge();
  const idx = bridge.findIndex(n => n.id === id);
  if (idx >= 0) {
    bridge[idx].read = true;
    saveBridge(bridge);
  }
}

export function markAllBridgeRead(role: string) {
  const bridge = loadBridge();
  bridge.forEach(n => {
    if (n.toRole === role) n.read = true;
  });
  saveBridge(bridge);
}

export function clearBridgeNotifications(role: string) {
  const bridge = loadBridge().filter(n => n.toRole !== role);
  saveBridge(bridge);
}
