/* Service worker quran-hifz.
   VERSION et la liste SHELL sont réécrites par tools/release.py.
   - coquille (html/css/js/données/police de texte) : precache versionné ;
   - audio Husary + polices de pages QCF : cache à la demande, immuable ;
   - version.json : réseau d'abord (détection de mise à jour). */
const VERSION = "1.5.2+2026-07-23";
const SHELL_CACHE = "roub-shell-" + VERSION;
const MEDIA_CACHE = "roub-media-v1";

// __SHELL_START__
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "version.json",
  "fonts/UthmanicHafs.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "data/meta.js",
  "data/pages.js",
  "data/pages2.js",
  "data/regles.js",
  "data/sync-config.js",
  "data/quran/j1r1.js",
  "data/quran/j1r2.js",
  "data/quran/j1r3.js",
  "data/quran/j1r4.js",
  "data/quran/j1r5.js",
  "data/quran/j1r6.js",
  "data/quran/j1r7.js",
  "data/quran/j1r8.js",
  "data/quran/j2r1.js",
  "data/quran/j2r2.js",
  "data/quran/j2r3.js",
  "data/quran/j2r4.js",
  "data/quran/j2r5.js",
  "data/quran/j2r6.js",
  "data/quran/j2r7.js",
  "data/quran/j2r8.js",
  "data/quran/j30r1.js",
  "data/quran/j30r2.js",
  "data/quran/j30r3.js",
  "data/quran/j30r4.js",
  "data/quran/j30r5.js",
  "data/quran/j30r6.js",
  "data/quran/j30r7.js",
  "data/quran/j30r8.js",
  "data/notes/j1r1.js",
  "data/notes/j1r2.js",
  "data/notes/j1r3.js",
  "data/notes/j1r4.js",
  "data/notes/j1r5.js",
  "data/notes/j1r6.js",
  "data/notes/j1r7.js",
  "data/notes/j1r8.js",
  "data/notes/j2r1.js",
  "data/notes/j2r2.js",
  "data/notes/j2r3.js",
  "data/notes/j2r4.js",
  "data/notes/j2r5.js",
  "data/notes/j2r6.js",
  "data/notes/j2r7.js",
  "data/notes/j2r8.js",
  "data/notes/j30r1.js",
  "data/notes/j30r2.js",
  "data/notes/j30r3.js",
  "data/notes/j30r4.js",
  "data/notes/j30r5.js",
  "data/notes/j30r6.js",
  "data/notes/j30r7.js",
  "data/notes/j30r8.js",
  "data/cartes/j1r1.js",
  "data/cartes/j1r2.js",
  "data/cartes/j1r3.js",
  "data/cartes/j1r4.js",
  "data/cartes/j1r5.js",
  "data/cartes/j1r6.js",
  "data/cartes/j1r7.js",
  "data/cartes/j1r8.js",
  "data/cartes/j2r1.js",
  "data/cartes/j2r2.js",
  "data/cartes/j2r3.js",
  "data/cartes/j2r4.js",
  "data/cartes/j2r5.js",
  "data/cartes/j2r6.js",
  "data/cartes/j2r7.js",
  "data/cartes/j2r8.js",
  "data/cartes/j30r1.js",
  "data/cartes/j30r2.js",
  "data/cartes/j30r3.js",
  "data/cartes/j30r4.js",
  "data/cartes/j30r5.js",
  "data/cartes/j30r6.js",
  "data/cartes/j30r7.js",
  "data/cartes/j30r8.js"
];
// __SHELL_END__

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith("hifz-") || (k.startsWith("roub-shell-") && k !== SHELL_CACHE)) {
        await caches.delete(k);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;

  // média immuable : cache d'abord, réseau sinon (et mise en cache)
  if (url.pathname.includes("/audio/") || url.pathname.includes("/fonts/qcf")) {
    e.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const resp = await fetch(e.request);
      if (resp.ok) cache.put(e.request, resp.clone());
      return resp;
    })());
    return;
  }

  // version.json : réseau d'abord (fraîcheur), cache en secours
  if (url.pathname.endsWith("version.json")) {
    e.respondWith(
      fetch(e.request).then(r => {
        caches.open(SHELL_CACHE).then(c => c.put(e.request, r.clone()));
        return r.clone();
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // coquille : cache d'abord, réseau sinon ; navigation hors-ligne -> index
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(e.request);
    } catch (err) {
      if (e.request.mode === "navigate") {
        const idx = await caches.match("index.html");
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
