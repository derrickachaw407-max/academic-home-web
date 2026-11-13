/* Academic-Home service worker — the app opens from the phone, at once, every time (3.11).

   - The app itself (the page, its script and styles, the font) is saved when a version installs, and opens
     straight from the phone, without waiting for the network: on slow mobile data and with no signal alike.
     The browser looks for a new version in the background (sw.js); a new one is saved whole, then the app
     offers Refresh.
   - Files named after their contents (app-…, p-…, fonts/…, img/…, lk-…, pl-…) never change, so a saved copy is used
     as it is. The parts of the app that load only when they're needed (Slide Studio, the PDF editor…) are
     saved the first time they're used, and kept across versions while they don't change: an update
     downloads only the parts that changed.
   - Any other file of this site: the network first, the saved copy when the network is slow or fails.
   - Requests to the Academic-Home server and to any other site are never touched or saved.
   - Off switch: publishing a sw.js whose KILL is true removes the saved copies and unregisters itself on
     every phone at its next update.
   SHELL, FILES and VERSION are written by the build (patches/split311.py). */
const VERSION = 'ah-shell-5.7-88b4897583';
const KILL = false;
const NET_TIMEOUT_MS = 4000;
const SHELL = ["/", "/manifest.webmanifest", "/app-5.7.61c4638277.js", "/app-5.7.ec903f68bf.css", "/fonts/manrope-latin.b42951014c.woff2"];
const FILES = ["/app-5.7.61c4638277.js", "/app-5.7.ec903f68bf.css", "/fonts/caslon-OFL.txt", "/fonts/caslon-latin-400.ce4653dcbd.woff2", "/fonts/caslon-latin-400i.f9fcb1b0fc.woff2", "/fonts/caslon-latin-700.3ddbe22355.woff2", "/fonts/caslon-latin-ext-400.5fcdbec1db.woff2", "/fonts/caslon-latin-ext-400i.5c60312117.woff2", "/fonts/caslon-latin-ext-700.1ab04b3e09.woff2", "/fonts/manrope-cyrillic-ext.5d8e0798a8.woff2", "/fonts/manrope-cyrillic.d8fc94bf7a.woff2", "/fonts/manrope-greek.1cb6f3caae.woff2", "/fonts/manrope-latin-ext.1f62546fa0.woff2", "/fonts/manrope-latin.b42951014c.woff2", "/fonts/manrope-vietnamese.89cd8db6d2.woff2", "/fonts/sig-caveat.95b77c08e6.woff2", "/fonts/sig-dancing-script.b3c76332c9.woff2", "/fonts/sig-great-vibes.710b16b18f.woff2", "/fonts/signature-fonts-OFL.txt", "/img/favicon.3ea1fad4be.png", "/img/favicon.69f77abd72.svg", "/img/feather.6fd7e606dc.png", "/img/tpl-academic.a4bfd916d5.webp", "/img/tpl-bold.1b4aee708e.webp", "/img/tpl-classic.63046e4253.webp", "/img/tpl-minimal.8226d449a5.webp", "/img/tpl-plain.6b155fee85.webp", "/img/word-academic.7f84efba71.webp", "/img/word-clean.0cbf340044.webp", "/img/word-compact.10c67b82fa.webp", "/img/word-report.4709cdf611.webp", "/lk-2.22.4.js", "/lk-e2ee-2.22.4.js", "/p-legal.8da565d483.css", "/p-legal.e8786b6bc7.js", "/p-listen.008f0a11f0.js", "/p-listen.b16509a95b.css", "/p-meet.1e6d633d31.css", "/p-meet.606f393eac.js", "/p-pdf.5e94ca92d1.css", "/p-pdf.68b41544eb.js", "/p-scan.59061ea10e.js", "/p-scan.cd6c7c82dd.css", "/p-slides.7aa0831d30.css", "/p-slides.87f58f13e9.js", "/p-studio.09015ada55.css", "/p-studio.92719b6192.js", "/p-study.b374e602b1.js", "/p-study.fe7ef131e7.css", "/p-word.3eca3e1d44.js", "/p-word.8a2895648b.css", "/pl-1.17.1.js"];
const KEPT = 'ah-files';
const NAMED = /(\.[0-9a-f]{10}\.(js|css|woff2|webp|png|jpg|svg)|\/(lk|pl)-[a-z0-9.-]+\.js)$/;

