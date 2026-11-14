import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { escapar, iniciais, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao, termos } from '../lib/ui.js';


// Equipe do departamento: código, pedidos, membros e ajustes (RF11, RF12, RF14–RF16)
export async function telaDepartamento(ctx, depId, recarregarContexto) {
  const [depRes, membrosRes, funcoesRes, mfRes] = await Promise.all([
    supabase.from('departamentos').select('id, nome, codigo, ativo, modulo_repertorio, organizacao_id, organizacoes(nome, termo_departamento, termo_evento, termo_funcao)').eq('id', depId).maybeSingle(),
    supabase.from('membros_departamento').select('usuario_id, papel, perm_repertorio, perm_escala, status, perfis(nome)').eq('departamento_id', depId).order('created_at'),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', depId).order('nome'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', depId)
  ]);

  const dep = depRes.data;
  if (!dep || !ctx.coordena(dep.id, dep.organizacao_id)) {
    location.hash = '#/';
    return aviso('Você não coordena este departamento.');
  }

  const admin = ctx.ehAdmin(dep.organizacao_id);
  const t = termos(dep.organizacoes);
  const funcoes = funcoesRes.data ?? [];
  const nomeFuncao = Object.fromEntries(funcoes.map((f) => [f.id, f.nome]));
  const funcoesDe = {};
  for (const mf of mfRes.data ?? []) (funcoesDe[mf.usuario_id] ??= new Set()).add(mf.funcao_id);
  const membros = membrosRes.data ?? [];
  const pendentes = membros.filter((m) => m.status === 'pendente');
  const ativos = membros.filter((m) => m.status === 'ativo');
  const textoConvite = `Entre em ${dep.nome} (${dep.organizacoes.nome}) pelo app Circlle: ${location.origin} — código ${dep.codigo}`;

  casca(ctx, ctx.depsEscala.some((d) => d.id === dep.id) ? 'escalas' : 'org', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(admin && !ctx.depsEscala.some((d) => d.id === dep.id) ? `#/org/${dep.organizacao_id}` : `#/escalas/${dep.id}`)}
      <div class="titulo">
        <p class="passo">${escapar(dep.nome)}</p>
        <h1>Equipe e ajustes</h1>
      </div>

      ${dep.ativo ? '' : `
        <section class="card aviso-card desativado">
          <span><strong>Desativado.</strong> Ninguém vê as datas daqui até você reativar.</span>
          <button class="btn btn-primary btn-sm" id="reativar">Reativar</button>
        </section>`}

      <section class="card codigo">
        <span class="codigo__rotulo">Código para entrar</span>
        <strong class="codigo__valor">${escapar(dep.codigo)}</strong>
        <div class="acoes acoes--linha">
          <button class="btn btn-ghost btn-sm" id="copiar">${icone.copiar()} Copiar</button>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
             href="https://wa.me/?text=${encodeURIComponent(textoConvite)}">${icone.whats()} WhatsApp</a>
          <button class="btn btn-ghost btn-sm" id="novoCodigo">${icone.girar()} Novo</button>
        </div>
      </section>

      ${pendentes.length ? `
        <section class="secao">
          <h2>Pedidos para entrar <span class="contador">${pendentes.length}</span></h2>
          ${pendentes.map((m) => `
            <div class="card pedido" data-usuario="${m.usuario_id}">
              <div class="pessoa">
                <span class="avatar" aria-hidden="true">${escapar(iniciais(m.perfis?.nome))}</span>
                <strong class="pessoa__nome">${escapar(m.perfis?.nome ?? 'Sem nome')}</strong>
              </div>
              <div class="chips" role="group" aria-label="Funções">
                ${funcoes.map((f) => `
                  <button type="button" class="chip" data-funcao="${f.id}" aria-pressed="${funcoesDe[m.usuario_id]?.has(f.id) ?? false}">
                    ${escapar(f.nome)}
                  </button>`).join('')}
              </div>
              <div class="acoes acoes--linha">
                <button class="btn btn-ghost btn-sm" data-acao="recusar">Recusar</button>
                <button class="btn btn-primary btn-sm" data-acao="aprovar">Aprovar</button>
              </div>
            </div>`).join('')}
        </section>` : ''}

      <section class="secao">
        <h2>Membros <span class="contador">${ativos.length}</span></h2>
        <div class="lista">
          ${ativos.length ? ativos.map((m) => {
            const nomes = [...(funcoesDe[m.usuario_id] ?? [])].map((id) => nomeFuncao[id]).filter(Boolean).join(', ');
            const selos = [
              m.papel === 'coordenador' ? '<span class="badge badge--reassign">Coordenador</span>' : '',
              m.papel !== 'coordenador' && m.perm_escala ? '<span class="badge badge--confirmed">Escalas</span>' : '',
              m.papel !== 'coordenador' && dep.modulo_repertorio && m.perm_repertorio ? '<span class="badge badge--confirmed">Repertório</span>' : ''
            ].join('');
            return `
              <a class="lista__item lista__item--link" href="#/dep/${dep.id}/membro/${m.usuario_id}">
                <span class="avatar" aria-hidden="true">${escapar(iniciais(m.perfis?.nome))}</span>
                <span class="lista__texto">
                  <strong>${escapar(m.perfis?.nome ?? 'Sem nome')}${m.usuario_id === ctx.usuario.id ? ' (você)' : ''}</strong>
                  <small>${escapar(nomes || 'Sem função marcada')}</small>
                </span>
                ${selos}${icone.seta()}
              </a>`;
          }).join('') : vazio('Ninguém aprovado ainda. Mande o código pelo WhatsApp.')}
        </div>
      </section>

      <section class="secao">
        <h2>Configurações</h2>
        <form class="card form" id="renomear" novalidate>
          <div class="field">
            <label for="nomeDep">Nome</label>
            <div class="linha linha--sem-margem">
              <input id="nomeDep" name="nome" required maxlength="60" value="${escapar(dep.nome)}" />
              <button class="btn btn-ghost btn-sm" type="submit">Salvar</button>
            </div>
          </div>
        </form>
        <div class="card form">
          <fieldset class="field">
            <legend>${escapar(t.funcoes)}</legend>
            <div class="chips">
              ${funcoes.map((f) => `
                <span class="chip chip--fixo">${escapar(f.nome)}
                  <button type="button" class="chip__x" data-remover-funcao="${f.id}" aria-label="Remover ${escapar(f.nome)}">×</button>
                </span>`).join('') || '<small class="dica">Nenhuma função ainda.</small>'}
            </div>
            <form class="linha" id="novaFuncao">
              <input name="nome" placeholder="Ex.: Violão, Câmera, Recepção" maxlength="40" aria-label="Adicionar ${escapar(t.funcao_)}" />
              <button class="btn btn-ghost btn-sm" type="submit">Adicionar</button>
            </form>
          </fieldset>

          <label class="toggle">
            <input type="checkbox" id="repertorio" ${dep.modulo_repertorio ? 'checked' : ''} />
            <span class="toggle__trilho" aria-hidden="true"></span>
            <span>
              <strong>Usa repertório de músicas</strong>
              <small>Libera músicas, tons e cifras. Coordenadores sempre podem montar o repertório.</small>
            </span>
          </label>
        </div>
        ${admin && dep.ativo ? `
          <button class="btn btn-ghost btn-perigo" id="desativar">Desativar ${escapar(dep.nome)}</button>` : ''}
      </section>
    </main>`);

  const recarregar = () => telaDepartamento(ctx, depId, recarregarContexto);
  const q = (sel) => document.querySelector(sel);

  // Código
  q('#copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(dep.codigo);
      aviso('Código copiado!');
    } catch {
      aviso(`Código: ${dep.codigo}`);
    }
  });
  q('#novoCodigo').addEventListener('click', async (e) => {
    if (!confirm('Gerar um novo código? O código atual deixa de funcionar.')) return;
    const { error } = await comBotao(e.currentTarget, () => supabase.rpc('novo_codigo', { p_dep: dep.id }));
    if (error) return aviso(traduzirErro(error));
    aviso('Novo código gerado.');
    recarregar();
  });

  // Nome do departamento (coordenador e administrador)
  q('#renomear').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Dê um nome.');
    if (nome === dep.nome) return;
    const { error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('departamentos').update({ nome }).eq('id', dep.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Nome atualizado.');
    recarregarContexto();
  });

  // Desativar e reativar (só o administrador)
  q('#desativar')?.addEventListener('click', async (e) => {
    if (!confirm(`Desativar ${dep.nome}? Ele some do app de todos os membros, mas nada é apagado. Dá para reativar depois.`)) return;
    const { error } = await comBotao(e.currentTarget, () =>
      supabase.from('departamentos').update({ ativo: false }).eq('id', dep.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Desativado.');
    location.hash = `#/org/${dep.organizacao_id}`;
    recarregarContexto();
  });
  q('#reativar')?.addEventListener('click', async (e) => {
    const { error } = await comBotao(e.currentTarget, () =>
      supabase.from('departamentos').update({ ativo: true }).eq('id', dep.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Reativado!');
    recarregarContexto();
  });

  // Pedidos: ajustar funções e aprovar (RF14)
  document.querySelectorAll('.pedido').forEach((cartao) => {
    const usuario = cartao.dataset.usuario;
    cartao.querySelectorAll('[data-funcao]').forEach((chip) =>
      chip.addEventListener('click', () =>
        chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true')))
    );
    cartao.querySelector('[data-acao="aprovar"]').addEventListener('click', async (e) => {
      const marcadas = [...cartao.querySelectorAll('[data-funcao][aria-pressed="true"]')].map((c) => c.dataset.funcao);
      const resultado = await comBotao(e.currentTarget, async () => {
        const r1 = await supabase.from('membro_funcoes').delete().eq('departamento_id', dep.id).eq('usuario_id', usuario);
        if (r1.error) return r1;
        if (marcadas.length) {
          const r2 = await supabase.from('membro_funcoes').insert(
            marcadas.map((funcao_id) => ({ departamento_id: dep.id, usuario_id: usuario, funcao_id })));
          if (r2.error) return r2;
        }
        return supabase.from('membros_departamento').update({ status: 'ativo' })
          .eq('departamento_id', dep.id).eq('usuario_id', usuario);
      });
      if (resultado.error) return aviso(traduzirErro(resultado.error));
      notificar('entrada_aprovada', { departamento_id: dep.id, usuario_id: usuario });
      aviso('Membro aprovado!');
      recarregar();
    });
    cartao.querySelector('[data-acao="recusar"]').addEventListener('click', async (e) => {
      if (!confirm('Recusar este pedido?')) return;
      const { error } = await comBotao(e.currentTarget, () =>
        supabase.from('membros_departamento').delete().eq('departamento_id', dep.id).eq('usuario_id', usuario));
      if (error) return aviso(traduzirErro(error));
      aviso('Pedido recusado.');
      recarregar();
    });
  });

  // Funções do departamento
  q('#novaFuncao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return;
    const { error } = await supabase.from('funcoes').insert({ departamento_id: dep.id, nome });
    if (error) return aviso(traduzirErro(error));
    recarregar();
  });
  document.querySelectorAll('[data-remover-funcao]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Remover esta função? Ela sai também do perfil de quem a marcou.')) return;
      const { error } = await supabase.from('funcoes').delete().eq('id', b.dataset.removerFuncao);
      if (error) return aviso(traduzirErro(error));
      recarregar();
    })
  );

  q('#repertorio').addEventListener('change', async (e) => {
    const { error } = await supabase.from('departamentos').update({ modulo_repertorio: e.target.checked }).eq('id', dep.id);
    if (error) {
      e.target.checked = !e.target.checked;
      return aviso(traduzirErro(error));
    }
    recarregarContexto();
  });
}
