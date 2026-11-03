// Bump CACHE_VERSION to invalidate every cache created by an older worker. Also bump it whenever offline.html,
// manifest.webmanifest or the precached icons change: they are served from the cache, so an old copy sticks
// until the version changes (hashed /assets/* files get new names and need no bump).
const CACHE_VERSION = "v3";
const CACHE_NAME = `ramadan-planner-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
// Only static, user-independent files are ever stored: the offline page, icons and hashed build assets.
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ramadan-planner-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Never store anything that may be per-user or not ours.
function isCacheable(request, response) {
  if (request.method !== "GET") return false;
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return false;
  const cc = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !/no-store|private/.test(cc);
}

// Re-cache the offline page when it is missing (e.g. the precache failed on install). Online only; errors ignored.
function ensureOfflinePage() {
  return caches
    .open(CACHE_NAME)
    .then((cache) =>
      cache.match(OFFLINE_URL).then((hit) => {
        if (hit) return;
        return fetch(OFFLINE_URL).then((response) => {
          if (isCacheable(new Request(OFFLINE_URL), response)) return cache.put(OFFLINE_URL, response);
        });
      }),
    )
    .catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: network first; when offline show the cached offline page. Page HTML itself is never cached.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    // The install step tolerates a failed precache, so the offline page may be missing: fetch it lazily.
    event.waitUntil(ensureOfflinePage());
    return;
  }

  // Hashed build assets are immutable: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            // An HTML body under /assets/ is a fallback or error page, never a build asset: do not pin it.
            const type = (response.headers.get("Content-Type") || "").toLowerCase();
            if (isCacheable(request, response) && !type.includes("text/html")) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Ramadan Planner",
    body: "You have a new reminder.",
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Ignore invalid push payloads
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});
