/**
 * Nuclear Panic Mode — Cross-Device Stealth Kill Switch
 * 
 * ARCHITECTURE:
 * - BroadcastChannel: Instant kill across ALL tabs on SAME device (< 100ms)
 * - Server Polling: Cross-device kill via Supabase KV (< 3 seconds)
 * - Safe Routes: Login pages can clear panic WITHOUT being killed themselves
 * 
 * WORKFLOW:
 * 1. Admin triggers panic → Server flag set + BroadcastChannel message sent
 * 2. All devices poll server every 3s, detect flag, self-destruct
 * 3. Same-device tabs get instant BroadcastChannel kill
 * 4. User opens login page → Login page clears server flag BEFORE listener activates
 * 5. Other pages initialize panic listener and will self-destruct if flag is active
 * 
 * DEADLOCK PREVENTION:
 * - Login routes (/admin/login, /agent/login, /customer/login) are SAFE ROUTES
 * - Safe routes clear the server panic flag on mount
 * - RootLayout checks current route and ONLY activates panic on protected routes
 * - This ensures user can always access login to disable panic
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';

const PANIC_CHANNEL = "emerald-crm-panic-channel";
const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5cdc87b7`;

// Track consecutive poll failures to avoid console spam
let consecutivePollFailures = 0;
const MAX_SILENT_FAILURES = 10; // Only log after this many consecutive failures

// SAFE ROUTES - Panic listener will NOT activate on these pages
export const SAFE_ROUTES = [
  '/admin/login',
  '/agent/login',
  '/customer/login',
  '/' // Landing page
];

// ONLY session/auth keys — wipe these to force re-login
// CRM data (cases, profiles, agent codes, etc.) is PRESERVED
const AUTH_KEYS_TO_WIPE = [
  "emerald-admin-auth",
  "emerald-agent-session",
  "emerald-customer-session",
  "crm_customer_session",
  "customer_session",
];

interface PanicPayload {
  url: string;
  title: string;
  timestamp: number;
}

const decoyPages = [
  { url: "https://www.google.com/search?q=weather+today", title: "weather today - Google Search" },
  { url: "https://www.google.com/search?q=best+restaurants+near+me", title: "best restaurants near me - Google Search" },
  { url: "https://mail.google.com", title: "Gmail" },
  { url: "https://www.google.com/maps", title: "Google Maps" },
  { url: "https://news.google.com", title: "Google News" },
  { url: "https://www.google.com/search?q=how+to+make+coffee", title: "how to make coffee - Google Search" },
  { url: "https://calendar.google.com", title: "Google Calendar" },
  { url: "https://www.google.com/search?q=stock+market+today", title: "stock market today - Google Search" },
  { url: "https://drive.google.com", title: "Google Drive" },
  { url: "https://www.google.com/search?q=latest+news", title: "latest news - Google Search" },
  { url: "https://www.youtube.com", title: "YouTube" },
  { url: "https://www.google.com/search?q=currency+exchange+rates", title: "currency exchange rates - Google Search" },
];

function getRandomDecoy(): { url: string; title: string } {
  return decoyPages[Math.floor(Math.random() * decoyPages.length)];
}

/**
 * Wipe auth sessions, replace history, close/redirect — but PRESERVE CRM data
 */
