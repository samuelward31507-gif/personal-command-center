// Cinder app service worker: shows push notifications and opens the app when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
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
