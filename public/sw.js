/**
 * Emerald Visa CRM — Service Worker
 * Strategy:
 *  - NEVER cache index.html (always fetch fresh — avoids stale builds)
 *  - Cache-first for hashed static assets (JS/CSS with content-hash)
 *  - Network-first with IndexedDB queue for API mutations (POST/PUT/DELETE)
 *  - Background sync to replay queued mutations when network returns
 */

const CACHE_NAME = "emerald-crm-v4";
const STATIC_URLS = ["/"];

// Helpers to identify asset types
const isIndexHtml = (url) => url.pathname === "/" || url.pathname === "/index.html";
const isHashedAsset = (url) => /\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?)$/.test(url.pathname);
const isStaticAsset = (url) => url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ico)$/);

// ── Install: pre-cache shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean ALL old caches (including same-name stale entries) ─
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: NEVER cache index.html, cache hashed assets ────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET mutations — they are handled by the offline queue
  if (request.method !== "GET") return;

  // Don't intercept cross-origin API calls (Supabase edge functions)
  if (url.hostname.includes("supabase.co")) return;

  // 1) index.html — ALWAYS network-first, never cache
  if (isIndexHtml(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          return caches.match("/index.html").then((cached) => {
            if (cached) return cached;
            return new Response("Offline", { status: 503 });
          });
        })
    );
    return;
  }

  // 2) Hashed assets (JS/CSS) — cache-first, cache on miss
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3) Other static assets — stale-while-revalidate (serve cached, refresh in background)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // 4) Everything else (API, etc.) — pass through
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
