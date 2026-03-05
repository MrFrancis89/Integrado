// idb.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// Wrapper minimalista sobre IndexedDB para o armazenamento de
// snapshots históricos (calendário).
//
// Por que não localStorage?
//   • localStorage é síncrono → bloqueia a Main Thread ao serializar
//     60 dias de dados (~centenas de KB).
//   • Cota de ~5 MB → estoura facilmente com histórico longo.
//   • IDB é assíncrono, cota de centenas de MB e cada snapshot é
//     uma entrada independente (sem ler/reescrever os outros 59).
//
// API pública:
//   idbGet(key)          → Promise<value | undefined>
//   idbSet(key, value)   → Promise<void>
//   idbDel(key)          → Promise<void>
//   idbKeys()            → Promise<string[]>
//   idbClear()           → Promise<void>
// ══════════════════════════════════════════════════════════════════

const DB_NAME    = 'stockflow-snapshots';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

let _dbPromise = null;

function _openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => {
            console.error('[idb] Falha ao abrir IndexedDB:', e.target.error);
            reject(e.target.error);
        };
    });
    return _dbPromise;
}

function _tx(mode) {
    return _openDB().then(db => {
        const tx    = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        return { tx, store };
    });
}

function _req(idbRequest) {
    return new Promise((resolve, reject) => {
        idbRequest.onsuccess = e => resolve(e.target.result);
        idbRequest.onerror   = e => reject(e.target.error);
    });
}

// ── API pública ───────────────────────────────────────────────────

export async function idbGet(key) {
    const { store } = await _tx('readonly');
    return _req(store.get(key));
}

export async function idbSet(key, value) {
    const { store } = await _tx('readwrite');
    return _req(store.put(value, key));
}

export async function idbDel(key) {
    const { store } = await _tx('readwrite');
    return _req(store.delete(key));
}

export async function idbKeys() {
    const { store } = await _tx('readonly');
    return _req(store.getAllKeys());
}

export async function idbClear() {
    const { store } = await _tx('readwrite');
    return _req(store.clear());
}

// ── Migração única do localStorage → IDB ─────────────────────────
// Chamada automaticamente no primeiro uso. Move a chave legada
// 'stockflow_snapshots_v1' para o IDB e remove do localStorage.
export async function migrarSnapshotsLegados(legacyKey) {
    try {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) return;
        const snaps = JSON.parse(raw);
        if (!snaps || typeof snaps !== 'object') return;

        const existentes = new Set(await idbKeys());
        for (const [data, payload] of Object.entries(snaps)) {
            if (!existentes.has(data)) {
                await idbSet(data, payload);
            }
        }
        localStorage.removeItem(legacyKey);
        console.info(`[idb] ${Object.keys(snaps).length} snapshot(s) migrado(s) do localStorage → IDB.`);
    } catch (e) {
        console.warn('[idb] Falha na migração de snapshots legados:', e);
    }
}