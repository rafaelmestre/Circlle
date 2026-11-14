import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { escapar, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao, formatarData, linkWhats } from '../lib/ui.js';
import { linkCifra, itensOrdenados, textoRepertorio } from '../lib/repertorio.js';

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Editor do repertório: músicas em ordem, tom de cada uma e as datas onde vale
export async function telaRepertorio(ctx, repId, rolagem = 0) {
  const { data: rep } = await supabase.from('repertorios')
    .select(`id, nome, departamento_id, departamentos(id, nome, organizacao_id),
             repertorio_itens(id, ordem, tom, observacao, musica_id, musicas(id, titulo, artista, tom, link))`)
    .eq('id', repId).maybeSingle();
  const dep = rep?.departamentos;
  if (!rep || !ctx.depsRepertorio.some((d) => d.id === dep.id)) {
    location.hash = '#/repertorios';
    return;
  }

  const [musicasRes, eventosRes] = await Promise.all([
    supabase.from('musicas').select('id, titulo, artista, tom, link').eq('organizacao_id', dep.organizacao_id).order('titulo'),
    supabase.from('eventos').select('id, titulo, inicio, status, repertorio_id, repertorios(nome)')
      .eq('departamento_id', dep.id).neq('status', 'cancelado')
      .gte('inicio', new Date(Date.now() - 86400000).toISOString()).order('inicio').limit(20)
  ]);
  const biblioteca = musicasRes.data ?? [];
  const eventos = eventosRes.data ?? [];
  const itens = itensOrdenados(rep);
  const naLista = new Set(itens.map((i) => i.musica_id));
  const recarregar = () => telaRepertorio(ctx, repId, window.scrollY);

  casca(ctx, 'repertorios', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(`#/repertorios/${dep.id}`, 'Repertórios')}
      <div class="titulo">
        <p class="passo">${escapar(dep.nome)}</p>
        <h1>${escapar(rep.nome)}</h1>
        <p>${itens.length} ${itens.length === 1 ? 'música' : 'músicas'}</p>
      </div>

      <section class="secao">
        <h2>Músicas</h2>
        <ol class="musicas musicas--editar">
          ${itens.map((i, n) => `
            <li class="musica" data-item="${i.id}">
              <span class="musica__num" aria-hidden="true">${n + 1}</span>
              <span class="musica__texto">
                <strong>${escapar(i.musicas.titulo)}</strong>
                <small>${escapar(i.musicas.artista ?? '')}</small>
              </span>
              <label class="musica__tom-campo">
                <span class="so-leitor">Tom de ${escapar(i.musicas.titulo)}</span>
                <input data-tom value="${escapar(i.tomFinal)}" maxlength="8" placeholder="Tom" />
              </label>
              <span class="musica__acoes">
                <button type="button" class="icone-botao icone-botao--mini" data-mover="-1" ${n === 0 ? 'disabled' : ''} aria-label="Subir ${escapar(i.musicas.titulo)}">↑</button>
                <button type="button" class="icone-botao icone-botao--mini" data-mover="1" ${n === itens.length - 1 ? 'disabled' : ''} aria-label="Descer ${escapar(i.musicas.titulo)}">↓</button>
                <a class="icone-botao icone-botao--mini" target="_blank" rel="noopener" href="${escapar(i.musicas.link || linkCifra(i.musicas))}"
                   aria-label="${i.musicas.link ? 'Abrir link' : 'Buscar cifra'} de ${escapar(i.musicas.titulo)}">${icone.seta(16)}</a>
                <button type="button" class="icone-botao icone-botao--mini icone-botao--perigo" data-tirar aria-label="Tirar ${escapar(i.musicas.titulo)}">×</button>
              </span>
            </li>`).join('') || `<li>${vazio('Busque abaixo ou cadastre a primeira música.')}</li>`}
        </ol>
      </section>

      <section class="secao">
        <h2>Adicionar música</h2>
        <div class="field">
          <label class="so-leitor" for="busca">Buscar música</label>
          <input id="busca" type="search" placeholder="Buscar por música ou artista" autocomplete="off" />
        </div>
        <div class="lista" id="resultados"></div>
        <details class="card" id="novaMusicaCaixa">
          <summary>${icone.mais()} Cadastrar música nova</summary>
          <form class="form" id="novaMusica" novalidate>
            <div class="field">
              <label for="mTitulo">Música</label>
              <input id="mTitulo" name="titulo" required maxlength="120" />
            </div>
            <div class="linha linha--sem-margem form-duas">
              <div class="field">
                <label for="mTom">Tom</label>
                <input id="mTom" name="tom" maxlength="8" placeholder="Ex.: G" />
              </div>
              <div class="field">
                <label for="mArtista">Artista</label>
                <input id="mArtista" name="artista" maxlength="120" />
              </div>
            </div>
            <div class="field">
              <label for="mLink">Link (cifra ou vídeo, opcional)</label>
              <input id="mLink" name="link" type="url" maxlength="500" placeholder="https://" />
            </div>
            <button class="btn btn-primary" type="submit">Cadastrar e adicionar</button>
          </form>
        </details>
      </section>

      <section class="secao">
        <h2>Usar nas datas</h2>
        <p class="texto-fraco">Toque numa data para aplicar este repertório. A equipe vê junto com a escala.</p>
        <div class="lista">
          ${eventos.map((e) => {
            const aqui = e.repertorio_id === rep.id;
            const outro = e.repertorio_id && !aqui ? e.repertorios?.nome : '';
            return `
              <div class="lista__item">
                <span class="lista__texto">
                  <strong>${escapar(e.titulo)}</strong>
                  <small>${escapar(formatarData(e.inicio))}${outro ? ` · usa “${escapar(outro)}”` : ''}</small>
                </span>
                <button type="button" class="chip" data-evento="${e.id}" data-status="${e.status}" aria-pressed="${aqui}">
                  ${aqui ? `${icone.check(16)} Usando` : outro ? 'Trocar' : 'Usar'}
                </button>
              </div>`;
          }).join('') || vazio('Nenhuma data por vir neste departamento.')}
        </div>
      </section>

      <section class="secao">
        <h2>Mais</h2>
        ${itens.length ? `
          <a class="btn btn-ghost" target="_blank" rel="noopener"
             href="${linkWhats(textoRepertorio(rep.nome, itens))}">${icone.whats()} Mandar no WhatsApp</a>` : ''}
        <form class="card form" id="renomear" novalidate>
          <div class="field">
            <label for="nomeRep">Nome do repertório</label>
            <div class="linha linha--sem-margem">
              <input id="nomeRep" name="nome" required maxlength="80" value="${escapar(rep.nome)}" />
              <button class="btn btn-ghost btn-sm" type="submit">Salvar</button>
            </div>
          </div>
        </form>
        <button class="btn btn-ghost btn-perigo" id="excluir">Excluir repertório</button>
      </section>
    </main>`);
  if (rolagem) window.scrollTo(0, rolagem);

  // ---------- Músicas da lista ----------
  const renumerar = async (ordem) => {
    const r = await Promise.all(ordem.map((id, n) => supabase.from('repertorio_itens').update({ ordem: n + 1 }).eq('id', id)));
    return r.find((x) => x.error) ?? { error: null };
  };

  document.querySelectorAll('[data-item]').forEach((linha) => {
    const id = linha.dataset.item;
    linha.querySelectorAll('[data-mover]').forEach((b) =>
      b.addEventListener('click', async () => {
        const ordem = itens.map((i) => i.id);
        const de = ordem.indexOf(id);
        const para = de + Number(b.dataset.mover);
        [ordem[de], ordem[para]] = [ordem[para], ordem[de]];
        const { error } = await comBotao(b, () => renumerar(ordem));
        if (error) return aviso(traduzirErro(error));
        recarregar();
      }));
    linha.querySelector('[data-tirar]').addEventListener('click', async (e) => {
      const { error } = await comBotao(e.currentTarget, () => supabase.from('repertorio_itens').delete().eq('id', id));
      if (error) return aviso(traduzirErro(error));
      recarregar();
    });
    linha.querySelector('[data-tom]').addEventListener('change', async (e) => {
      const tom = e.target.value.trim() || null;
      const { error } = await supabase.from('repertorio_itens').update({ tom }).eq('id', id);
      if (error) return aviso(traduzirErro(error));
      aviso('Tom salvo.');
    });
  });

  const adicionar = async (musicaId, botao) => {
    const { error } = await comBotao(botao, () => supabase.from('repertorio_itens')
      .insert({ repertorio_id: rep.id, musica_id: musicaId, ordem: itens.length + 1 }));
    if (error) return aviso(traduzirErro(error));
    recarregar();
  };

  // ---------- Busca na biblioteca da organização ----------
  const busca = document.querySelector('#busca');
  const resultados = document.querySelector('#resultados');
  const caixaNova = document.querySelector('#novaMusicaCaixa');
  busca.addEventListener('input', () => {
    const termo = sem(busca.value.trim());
    if (!termo) {
      resultados.innerHTML = '';
      return;
    }
    const achadas = biblioteca.filter((m) => !naLista.has(m.id) && sem(`${m.titulo} ${m.artista}`).includes(termo)).slice(0, 8);
    resultados.innerHTML = achadas.map((m) => `
      <div class="lista__item">
        <span class="lista__texto"><strong>${escapar(m.titulo)}</strong><small>${escapar(m.artista ?? '')}${m.tom ? ` · ${escapar(m.tom)}` : ''}</small></span>
        <button type="button" class="btn btn-ghost btn-sm" data-add="${m.id}">Adicionar</button>
      </div>`).join('') || `
      <p class="texto-fraco">Nenhuma música com “${escapar(busca.value.trim())}”.
        <button type="button" class="link-botao" id="cadastrarBusca">Cadastrar agora</button></p>`;
    resultados.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => adicionar(b.dataset.add, b)));
    resultados.querySelector('#cadastrarBusca')?.addEventListener('click', () => {
      caixaNova.open = true;
      document.querySelector('#mTitulo').value = busca.value.trim();
      document.querySelector('#mArtista').focus();
    });
  });

  document.querySelector('#novaMusica').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const titulo = f.titulo.value.trim();
    if (!titulo) return aviso('Informe o nome da música.');
    const link = f.link.value.trim();
    if (link && !/^https?:\/\//i.test(link)) return aviso('O link precisa começar com https://');
    const botao = f.querySelector('button');
    const { data, error } = await comBotao(botao, () => supabase.from('musicas').insert({
      organizacao_id: dep.organizacao_id, titulo, artista: f.artista.value.trim() || null,
      tom: f.tom.value.trim() || null, link: link || null
    }).select('id').single());
    if (error) return aviso(traduzirErro(error));
    adicionar(data.id, botao);
  });

  // ---------- Aplicar nas datas ----------
  document.querySelectorAll('[data-evento]').forEach((chip) =>
    chip.addEventListener('click', async () => {
      const aqui = chip.getAttribute('aria-pressed') === 'true';
      const { error } = await comBotao(chip, () =>
        supabase.rpc('aplicar_repertorio', { p_evento: chip.dataset.evento, p_repertorio: aqui ? null : rep.id }));
      if (error) return aviso(traduzirErro(error));
      // Escala já enviada: a equipe recebe o aviso do repertório
      if (!aqui && ['previa', 'publicado'].includes(chip.dataset.status)) {
        notificar('repertorio', { evento_id: chip.dataset.evento });
      }
      aviso(aqui ? 'Repertório tirado da data.' : 'Repertório aplicado!');
      recarregar();
    }));

  // ---------- Nome e exclusão ----------
  document.querySelector('#renomear').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Dê um nome.');
    const { error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('repertorios').update({ nome }).eq('id', rep.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Nome atualizado.');
    recarregar();
  });
  document.querySelector('#excluir').addEventListener('click', async (e) => {
    if (!confirm(`Excluir “${rep.nome}”? As datas que usam este repertório ficam sem repertório. As músicas continuam cadastradas.`)) return;
    const { error } = await comBotao(e.currentTarget, () => supabase.from('repertorios').delete().eq('id', rep.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Repertório excluído.');
    location.hash = `#/repertorios/${dep.id}`;
  });
}
