import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, casca, icone, vazio, aviso, traduzirErro, comBotao, botaoVoltar } from '../lib/ui.js';
import { estadoNotificacoes, ativarNotificacoes, desativarNotificacoes } from '../lib/notificacoes.js';

// Perfil: nome, departamentos e o que faz em cada um (RF02, RF03, RF04)
export async function telaPerfil(ctx, recarregarContexto) {
  const deps = ctx.vinculos.map((v) => v.departamento_id);
  const [funcoesRes, minhasRes] = deps.length
    ? await Promise.all([
        supabase.from('funcoes').select('id, nome, departamento_id').in('departamento_id', deps).order('nome'),
        supabase.from('membro_funcoes').select('funcao_id').eq('usuario_id', ctx.usuario.id)
      ])
    : [{ data: [] }, { data: [] }];

  const minhas = new Set((minhasRes.data ?? []).map((m) => m.funcao_id));
  const funcoesPorDep = {};
  for (const f of funcoesRes.data ?? []) (funcoesPorDep[f.departamento_id] ??= []).push(f);

  const push = await estadoNotificacoes();

  casca(ctx, 'perfil', `
    <main class="tela tela--com-nav">
      ${botaoVoltar('#/', 'Voltar')}
      <div class="perfil__cab">
        <span class="avatar avatar--grande" aria-hidden="true">${escapar(iniciais(ctx.perfil.nome))}</span>
        <div>
          <h1>${escapar(ctx.perfil.nome)}</h1>
          <p class="texto-fraco">${escapar(ctx.usuario.email)}</p>
        </div>
      </div>

      <form class="form card" id="dados" novalidate>
        <div class="field">
          <label for="nome">Seu nome</label>
          <input id="nome" name="nome" required maxlength="80" autocomplete="name" value="${escapar(ctx.perfil.nome)}" />
        </div>
        <button class="btn btn-ghost" type="submit">Salvar nome</button>
      </form>

      <section class="secao">
        <h2>Meus grupos e o que eu faço</h2>
        <p class="texto-fraco">O coordenador usa isso para montar a escala. Toque para marcar ou desmarcar.</p>
        ${ctx.vinculos.length ? ctx.vinculos.map((v) => `
          <div class="card">
            <div class="equipe__cab">
              <div>
                <p class="equipe__org">${escapar(v.departamentos.organizacoes.nome)}</p>
                <h2 class="cartao__titulo">${escapar(v.departamentos.nome)}</h2>
              </div>
              ${v.status === 'pendente' ? '<span class="badge badge--pending">Aguardando</span>'
                : v.papel === 'coordenador' ? '<span class="badge badge--reassign">Coordenador</span>' : ''}
            </div>
            <div class="chips">
              ${(funcoesPorDep[v.departamento_id] ?? []).map((f) => `
                <button type="button" class="chip" data-dep="${v.departamento_id}" data-funcao="${f.id}" aria-pressed="${minhas.has(f.id)}">
                  ${escapar(f.nome)}
                </button>`).join('') || '<small class="dica">O departamento ainda não tem funções.</small>'}
            </div>
          </div>`).join('') : vazio('Você ainda não participa de nenhum departamento.')}
        <a class="btn btn-ghost" href="#/entrar">${icone.mais()} Entrar com código</a>
      </section>

      ${push === 'sem_configuracao' ? '' : `
        <section class="secao">
          <h2>Notificações</h2>
          <div class="card" id="notificacoes">${blocoNotificacoes(push)}</div>
        </section>`}

      <section class="secao">
        <h2>Conta</h2>
        <button class="btn btn-ghost" id="sair">Sair</button>
        <a class="btn btn-ghost" href="#/termos">Termos de uso e privacidade</a>
        <button class="btn btn-ghost btn-perigo" id="excluir">Excluir minha conta</button>
        <p class="texto-fraco dica-excluir">Excluir apaga na hora seu perfil, suas escalas, respostas e datas marcadas. Avisos e músicas que você cadastrou ficam com o grupo, sem o seu nome.</p>
      </section>
    </main>`);

  document.querySelector('#dados').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Informe seu nome.');
    const { error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('perfis').update({ nome }).eq('id', ctx.usuario.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Nome atualizado.');
    recarregarContexto();
  });

  document.querySelectorAll('[data-funcao]').forEach((chip) =>
    chip.addEventListener('click', async () => {
      const marcado = chip.getAttribute('aria-pressed') === 'true';
      const { funcao, dep } = chip.dataset;
      const { error } = await comBotao(chip, () => marcado
        ? supabase.from('membro_funcoes').delete().eq('usuario_id', ctx.usuario.id).eq('funcao_id', funcao)
        : supabase.from('membro_funcoes').insert({ departamento_id: dep, usuario_id: ctx.usuario.id, funcao_id: funcao }));
      if (error) return aviso(traduzirErro(error));
      chip.setAttribute('aria-pressed', String(!marcado));
    })
  );

  // Notificações deste aparelho (RF36)
  const caixaPush = document.querySelector('#notificacoes');
  const ligarPush = () => caixaPush?.querySelector('#push')?.addEventListener('change', async (e) => {
    const campo = e.currentTarget;
    campo.disabled = true;
    const { error } = campo.checked ? await ativarNotificacoes() : await desativarNotificacoes();
    if (error) {
      aviso(error.message === 'Notificações bloqueadas'
        ? 'As notificações estão bloqueadas. Libere nas configurações do navegador.'
        : 'Não foi possível mudar agora. Tente de novo.');
    } else {
      aviso(campo.checked ? 'Notificações ativadas neste aparelho.' : 'Notificações desativadas neste aparelho.');
    }
    caixaPush.innerHTML = blocoNotificacoes(await estadoNotificacoes());
    ligarPush();
  });
  ligarPush();

  // Ao sair, o aparelho para de receber os avisos desta conta
  document.querySelector('#sair').addEventListener('click', async (e) => {
    await comBotao(e.currentTarget, () => desativarNotificacoes().catch(() => {}));
    supabase.auth.signOut();
  });
  document.querySelector('#excluir').addEventListener('click', async (e) => {
    if (!confirm('Excluir sua conta e todos os seus dados? Isso não pode ser desfeito.')) return;
    const { error } = await comBotao(e.currentTarget, async () => {
      await desativarNotificacoes().catch(() => {});
      return supabase.rpc('excluir_minha_conta');
    });
    if (error) {
      const org = /Único administrador: (.+)/.exec(error.message ?? '')?.[1];
      return aviso(org
        ? `Você é o único administrador de “${org}”. Fale com o Circlle para passar a administração e depois exclua a conta.`
        : traduzirErro(error));
    }
    aviso('Sua conta foi excluída.');
    await supabase.auth.signOut();
  });
}

// Estado das notificações neste aparelho
function blocoNotificacoes(estado) {
  if (estado === 'instalar') {
    return `
      <p class="texto-fraco">No iPhone, as notificações funcionam com o Circlle instalado:
      toque em <b>Compartilhar</b>, depois em <b>Adicionar à Tela de Início</b>, e abra pelo ícone.</p>`;
  }
  if (estado === 'indisponivel') {
    return '<p class="texto-fraco">Este navegador não recebe notificações. Instale o Circlle ou use o Chrome, Edge ou Safari atualizado.</p>';
  }
  if (estado === 'bloqueado') {
    return '<p class="texto-fraco">As notificações estão bloqueadas para o Circlle. Libere nas configurações do navegador e volte aqui.</p>';
  }
  return `
    <label class="toggle">
      <input type="checkbox" id="push" ${estado === 'ativo' ? 'checked' : ''} />
      <span class="toggle__trilho" aria-hidden="true"></span>
      <span>
        <strong>Avisos neste aparelho</strong>
        <small>Prévia, escala publicada, datas abertas e pedidos de ajuste.</small>
      </span>
    </label>`;
}
