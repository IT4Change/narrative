// Self-destructing service worker
// This SW immediately unregisters itself and clears all caches
// Deploy this to replace the old PWA service worker

self.addEventListener('install', () => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  // Clear all caches
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => {
      console.log('[SW] Deleting cache:', cacheName);
      return caches.delete(cacheName);
    })
  );

  // Unregister this service worker
  const registration = await self.registration;
  await registration.unregister();
  console.log('[SW] Service worker unregistered');

  // Force reload all clients to get fresh content
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.navigate(client.url);
  });
});

// Don't cache anything - pass through all requests
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});