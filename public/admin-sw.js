/*
 * Service worker for the team's admin site ("CRPT Admin" on the home screen), scope /admin.
 * Its only job is team alerts (src/lib/teamAlerts.ts): show each push as a notification and,
 * on tap, open the admin page it points to. It does not cache pages or work offline.
 * Plain JavaScript on purpose: no build step, no library.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "CRPT Admin";
  const url = typeof data.url === "string" && data.url.startsWith("/admin") ? data.url : "/admin";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: "/admin-app/icon-192.png",
      badge: "/admin-app/icon-192.png",
      data: { url },
      lang: "es",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of open) {
        if (new URL(c.url).pathname.startsWith("/admin") && "focus" in c) {
          await c.focus();
          if ("navigate" in c) return c.navigate(target);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
