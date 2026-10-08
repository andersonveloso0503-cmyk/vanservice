// Mantém o app abrindo mesmo com internet ruim. Sempre tenta a versão mais nova primeiro.
const CACHE = 'van-service-202610081507';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Notificação no celular: chega do Supabase (função "avisar") mesmo com o app fechado.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { texto: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Van Service', {
    body: d.texto || 'Você tem um aviso novo no app.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: 'van-service-' + Date.now(), data: { url: './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const aberto = cs.find((c) => c.url.startsWith(self.registration.scope));
    return aberto ? aberto.focus() : self.clients.openWindow('./');
  }));
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
