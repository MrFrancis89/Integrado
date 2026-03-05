// main.js — StockFlow Pro v9.7.5
// Orquestrador principal: inicializa todos os módulos após DOMContentLoaded.

import { configurarListenersConfirm, mostrarConfirmacao } from './confirm.js';
import { iniciarNavegacao }     from './navegacao.js';
import { iniciarCalendario, agendarSnapshot, fecharCalendario } from './calendario.js';
import { iniciarMassa }         from './massa.js';
import { iniciarProducao }      from './producao.js';
import { iniciarListaFacil }    from './listafacil.js';
import { initSwipe }            from './swipe.js';
import { atualizarDropdown }    from './dropdown.js';
import { renderizarListaCompleta, inserirLinhaNoDOM, salvarEAtualizar, atualizarStatusSave } from './ui.js';
import { atualizarPainelCompras, gerarTextoCompras } from './compras.js';
import { coletarDadosDaTabela } from './tabela.js';
import { verificarAlertas, abrirModalAlerta, fecharModalAlerta, salvarAlerta } from './alerta.js';
import { abrirCalculadora, fecharCalculadora, calcDigito, calcSalvar, getInputCalculadoraAtual } from './calculadora.js';
import { parseFractionToDecimal, parseAndUpdateQuantity } from './parser.js';
import { alternarCheck, alternarTodos } from './eventos.js';
import { ativarModoTeclado }    from './teclado.js';
import { copiarParaClipboard, darFeedback } from './utils.js';
import { mostrarToast }         from './toast.js';
import {
    carregarDados, salvarDados, carregarOcultos, salvarOcultos,
    carregarMeus, salvarMeus, carregarTema, salvarTema,
    carregarPosicaoLupa, salvarPosicaoLupa, marcarDicaSwipeVista, dicaSwipeFoiVista,
    carregarUltimaVersao, salvarUltimaVersao,
    carregarItensLF, salvarItensLF, carregarOrcamentoLF, salvarOrcamentoLF,
    registrarPrecoHistorico, carregarHistoricoItem, carregarHistoricoCompleto,
    limparHistoricoItem, limparTodoHistorico, mesclarHistorico,
    carregarSnapshot, listarDatasComSnapshot, salvarSnapshot,
    STORAGE_KEYS,
} from './storage.js';
import { produtosPadrao } from './produtos.js';
import appStore from './store.js';

// ── Versão ─────────────────────────────────────────────────────────────────────
const VERSAO_ATUAL = '9.7.5';

// ── Debounce para verificarAlertas() ───────────────────────────────────────────
// BUG FIX #6: verificarAlertas() não deve ser chamada a cada tecla digitada —
// isso força coletarDadosDaTabela() + Map + forEach a cada caractere, gerando
// thrashing em listas longas. Debounce de 600ms garante que a verificação só
// ocorra após o usuário parar de digitar.
let _alertaDebounceTimer = null;
function verificarAlertasDebounced() {
    clearTimeout(_alertaDebounceTimer);
    _alertaDebounceTimer = setTimeout(verificarAlertas, 600);
}

// ── Temas ──────────────────────────────────────────────────────────────────────
const TEMAS = ['escuro', 'midnight', 'arctic', 'forest'];
const TEMA_CSS = { midnight: 'theme-midnight', arctic: 'theme-arctic', forest: 'theme-forest' };

function aplicarTema(tema) {
    const body = document.body;
    const html = document.documentElement;
    ['theme-midnight','theme-arctic','theme-forest','light-mode'].forEach(c => {
        body.classList.remove(c); html.classList.remove(c);
    });
    if (TEMA_CSS[tema]) {
        body.classList.add(TEMA_CSS[tema]);
        if (tema === 'arctic') body.classList.add('light-mode');
    }
    // Remove do html (anti-FOUC já aplicou)
    html.className = html.className.replace(/theme-\S+|light-mode/g, '').trim();
    salvarTema(tema);
    appStore.set({ tema });
    const btn = document.getElementById('btn-tema');
    if (btn) {
        const label = btn.querySelector('.btn-theme-label');
        const text  = { escuro:'DARK', midnight:'OLED', arctic:'LIGHT', forest:'🌿' }[tema] || 'DARK';
        if (label) label.textContent = text;
        else btn.textContent = text;
    }
}

function ciclarTema() {
    darFeedback();
    const atual = appStore.get('tema') || carregarTema() || 'escuro';
    const idx = TEMAS.indexOf(atual);
    const prox = TEMAS[(idx + 1) % TEMAS.length];
    aplicarTema(prox);
}

