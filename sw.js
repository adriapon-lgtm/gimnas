// Puja VERSION cada vegada que canviïs qualsevol fitxer de l'app,
// perquè el mòbil descarregui la versió nova.
const VERSION = 'v10';
const CACHE = `gimnas-${VERSION}`;

const PHOTOS = [
  'lat', 'lowrow', 'chestpress', 'pectoral', 'shoulder', 'delts', 'armcurl', 'armext',
  'legpress', 'legcurl', 'legext', 'abdadd', 'prone', 'multihip', 'hipthrust',
  'seatedcalf', 'psrow', 'incline', 'chin', 'lowerback',
];

const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'plan.js',
  'muscles.js',
  'anim.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  ...PHOTOS.map((p) => `img/${p}.jpg`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gimnas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primer la memòria cau: l'app funciona igual amb connexió o sense.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
