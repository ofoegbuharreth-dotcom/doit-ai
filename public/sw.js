const CACHE = 'doit-shell-v6';
const SHELL = ['/', '/download', '/manifest.json', '/doit-logo.png', '/doit-logo-192.png', '/doit-logo-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate';
  const asset = ['script', 'style', 'font', 'image'].includes(event.request.destination);
  if (asset) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    const requestedScript = event.request.destination === 'script';
    const returnedHtml = (response.headers.get('content-type') || '').includes('text/html');
    if (!(requestedScript && returnedHtml)) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (navigation) return caches.match('/');
    return Response.error();
  }));
});
