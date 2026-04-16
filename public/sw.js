/**
 * Emerald Visa CRM — Service Worker
 * Offline-first strategy:
 *  - Cache-first for static assets (JS/CSS/images)
 *  - Network-first with IndexedDB queue for API mutations (POST/PUT/DELETE)
 *  - Background sync to replay queued mutations when network returns
 */

const CACHE_NAME = "emerald-crm-v3";
const STATIC_URLS = ["/", "/index.html"];

// ── Install: pre-cache shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for assets, pass-through for API ──────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET mutations — they are handled by the offline queue
  if (request.method !== "GET") return;

  // Don't intercept cross-origin API calls (Supabase edge functions)
  if (url.hostname.includes("supabase.co")) return;

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (
          response.ok &&
          url.origin === self.location.origin &&
          !url.pathname.startsWith("/api/")
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
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
