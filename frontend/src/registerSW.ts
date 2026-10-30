/**
 * Registra o service worker (apenas em produção, para não atrapalhar o HMR do Vite).
 * Quando uma nova versão é publicada, ativa-a e recarrega a página uma única vez.
 */
export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) {
            novo.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      let recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!recarregou) { recarregou = true; window.location.reload(); }
      });
    } catch (e) {
      console.warn('Falha ao registrar o service worker', e);
    }
  });
}
