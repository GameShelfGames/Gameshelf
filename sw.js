/* GameShelf service worker — caches only the site shell so the homepage opens offline.
   It never caches games, Supabase requests, or anything cross-origin, and stores no account data.
   Strategy: network first, cache as the offline fallback (so edits show up immediately).
   Bump VERSION to clear old caches after a big change. */
const VERSION = 'gameshelf-shell-v2';
const SHELL = ['./', 'index.html', 'style.css', 'script.js', 'supabase-config.js', 'manifest.json',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png'];
const SHELL_PATHS = new Set(SHELL.map(p => new URL(p, self.registration.scope).pathname));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !SHELL_PATHS.has(url.pathname)) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
