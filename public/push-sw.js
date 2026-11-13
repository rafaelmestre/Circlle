// Recebe as notificações do Circlle (carregado pelo service worker do PWA)
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Circlle', {
      body: dados.corpo || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: dados.tag,
      renotify: Boolean(dados.tag),
      data: { url: dados.url || '/' }
    })
  );
});

// Toque na notificação: abre o app na tela certa
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) {
      await aberta.focus();
      return aberta.navigate(destino).catch(() => aberta.postMessage({ tipo: 'abrir', url: destino }));
    }
    return self.clients.openWindow(destino);
  })());
});
