// toast.js — StockFlow Pro v9.7.4
// CORREÇÃO v9.7.4: mostrarAlertaElegante removido daqui e movido para confirm.js.
// CORREÇÃO v9.7.4: innerText → textContent (evita reflow de layout).
// Mantém apenas mostrarToast (notificação não bloqueante).

export function mostrarToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) { console.warn('[toast] #toast-container não encontrado.'); return; }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}