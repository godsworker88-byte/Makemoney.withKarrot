// 다인마켓 서비스워커 — HTML/코드는 네트워크 우선(수정 즉시 반영), 오프라인 대비 캐시 백업
const CACHE = 'dainmarket-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return;            // API는 항상 네트워크
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const isDoc = e.request.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname === '/' || u.pathname.endsWith('/');
  if (isDoc) {
    // 네트워크 우선: 최신 코드를 받고, 실패 시 캐시
    e.respondWith(
      fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
  } else {
    // 정적 자원: 캐시 우선
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); } return r; })));
  }
});
