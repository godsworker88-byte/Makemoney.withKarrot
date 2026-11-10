// 최소 서비스워커 (PWA 설치 + 앱 셸 오프라인)
const CACHE = 'dainmarket-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // API는 항상 네트워크
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok && u.origin === location.origin) { const cp = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, cp)); }
      return r;
    }).catch(()=>caches.match('./index.html')))
  );
});
