/* Hospitalist Toolkit - service worker for POCKET MODE only (iPhone home-screen app; see pocket.js).
   Keeps a copy of the toolkit pages so the app opens with no signal. It only acts for pocket-mode pages (address contains pocket=1,
   or a page loaded inside one); every other request, including the normal Cerner launch, goes straight to the network untouched.
   Online: always fetches the newest copy first, then saves it. Offline: uses the saved copy. No patient data is ever saved. */
importScripts("pocket-files.js"); // self.POCKET_FILES and self.POCKET_VERSION, written by: node pocket-build.js
const CACHE = "toolkit-pocket-" + self.POCKET_VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    // one file at a time, so one missing file doesn't stop the rest from being saved
    for (const f of self.POCKET_FILES) { try { const r = await fetch(f, { cache: "reload", mode: /^https:/.test(f) ? "cors" : "same-origin" }); if (r.ok) await c.put(f, r); } catch (err) {} }
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("toolkit-pocket-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isPocketUrl = (u) => /[?&]pocket=1(&|$)/.test(u || "");
async function fromPocket(e) {
  if (isPocketUrl(e.request.url)) return true;                      // the pocket page or a pocket tab itself
  if (!e.clientId) return false;
  const c = await self.clients.get(e.clientId);
  return !!(c && isPocketUrl(c.url));                                // a script, style or file loaded by a pocket page
}
// only cache our own files and the three CDN libraries the tabs load
const CACHEABLE = (u) => u.origin === self.location.origin || /^https:\/\/cdn\.jsdelivr\.net\/npm\/(fhirclient|pdfjs-dist|pdf-lib)/.test(u.href);

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (!CACHEABLE(url)) return;
  e.respondWith((async () => {
    if (!(await fromPocket(e))) return fetch(e.request);             // normal (Cerner) use: untouched
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(e.request.mode === "navigate" ? e.request.url : e.request, { cache: "no-cache" });         // check GitHub for a newer copy every time (no 10-min browser cache)
      if (r && r.ok) cache.put(e.request, r.clone()).catch(() => {});
      return r;
    } catch (err) {                                                  // offline: saved copy (ignore ?v=… cache-busting)
      const hit = (await cache.match(e.request)) || (await cache.match(e.request, { ignoreSearch: true }));
      if (hit) return hit;
      if (e.request.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
      throw err;
    }
  })());
});
