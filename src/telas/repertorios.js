import { casca, icone } from '../lib/ui.js';

// Repertórios (próxima etapa): montar como uma playlist e aplicar numa escala
export function telaRepertorios(ctx) {
  if (!ctx.depsRepertorio.length) {
    location.hash = '#/';
    return;
  }
  casca(ctx, 'repertorios', `
    <main class="tela tela--com-nav">
      <div class="titulo titulo--topo">
        <h1>Repertórios</h1>
      </div>
      <section class="card em-breve">
        <span class="icon-circle">${icone.musica()}</span>
        <h2 class="cartao__titulo">Em breve</h2>
        <p class="texto-fraco">Aqui você vai montar repertórios como uma playlist (música, artista, tom e link)
        e aplicar numa data da escala. A equipe recebe junto com a escala.</p>
      </section>
    </main>`);
}
