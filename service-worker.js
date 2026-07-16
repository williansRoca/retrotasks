/* ============================================================
 * service-worker.js — RetroTasks
 *
 * QUE HACE: guarda en cache los archivos de la app ("App Shell")
 * para que abra sin conexion y sea instalable.
 *
 * TRAMPA CLASICA que este codigo evita: si no versionas la cache,
 * los usuarios quedan atrapados con codigo viejo. Por eso, cuando
 * cambies el codigo, SUBE el numero de CACHE_VERSION: el evento
 * "activate" borra las versiones anteriores.
 *
 * ESTRATEGIA:
 *  - Archivos propios (App Shell): cache-first (rapido y offline).
 *  - Lo demas: network-first con fallback a cache.
 * ============================================================ */

const CACHE_VERSION = "retrotasks-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/firebase.js",
  "./js/model.js",
  "./js/notifications.js",
  "./js/sound.js",
  "./js/theme.js",
  // Firebase alojado localmente (js/vendor): sin CDN, la app
  // completa funciona offline y dentro del APK sin red.
  "./js/vendor/firebase-app.js",
  "./js/vendor/firebase-auth.js",
  "./js/vendor/firebase-firestore.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/avatar-1.png",
  "./icons/avatar-2.png",
  "./icons/avatar-3.png",
  "./icons/avatar-4.png",
  "./icons/avatar-5.png",
  "./icons/avatar-6.png",
  "./icons/avatar-7.png",
  "./icons/avatar-8.png",
  "./icons/avatar-9.png",
  "./icons/avatar-10.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // activa la nueva version de inmediato
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    // cache-first
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
        return resp;
      }).catch(() => caches.match("./index.html")))
    );
  } else {
    // network-first
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});
