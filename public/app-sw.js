// Cinder app service worker: push notifications, and the app opening without signal (a crew in a basement).
// The page, its scripts and the last data it loaded are kept on this device; nothing is ever sent from here.
// Writes made offline are queued by the page itself (lib in page.tsx) and sent when the connection comes back.
const SHELL = "cinder-shell-v1", DATA = "cinder-data-v1", STATIC = "cinder-static-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("cinder-") && ![SHELL, DATA, STATIC].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("message", e => { if (e.data === "cinder-clear") e.waitUntil(Promise.all([caches.delete(DATA), caches.delete(SHELL)])); });

// Every deploy brings new file names; keep the newest 300 so the cache doesn't grow forever.
const trim = async (c, max) => { const keys = await c.keys(); for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k); };
const fresh = async (req, cacheName) => {
  try {
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(cacheName); await c.put(req, res.clone()); }
    return res;
  } catch {
    const hit = await caches.match(req, { cacheName });
    if (hit) return hit;
    throw new Error("offline");
  }
};
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The page: newest when online, the last copy when not.
  if (req.mode === "navigate" && url.pathname.startsWith("/app")) {
    event.respondWith(fresh(req, SHELL).catch(async () => (await caches.match("/app", { cacheName: SHELL })) || new Response("You're offline, and this page hasn't been opened here before.", { status: 503, headers: { "Content-Type": "text/plain" } })));
    return;
  }
  // Built scripts and styles never change under the same name.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req, { cacheName: STATIC }).then(hit => hit || fetch(req).then(async res => {
      if (res.ok) { const c = await caches.open(STATIC); await c.put(req, res.clone()); trim(c, 300); }
      return res;
    })));
    return;
  }
  // The app's data and job photos: newest when online, the last copy when not.
  if (url.pathname === "/api/app/data" || url.pathname === "/api/app/media") {
    event.respondWith(fresh(req, DATA).catch(() => new Response(JSON.stringify({ error: "You're offline. Showing what was saved on this phone.", offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })));
  }
});
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Cinder", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Cinder", {
    body: d.body || "", icon: "/app-icon-192.png", badge: "/app-icon-192.png", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "/app" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).pathname.startsWith("/app")) { await c.focus(); c.navigate(url).catch(() => {}); return; }
    await self.clients.openWindow(url);
  })());
});
