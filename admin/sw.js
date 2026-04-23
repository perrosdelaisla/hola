/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Panel Admin · Service Worker
   
   Service worker mínimo — cumple el requisito de Android/iOS
   para que la app sea instalable como PWA. NO cachea nada
   para que los cambios de código se vean al instante sin
   necesidad de invalidar caché.
   ═══════════════════════════════════════════ */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estrategia: network-only. No cacheamos nada.
self.addEventListener('fetch', (event) => {
  // Dejamos que el navegador haga su petición normal
  return;
});