// ── Lupa flutuante ─────────────────────────────────────────────────────────────
function iniciarLupa() {
    const lupa    = document.getElementById('assistive-touch');
    const overlay = document.getElementById('search-overlay');
    const input   = document.getElementById('filtroBusca');
    if (!lupa || !overlay) return;

    // Restaura posição salva
    const pos = carregarPosicaoLupa();
    if (pos) { lupa.style.left = pos.x + 'px'; lupa.style.top = pos.y + 'px'; }

    // ── Abertura / fechamento ────────────────────────────────────
    function abrirBusca() {
        darFeedback();
        overlay.classList.add('search-open');
        if (input) { setTimeout(() => input.focus(), 80); aplicarFiltro(); }
    }
    function fecharBusca() {
        overlay.classList.remove('search-open');
        if (input) input.blur();
    }
    function toggleBusca() {
        overlay.classList.contains('search-open') ? fecharBusca() : abrirBusca();
    }

    // ── Arrastar (touch) ─────────────────────────────────────────
    let isDragging = false, startX, startY, elX, elY, touchMoved = false;

    lupa.addEventListener('touchstart', e => {
        isDragging  = false;
        touchMoved  = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const rect = lupa.getBoundingClientRect();
        elX = rect.left; elY = rect.top;
    }, { passive: true });

    lupa.addEventListener('touchmove', e => {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isDragging = true;
            touchMoved = true;
        }
        if (isDragging) {
            const nx = Math.max(0, Math.min(window.innerWidth  - 56, elX + dx));
            const ny = Math.max(0, Math.min(window.innerHeight - 56, elY + dy));
            lupa.style.left = nx + 'px';
            lupa.style.top  = ny + 'px';
        }
    }, { passive: true });

    lupa.addEventListener('touchend', (e) => {
        // BUG FIX #2: preventDefault suprime o click sintético (~300ms) que o
        // browser gera após touchend — sem isso, toggleBusca dispara duas vezes
        // (touchend → abre; click → fecha imediatamente), fazendo a lupa parecer
        // inoperante no mobile.
        e.preventDefault();
        if (!touchMoved) {
            toggleBusca();
        } else {
            const rect = lupa.getBoundingClientRect();
            salvarPosicaoLupa({ x: rect.left, y: rect.top });
        }
        isDragging = false;
    });

    // ── Click (desktop / fallback) ───────────────────────────────
    lupa.addEventListener('click', toggleBusca);

    // ── Fecha ao tocar/clicar fora ───────────────────────────────
    document.addEventListener('pointerdown', e => {
        if (overlay.classList.contains('search-open') &&
            !overlay.contains(e.target) &&
            !lupa.contains(e.target)) {
            fecharBusca();
        }
    }, true);
}

// ── Filtro / busca ─────────────────────────────────────────────────────────────
function aplicarFiltro() {
    const busca = (document.getElementById('filtroBusca')?.value || '').toLowerCase().trim();
    const sel   = document.getElementById('filtroSelect')?.value || '';

    document.querySelectorAll('#lista-itens-container tr').forEach(tr => {
        if (tr.classList.contains('categoria-header-row')) {
            tr.style.display = '';
            return;
        }
        const nome = tr.querySelector('.nome-prod')?.textContent.toLowerCase() || '';
        const matchBusca = !busca || nome.includes(busca);
        const matchSel   = !sel   || nome.trim() === sel.toLowerCase().trim();
        tr.style.display = (matchBusca && matchSel) ? '' : 'none';
    });

    // Oculta headers de categorias sem filhos visíveis
    document.querySelectorAll('.categoria-header-row').forEach(hdr => {
        let next = hdr.nextElementSibling;
        let temVisivel = false;
        while (next && !next.classList.contains('categoria-header-row')) {
            if (next.style.display !== 'none') { temVisivel = true; break; }
            next = next.nextElementSibling;
        }
        hdr.style.display = temVisivel ? '' : 'none';
    });
}

// ── Microfone ──────────────────────────────────────────────────────────────────
function iniciarMic(inputId, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
    btn.addEventListener('click', () => { darFeedback(); try { rec.start(); } catch(e){} });
    rec.onresult = e => {
        const inp = document.getElementById(inputId);
        if (inp) { inp.value = e.results[0][0].transcript; inp.dispatchEvent(new Event('input')); }
    };
}

