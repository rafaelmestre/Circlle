import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { escapar, casca, botaoVoltar, vazio, aviso, traduzirErro, comBotao, primeiroNome } from '../lib/ui.js';

const fmtQuando = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const quando = (iso) => fmtQuando.format(new Date(iso)).replace(/\./g, '').replace(' de ', ' ');

// Quem publica no mural: quem monta escalas ou repertórios naquele departamento
export const podePublicar = (ctx, depId) =>
  ctx.depsEscala.some((d) => d.id === depId) || ctx.depsRepertorio.some((d) => d.id === depId);

// Cartão de um aviso (usado no mural e no resumo do Início)
export const cartaoAviso = (a, acoes = '') => `
  <article class="card aviso-mural ${a.fixado ? 'aviso-mural--fixado' : ''}" data-aviso="${a.id}">
    ${a.fixado ? '<span class="aviso-mural__fixo">Fixado</span>' : ''}
    <h3 class="aviso-mural__titulo">${escapar(a.titulo)}</h3>
    ${a.corpo ? `<p class="aviso-mural__corpo">${escapar(a.corpo)}</p>` : ''}
    <small class="aviso-mural__meta">${escapar(primeiroNome(a.perfis?.nome ?? ''))} · ${escapar(quando(a.created_at))}</small>
    ${acoes}
  </article>`;

// Mural do departamento (RF30)
export async function telaMural(ctx, depId) {
  const dep = ctx.ativos.find((v) => v.departamento_id === depId)?.departamentos
    ?? ctx.depsEscala.find((d) => d.id === depId);
  if (!dep) {
    location.hash = '#/';
    return;
  }
  const publica = podePublicar(ctx, depId);
  const coordena = ctx.coordena(depId, dep.organizacao_id);

  const { data, error } = await supabase.from('avisos')
    .select('id, titulo, corpo, fixado, autor, created_at, perfis(nome)')
    .eq('departamento_id', depId)
    .order('fixado', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  if (error) aviso(traduzirErro(error));
  const avisos = data ?? [];

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${botaoVoltar('#/', 'Início')}
      <div class="titulo">
        <p class="passo">${escapar(dep.nome)}</p>
        <h1>Mural</h1>
      </div>

      ${publica ? `
        <details class="card" id="novoAvisoCaixa" ${avisos.length ? '' : 'open'}>
          <summary>Novo aviso</summary>
          <form class="form" id="novoAviso" novalidate>
            <div class="field">
              <label for="aTitulo">Título</label>
              <input id="aTitulo" name="titulo" required maxlength="100" placeholder="Ex.: Reunião dia 30 às 11h" />
            </div>
            <div class="field">
              <label for="aCorpo">Mensagem (opcional)</label>
              <textarea id="aCorpo" name="corpo" rows="4" maxlength="2000"
                placeholder="Ex.: vamos alinhar a organização e a capacitação da equipe."></textarea>
            </div>
            <label class="toggle">
              <input type="checkbox" name="fixado" />
              <span class="toggle__trilho" aria-hidden="true"></span>
              <span><strong>Fixar no topo</strong><small>Fica em destaque até alguém desafixar.</small></span>
            </label>
            <button class="btn btn-primary" type="submit">Publicar e avisar a equipe</button>
          </form>
        </details>` : ''}

      <section class="secao">
        ${avisos.map((a) => cartaoAviso(a, a.autor === ctx.usuario.id || coordena ? `
          <div class="acoes acoes--linha aviso-mural__acoes">
            <button class="link-botao" data-fixar="${!a.fixado}">${a.fixado ? 'Desafixar' : 'Fixar'}</button>
            <button class="link-botao link-botao--perigo" data-apagar>Apagar</button>
          </div>` : '')).join('') || vazio('Nenhum aviso por enquanto.')}
      </section>
    </main>`);

  document.querySelector('#novoAviso')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const titulo = f.titulo.value.trim();
    if (!titulo) return aviso('Dê um título ao aviso.');
    const { data: novo, error: erro } = await comBotao(f.querySelector('button'), () =>
      supabase.from('avisos').insert({
        departamento_id: depId, titulo, corpo: f.corpo.value.trim() || null, fixado: f.fixado.checked
      }).select('id').single());
    if (erro) return aviso(traduzirErro(erro));
    notificar('aviso', { aviso_id: novo.id });
    aviso('Aviso publicado!');
    telaMural(ctx, depId);
  });

  document.querySelectorAll('[data-aviso]').forEach((cartao) => {
    const id = cartao.dataset.aviso;
    cartao.querySelector('[data-fixar]')?.addEventListener('click', async (e) => {
      const fixar = e.currentTarget.dataset.fixar === 'true';
      const { error: erro } = await comBotao(e.currentTarget, () =>
        supabase.from('avisos').update({ fixado: fixar }).eq('id', id));
      if (erro) return aviso(traduzirErro(erro));
      telaMural(ctx, depId);
    });
    cartao.querySelector('[data-apagar]')?.addEventListener('click', async (e) => {
      if (!confirm('Apagar este aviso?')) return;
      const { error: erro } = await comBotao(e.currentTarget, () => supabase.from('avisos').delete().eq('id', id));
      if (erro) return aviso(traduzirErro(erro));
      telaMural(ctx, depId);
    });
  });
}
