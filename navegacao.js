// navegacao.js — StockFlow Pro v9.7.7
// ══════════════════════════════════════════════════════════════════
// CORREÇÃO v9.7.4: scroll para o topo ao trocar de aba.
// ADIÇÃO   v9.7.6: iframe lazy-load + fix getAttribute('src') + ajuste de
//                  altura dinâmico para #fichatecnica-section.
// FEATURE  v9.7.7: menu de abas retrátil.
//   • Botão pill #btn-nav-toggle recolhe/expande #nav-tabs-panel via
//     classe CSS 'nav-collapsed' (max-height + opacity + transition).
//   • Estado persistido em localStorage('navCollapsed').
//   • Indicador de aba ativa exibido quando o menu está recolhido.
//   • Ao trocar de aba com menu recolhido: expande automaticamente,
//     aguarda a transição e então recolhe de volta (UX: o usuário vê
//     para onde navegou antes do menu fechar).
//
// BUG FIX v9.7.6 — _carregarFichaTecnica:
//   iframe.src (propriedade refletida) retorna URL completa da página pai
//   mesmo sem atributo src → sempre truthy → iframe nunca recebia 'ficha-tecnica.html'.
//   Fix: getAttribute('src') retorna null/'' — falsy.
//
// BUG FIX v9.7.6 — _ajustarAlturaSectionFT:
//   dvh não suportado no iOS ≤ 15; cálculo estático não descontava header+tabs.
//   Fix: JS mede getBoundingClientRect().top após rAF e define style.height exato.
// ══════════════════════════════════════════════════════════════════
import { darFeedback } from './utils.js';

const NAV_COLLAPSED_KEY = 'navCollapsed';

export function iniciarNavegacao() {
    const tabs     = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    const panel    = document.getElementById('nav-tabs-panel');
    const toggle   = document.getElementById('btn-nav-toggle');

    // ── Indicador de aba ativa (visível quando menu recolhido) ────
    // Inserido dinamicamente entre toggle e panel
    const indicator = document.createElement('div');
    indicator.id = 'nav-active-indicator';
    indicator.className = 'nav-collapsed-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    if (panel && toggle) {
        toggle.parentNode.insertBefore(indicator, panel);
    }

    function _getActiveTab() {
        return document.querySelector('.nav-tab.active');
    }

    function _atualizarIndicador() {
        const aba = _getActiveTab();
        if (!aba) return;
        // Clona o svg e o label da aba ativa para o indicador
        const svgOrig   = aba.querySelector('svg.tab-icon');
        const labelOrig = aba.querySelector('.tab-label');
        if (!svgOrig || !labelOrig) return;
        const svg   = svgOrig.cloneNode(true);
        const label = document.createElement('span');
        label.textContent = labelOrig.textContent;
        indicator.innerHTML = '';
        indicator.appendChild(svg);
        indicator.appendChild(label);
    }

    // ── Estado recolhido ──────────────────────────────────────────
    function _isCollapsed() {
        return panel?.classList.contains('nav-collapsed');
    }

    function _setCollapsed(collapsed, save = true) {
        if (!panel || !toggle) return;
        if (collapsed) {
            panel.classList.add('nav-collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Expandir menu');
            indicator.classList.add('visible');
        } else {
            panel.classList.remove('nav-collapsed');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Recolher menu');
            indicator.classList.remove('visible');
        }
        if (save) {
            try { localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch(e) {}
        }
        // Reavalia altura da Ficha Técnica após a transição
        if (document.getElementById('fichatecnica-section')?.classList.contains('active')) {
            setTimeout(() => requestAnimationFrame(_ajustarAlturaSectionFT), 400);
        }
    }

    // Restaura estado salvo
    (function _restaurarEstado() {
        try {
            const salvo = localStorage.getItem(NAV_COLLAPSED_KEY);
            if (salvo === '1') {
                _setCollapsed(true, false);
                _atualizarIndicador();
            }
        } catch(e) {}
    })();

    // Listener do botão toggle
    if (toggle) {
        toggle.addEventListener('click', () => {
            darFeedback();
            _setCollapsed(!_isCollapsed());
        });
    }

    // ── Lazy-load iframe da Ficha Técnica ─────────────────────────
    let _ftCarregado = false;

    function _carregarFichaTecnica() {
        if (_ftCarregado) return;
        const iframe = document.getElementById('ft-iframe');
        if (!iframe) return;
        // BUG FIX v9.7.6: getAttribute('src') — não a propriedade refletida
        const attrSrc = iframe.getAttribute('src');
        if (!attrSrc) {
            iframe.src = 'ficha-tecnica.html';
        }
        _ftCarregado = true;
    }

    // ── Ajuste dinâmico da altura da seção Ficha Técnica ─────────
    function _ajustarAlturaSectionFT() {
        const section = document.getElementById('fichatecnica-section');
        if (!section) return;
        const top = section.getBoundingClientRect().top;
        const vh  = window.innerHeight;
        const safeBottom = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'
        ) || 0;
        section.style.height = Math.max(200, vh - top - safeBottom) + 'px';
    }

    // ── Navegação entre abas ──────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(target + '-section')?.classList.add('active');

            darFeedback();
            _atualizarIndicador();

            if (target === 'fichatecnica') {
                _carregarFichaTecnica();
                requestAnimationFrame(_ajustarAlturaSectionFT);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: target } }));
        });
    });

    // Reavalia altura ao redimensionar
    const _onResize = () => {
        if (document.getElementById('fichatecnica-section')?.classList.contains('active')) {
            requestAnimationFrame(_ajustarAlturaSectionFT);
        }
    };
    window.addEventListener('resize', _onResize, { passive: true });
    window.addEventListener('orientationchange', _onResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _onResize, { passive: true });
    }
}
