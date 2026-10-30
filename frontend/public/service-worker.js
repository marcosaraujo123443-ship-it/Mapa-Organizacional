/**
 * Service Worker - Mapa Organizacional (PWA)
 *
 * Estratégias de cache (uso offline parcial):
 *  - App shell (HTML, manifest, ícones): pré-cacheado na instalação.
 *  - Navegação (HTML): network-first, cai para o index.html em cache se offline (SPA).
 *  - Assets estáticos com hash do Vite (/assets/*): cache-first (imutáveis).
 *  - API GET (/api/v1/*): network-first com fallback ao cache -> organograma, cargos
 *    e POPs já visitados continuam disponíveis sem internet.
 *  - Busca (/api/v1/busca): somente rede (resultados dependem do termo; offline retorna vazio).
 *
 * Para publicar uma nova versão, altere VERSAO.
 */
const VERSAO = 'v1.3.0';
const CACHE_SHELL = `shell-${VERSAO}`;
const CACHE_ASSETS = `assets-${VERSAO}`;
const CACHE_API = 'api-v1'; // mantido entre versões para preservar dados offline
const MAX_ITENS_API = 200;

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---------------------------------------------------------------------------
// Instalação: pré-cache do app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL)));
});

// ---------------------------------------------------------------------------
// Ativação: remove caches de versões antigas
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  const validos = [CACHE_SHELL, CACHE_ASSETS, CACHE_API];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !validos.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Permite que a página ative imediatamente uma nova versão
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Interceptação de requisições
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API (pode estar em outra origem se VITE_API_URL estiver definido)
  if (url.pathname.startsWith('/api/v1/')) {
    if (url.pathname.startsWith('/api/v1/busca')) {
      event.respondWith(somenteRede(request, { q: url.searchParams.get('q'), resultados: [], offline: true }));
    } else {
      event.respondWith(redePrimeiro(request, CACHE_API, true));
    }
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação da SPA
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_SHELL).then((c) => c.put('/index.html', copia));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Assets versionados do build
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cachePrimeiro(request, CACHE_ASSETS));
    return;
  }

  // Demais arquivos (anexos de POP etc.): network-first
  event.respondWith(redePrimeiro(request, CACHE_ASSETS, false));
});

// ---------------------------------------------------------------------------
// Estratégias
// ---------------------------------------------------------------------------
async function cachePrimeiro(request, nomeCache) {
  const emCache = await caches.match(request);
  if (emCache) return emCache;
  const res = await fetch(request);
  if (res.ok) (await caches.open(nomeCache)).put(request, res.clone());
  return res;
}

async function redePrimeiro(request, nomeCache, limitar) {
  const cache = await caches.open(nomeCache);
  try {
    const res = await fetch(request);
    if (res.ok) {
      await cache.put(request, res.clone());
      if (limitar) aparar(cache, MAX_ITENS_API);
    }
    return res;
  } catch {
    const emCache = await cache.match(request);
    if (emCache) return emCache;
    return new Response(JSON.stringify({ erro: 'Sem conexão e sem dados salvos para este item.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function somenteRede(request, fallbackJson) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify(fallbackJson), { headers: { 'Content-Type': 'application/json' } });
  }
}

/** Mantém o cache da API com no máximo `max` entradas (remove as mais antigas). */
async function aparar(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
