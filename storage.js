// storage.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// NOVIDADE v9.7.3 — Snapshots migrados para IndexedDB
// ══════════════════════════════════════════════════════════════════
// PROBLEMA (v9.7.3):
//   salvarSnapshot() lia toda a chave 'stockflow_snapshots_v1' do
//   localStorage, desserializava até 60 dias de dados, adicionava o
//   dia atual e reescrevia tudo de volta.
//   • localStorage é SÍNCRONO → bloqueia a Main Thread.
//   • Cada gravação processa e reescreve centenas de KB.
//   • Cota de ~5 MB → estoura com histórico longo (QuotaExceededError).
//
// SOLUÇÃO:
//   Snapshots agora são armazenados no IndexedDB via idb.js:
//   • Cada dia é uma entrada independente → zero reescrita dos outros 59.
//   • I/O totalmente assíncrono → sem bloqueio de UI ou stuttering.
//   • Cota de centenas de MB → sem risco de overflow.
//   • Migração automática das entradas legadas do localStorage.
//
// BREAKING CHANGE:
//   salvarSnapshot(), carregarSnapshot() e listarDatasComSnapshot()
//   agora retornam Promise. Todos os chamadores (calendario.js)
//   foram atualizados para await.
//
// Manter inalteradas:
//   Todas as demais funções (localStorage) permanecem síncronas.
// ══════════════════════════════════════════════════════════════════

import { idbGet, idbSet, idbDel, idbKeys, migrarSnapshotsLegados } from './idb.js';

export const STORAGE_KEYS = {
    dados:        'estoqueDados_v4_categorias',
    ocultos:      'itensOcultosPadrao_v4',
    meus:         'meusItensPadrao_v4',
    tema:         'temaEstoque',
    lupaPos:      'lupaPosicao_v1',
    dicaSwipe:    'dicaSwipeMostrada',
    ultimaVersao: 'stockflow_ultima_versao',
    lfItens:      'listaFacil_itens_v1',
    lfOrcamento:  'listaFacil_orcamento_v1',
    lfHistorico:  'listaFacil_historico_v1',
    // 'snapshots' removido do localStorage — agora em IndexedDB via idb.js.
};

// ── Wrappers robustos (localStorage) ─────────────────────────────

function _setItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error(`[storage] Falha ao salvar "${key}":`, e);
        return false;
    }
}

function _getItem(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.error(`[storage] Dado corrompido em "${key}":`, e);
        return fallback;
    }
}

// ── Estoque ───────────────────────────────────────────────────────
export function salvarDados(d)  { _setItem(STORAGE_KEYS.dados, JSON.stringify(d)); }
export function carregarDados() { return _getItem(STORAGE_KEYS.dados, null); }

// ── Configurações de lista ────────────────────────────────────────
export function salvarOcultos(o)  { _setItem(STORAGE_KEYS.ocultos, JSON.stringify(o)); }
export function carregarOcultos() { return _getItem(STORAGE_KEYS.ocultos, []); }
export function salvarMeus(m)     { _setItem(STORAGE_KEYS.meus, JSON.stringify(m)); }
export function carregarMeus()    { return _getItem(STORAGE_KEYS.meus, []); }

// ── UI / Tema ─────────────────────────────────────────────────────
export function salvarTema(modo)       { _setItem(STORAGE_KEYS.tema, modo); }
export function carregarTema()         { return localStorage.getItem(STORAGE_KEYS.tema); }
export function salvarPosicaoLupa(p)   { _setItem(STORAGE_KEYS.lupaPos, JSON.stringify(p)); }
export function carregarPosicaoLupa()  { return _getItem(STORAGE_KEYS.lupaPos, null); }
export function marcarDicaSwipeVista() { _setItem(STORAGE_KEYS.dicaSwipe, 'true'); }
export function dicaSwipeFoiVista()    { return !!localStorage.getItem(STORAGE_KEYS.dicaSwipe); }
export function salvarUltimaVersao(v)  { _setItem(STORAGE_KEYS.ultimaVersao, v); }
export function carregarUltimaVersao() { return localStorage.getItem(STORAGE_KEYS.ultimaVersao); }

