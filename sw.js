// Keeps the catalog page available offline. The price list itself is saved by the page (localStorage).
const CACHE = "jl-app-v1";
const APP = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin) {
    // Network first so updates show right away; cache when offline.
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  } else if (url.hostname === "drive.google.com" || url.hostname.endsWith("googleusercontent.com") && e.request.destination === "image") {
    // Photos: cache after first view so they also show offline.
    e.respondWith(caches.open("jl-fotos-v1").then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }))));
  }
});
