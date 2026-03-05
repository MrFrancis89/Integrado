// navegacao.js — StockFlow Pro v9.7.6
// ══════════════════════════════════════════════════════════════════
// CORREÇÃO v9.7.4: scroll para o topo ao trocar de aba.
// ADIÇÃO v9.7.6: suporte à aba "Ficha Técnica" (iframe lazy-load).
//   O iframe só recebe o src na primeira vez que a aba é ativada
//   (lazy-load) para não bloquear o carregamento inicial do StockFlow.
//   Em todas as visitas seguintes o iframe já está carregado e
//   mantém seu estado interno (localStorage fichatecnica_v1).
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
        if (iframe && !iframe.src) {
            iframe.src = 'ficha-tecnica.html';
            _ftCarregado = true;
        } else if (iframe && iframe.src) {
            // Já tinha src (ex: injetado pelo HTML diretamente)
            _ftCarregado = true;
        }
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
            // (o iframe tem scroll próprio); apenas garantir lazy-load.
            if (target === 'fichatecnica') {
                _carregarFichaTecnica();
                // Não chama window.scrollTo — o iframe controla seu próprio scroll
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: target } }));
        });
    });
}
