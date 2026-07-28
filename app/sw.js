/* Service worker quran-hifz.
   VERSION et la liste SHELL sont réécrites par tools/release.py.
   - coquille (html/css/js/données/police de texte) : precache versionné ;
   - audio Husary + polices de pages QCF : cache à la demande, immuable ;
   - version.json : réseau d'abord (détection de mise à jour). */
const VERSION = "1.23.0+2026-07-29";
const SHELL_CACHE = "roub-shell-" + VERSION;
const MEDIA_CACHE = "roub-media-v1";

// __SHELL_START__
const SHELL = [
  "./",
  "index.html",
  "roub-themes.css",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "version.json",
  "fonts/UthmanicHafs.woff2",
  "fonts/Charis-Bold.woff2",
  "fonts/Charis-Italic.woff2",
  "fonts/Charis-Regular.woff2",
  "fonts/DigitalKhatt.woff2",
  "fonts/GentiumBook-Bold.woff2",
  "fonts/GentiumBook-Italic.woff2",
  "fonts/GentiumBook-Regular.woff2",
  "fonts/NotoSans-Bold.woff2",
  "fonts/NotoSans-Italic.woff2",
  "fonts/NotoSans-Regular.woff2",
  "fonts/NotoSans-SemiBold.woff2",
  "fonts/QCF_FullSurahHD.woff2",
  "fonts/QCF_SurahHeader.woff2",
  "anki/roub-cartes.apkg",
  "icons/roub-192.png",
  "icons/roub-512.png",
  "icons/roub-marque.svg",
  "icons/roub-touch-180.png",
  "data/glossaire.js",
  "data/khatt.js",
  "data/meta.js",
  "data/noms-sourates.js",
  "data/pages.js",
  "data/pages2.js",
  "data/regles.js",
  "data/sync-config.js",
  "data/tajcur.js",
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
  "data/cartes/j30r8.js",
  "data/tafsirfr/j1r1.js",
  "data/tafsirfr/j1r2.js",
  "data/tafsirfr/j1r3.js",
  "data/tafsirfr/j1r4.js",
  "data/tafsirfr/j1r5.js",
  "data/tafsirfr/j1r6.js",
  "data/tafsirfr/j1r7.js",
  "data/tafsirfr/j1r8.js",
  "data/tafsirfr/j2r1.js",
  "data/tafsirfr/j2r2.js",
  "data/tafsirfr/j2r3.js",
  "data/tafsirfr/j2r4.js",
  "data/tafsirfr/j2r5.js",
  "data/tafsirfr/j2r6.js",
  "data/tafsirfr/j2r7.js",
  "data/tafsirfr/j2r8.js",
  "data/tafsirfr/j30r1.js",
  "data/tafsirfr/j30r2.js",
  "data/tafsirfr/j30r3.js",
  "data/tafsirfr/j30r4.js",
  "data/tafsirfr/j30r5.js",
  "data/tafsirfr/j30r6.js",
  "data/tafsirfr/j30r7.js",
  "data/tafsirfr/j30r8.js",
  "data/segments/husary128.js",
  "data/segments/husary64.js",
  "data/segments/muallim.js",
  "data/segments/mujawwad.js"
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
    await indexAudio;              // index des récitations déjà en cache
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* hôtes des styles de récitation non embarqués : mis en cache au fil de
   l'écoute (ils autorisent CORS, la réponse est donc réutilisable hors-ligne) */
const AUDIO_HOSTS = ["mirrors.quranicaudio.com", "audio-cdn.tarteel.ai"];

/* index des récitations distantes déjà en cache : permet de décider, sans
   attendre, si l'on doit s'interposer (voir le gestionnaire fetch) */
const AUDIO_EN_CACHE = new Set();
const indexAudio = caches.open(MEDIA_CACHE)
  .then(c => c.keys())
  .then(reqs => reqs.forEach(r => AUDIO_EN_CACHE.add(r.url)))
  .catch(() => {});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  if (url.origin !== location.origin) {
    if (!AUDIO_HOSTS.includes(url.hostname)) return;

    /* Lecture par un élément <audio> : on ne s'interpose QUE si le fichier est
       déjà en cache (décision SYNCHRONE, d'où l'index en mémoire). Sinon on ne
       répond pas du tout : le navigateur va chercher le fichier lui-même.
       Raison : une requête média cross-origin passée par le service worker
       revient en réponse « opaque », que Firefox et ses dérivés (LibreWolf)
       refusent de lire, là où Chrome l'accepte. Le préchargement, lui, est une
       requête ordinaire de la page : interceptable et mise en cache. */
    if (e.request.destination === "audio") {
      if (!AUDIO_EN_CACHE.has(url.href)) return;
      e.respondWith(caches.open(MEDIA_CACHE)
        .then(c => c.match(url.href))
        .then(hit => hit || fetch(e.request)));
      return;
    }

    e.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(url.href);
      if (hit) return hit;
      const resp = await fetch(e.request);
      // 206 (lecture partielle) : jamais mis en cache, il serait tronqué
      if (resp.status === 200) {
        await cache.put(url.href, resp.clone());
        AUDIO_EN_CACHE.add(url.href);
      }
      return resp;
    })());
    return;
  }

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
