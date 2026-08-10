/* ==========================================================================
   Squishy Squad - offline service worker

   The whole app is one HTML file, so there is very little to do here: keep a
   copy of it, serve that copy instantly, and quietly refresh it in the
   background whenever there is a connection.

   Strategy is stale-while-revalidate, chosen deliberately:
     - opening the app NEVER waits on the network, so it works on a locked-down
       school wifi, in airplane mode, or with one bar
     - a new version pushed to GitHub is picked up on the next launch after the
       one where she happened to be online

   That one-launch delay is the trade. Network-first would show updates a beat
   sooner but would hang or fail exactly when she has no signal, which is the
   case this file exists for.
   ========================================================================== */
const CACHE = "squishy-squad-v1";
const ASSETS = ["./", "./index.html"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a failed pre-cache must not brick install
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;   // never touch anything off-site

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // keep the background refresh alive even though we answer from cache
    event.waitUntil(fresh);

    if (hit) return hit;

    const res = await fresh;
    if (res) return res;

    return new Response(
      "<!doctype html><meta charset=utf-8><title>Squishy Squad</title>" +
      "<body style='font-family:system-ui;padding:2rem;text-align:center'>" +
      "<h1>Not saved yet</h1><p>Open this once with a connection and it will " +
      "work offline from then on.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  })());
});
