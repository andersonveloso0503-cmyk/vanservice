// Mantém o app abrindo mesmo com internet ruim. Sempre tenta a versão mais nova primeiro.
const CACHE = 'van-service-202610081434';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // dados e arquivos do banco nunca ficam guardados aqui
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => { // confere com o servidor se há versão nova antes de usar a guardada
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
  );
});
