/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Admin viejo · SW auto-desregistrador
   (cutover Bloque 6 — el admin viejo se mudó a /clases/admin/)

   Este SW reemplaza al pass-through anterior. Cuando un cliente
   con la PWA vieja recibe esta versión:
     1. install  → skipWaiting() para activar al instante.
     2. activate → unregister() borra el registro del SW,
                   claim() toma control de las ventanas,
                   matchAll() + navigate() refresca cada pestaña,
                   que ya carga el shim hola/admin/index.html y
                   de ahí redirige a /clases/admin/.
   Resultado: la PWA vieja queda inactiva y el usuario aterriza
   en el admin nuevo sin acción manual.
   ═══════════════════════════════════════════ */

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try { await self.registration.unregister(); } catch (_e) {}
        try { await self.clients.claim(); } catch (_e) {}
        try {
            const ventanas = await self.clients.matchAll({ type: 'window' });
            ventanas.forEach((client) => {
                try { client.navigate(client.url); } catch (_e) {}
            });
        } catch (_e) {}
    })());
});

// Fetch pass-through — no cacheamos ni interferimos.
self.addEventListener('fetch', () => { return; });
