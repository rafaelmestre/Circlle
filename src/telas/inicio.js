import { supabase } from '../lib/supabase.js';
import { htmlPainelPlataforma } from './painelPlataforma.js';
import { estadoNotificacoes, ativarNotificacoes } from '../lib/notificacoes.js';
import { escapar, primeiroNome, iniciais, formatarData, diaMes, casca, icone, vazio, aviso, traduzirErro, comBotao, nomesFuncoes, termos } from '../lib/ui.js';

// Painel do membro (RF33): próxima escala, datas abertas e departamentos
export async function telaInicio(ctx) {
  const agora = new Date().toISOString();
  const depsAtivos = ctx.ativos.map((v) => v.departamento_id);

  const [escalasRes, abertosRes, dispRes] = await Promise.all([
    supabase.from('escalas')
      .select('id, resposta, escala_funcoes(funcoes(nome)), eventos!inner(id, titulo, local, inicio, status, departamentos(nome))')
      .eq('usuario_id', ctx.usuario.id)
      .in('eventos.status', ['previa', 'publicado'])
      .gte('eventos.inicio', agora),
    depsAtivos.length
      ? supabase.from('eventos')
          .select('id, titulo, local, inicio, departamento_id, departamentos(nome)')
          .in('departamento_id', depsAtivos)
          .eq('status', 'aberto')
          .gte('inicio', agora)
          .order('inicio')
      : { data: [] },
    supabase.from('disponibilidades').select('evento_id').eq('usuario_id', ctx.usuario.id)
  ]);

  const proximas = (escalasRes.data ?? [])
    .sort((a, b) => a.eventos.inicio.localeCompare(b.eventos.inicio));
  const abertos = abertosRes.data ?? [];
  const marcados = new Set((dispRes.data ?? []).map((d) => d.evento_id));
  const pendentes = ctx.vinculos.filter((v) => v.status === 'pendente');

  const destaque = proximas[0];
  const aguardando = proximas.filter((e) => e.resposta === 'pendente').length;
  const blocoDestaque = destaque ? `
    <section class="destaque">
      <span class="destaque__rotulo">
        Sua próxima escala${destaque.eventos.status === 'previa' ? ' · <span class="destaque__tag">prévia</span>' : ''}
      </span>
      <strong class="destaque__titulo">${escapar(destaque.eventos.titulo)}</strong>
      <span>${escapar(formatarData(destaque.eventos.inicio))}</span>
      <span>${escapar(destaque.eventos.departamentos.nome)} · ${escapar(nomesFuncoes(destaque))}</span>
      <div class="destaque__acoes">
        ${destaque.resposta === 'pendente'
          ? `<button class="btn btn-sm destaque__btn" id="confirmarProxima">${icone.check(16)} Confirmo</button>`
          : `<span class="destaque__estado">${destaque.resposta === 'confirmado' ? `${icone.check(16)} Você confirmou` : 'Você pediu ajuste'}</span>`}
        <a class="btn btn-sm destaque__link" href="#/evento/${destaque.eventos.id}">Ver escala</a>
      </div>
    </section>` : depsAtivos.length ? `
    <section class="card vazio-guia">
      <h2 class="cartao__titulo">Você ainda não está em nenhuma escala</h2>
      <p class="texto-fraco">Marque abaixo os dias em que você pode ir. O coordenador monta a escala com quem marcou, e ela aparece aqui.</p>
    </section>` : '';

  const linhaEvento = (e, extra = '') => {
    const { dia, mes } = diaMes(e.inicio);
    return `
      <div class="data">
        <div class="data__dia"><strong>${dia}</strong><span>${escapar(mes)}</span></div>
        <div class="data__info">
          <strong>${escapar(e.titulo)}</strong>
          <span>${escapar(formatarData(e.inicio).split(' · ')[1])} · ${escapar(e.departamentos?.nome ?? '')}${e.local ? ` · ${escapar(e.local)}` : ''}</span>
        </div>
        ${extra}
      </div>`;
  };

  const meusDeps = ctx.vinculos.map((v) => {
    const d = v.departamentos;
    const coord = ctx.coordena(d.id, d.organizacao_id);
    const rotulo = v.status === 'pendente' ? '<span class="badge badge--pending">Aguardando</span>'
      : coord ? '<span class="badge badge--reassign">Coordenador</span>'
      : v.perm_repertorio ? '<span class="badge badge--confirmed">Repertório</span>' : '';
    const conteudo = `
      <span class="avatar" aria-hidden="true">${escapar(iniciais(d.nome))}</span>
      <span class="lista__texto"><strong>${escapar(d.nome)}</strong><small>${escapar(d.organizacoes.nome)}</small></span>
      ${rotulo}`;
    return coord
      ? `<a class="lista__item lista__item--link" href="#/dep/${d.id}">${conteudo}${icone.seta()}</a>`
      : `<div class="lista__item">${conteudo}</div>`;
  });

  // Admin sem vínculo direto: atalhos para os departamentos da organização
  const ids = new Set(ctx.vinculos.map((v) => v.departamento_id));
  let depsAdmin = [];
  if (ctx.orgsAdmin.length) {
    const { data } = await supabase.from('departamentos')
      .select('id, nome, organizacoes(nome)')
      .in('organizacao_id', ctx.orgsAdmin.map((o) => o.id))
      .eq('ativo', true).order('nome');
    depsAdmin = (data ?? []).filter((d) => !ids.has(d.id));
  }

  const painel = ctx.plataforma ? await htmlPainelPlataforma() : '';

  // Se todos os vínculos são de um grupo só, usa as palavras dele (RF09)
  const orgs = new Map([...ctx.vinculos.map((v) => v.departamentos.organizacoes), ...ctx.orgsAdmin].map((o) => [o.id, o]));
  const t = termos(orgs.size === 1 ? [...orgs.values()][0] : null);

  // Convite para ligar as notificações (some quando a pessoa ativa ou dispensa)
  const CHAVE_CONVITE = 'circlle:convite-notificacoes';
  let dispensado = false;
  try { dispensado = localStorage.getItem(CHAVE_CONVITE) === '1'; } catch { /* sem armazenamento */ }
  const push = ctx.vinculos.length && !dispensado ? await estadoNotificacoes() : 'indisponivel';
  const blocoPush = push === 'inativo' ? `
    <section class="card convite-push">
      <span class="icon-circle">${icone.sino()}</span>
      <div class="convite-push__texto">
        <strong>Receba os avisos no celular</strong>
        <small>Prévia, escala publicada e datas abertas chegam na hora.</small>
      </div>
      <div class="acoes acoes--linha">
        <button class="btn btn-ghost btn-sm" data-dispensar>Agora não</button>
        <button class="btn btn-primary btn-sm" id="ativarPush">Ativar</button>
      </div>
    </section>` : push === 'instalar' ? `
    <section class="card convite-push">
      <span class="icon-circle">${icone.sino()}</span>
      <div class="convite-push__texto">
        <strong>Quer os avisos no iPhone?</strong>
        <small>Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra o Circlle pelo ícone e ative as notificações no Perfil.</small>
      </div>
      <div class="acoes acoes--linha">
        <button class="btn btn-ghost btn-sm" data-dispensar>Entendi</button>
      </div>
    </section>` : '';

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      <header class="topo">
        <div class="topo__saudacao">
          <img src="/favicon.svg" alt="Circlle" class="topo__logo" />
          <div>
            <small>Olá,</small>
            <h1>${escapar(primeiroNome(ctx.perfil.nome))}</h1>
          </div>
        </div>
        <a class="avatar avatar--link" href="#/perfil" aria-label="Meu perfil">${escapar(iniciais(ctx.perfil.nome))}</a>
      </header>

      ${painel}

      ${blocoDestaque}

      ${blocoPush}

      ${pendentes.length ? `
        <p class="card aviso-card">Seu pedido para entrar em <strong>${pendentes.map((p) => escapar(p.departamentos.nome)).join(', ')}</strong>
        está com o coordenador. Assim que ele aprovar, as datas aparecem aqui.</p>` : ''}

      ${proximas.length > 1 ? `
        <a class="lista__item lista__item--link atalho-calendario" href="#/calendario">
          <span class="icon-circle">${icone.calendario()}</span>
          <span class="lista__texto">
            <strong>Mais ${proximas.length - 1} ${proximas.length - 1 === 1 ? 'escala' : 'escalas'} pela frente</strong>
            <small>${aguardando > (destaque.resposta === 'pendente' ? 1 : 0)
              ? `${aguardando} ${aguardando === 1 ? 'espera' : 'esperam'} sua resposta · ver no calendário`
              : 'Ver todas no calendário'}</small>
          </span>
          ${icone.seta()}
        </a>` : ''}

      ${depsAtivos.length ? `
        <section class="secao">
          <h2>Datas abertas</h2>
          <p class="texto-fraco">Marque os dias em que você pode. O coordenador monta a escala a partir disso.</p>
          <div class="lista">
            ${abertos.length ? abertos.map((e) => {
              const marcado = marcados.has(e.id);
              return `<div class="lista__item">${linhaEvento(e, `
                <button class="chip chip--posso" data-evento="${e.id}" aria-pressed="${marcado}">
                  ${marcado ? `${icone.check(16)} Posso` : 'Posso'}
                </button>`)}</div>`;
            }).join('') : vazio('Nenhuma data aberta agora.')}
          </div>
        </section>` : ''}

      <section class="secao">
        <h2>Meus ${escapar(t.deps_)}</h2>
        <div class="lista">
          ${meusDeps.join('') || ''}
          ${depsAdmin.map((d) => `
            <a class="lista__item lista__item--link" href="#/dep/${d.id}">
              <span class="avatar" aria-hidden="true">${escapar(iniciais(d.nome))}</span>
              <span class="lista__texto"><strong>${escapar(d.nome)}</strong><small>${escapar(d.organizacoes.nome)}</small></span>
              <span class="badge badge--reassign">Admin</span>${icone.seta()}
            </a>`).join('')}
          ${!meusDeps.length && !depsAdmin.length ? vazio('Nada por aqui ainda.') : ''}
        </div>
        <a class="btn btn-ghost" href="#/entrar">${icone.mais()} Entrar com código</a>
      </section>
    </main>`);

  document.querySelector('#confirmarProxima')?.addEventListener('click', async (e) => {
    const { error } = await comBotao(e.currentTarget, () =>
      supabase.rpc('responder_escala', { p_evento: destaque.eventos.id, p_resposta: 'confirmado', p_motivo: null }));
    if (error) return aviso(traduzirErro(error));
    aviso('Presença confirmada!');
    telaInicio(ctx);
  });

  const fecharConvite = () => {
    try { localStorage.setItem(CHAVE_CONVITE, '1'); } catch { /* sem armazenamento */ }
    document.querySelector('.convite-push')?.remove();
  };
  document.querySelector('[data-dispensar]')?.addEventListener('click', fecharConvite);
  document.querySelector('#ativarPush')?.addEventListener('click', async (e) => {
    const { error } = await comBotao(e.currentTarget, ativarNotificacoes);
    if (error) {
      return aviso(error.message === 'Notificações bloqueadas'
        ? 'As notificações estão bloqueadas no navegador. Libere nas configurações do site.'
        : 'Não foi possível ativar agora. Tente pelo Perfil.');
    }
    fecharConvite();
    aviso('Pronto! Você vai receber os avisos neste aparelho.');
  });

  // Marcar / desmarcar disponibilidade (RF19, RF20)
  document.querySelectorAll('[data-evento]').forEach((botao) =>
    botao.addEventListener('click', async () => {
      const id = botao.dataset.evento;
      const marcado = botao.getAttribute('aria-pressed') === 'true';
      const { error } = await comBotao(botao, () => marcado
        ? supabase.from('disponibilidades').delete().eq('evento_id', id).eq('usuario_id', ctx.usuario.id)
        : supabase.from('disponibilidades').insert({ evento_id: id, usuario_id: ctx.usuario.id }));
      if (error) return aviso(traduzirErro(error));
      botao.setAttribute('aria-pressed', String(!marcado));
      botao.innerHTML = !marcado ? `${icone.check(16)} Posso` : 'Posso';
    })
  );
}
