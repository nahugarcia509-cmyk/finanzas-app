const BUILD_ID = '__BUILD_ID__'
const CACHE_VERSION = `mis-finanzas-${BUILD_ID}`
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => cache.put('/index.html', copy))
          return response
        })
        .catch(async () => (await caches.match('/index.html')) || caches.match('/'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy))
        }
        return response
      }).catch(() => cached)
      return cached || network
    })
  )
})
