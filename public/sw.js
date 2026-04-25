/**
 * Emerald Visa CRM — Service Worker (no asset caching)
 *
 * This SW does NOT cache static assets. It only provides:
 *  - Background sync to replay queued mutations when network returns
 *  - Message handling for the offline mutation queue
 *
 * Caching is intentionally disabled to prevent stale builds.
 */

// ── Fetch: pass everything through (no caching) ───────────────────────
self.addEventListener("fetch", (event) => {
  // We don't intercept any requests — let the browser / server handle everything.
  // This prevents stale cached assets and 404s from cache mismatches.
});

// ── Install / Activate: minimal ───────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up any old caches from previous SW versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Background Sync: replay queued mutations ──────────────────────────
const DB_NAME = "emerald-offline-queue";
const DB_STORE = "mutations";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function getQueuedMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener("sync", (event) => {
  if (event.tag === "crm-sync") {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  let db;
  try {
    db = await openDB();
    const mutations = await getQueuedMutations(db);
    for (const mut of mutations) {
      try {
        const res = await fetch(mut.url, {
          method: mut.method,
          headers: mut.headers,
          body: mut.body,
        });
        if (res.ok) {
          await deleteMutation(db, mut.id);
          console.log(`[SW] Replayed mutation ${mut.id}: ${mut.method} ${mut.url}`);
        }
      } catch (err) {
        console.log(`[SW] Failed to replay mutation ${mut.id}:`, err);
      }
    }
  } catch (err) {
    console.log("[SW] replayQueue error:", err);
  }
}

// ── Message handler: accept mutations from the client ─────────────────
self.addEventListener("message", async (event) => {
  if (event.data?.type === "QUEUE_MUTATION") {
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.add({
        url: event.data.url,
        method: event.data.method,
        headers: event.data.headers,
        body: event.data.body,
        timestamp: Date.now(),
      });
      tx.oncomplete = () => {
        event.source?.postMessage({ type: "MUTATION_QUEUED", url: event.data.url });
      };
    } catch (err) {
      console.log("[SW] Failed to queue mutation:", err);
    }
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