// ── Lista Fácil ───────────────────────────────────────────────────
export function salvarItensLF(itens)  { _setItem(STORAGE_KEYS.lfItens, JSON.stringify(itens)); }
export function carregarItensLF()     { return _getItem(STORAGE_KEYS.lfItens, null); }
export function salvarOrcamentoLF(v)  { _setItem(STORAGE_KEYS.lfOrcamento, String(v)); }
export function carregarOrcamentoLF() {
    try {
        const v = localStorage.getItem(STORAGE_KEYS.lfOrcamento);
        return v ? (parseFloat(v) || 3200) : 3200;
    } catch (e) { return 3200; }
}

// ── Histórico de preços ───────────────────────────────────────────
const MAX_HIST = 10;

export function registrarPrecoHistorico(nomeItem, preco) {
    if (!nomeItem || preco <= 0) return;
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    const k = nomeItem.toLowerCase().trim();
    if (!h[k]) h[k] = [];
    const hoje = new Date().toLocaleDateString('pt-BR');
    const last = h[k][h[k].length - 1];
    if (last && last.d === hoje && last.v === preco) return;
    h[k].push({ d: hoje, v: preco });
    if (h[k].length > MAX_HIST) h[k] = h[k].slice(-MAX_HIST);
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(h));
}

export function carregarHistoricoItem(nomeItem) {
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    return h[nomeItem.toLowerCase().trim()] || [];
}

export function carregarHistoricoCompleto() {
    return _getItem(STORAGE_KEYS.lfHistorico, {});
}

export function limparHistoricoItem(nomeItem) {
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    delete h[nomeItem.toLowerCase().trim()];
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(h));
}

export function limparTodoHistorico() {
    _setItem(STORAGE_KEYS.lfHistorico, '{}');
}

export function mesclarHistorico(historicoExterno) {
    if (!historicoExterno || typeof historicoExterno !== 'object') return;
    const local = _getItem(STORAGE_KEYS.lfHistorico, {});
    const toDate = s => { const [d, m, y] = s.split('/'); return new Date(y, m - 1, d); };

    for (const [k, pontos] of Object.entries(historicoExterno)) {
        if (!Array.isArray(pontos)) continue;
        if (!local[k]) {
            local[k] = pontos.slice(-MAX_HIST);
        } else {
            const datasLocais = new Set(local[k].map(p => p.d));
            for (const p of pontos) {
                if (!datasLocais.has(p.d)) { local[k].push(p); datasLocais.add(p.d); }
            }
            local[k].sort((a, b) => toDate(a.d) - toDate(b.d));
            if (local[k].length > MAX_HIST) local[k] = local[k].slice(-MAX_HIST);
        }
    }
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(local));
}

// ══════════════════════════════════════════════════════════════════
// ── Snapshots (IndexedDB) — ASYNC ────────────────────────────────
// ══════════════════════════════════════════════════════════════════
// Todas as funções abaixo retornam Promise.
// Chamadores devem usar await (veja calendario.js).
//
// Estrutura de cada entrada no IDB:
//   key   : string  "DD/MM/AAAA"
//   value : { ts, estoque, ocultos, meus, lfItens, lfOrcamento, lfHistorico }

const MAX_SNAPSHOTS = 60;

// Executa a migração legada na primeira importação deste módulo.
// É uma Promise fire-and-forget — não precisa de await no chamador.
migrarSnapshotsLegados('stockflow_snapshots_v1');

