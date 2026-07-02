/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Admin viejo · SW "kill switch"
   (decomiso — el admin viejo se mudó a /clases/admin/)

   Este SW reemplaza a cualquier versión anterior. Cuando una
   instalación vieja que todavía tenga el SW registrado reciba
   esta versión:
     1. install  → skipWaiting() para activar al instante.
     2. activate → borra TODOS los caches, se desregistra a sí
                   mismo (registration.unregister()), toma control
                   de las ventanas y las recarga para que caigan
                   en el shim admin/index.html, que a su vez
                   redirige al panel nuevo.
   Resultado: la PWA vieja suelta el SW y sus caches sin acción
   manual del usuario. No hay handler de fetch: no interceptamos
   ni cacheamos nada.
   ═══════════════════════════════════════════ */

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
        // 1. Borrar todos los caches.
        try {
            const claves = await caches.keys();
            await Promise.all(claves.map(function (k) { return caches.delete(k); }));
        } catch (_e) {}

        // 2. Desregistrarse a sí mismo.
        try { await self.registration.unregister(); } catch (_e) {}

        // 3. Tomar control y recargar cada ventana → cae en el shim.
        try { await self.clients.claim(); } catch (_e) {}
        try {
            const ventanas = await self.clients.matchAll({ type: 'window' });
            ventanas.forEach(function (client) {
                try { client.navigate(client.url); } catch (_e) {}
            });
        } catch (_e) {}
    })());
});
