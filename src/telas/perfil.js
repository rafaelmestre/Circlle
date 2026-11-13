import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, casca, icone, vazio, aviso, traduzirErro, comBotao } from '../lib/ui.js';

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

  casca(ctx, 'perfil', `
    <main class="tela tela--com-nav">
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
        <h2>O que eu faço</h2>
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

      <section class="secao">
        <h2>Conta</h2>
        <button class="btn btn-ghost" id="sair">Sair</button>
        <button class="btn btn-ghost btn-perigo" id="excluir">Excluir minha conta</button>
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

  document.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
  document.querySelector('#excluir').addEventListener('click', async (e) => {
    if (!confirm('Excluir sua conta e todos os seus dados? Isso não pode ser desfeito.')) return;
    const { error } = await comBotao(e.currentTarget, () => supabase.rpc('excluir_minha_conta'));
    if (error) return aviso(traduzirErro(error));
    await supabase.auth.signOut();
  });
}
