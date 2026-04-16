/**
 * Offline-first mutation queue.
 *
 * When a POST/PUT/DELETE request is made:
 *  1. Try the network normally.
 *  2. If offline (or network fails), queue the mutation in IndexedDB via the service worker.
 *  3. The service worker replays it when connectivity returns.
 *
 * Also exports `registerServiceWorker()` — call once from App.tsx.
 */

const DB_NAME = "emerald-offline-queue";
const DB_STORE = "mutations";

// ── Service Worker Registration ────────────────────────────────────────
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  // In sandboxed iframe environments (e.g. Figma preview) the SW script is
  // served as text/html (404 page) which causes a SecurityError. Detect this
  // early by checking the MIME type and skip registration gracefully.
  try {
    const probe = await fetch("/sw.js", { method: "HEAD" });
    const mime = probe.headers.get("content-type") || "";
    if (!mime.includes("javascript") && !mime.includes("application/")) {
      console.info("[SW] Skipping registration — script not served as JS in this environment.");
      return;
    }
  } catch {
    // Network unavailable, skip
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[SW] Registered:", registration.scope);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          // New version available — auto-activate
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  } catch (err: any) {
    // Suppress SecurityError (unsupported MIME / sandboxed origin) silently;
    // warn on any other unexpected failure.
    if (err?.name !== "SecurityError") {
      console.warn("[SW] Registration failed:", err);
    }
  }
}

// ── IndexedDB queue helpers (used when SW messaging fails) ────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e: any) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueInDB(mutation: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.add({ ...mutation, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Queue a mutation in the service worker (or IndexedDB directly).
 * Called when the network is unavailable.
 */
async function queueMutation(mutation: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}): Promise<void> {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "QUEUE_MUTATION",
      ...mutation,
    });
  } else {
    // SW not active yet — queue directly in IndexedDB
    await queueInDB(mutation);
  }
  // Also trigger background sync if available
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as any).sync?.register?.("crm-sync");
  } catch { /* background sync not supported */ }
}

/**
 * Offline-aware fetch wrapper for CRM API mutations.
 * Use this anywhere you do POST/PUT/DELETE to the server.
 *
 * Returns the Response on success, or null when queued offline.
 */
export async function offlineFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response | null> {
  if (navigator.onLine) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      // Network error despite navigator.onLine — queue anyway
      console.warn("[offline] Fetch failed despite online status, queuing:", url);
    }
  }

  // Offline — queue mutation for background sync
  const headers: Record<string, string> = {};
  if (options.headers) {
    new Headers(options.headers as HeadersInit).forEach((v, k) => { headers[k] = v; });
  }
  await queueMutation({
    url,
    method: (options.method || "POST").toUpperCase(),
    headers,
    body: typeof options.body === "string" ? options.body : "",
  });

  return null; // indicates "queued, not yet sent"
}

/**
 * Get the count of pending offline mutations.
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}