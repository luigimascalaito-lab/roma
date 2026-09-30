// Service worker: guscio dell'app offline + audioguide scaricate a richiesta.
const SHELL = 'romagnole-shell-v7';
const FONTS = 'romagnole-fonts-v1';
const AUDIO = 'romagnole-audio-v1';
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './foto/p1.jpg', './foto/p2.jpg', './foto/p3.jpg', './foto/p4.jpg', './foto/p5.jpg', './foto/p6.jpg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './biglietti/mara-1.jpg',
  './biglietti/mara-2.jpg',
  './biglietti/flavia-1.jpg',
  './biglietti/flavia-2.jpg',
  './biglietti/flavia-3.jpg',
  './biglietti/francesca-1.jpg',
  './biglietti/cinzia-1.jpg',
  './biglietti/lidiana-1.jpg',
  './biglietti/roberta-1.jpg',
  './biglietti/roberta-3.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, FONTS, AUDIO].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Risponde a una richiesta Range partendo da un file completo in cache (serve a <audio> per il seek).
async function rangeFromCache(request, cached) {
  const header = request.headers.get('range');
  if (!header) return cached;
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(header);
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`
    }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.includes('/audio/')) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const hit = await cache.match(url.pathname, { ignoreSearch: true });
      if (hit) return rangeFromCache(req, hit);
      return fetch(req);
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then((r) => { cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }

  if (url.origin === location.origin) {
    // Rete prima, così gli aggiornamenti arrivano subito; cache se si è offline.
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const r = await fetch(req);
        if (r.ok) cache.put(req, r.clone());
        return r;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
      }
    })());
  }
});