function selfDestruct(decoy: { url: string; title: string }) {
  // 1. Only wipe auth/session keys — CRM data (cases, profiles, etc.) stays
  try {
    AUTH_KEYS_TO_WIPE.forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    // Also remove the panic flag itself
    try { localStorage.removeItem("__crm_panic__"); } catch (_) {}
  } catch (_) {}

  // 2. Clear sessionStorage completely (session-only, no persistent data lost)
  try { sessionStorage.clear(); } catch (_) {}

  // 3. Clear cookies
  try {
    document.cookie.split(";").forEach(cookie => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (_) {}

  // 4. Replace current history state with decoy
  try {
    window.history.replaceState(null, decoy.title, decoy.url);
  } catch (_) {}

  // 5. Overwrite page title
  document.title = decoy.title;

  // 6. Blank out the page immediately (visual kill)
  try {
    document.body.innerHTML = "";
    document.body.style.background = "#fff";
  } catch (_) {}

  // 7. Try to close the tab
  try { window.close(); } catch (_) {}

  // 8. Fallback — redirect (replaces history entry so no back button)
  setTimeout(() => {
    window.location.replace(decoy.url);
  }, 200);
}

/**
 * TRIGGER PANIC — Call this from the admin panic button.
 * Sets server flag (all devices detect within 3s) + BroadcastChannel (instant same-device kill)
 */
export async function triggerPanic() {
  const decoy = getRandomDecoy();
  const payload: PanicPayload = {
    url: decoy.url,
    title: decoy.title,
    timestamp: Date.now(),
  };

  // 1. Set server flag for cross-device detection
  try {
    await fetch(`${SERVER_URL}/api/panic/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    console.log('🚨 Server panic flag set');
  } catch (err) {
    console.error('Failed to set server panic flag:', err);
  }

  // 2. Broadcast to all tabs on THIS device (instant kill)
  try {
    const channel = new BroadcastChannel(PANIC_CHANNEL);
    channel.postMessage(payload);
    // Close channel after a brief delay to ensure delivery
    setTimeout(() => channel.close(), 100);
  } catch (_) {
    // BroadcastChannel not supported — fallback: set a localStorage flag
    // Other tabs watching storage events will pick it up
    try {
      localStorage.setItem("__crm_panic__", JSON.stringify(payload));
    } catch (_) {}
  }

  // 3. Self-destruct THIS tab
  selfDestruct(decoy);
}

/**
 * CHECK if we're on a safe route (login pages)
 */
function isSafeRoute(): boolean {
  return SAFE_ROUTES.some(route => window.location.pathname === route);
}

/**
 * CLEAR server panic flag — ONLY call this from safe routes (login pages)
 */
export async function clearServerPanic() {
  try {
    await fetch(`${SERVER_URL}/api/panic/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    console.log('✅ Server panic flag cleared');
  } catch (err) {
    console.error('Failed to clear server panic flag:', err);
  }
}

/**
 * CHECK server panic status
 */
async function checkServerPanic(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/panic/status`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    const data = await response.json();
    // Reset failure counter on successful poll
    if (consecutivePollFailures > 0) consecutivePollFailures = 0;
    return data.active === true;
  } catch (err) {
    consecutivePollFailures++;
    // Only log after MAX_SILENT_FAILURES consecutive failures to avoid console spam
    if (consecutivePollFailures === MAX_SILENT_FAILURES) {
      console.warn('⚠️ Panic mode server polling unavailable — falling back to local-only detection');
    }
    return false;
  }
}

/**
 * LISTEN FOR PANIC — Call this on app startup ONLY on protected routes.
 * Safe routes (login pages) should NOT call this.
 * Returns a cleanup function to remove the listener.
 */
export function listenForPanic(): () => void {
  const cleanups: (() => void)[] = [];

  // Method 1: BroadcastChannel listener (instant same-device kill)
  try {
    const channel = new BroadcastChannel(PANIC_CHANNEL);
    const handler = (event: MessageEvent<PanicPayload>) => {
      const { url, title } = event.data;
      selfDestruct({ url, title });
    };
    channel.addEventListener("message", handler);
    cleanups.push(() => {
      channel.removeEventListener("message", handler);
      channel.close();
    });
  } catch (_) {}

  // Method 2: localStorage event fallback (for browsers without BroadcastChannel)
  const storageHandler = (event: StorageEvent) => {
    if (event.key === "__crm_panic__" && event.newValue) {
      try {
        const payload: PanicPayload = JSON.parse(event.newValue);
        selfDestruct({ url: payload.url, title: payload.title });
      } catch (_) {
        selfDestruct(getRandomDecoy());
      }
    }
  };
  window.addEventListener("storage", storageHandler);
  cleanups.push(() => window.removeEventListener("storage", storageHandler));

  // Method 3: Server polling (cross-device detection, every 3 seconds)
  // Delay the first poll by 5s to allow server cold-start
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const startPolling = () => {
    pollInterval = setInterval(async () => {
      const isPanicActive = await checkServerPanic();
      if (isPanicActive) {
        selfDestruct(getRandomDecoy());
      }
    }, 3000);
  };
  const initialDelay = setTimeout(startPolling, 5000);

  cleanups.push(() => {
    clearTimeout(initialDelay);
    if (pollInterval) clearInterval(pollInterval);
  });

  // Check if panic was already triggered (e.g., tab opened after panic)
  // Only check localStorage, NOT server (to avoid delay on startup)
  try {
    const existing = localStorage.getItem("__crm_panic__");
    if (existing) {
      const payload: PanicPayload = JSON.parse(existing);
      // If panic was triggered within the last 5 seconds, self-destruct
      if (Date.now() - payload.timestamp < 5000) {
        selfDestruct({ url: payload.url, title: payload.title });
      } else {
        localStorage.removeItem("__crm_panic__");
      }
    }
  } catch (_) {}

  return () => cleanups.forEach(fn => fn());
}