// ── Scroll buttons ─────────────────────────────────────────────────────────────
function iniciarScrollBtns() {
    document.getElementById('btn-scroll-top')?.addEventListener('click', () => {
        darFeedback(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('btn-scroll-bottom')?.addEventListener('click', () => {
        darFeedback(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
}

// ── Exportar / Importar JSON ───────────────────────────────────────────────────
function exportarJSON() {
    darFeedback();
    const payload = {
        v:           VERSAO_ATUAL,
        estoque:     carregarDados()              || [],
        ocultos:     carregarOcultos()            || [],
        meus:        carregarMeus()               || [],
        lfItens:     carregarItensLF()            || [],
        lfOrcamento: carregarOrcamentoLF()        || 3200,
        lfHistorico: carregarHistoricoCompleto()  || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockflow_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    mostrarToast('Lista salva!');
}

function importarJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const d = JSON.parse(e.target.result);
            mostrarConfirmacao('Carregar lista do arquivo? Os dados atuais serão substituídos.', () => {
                if (Array.isArray(d.estoque)) salvarDados(d.estoque);
                if (Array.isArray(d.ocultos)) salvarOcultos(d.ocultos);
                if (Array.isArray(d.meus))    salvarMeus(d.meus);
                if (Array.isArray(d.lfItens)) salvarItensLF(d.lfItens);
                if (d.lfOrcamento)            salvarOrcamentoLF(d.lfOrcamento);
                if (d.lfHistorico)            mesclarHistorico(d.lfHistorico);
                location.reload();
            });
        } catch { mostrarToast('Arquivo inválido.'); }
    };
    reader.readAsText(file);
}

// ── Lista padrão ───────────────────────────────────────────────────────────────
let itensOcultos = [];
let meusItens    = [];

function carregarListaPadrao() {
    itensOcultos = carregarOcultos();
    meusItens    = carregarMeus();
}

function buildDadosPadrao() {
    const dados = [];
    const ocultoSet = new Set(itensOcultos.map(n => n.toLowerCase()));
    produtosPadrao.forEach(linha => {
        const [n, u] = linha.split('|');
        if (!ocultoSet.has(n.toLowerCase())) dados.push({ n, q: '', u: u || 'uni', c: false, min: null, max: null });
    });
    meusItens.forEach(item => {
        if (!dados.find(d => d.n.toLowerCase() === item.n.toLowerCase()))
            dados.push({ n: item.n, q: '', u: item.u || 'uni', c: false, min: null, max: null });
    });
    return dados;
}

function restaurarListaPadrao() {
    mostrarConfirmacao('Restaurar lista padrão? Os dados atuais serão perdidos.', () => {
        salvarDados(buildDadosPadrao());
        location.reload();
    });
}

// ── Novo Dia ───────────────────────────────────────────────────────────────────
function novoDia() {
    mostrarConfirmacao('Zerar todas as quantidades? Esta ação não pode ser desfeita.', () => {
        const dados = coletarDadosDaTabela().map(d => ({ ...d, q: '', c: false }));
        salvarDados(dados);
        renderizarListaCompleta(dados);
        atualizarDropdown();
        atualizarPainelCompras();
        mostrarToast('Quantidades zeradas!');
        agendarSnapshot();
    });
}

// ── Adicionar item ─────────────────────────────────────────────────────────────
function adicionarItem() {
    const nomEl = document.getElementById('novoProduto');
    const qtdEl = document.getElementById('novoQtd');
    const undEl = document.getElementById('novoUnidade');
    const nome  = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.'); return; }
    const dados = coletarDadosDaTabela();
    if (dados.find(d => d.n.toLowerCase() === nome.toLowerCase())) {
        mostrarToast('Produto já existe na lista.'); return;
    }
    darFeedback();
    inserirLinhaNoDOM(nome, qtdEl?.value || '', undEl?.value || 'uni', false, null, null);
    const novosDados = coletarDadosDaTabela();
    salvarDados(novosDados);
    atualizarDropdown();
    atualizarStatusSave();
    if (nomEl) nomEl.value = '';
    if (qtdEl) qtdEl.value = '';
    agendarSnapshot();
    initSwipe();
}

function adicionarFavorito() {
    const nomEl = document.getElementById('novoProduto');
    const nome  = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.'); return; }
    mostrarConfirmacao('Adicionar "' + nome + '" à lista padrão?', () => {
        const u = document.getElementById('novoUnidade')?.value || 'uni';
        meusItens = meusItens.filter(i => i.n.toLowerCase() !== nome.toLowerCase());
        meusItens.push({ n: nome, u });
        salvarMeus(meusItens);
        // BUG FIX #7: verifica duplicata ANTES de chamar adicionarItem() para
        // não exibir dois toasts conflitantes quando o produto já existe.
        // adicionarItem() mostrará "Produto já existe" se for o caso e retornará
        // sem adicionar — nessa situação, suprimir o toast de "favorito adicionado".
        const jaExiste = !!coletarDadosDaTabela().find(
            d => d.n.toLowerCase() === nome.toLowerCase()
        );
        adicionarItem();
        if (!jaExiste) mostrarToast('"' + nome + '" adicionado aos favoritos!');
    });
}

function removerDoPadrao() {
    const nomEl = document.getElementById('novoProduto');
    const nome  = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.'); return; }
    mostrarConfirmacao('Remover "' + nome + '" da lista padrão?', () => {
        const nLower = nome.toLowerCase();
        meusItens    = meusItens.filter(i => i.n.toLowerCase() !== nLower);
        itensOcultos = itensOcultos.filter(n => n.toLowerCase() !== nLower);
        if (produtosPadrao.some(p => p.split('|')[0].toLowerCase() === nLower)) {
            itensOcultos.push(nome);
        }
        salvarMeus(meusItens);
        salvarOcultos(itensOcultos);
        mostrarToast('"' + nome + '" removido do padrão.');
    });
}

// ── Compartilhar ───────────────────────────────────────────────────────────────
function compartilharEstoque() {
    darFeedback();
    const dados = coletarDadosDaTabela();
    const linhas = dados.map(d => d.n + (d.q ? ' — ' + d.q + ' ' + d.u : '')).join('\n');
    const texto  = '📦 ESTOQUE\n\n' + linhas;
    if (navigator.share) navigator.share({ text: texto });
    else copiarParaClipboard(texto);
}

function compartilharCompras() {
    darFeedback();
    copiarParaClipboard(gerarTextoCompras());
}

// ── Restaurar snapshot ─────────────────────────────────────────────────────────
function restaurarSnapshot(snap, data) {
    if (!snap) return;
    if (Array.isArray(snap.estoque) && snap.estoque.length > 0) salvarDados(snap.estoque);
    if (Array.isArray(snap.ocultos))  salvarOcultos(snap.ocultos);
    if (Array.isArray(snap.meus))     salvarMeus(snap.meus);
    if (Array.isArray(snap.lfItens))  salvarItensLF(snap.lfItens);
    if (snap.lfOrcamento)             salvarOrcamentoLF(snap.lfOrcamento);
    if (snap.lfHistorico)             mesclarHistorico(snap.lfHistorico);
    mostrarToast('Backup de ' + data + ' restaurado!');
    setTimeout(() => location.reload(), 800);
}

// ── Toggle lista de estoque ────────────────────────────────────────────────────
function toggleLista() {
    const tabela = document.getElementById('tabela-estoque');
    const btn    = document.getElementById('btn-toggle-lista');
    if (!tabela || !btn) return;
    darFeedback();
    const oculto = tabela.style.display === 'none';
    tabela.style.display = oculto ? '' : 'none';
    btn.textContent = oculto ? 'OCULTAR LISTA DE ESTOQUE' : 'MOSTRAR LISTA DE ESTOQUE';
}

// ── Novidades (what's new) ─────────────────────────────────────────────────────
function mostrarNovidades() {
    const ultima = carregarUltimaVersao();
    if (ultima === VERSAO_ATUAL) return;
    fetch('./CHANGELOG.md')
        .then(r => r.text())
        .then(md => {
            const div = document.getElementById('whatsnew-content');
            if (div) {
                // BUG FIX #8: innerHTML com conteúdo externo (CHANGELOG.md) é
                // vulnerável a XSS se o arquivo for comprometido ou contiver tags.
                // Cada linha é inserida via textContent — sem execução de HTML.
                div.innerHTML = '';
                md.split('\n').slice(0, 40).forEach(linha => {
                    const p = document.createElement('p');
                    p.textContent = linha;
                    div.appendChild(p);
                });
            }
            document.getElementById('modal-whatsnew').style.display = 'flex';
            salvarUltimaVersao(VERSAO_ATUAL);
        })
        .catch(() => salvarUltimaVersao(VERSAO_ATUAL));
}

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

    // 1. Tema
    const temaInicial = carregarTema() || 'escuro';
    aplicarTema(temaInicial);
    document.getElementById('btn-tema')?.addEventListener('click', ciclarTema);

    // 2. Confirm modal
    configurarListenersConfirm();

    // 3. Navegação entre abas
    iniciarNavegacao();

    // 4. Calendário / backup
    iniciarCalendario(restaurarSnapshot);

    // 5. Carregar e renderizar dados de estoque
    carregarListaPadrao();
    let dados = carregarDados();
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
        dados = buildDadosPadrao();
        salvarDados(dados);
    }
    renderizarListaCompleta(dados);
    atualizarDropdown();
    atualizarPainelCompras();
    verificarAlertas();

    // 6. Swipe
    initSwipe();

    // 7. Módulo Massa
    iniciarMassa();

    // 8. Módulo Produção Total (lazy — renderiza ao clicar na aba)
    iniciarProducao();

    // 9. Módulo Lista Fácil
    iniciarListaFacil();

    // 10. Lupa flutuante
    iniciarLupa();

    // 11. Microfone
    iniciarMic('filtroBusca', 'btn-mic-busca');
    iniciarMic('novoProduto', 'btn-mic-prod');

    // 12. Scroll buttons
    iniciarScrollBtns();

    // 13. Novidades
    mostrarNovidades();

    // ── Listeners globais ───────────────────────────────────────────────────────

    // Filtro / busca
    document.getElementById('filtroBusca')?.addEventListener('input', aplicarFiltro);
    document.getElementById('filtroSelect')?.addEventListener('change', aplicarFiltro);

    // Botão limpar busca
    document.querySelectorAll('[data-limpar]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.limpar;
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.dispatchEvent(new Event('input')); }
        });
    });

    // Botões de ação do estoque
    document.getElementById('btn-toggle-lista')?.addEventListener('click', toggleLista);
    document.getElementById('btn-novo-dia')?.addEventListener('click', novoDia);
    document.getElementById('btn-exportar')?.addEventListener('click', exportarJSON);
    document.getElementById('btn-importar')?.addEventListener('click', () => {
        darFeedback(); document.getElementById('input-arquivo')?.click();
    });
    document.getElementById('input-arquivo')?.addEventListener('change', e => {
        importarJSON(e.target.files[0]);
        e.target.value = '';
    });
    document.getElementById('btn-reset')?.addEventListener('click', restaurarListaPadrao);

    // Compartilhar
    document.getElementById('btn-compartilhar-estoque')?.addEventListener('click', compartilharEstoque);
    document.getElementById('btn-copiar-estoque')?.addEventListener('click', () => {
        darFeedback();
        const dados = coletarDadosDaTabela();
        copiarParaClipboard(dados.map(d => d.n + (d.q ? ' — ' + d.q + ' ' + d.u : '')).join('\n'));
    });
    document.getElementById('btn-compartilhar-compras')?.addEventListener('click', () => {
        darFeedback();
        if (navigator.share) navigator.share({ text: gerarTextoCompras() });
        else copiarParaClipboard(gerarTextoCompras());
    });
    document.getElementById('btn-copiar-compras')?.addEventListener('click', compartilharCompras);

    // Adicionar item
    document.getElementById('add-btn')?.addEventListener('click', adicionarItem);
    document.getElementById('add-star-btn')?.addEventListener('click', adicionarFavorito);
    document.getElementById('remove-star-btn')?.addEventListener('click', removerDoPadrao);
    document.getElementById('novoProduto')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') adicionarItem();
    });

    // Calculadora (estoque)
    document.getElementById('modal-calc')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) fecharCalculadora();
    });
    document.querySelector('.calc-close')?.addEventListener('click', fecharCalculadora);
    // BUG FIX #1: #novoQtd tem readonly mas não tinha nenhum gatilho para abrir a
    // calculadora. Sem listener, o campo ficava inerte ao toque/clique — o usuário
    // não conseguia digitar quantidade ao adicionar um novo item.
    document.getElementById('novoQtd')?.addEventListener('click', () => {
        abrirCalculadora(document.getElementById('novoQtd'));
    });
    document.getElementById('calc-btn-teclado')?.addEventListener('click', () => {
        // BUG FIX: o handler anterior hardcoded document.getElementById('novoQtd'),
        // ignorando que a calculadora pode ter sido aberta por qualquer input da tabela.
        // getInputCalculadoraAtual() retorna exatamente o input que abriu a calculadora,
        // seja #novoQtd ou um .input-qtd-tabela de qualquer linha do estoque.
        const inp = getInputCalculadoraAtual();
        fecharCalculadora();
        if (inp) ativarModoTeclado(inp);
    });
    document.querySelectorAll('[data-calc]').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = btn.dataset.calc;
            if (v === 'OK') calcSalvar();
            else calcDigito(v);
        });
    });

    // Delegação: checkbox, nome, quantidade, unidade na tabela
    document.getElementById('lista-itens-container')?.addEventListener('change', e => {
        const chk = e.target.closest("input[type='checkbox']");
        if (chk) { alternarCheck(chk); agendarSnapshot(); return; }
        const sel = e.target.closest('select');
        if (sel) { const d = coletarDadosDaTabela(); salvarDados(d); agendarSnapshot(); atualizarStatusSave(); }
    });
    document.getElementById('lista-itens-container')?.addEventListener('input', e => {
        const inp = e.target.closest('.input-qtd-tabela');
        if (inp) { const d = coletarDadosDaTabela(); salvarDados(d); agendarSnapshot(); atualizarStatusSave(); verificarAlertasDebounced(); }
    });
    // BUG FIX v9.7.5: dois listeners de 'blur' (capture) unificados em um único handler.
    // Antes havia dois addEventListener('blur',...,true) separados no mesmo container,
    // um para .nome-prod e outro para .input-qtd-tabela. Isso criava um design frágil
    // onde a ordem de registro poderia causar comportamento inesperado.
    document.getElementById('lista-itens-container')?.addEventListener('blur', e => {
        const nome = e.target.closest('.nome-prod');
        if (nome) { salvarEAtualizar(); agendarSnapshot(); return; }
        const inp = e.target.closest('.input-qtd-tabela');
        if (inp && !inp.hasAttribute('readonly')) parseAndUpdateQuantity(inp);
    }, true);
    document.getElementById('lista-itens-container')?.addEventListener('dblclick', e => {
        const inp = e.target.closest('.input-qtd-tabela');
        if (inp) abrirCalculadora(inp);
    });

    // Calculadora via toque longo no input (mobile)
    let longPressTimer = null;
    document.getElementById('lista-itens-container')?.addEventListener('touchstart', e => {
        const inp = e.target.closest('.input-qtd-tabela');
        if (!inp || !inp.hasAttribute('readonly')) return;
        longPressTimer = setTimeout(() => abrirCalculadora(inp), 400);
    }, { passive: true });
    document.getElementById('lista-itens-container')?.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    }, { passive: true });

    // Check-todos
    document.getElementById('check-todos')?.addEventListener('change', e => {
        alternarTodos(e.target);
    });

    // Filtro select: dropdown clicável via toque (fix iOS)
    document.getElementById('filtroSelect')?.addEventListener('touchstart', () => {}, { passive: true });

    // Modal alerta de estoque
    document.getElementById('salvar-alerta')?.addEventListener('click', () => { salvarAlerta(); agendarSnapshot(); });
    document.querySelectorAll('.fechar-modal-alerta').forEach(b =>
        b.addEventListener('click', fecharModalAlerta)
    );

    // Modal confirm / whatsnew
    document.querySelectorAll('.fechar-whatsnew').forEach(b =>
        b.addEventListener('click', () => {
            document.getElementById('modal-whatsnew').style.display = 'none';
        })
    );


    // Fechar modais ao pressionar Escape + teclado físico na calculadora
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { fecharCalendario(); fecharCalculadora(); return; }

        // ── Teclado físico na calculadora da aba Estoque ─────────────────
        // Só intercepta quando o modal da calculadora está visível E o foco
        // não está em outro input/textarea (evita bloquear digitação normal).
        const modalCalc = document.getElementById('modal-calc');
        if (!modalCalc || modalCalc.style.display === 'none') return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const KEY_MAP = {
            '0':'0','1':'1','2':'2','3':'3','4':'4',
            '5':'5','6':'6','7':'7','8':'8','9':'9',
            ',':',','.':',',           // vírgula e ponto → separador decimal
            '+':'+','-':'-',
            '*':'×','x':'×','X':'×',
            '/':'÷',
            'Backspace':'BACK',
            'Delete':'C','c':'C','C':'C',
            'Enter':'OK',
        };

        const acao = KEY_MAP[e.key];
        if (!acao) return;

        e.preventDefault(); // impede scroll, submit, etc.
        if (acao === 'OK') calcSalvar();
        else calcDigito(acao);
    });

    // Auto-save ao sair
    window.addEventListener('beforeunload', () => {
        const d = coletarDadosDaTabela();
        salvarDados(d);
    });
});