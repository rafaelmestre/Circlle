import { escapar, icone } from './ui.js';

// Busca da cifra no Cifra Club (o site não tem API; abrimos a busca pronta)
export const linkCifra = (m) =>
  `https://www.cifraclub.com.br/?q=${encodeURIComponent(`${m.titulo} ${m.artista ?? ''}`.trim())}`;

// Tela da música já no tom do repertório
export const linkMusica = (i) =>
  `#/musica/${i.musica_id ?? i.musicas.id}${i.tomFinal ? `/${encodeURIComponent(i.tomFinal)}` : ''}`;

// Itens em ordem, com o tom da lista valendo sobre o tom original
export function itensOrdenados(rep) {
  return [...(rep?.repertorio_itens ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => ({ ...i, tomFinal: i.tom || i.musicas?.tom || '' }));
}

// Texto para o WhatsApp: "1. Aquarela — Toquinho (G)"
export function textoRepertorio(nome, itens, titulo = '') {
  return [
    `*Repertório${titulo ? `: ${titulo}` : ''}*`,
    nome && nome !== titulo ? `_${nome}_` : null,
    '',
    ...itens.map((i, n) => `${n + 1}. ${i.musicas.titulo}${i.musicas.artista ? ` — ${i.musicas.artista}` : ''}${i.tomFinal ? ` (${i.tomFinal})` : ''}`)
  ].filter((l) => l !== null).join('\n');
}

// Bloco de leitura do repertório de uma data (membros e coordenação)
export function blocoRepertorio(rep, { podeEditar = false, depId = '' } = {}) {
  const itens = itensOrdenados(rep);
  if (!rep) {
    return podeEditar ? `
      <section class="secao">
        <h2>Repertório</h2>
        <a class="btn btn-ghost" href="#/repertorios/${depId}">${icone.musica(18)} Escolher um repertório</a>
      </section>` : '';
  }
  return `
    <section class="secao">
      <div class="secao__cab">
        <h2>Repertório <span class="contador">${itens.length}</span></h2>
        ${podeEditar ? `<a class="link-sutil" href="#/repertorio/${rep.id}">Editar</a>` : ''}
      </div>
      <ol class="musicas">
        ${itens.map((i) => `
          <li class="musica">
            <span class="musica__texto">
              <strong>${escapar(i.musicas.titulo)}</strong>
              <small>${escapar(i.musicas.artista ?? '')}${i.observacao ? ` · ${escapar(i.observacao)}` : ''}</small>
            </span>
            ${i.tomFinal ? `<span class="musica__tom" aria-label="Tom ${escapar(i.tomFinal)}">${escapar(i.tomFinal)}</span>` : ''}
            <a class="icone-botao icone-botao--mini" href="${linkMusica(i)}"
               aria-label="Cifra de ${escapar(i.musicas.titulo)}${i.tomFinal ? ` em ${escapar(i.tomFinal)}` : ''}">${icone.seta()}</a>
          </li>`).join('') || '<li class="vazio">Nenhuma música ainda.</li>'}
      </ol>
    </section>`;
}
