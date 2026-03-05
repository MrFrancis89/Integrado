// navegacao.js — StockFlow Pro v9.7.6
// ══════════════════════════════════════════════════════════════════
// CORREÇÃO v9.7.4: scroll para o topo ao trocar de aba.
// ADIÇÃO v9.7.6: suporte à aba "Ficha Técnica" (iframe lazy-load).
//   O iframe só recebe o src na primeira vez que a aba é ativada
//   (lazy-load) para não bloquear o carregamento inicial do StockFlow.
//   Em todas as visitas seguintes o iframe já está carregado e
//   mantém seu estado interno (localStorage fichatecnica_v1).
//
// BUG FIX v9.7.6 — _carregarFichaTecnica:
//   PROBLEMA: `!iframe.src` compara a PROPRIEDADE REFLETIDA, não o atributo HTML.
//     Quando o HTML tem <iframe id="ft-iframe"> sem src ou com src="",
//     a propriedade `iframe.src` retorna a URL COMPLETA da página pai
//     (ex: "https://mrfrancis89.github.io/index.html") — uma string truthy.
//     Resultado: `!iframe.src` === false → entra no else if → marca
//     _ftCarregado=true sem nunca injetar 'ficha-tecnica.html' como src.
//     A aba abre em branco permanentemente.
//   CORREÇÃO: `iframe.getAttribute('src')` retorna o valor literal do atributo:
//     null se o atributo não existir, "" se existir vazio — ambos falsy.
//     Apenas quando um src real estiver no HTML (ex: src="ficha-tecnica.html")
//     o else if dispara corretamente.
//
// BUG FIX v9.7.6 — _ajustarAlturaSectionFT:
//   PROBLEMA: `height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))`
//     no patch-v976.css tem dois problemas:
//     1. `dvh` só foi suportado a partir do Safari 16 (iOS 16). No iOS 15 e
//        anteriores o valor é ignorado e a section colapsa para height: auto,
//        tornando o iframe 0px de altura — apenas os elementos position:sticky
//        (header + nav internos) aparecem, com o fundo do StockFlow visível
//        logo abaixo (exatamente o que aparece na print).
//     2. Mesmo com dvh correto, o cálculo não desconta a altura do header do
//        StockFlow + grid de abas, fazendo a section ser ~200px mais alta que
//        o espaço disponível, transbordando o viewport.
//   CORREÇÃO: JS calcula a posição real da section no momento da ativação e
//     define explicitamente a altura via style.height, eliminando dependência
//     de dvh e de qualquer cálculo estático fixo. Reavalia em resize e
//     orientationchange para cobrir rotação e teclado virtual (iOS).
// ══════════════════════════════════════════════════════════════════
import { darFeedback } from './utils.js';

export function iniciarNavegacao() {
    const tabs     = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    // ── Lazy-load iframe da Ficha Técnica ─────────────────────────
    // O <iframe id="ft-iframe"> começa sem src para não bloquear o
    // carregamento inicial. O src é injetado na primeira ativação.
    let _ftCarregado = false;

    function _carregarFichaTecnica() {
        if (_ftCarregado) return;
        const iframe = document.getElementById('ft-iframe');
        if (!iframe) return;

        // BUG FIX v9.7.6: usa getAttribute('src') em vez de iframe.src.
        // `iframe.src` (propriedade refletida) retorna a URL COMPLETA da página
        // pai mesmo quando o atributo src está ausente ou vazio — é sempre truthy.
        // getAttribute('src') retorna null (sem atributo) ou "" (vazio) — falsy.
        const attrSrc = iframe.getAttribute('src');
        if (!attrSrc) {
            iframe.src = 'ficha-tecnica.html';
            _ftCarregado = true;
        } else {
            // src já definido no HTML diretamente (ex: src="ficha-tecnica.html")
            _ftCarregado = true;
        }
    }

    // BUG FIX v9.7.6: ajusta a altura da section em tempo de execução para
    // eliminar dependência de `dvh` (não suportado iOS ≤ 15) e garantir que
    // a section ocupe exatamente o espaço disponível abaixo do header + tabs.
    function _ajustarAlturaSectionFT() {
        const section = document.getElementById('fichatecnica-section');
        if (!section) return;

        // getBoundingClientRect().top reflete a posição atual — inclui
        // automaticamente a altura de qualquer elemento acima (header, tabs,
        // banners, etc.), sem necessidade de somar alturas manualmente.
        const top = section.getBoundingClientRect().top;

        // window.innerHeight é o viewport visual; em iOS Safari (standalone PWA)
        // não inclui a barra de endereços e é equivalente a 100dvh.
        const vh = window.innerHeight;

        // Safe area inferior (notch/home indicator): lê do CSS se disponível.
        // Fallback 0 caso o browser não suporte env().
        const safeBottom = parseInt(
            getComputedStyle(document.documentElement)
                .getPropertyValue('--sab') || '0'
        ) || 0;

        const altura = Math.max(200, vh - top - safeBottom);
        section.style.height = altura + 'px';
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(target + '-section')?.classList.add('active');

            darFeedback();

            // Para a aba Ficha Técnica: não scrollar a página principal
            // (o iframe tem scroll próprio); apenas garantir lazy-load e altura.
            if (target === 'fichatecnica') {
                _carregarFichaTecnica();
                // BUG FIX v9.7.6: ajusta altura após a section se tornar visível
                // (display:flex — o getBoundingClientRect só é preciso quando visível).
                // rAF garante que o browser já calculou o layout do flex antes de medir.
                requestAnimationFrame(_ajustarAlturaSectionFT);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: target } }));
        });
    });

    // Reavalia altura ao redimensionar (rotação de tela, teclado virtual iOS).
    const _onResize = () => {
        const section = document.getElementById('fichatecnica-section');
        if (section?.classList.contains('active')) {
            requestAnimationFrame(_ajustarAlturaSectionFT);
        }
    };
    window.addEventListener('resize', _onResize, { passive: true });
    window.addEventListener('orientationchange', _onResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _onResize, { passive: true });
    }
}
