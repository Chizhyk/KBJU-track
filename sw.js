// KBJU Track v9 — офлайн-режим: оболочка приложения кэшируется, запросы к ИИ и базам идут напрямую в сеть
const CACHE = 'kbju-v9';
const SHELL = ['./', 'index.html', 'css/styles.css?v=9', 'js/app.js?v=9'];
const NETWORK_ONLY = ['generativelanguage.googleapis.com', 'openfoodfacts.org', 'supabase.co'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NETWORK_ONLY.some(h => url.hostname.endsWith(h))) return;
  if (url.origin === location.origin) {
    // свои файлы: сначала кэш, в фоне обновляем (при следующем запуске будет свежая версия)
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(req, { ignoreSearch: false });
      const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (cached) { net.catch(() => {}); return cached; }
      const r = await net;
      if (r) return r;
      if (req.mode === 'navigate') return (await c.match('index.html')) || (await c.match('./')) || Response.error();
      return Response.error();
    }));
    return;
  }
  // библиотеки с CDN: кэш в приоритете
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(req);
    if (cached) return cached;
    try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }
    catch (err) { return Response.error(); }
  }));
});
