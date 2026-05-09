// ══════════════════════════════════════
// SERVICE WORKER — Quiniela Mundialista 2026
// Estrategia: Network First (siempre datos frescos de Firebase)
// Solo cachea assets estáticos (HTML, CSS, JS, imágenes)
// ══════════════════════════════════════

const CACHE_NAME = 'quiniela-2026-v6';

const ASSETS_TO_CACHE = [
  './jugador.html',
  './predicciones.html',
  './admin.html',
  './panel.html',
  './404.html',
  './css/jugador.css',
  './css/predicciones.css',
  './css/admin.css',
  './css/panel.css',
  './js/partidos.js',
  './js/jugador.js',
  './js/predicciones.js',
  './js/admin.js',
  './js/panel.js',
  './js/firebase/config.js',
  './js/utils/helpers.js',
  './js/utils/animations.js',
  './js/utils/toasts.js',
  './img/logo.png',
  './img/cancha.png',
  './manifest.json'
];

// ── INSTALL: cachear assets estáticos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: Network First para todo ──
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No interceptar peticiones a Firebase ni CDNs externos
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('flagcdn.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia fresca en cache
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        // Sin red: servir desde cache
        caches.match(event.request).then(cached =>
          cached || caches.match('./jugador.html')
        )
      )
  );
});