/**
 * Salva (ou sobrescreve) o snapshot do dia atual no IDB.
 * Remove os dias mais antigos se o total ultrapassar MAX_SNAPSHOTS.
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function salvarSnapshot(payload) {
    const hoje = new Date().toLocaleDateString('pt-BR');

    const entrada = {
        ts:          Date.now(),
        estoque:     Array.isArray(payload.estoque)                          ? payload.estoque      : [],
        ocultos:     Array.isArray(payload.ocultos)                          ? payload.ocultos      : [],
        meus:        Array.isArray(payload.meus)                             ? payload.meus         : [],
        lfItens:     Array.isArray(payload.lfItens)                          ? payload.lfItens      : [],
        lfOrcamento: typeof payload.lfOrcamento === 'number'                 ? payload.lfOrcamento  : 3200,
        lfHistorico: payload.lfHistorico && typeof payload.lfHistorico === 'object' ? payload.lfHistorico : {},
    };

    try {
        await idbSet(hoje, entrada);

        // Limpa dias excedentes (mantém os MAX_SNAPSHOTS mais recentes).
        const toDate = s => { const [d, m, y] = s.split('/'); return new Date(+y, m - 1, +d); };
        const chaves = await idbKeys();
        if (chaves.length > MAX_SNAPSHOTS) {
            const excedentes = chaves
                .sort((a, b) => toDate(a) - toDate(b))
                .slice(0, chaves.length - MAX_SNAPSHOTS);
            await Promise.all(excedentes.map(k => idbDel(k)));
        }
    } catch (e) {
        console.error('[storage] Falha ao salvar snapshot no IDB:', e);
    }
}

/**
 * Carrega o snapshot de uma data específica.
 * @param {string} dataStr  "DD/MM/AAAA"
 * @returns {Promise<object|null>}
 */
export async function carregarSnapshot(dataStr) {
    try {
        const snap = await idbGet(dataStr);
        return snap ?? null;
    } catch (e) {
        console.error('[storage] Falha ao carregar snapshot do IDB:', e);
        return null;
    }
}

/**
 * Retorna todas as datas que possuem snapshot salvo.
 * @returns {Promise<string[]>}  Array de strings "DD/MM/AAAA"
 */
export async function listarDatasComSnapshot() {
    try {
        return await idbKeys();
    } catch (e) {
        console.error('[storage] Falha ao listar snapshots do IDB:', e);
        return [];
    }
}

/**
 * Exporta todos os snapshots do IDB como um objeto serializável.
 * Formato: { versao, exportadoEm, snapshots: { "DD/MM/AAAA": payload, ... } }
 * @returns {Promise<object>}
 */
export async function exportarTodosSnapshots() {
    const chaves = await idbKeys();
    const snapshots = {};
    await Promise.all(
        chaves.map(async k => {
            try {
                const snap = await idbGet(k);
                if (snap) snapshots[k] = snap;
            } catch (e) {
                console.warn(`[storage] Não foi possível exportar snapshot de ${k}:`, e);
            }
        })
    );
    return {
        versao: '9.7.4',
        exportadoEm: new Date().toISOString(),
        snapshots,
    };
}

/**
 * Importa snapshots de um objeto exportado, mesclando com os existentes.
 * Entradas mais recentes (maior ts) têm precedência em caso de conflito.
 * @param {object} backupObj  Objeto no formato gerado por exportarTodosSnapshots()
 * @returns {Promise<{ importados: number, ignorados: number }>}
 */
export async function importarSnapshots(backupObj) {
    if (!backupObj?.snapshots || typeof backupObj.snapshots !== 'object') {
        throw new Error('Arquivo de backup inválido ou corrompido.');
    }

    const entradas = Object.entries(backupObj.snapshots);
    let importados = 0;
    let ignorados  = 0;

    for (const [data, payload] of entradas) {
        try {
            const existente = await idbGet(data);
            // Mantém o mais recente em caso de conflito pelo timestamp.
            if (!existente || (payload.ts && payload.ts > (existente.ts || 0))) {
                await idbSet(data, payload);
                importados++;
            } else {
                ignorados++;
            }
        } catch (e) {
            console.warn(`[storage] Falha ao importar snapshot de ${data}:`, e);
            ignorados++;
        }
    }

    return { importados, ignorados };
}