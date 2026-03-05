// sw.js — StockFlow Pro Service Worker v9.7.6
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — fetch handler sem tratamento de erro de rede
//   PROBLEMA : Se fetch(request) falhar (offline, timeout, servidor down),
//              a Promise rejeitada não era capturada → o browser mostrava
//              uma página de erro genérica mesmo com cache disponível.
//   CORREÇÃO : .catch() após fetch tenta servir do cache como fallback;
//              se também não houver cache, retorna Response de erro legível.
//
// BUG #2 — Respostas opacas (cross-origin, ex: CDN) eram cacheadas
//   PROBLEMA : response.status !== 200 como guard não captura respostas
//              opacas (status = 0, de requisições cross-origin sem CORS).
//              Cachear status=0 pode retornar conteúdo inválido.
//   CORREÇÃO : Guard adicional response.type === 'basic' garante que apenas
//              respostas same-origin são cacheadas (exceto se for necessário
//              suporte a CDNs — nesse caso remover esse guard e tratar
//              individualmente).
//
// BUG #3 — install: sem tratamento de falha parcial de cache
//   PROBLEMA : cache.addAll() falha atomicamente se qualquer asset não
//              carregar. Em redes instáveis, um único ativo ausente bloqueia
//              toda a instalação do Service Worker.
//   CORREÇÃO : Usa Promise.allSettled + cache.put individual para tolerar
//              falhas parciais — o SW instala mesmo se alguns assets falharem.
// ══════════════════════════════════════════════════════════════════

// BUG FIX #10: CACHE_NAME derivado de uma constante VERSION — elimina o risco
// de atualizar a versão em um lugar e esquecer de atualizar o cache name,
// deixando usuários com SW antigo a servir assets desatualizados.
const VERSION    = '9.7.5';
const CACHE_NAME = 'stockflow-v' + VERSION.replace(/\./g, '-');

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './massa-extra.css',
    './apple-overrides.css', // BUG FIX #2: ausente na versão anterior — quebrava offline no iOS.
    './patch-v976.css',      // BUG FIX v9.7.6: ausente — sem este arquivo o layout da aba Ficha Técnica
                             //   (flex, height, iframe) não é aplicado e a aba aparece em branco.
    './ficha-tecnica.html',  // BUG FIX v9.7.6: ausente — offline a aba Ficha Técnica falha completamente.
    './manifest.json',
    './icone.png',
    './fundo-pizza.jpg',
    './CHANGELOG.md',        // BUG FIX #4: necessário para mostrarNovidades() funcionar offline.
    './main.js',
    './store.js',
    './storage.js',
    './listafacil.js',
    './navegacao.js',
    './ui.js',
    './tabela.js',
    './eventos.js',
    './compras.js',
    './categorias.js',
    './calculadora.js',
    './teclado.js',
    './parser.js',
    './alerta.js',
    './swipe.js',
    './toast.js',
    './confirm.js',
    './utils.js',
    './dropdown.js',
    './produtos.js',
    './calendario.js',
    './massa.js',
    './producao.js',
    './idb.js',
];

// BUG FIX #3: install tolerante a falhas parciais.
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            const results = await Promise.allSettled(
                ASSETS.map(url =>
                    fetch(url).then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
                        return cache.put(url, res);
                    })
                )
            );
            const falhos = results.filter(r => r.status === 'rejected');
            if (falhos.length) {
                console.warn(`[SW] ${falhos.length} asset(s) não cacheados:`,
                    falhos.map(f => f.reason?.message || f.reason));
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            // Cache hit → retorna imediatamente.
            if (cached) return cached;

            // BUG FIX #1 & #2: fetch com fallback robusto.
            return fetch(e.request)
                .then(response => {
                    // BUG FIX #2: só cacheia respostas same-origin bem-sucedidas.
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // BUG FIX #1: rede falhou e não há cache → tenta fallback para index.html
                    // (útil para navegação em modo offline em rotas SPA).
                    return caches.match('./index.html').then(fallback =>
                        fallback || new Response('Sem conexão e sem cache disponível.', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                        })
                    );
                });
        })
    );
});
