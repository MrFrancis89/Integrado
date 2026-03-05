// compras.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — .innerText força reflow de layout
//   PROBLEMA : .innerText em .nome-prod causa recalcuação do layout CSS
//              a cada leitura. Em listas longas com muitos itens marcados,
//              isso gera múltiplos reflows sequenciais.
//   CORREÇÃO : .textContent para leitura de texto puro.
// ══════════════════════════════════════════════════════════════════

import { coletarDadosDaTabela } from './tabela.js';
import { obterDataAmanha } from './utils.js';

export function atualizarPainelCompras() {
    const ulCompras   = document.getElementById('lista-compras-visual');
    const areaCompras = document.getElementById('area-compras');
    if (!ulCompras || !areaCompras) return;

    ulCompras.innerHTML = '';
    let temItens = false;

    document.querySelectorAll('#lista-itens-container tr:not(.categoria-header-row)').forEach(r => {
        const checkbox = r.querySelector("input[type='checkbox']");
        if (checkbox?.checked) {
            temItens = true;
            const li = document.createElement('li');
            // BUG FIX #1: textContent em vez de innerText.
            li.textContent = r.querySelector('.nome-prod').textContent.replace(/\r\n|\n|\r/g, ' ').trim();
            ulCompras.appendChild(li);
        }
    });

    areaCompras.style.display = temItens ? 'block' : 'none';
}

export function gerarTextoCompras() {
    const itens = [];

    document.querySelectorAll('#lista-itens-container tr:not(.categoria-header-row)').forEach(r => {
        const check = r.querySelector("input[type='checkbox']");
        if (check?.checked) {
            // BUG FIX #1: textContent em vez de innerText.
            itens.push(r.querySelector('.nome-prod').textContent.replace(/\r\n|\n|\r/g, ' ').trim());
        }
    });

    itens.sort();
    return `*LISTA DE COMPRAS ${obterDataAmanha()}*\n\n` + itens.join('\n') + '\n';
}