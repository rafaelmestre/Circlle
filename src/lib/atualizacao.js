import { registerSW } from 'virtual:pwa-register';

// Atualização automática do app instalado.
// O app na tela inicial quase nunca "recarrega" de verdade (fica em segundo plano),
// então procuramos versão nova sempre que ele volta para a frente e a cada 30 min.
// Quando a versão nova assume, a página recarrega sozinha (registerType: autoUpdate).
export function iniciarAtualizacao() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const checar = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registro.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', checar);
      setInterval(checar, 30 * 60 * 1000);
    }
  });
}
