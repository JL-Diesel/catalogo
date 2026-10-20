// Keeps the catalog page available offline. The price list itself is saved by the page (localStorage).
const CACHE = "jl-app-v2";
const FOTOS = "jl-fotos-v2";
const APP = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // Drops older caches, including the v1 photo cache that kept replaced photos forever.
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FOTOS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Photos are stored without the page's refresh parameter (v=…), so each photo keeps one offline copy.
const photoKey = url => { const u = new URL(url); u.searchParams.delete("v"); return u.toString(); };
const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error("timeout")), ms); p.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); no(err); }); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin) {
    // Network first so updates show right away; cache when offline.
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  } else if (e.request.destination === "image" && (url.hostname === "drive.google.com" || url.hostname.endsWith("googleusercontent.com"))) {
    // Photos: network first so a replaced photo shows up; the saved copy is used offline or on a very slow connection.
    const key = photoKey(e.request.url);
    e.respondWith(caches.open(FOTOS).then(c =>
      withTimeout(fetch(e.request), 6000).then(r => {
        if (r.ok || r.type === "opaque") c.put(key, r.clone());
        return r;
      }).catch(() => c.match(key).then(hit => hit || fetch(e.request)))
    ));
  }
});
