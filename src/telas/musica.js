import { supabase } from '../lib/supabase.js';
import { escapar, casca, aviso, traduzirErro, comBotao, icone } from '../lib/ui.js';
import { cifraHtml, distancia, lerTom, primeiroAcorde, tomTransposto, usaBemol } from '../lib/tom.js';
import { linkCifra } from '../lib/repertorio.js';

const NOTAS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Cifra da música com troca de tom (RF27, RF29)
export async function telaMusica(ctx, musicaId, tomPedido) {
  const { data: m } = await supabase.from('musicas')
    .select('id, organizacao_id, titulo, artista, tom, link, cifra').eq('id', musicaId).maybeSingle();
  if (!m) {
    location.hash = '#/';
    return aviso('Música não encontrada.');
  }

  // Edita quem monta repertório em algum departamento da organização
  const podeEditar = ctx.depsRepertorio.some((d) => d.organizacao_id === m.organizacao_id);
  const original = m.tom || primeiroAcorde(m.cifra) || '';
  const menor = lerTom(original)?.menor ?? false;
  let semitons = original && tomPedido ? distancia(original, decodeURIComponent(tomPedido)) : 0;
  let editando = false;

  const render = () => {
    const tomAtual = original ? tomTransposto(original, semitons) : '';
    casca(ctx, 'repertorios', `
      <main class="tela tela--com-nav">
        <a class="voltar" href="#/" id="voltar">${icone.voltar()} Voltar</a>
        <div class="titulo">
          <p class="passo">${escapar(m.artista ?? 'Música')}</p>
          <h1>${escapar(m.titulo)}</h1>
          ${original ? `<p>Tom original: <strong>${escapar(original)}</strong></p>` : ''}
        </div>

        ${m.cifra && original && !editando ? `
          <section class="card tons">
            <div class="tons__cab">
              <button type="button" class="icone-botao" data-passo="-1" aria-label="Meio tom abaixo">−</button>
              <div class="tons__atual">
                <small>Tom</small>
                <strong aria-live="polite">${escapar(tomAtual)}</strong>
              </div>
              <button type="button" class="icone-botao" data-passo="1" aria-label="Meio tom acima">+</button>
            </div>
            <div class="chips tons__chips" role="group" aria-label="Escolher tom">
              ${NOTAS.map((n) => {
                const nome = `${n}${menor ? 'm' : ''}`;
                const ativo = lerTom(tomAtual)?.nota && distancia(nome, tomAtual) % 12 === 0;
                return `<button type="button" class="chip chip--mini" data-tom="${nome}" aria-pressed="${Boolean(ativo)}">${nome}</button>`;
              }).join('')}
            </div>
          </section>` : ''}

        ${editando ? `
          <form class="form card" id="editar" novalidate>
            <div class="field">
              <label for="cifra">Cifra</label>
              <textarea id="cifra" name="cifra" rows="16" maxlength="20000" class="cifra-campo" spellcheck="false"
                placeholder="[G]Numa folha qualquer [D]eu desenho um sol\n\nou\n\nG             D\nNuma folha qualquer">${escapar(m.cifra ?? '')}</textarea>
              <small class="dica">Escreva os acordes entre colchetes no meio da letra, como <code>[G]Numa folha</code>,
              ou numa linha só de acordes em cima da letra. Os dois jeitos trocam de tom.</small>
            </div>
            <div class="field">
              <label for="tomOriginal">Tom original</label>
              <input id="tomOriginal" name="tom" maxlength="8" value="${escapar(m.tom ?? '')}" placeholder="Ex.: G ou Em" />
            </div>
            <div class="acoes acoes--linha">
              <button class="btn btn-ghost" type="button" id="cancelar">Cancelar</button>
              <button class="btn btn-primary" type="submit">Salvar cifra</button>
            </div>
          </form>` : m.cifra ? `
          <pre class="cifra card">${cifraHtml(m.cifra, semitons, usaBemol(tomAtual))}</pre>` : `
          <section class="card vazio-guia">
            <h2 class="cartao__titulo">Ainda sem cifra</h2>
            <p class="texto-fraco">${podeEditar ? 'Cole a cifra aqui uma vez e a equipe passa a ver em qualquer tom.' : 'Quem monta o repertório ainda não cadastrou a cifra.'}</p>
          </section>`}

        ${editando ? '' : `
          <div class="acoes">
            ${podeEditar ? `<button class="btn btn-ghost" id="abrirEdicao">${icone.editar()} ${m.cifra ? 'Editar cifra' : 'Cadastrar cifra'}</button>` : ''}
            <a class="btn btn-ghost" target="_blank" rel="noopener" href="${escapar(m.link || linkCifra(m))}">
              ${m.link ? 'Abrir link da música' : 'Buscar no Cifra Club'}</a>
          </div>`}
      </main>`);

    // Volta para a tela de onde veio (repertório ou data)
    document.querySelector('#voltar').addEventListener('click', (e) => {
      if (history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });
    document.querySelectorAll('[data-passo]').forEach((b) =>
      b.addEventListener('click', () => { semitons += Number(b.dataset.passo); render(); }));
    document.querySelectorAll('[data-tom]').forEach((b) =>
      b.addEventListener('click', () => { semitons = distancia(original, b.dataset.tom); render(); }));
    document.querySelector('#abrirEdicao')?.addEventListener('click', () => { editando = true; render(); });
    document.querySelector('#cancelar')?.addEventListener('click', () => { editando = false; render(); });
    document.querySelector('#editar')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cifra = e.currentTarget.cifra.value.replace(/\s+$/, '') || null;
      const tom = e.currentTarget.tom.value.trim() || null;
      const { error } = await comBotao(e.currentTarget.querySelector('button[type="submit"]'), () =>
        supabase.from('musicas').update({ cifra, tom }).eq('id', m.id));
      if (error) return aviso(traduzirErro(error));
      telaMusica(ctx, musicaId, tomPedido);
      aviso('Cifra salva.');
    });
  };
  render();
}