function isApp(url, req) {
  return req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
}

self.addEventListener('install', (event) => {
  if (KILL) { event.waitUntil(self.skipWaiting()); return; }
  event.waitUntil((async () => {
    const page = await caches.open(VERSION), kept = await caches.open(KEPT);
    // a file already saved under the same name is the same file: only what's new is downloaded
    const named = SHELL.filter((u) => NAMED.test(u)), others = SHELL.filter((u) => !NAMED.test(u));
    const missing = [];
    for (const u of named) if (!(await kept.match(u))) missing.push(u);
    // the page fresh from the server (a copy the browser kept might be the version before)
    await Promise.all([kept.addAll(missing), page.addAll(others.map((u) => new Request(u, { cache: 'no-cache' })))]);
    await self.skipWaiting();
  })());           // any failure fails the install: the version already here keeps working, and the browser tries again later
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => KILL || (n !== VERSION && n !== KEPT)).map((n) => caches.delete(n)));
    if (KILL) {
      await self.registration.unregister();
      return;
    }
    // the parts of earlier versions that this one doesn't use any more
    const kept = await caches.open(KEPT), keep = new Set(FILES);
    for (const req of await kept.keys()) {
      const p = new URL(req.url).pathname;
      if (!keep.has(p)) await kept.delete(req);
    }
    await self.clients.claim();
  })());
});

function saveCopy(cacheName, key, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(key, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (KILL || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // the Academic-Home server and other sites: untouched
  if (url.pathname === '/sw.js') return;

  // The app: from the phone, at once. (Each version's page is saved when it installs, with its own script and
  // styles, so they always match.)
  if (isApp(url, req)) {
    event.respondWith((async () => {
      const saved = await (await caches.open(VERSION)).match('/');
      return saved || fetch(req).then((res) => saveCopy(VERSION, '/', res));
    })());
    return;
  }
  // Files named after their contents: the saved copy, or download and save it.
  if (NAMED.test(url.pathname)) {
    event.respondWith((async () => {
      const kept = await caches.open(KEPT);
      const saved = await kept.match(url.pathname);
      if (saved) return saved;
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') await kept.put(url.pathname, res.clone()).catch(() => {});
      return res;
    })());
    return;
  }
  // Anything else of this site (the policy pages, icons…): network first, the saved copy if it's slow or fails.
  event.respondWith((async () => {
    const fromNetwork = fetch(req).then((res) => saveCopy(VERSION, req, res));
    const cached = await caches.match(req, { cacheName: VERSION });
    if (!cached) return fromNetwork;
    const timer = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT_MS));
    const winner = await Promise.race([fromNetwork.then((r) => (r && r.ok ? r : null)).catch(() => null), timer]);
    if (winner) return winner;
    event.waitUntil(fromNetwork.catch(() => {}));
    return cached;
  })());
});

// The app asks which of its parts are saved here (Data saver shows it), and can save them all for later.
self.addEventListener('message', (event) => {
  const d = event.data || {};
  // which version this is: a page that's already this version needs no "new version" bar when this worker takes over
  if (d.type === 'version') {
    const to = (event.ports && event.ports[0]) || event.source;
    if (to) to.postMessage({ type: 'version', version: VERSION });
    return;
  }
  if (d.type === 'parts') {
    event.waitUntil((async () => {
      const kept = await caches.open(KEPT);
      const have = new Set((await kept.keys()).map((r) => new URL(r.url).pathname));
      if (d.save) {
        for (const p of d.save) {
          if (!have.has(p)) { try { await kept.add(p); have.add(p); } catch (e) { break; } }
        }
      }
      if (event.source) event.source.postMessage({ type: 'parts', have: [...have] });
    })());
  }
});

// Tapping an alert ("Your file is ready", "Round 1 done") brings Academic-Home to the
// front — the open window if there is one, otherwise a new one — at Your activity.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const go = (event.notification.data && event.notification.data.go) || '';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        if (go === 'activity') w.postMessage({ type: 'open', go: 'activity' });
        return w.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(go === 'activity' ? '/?go=activity' : '/');
  })());
});
