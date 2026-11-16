import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { escapar, avatar, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao, linkWhats } from '../lib/ui.js';
import { linkGrupo } from '../lib/convite.js';
import { formAdicionarPessoa, ligarAdicionarPessoa } from '../lib/pessoaSemConta.js';

// Equipe do grupo: convite, pedidos, membros (com e sem conta) e ajustes
export async function telaDepartamento(ctx, depId, recarregarContexto) {
  const [depRes, membrosRes, funcoesRes, mfRes] = await Promise.all([
    supabase.from('departamentos').select('id, nome, codigo, ativo, pedir_disponibilidade, organizacao_id').eq('id', depId).maybeSingle(),
    supabase.from('membros_departamento').select('usuario_id, papel, perm_repertorio, perm_escala, status, perfis(nome, apelido, avatar_url, provisorio)').eq('departamento_id', depId).order('created_at'),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', depId).order('nome'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', depId)
  ]);

  const dep = depRes.data;
  if (!dep || !ctx.coordena(dep.id, dep.organizacao_id)) {
    location.hash = '#/';
    return aviso('Você não coordena este grupo.');
  }

  const funcoes = funcoesRes.data ?? [];
  const nomeFuncao = Object.fromEntries(funcoes.map((f) => [f.id, f.nome]));
  const funcoesDe = {};
  for (const mf of mfRes.data ?? []) (funcoesDe[mf.usuario_id] ??= new Set()).add(mf.funcao_id);
  const membros = membrosRes.data ?? [];
  const pendentes = membros.filter((m) => m.status === 'pendente');
  const ativos = membros.filter((m) => m.status === 'ativo')
    .sort((a, b) => Number(a.perfis?.provisorio ?? false) - Number(b.perfis?.provisorio ?? false));
  const semConta = ativos.filter((m) => m.perfis?.provisorio).length;
  const link = linkGrupo(dep.codigo);
  const textoConvite = `Entra no ${dep.nome} pelo Circlle, o app das nossas escalas: ${link}`;

  casca(ctx, 'escalas', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(`#/escalas/${dep.id}`)}
      <div class="titulo">
        <p class="passo">${escapar(dep.nome)}</p>
        <h1>Equipe e ajustes</h1>
      </div>

      <section class="card convite-grupo">
        <h2 class="convite-grupo__titulo">${icone.equipe(20)} Convide a banda</h2>
        <p class="texto-fraco">Mande o link no grupo do WhatsApp. Quem tocar nele cria a conta e pede para entrar; você aprova aqui.</p>
        <div class="acoes acoes--linha">
          <a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="${linkWhats(textoConvite)}">${icone.whats()} Mandar no WhatsApp</a>
          <button class="btn btn-ghost btn-sm" id="copiarLink">${icone.copiar()} Copiar link</button>
        </div>
        <p class="convite-grupo__codigo">Ou pelo código <strong>${escapar(dep.codigo)}</strong>
          <button class="link-botao" id="novoCodigo">gerar outro</button></p>
      </section>

      ${pendentes.length ? `
        <section class="secao">
          <h2>Pedidos para entrar <span class="contador">${pendentes.length}</span></h2>
          ${pendentes.map((m) => `
            <div class="card pedido" data-usuario="${m.usuario_id}">
              <div class="pessoa">
                ${avatar(m.perfis)}
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
        ${formAdicionarPessoa(funcoes)}
        <div class="lista">
          ${ativos.length ? ativos.map((m) => {
            const nomes = [...(funcoesDe[m.usuario_id] ?? [])].map((id) => nomeFuncao[id]).filter(Boolean).join(', ');
            const selos = [
              m.perfis?.provisorio ? '<span class="badge badge--pending">Sem conta</span>' : '',
              m.papel === 'coordenador' ? '<span class="badge badge--reassign">Coordenador</span>' : '',
              m.papel !== 'coordenador' && m.perm_escala ? '<span class="badge badge--confirmed">Escalas</span>' : '',
              m.papel !== 'coordenador' && m.perm_repertorio ? '<span class="badge badge--confirmed">Repertório</span>' : ''
            ].join('');
            return `
              <a class="lista__item lista__item--link" href="#/dep/${dep.id}/membro/${m.usuario_id}">
                ${avatar(m.perfis)}
                <span class="lista__texto">
                  <strong>${escapar(m.perfis?.nome ?? 'Sem nome')}${m.usuario_id === ctx.usuario.id ? ' (você)' : ''}</strong>
                  <small>${escapar(nomes || 'Sem função marcada')}</small>
                </span>
                ${selos}${icone.seta()}
              </a>`;
          }).join('') : vazio('Ninguém ainda. Mande o link no WhatsApp ou adicione as pessoas acima.')}
        </div>
        ${semConta ? `<p class="texto-fraco dica-lista">Quem está <strong>sem conta</strong> já pode ser escalado. Toque na pessoa para mandar o link pessoal: quando ela entrar, as escalas dela já aparecem.</p>` : ''}
      </section>

      <section class="secao">
        <h2>Ajustes do grupo</h2>
        <form class="card form" id="renomear" novalidate>
          <div class="field">
            <label for="nomeDep">Nome do grupo</label>
            <div class="linha linha--sem-margem">
              <input id="nomeDep" name="nome" required maxlength="60" value="${escapar(dep.nome)}" />
              <button class="btn btn-ghost btn-sm" type="submit">Salvar</button>
            </div>
          </div>
        </form>
        <div class="card form">
          <fieldset class="field">
            <legend>Funções</legend>
            <div class="chips">
              ${funcoes.map((f) => `
                <span class="chip chip--fixo">${escapar(f.nome)}
                  <button type="button" class="chip__x" data-remover-funcao="${f.id}" aria-label="Remover ${escapar(f.nome)}">×</button>
                </span>`).join('') || '<small class="dica">Nenhuma função ainda.</small>'}
            </div>
            <form class="linha" id="novaFuncao">
              <input name="nome" placeholder="Ex.: Saxofone, Violino, Percussão" maxlength="40" aria-label="Adicionar função" />
              <button class="btn btn-ghost btn-sm" type="submit">Adicionar</button>
            </form>
          </fieldset>

          <label class="toggle">
            <input type="checkbox" id="pedirDisp" ${dep.pedir_disponibilidade ? 'checked' : ''} />
            <span class="toggle__trilho" aria-hidden="true"></span>
            <span>
              <strong>Pedir disponibilidade antes de escalar</strong>
              <small>Ao criar datas, a banda é avisada para marcar em quais pode. Na hora de montar a escala,
              quem marcou aparece primeiro; quem não marcou ainda pode ser escalado, com um aviso.</small>
            </span>
          </label>
        </div>
      </section>
    </main>`);

  const recarregar = () => telaDepartamento(ctx, depId, recarregarContexto);
  const q = (sel) => document.querySelector(sel);

  // Convite
  q('#copiarLink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      aviso('Link copiado!');
    } catch {
      aviso(link);
    }
  });
  q('#novoCodigo').addEventListener('click', async (e) => {
    if (!confirm('Gerar outro código? O link e o código atuais deixam de funcionar.')) return;
    const { error } = await comBotao(e.currentTarget, () => supabase.rpc('novo_codigo', { p_dep: dep.id }));
    if (error) return aviso(traduzirErro(error));
    aviso('Novo link gerado.');
    recarregar();
  });

  // Pessoa sem conta
  ligarAdicionarPessoa(document, dep.id, (pessoa) => {
    aviso(`${pessoa.nome} entrou no grupo. Já dá para escalar.`);
    location.hash = `#/dep/${dep.id}/membro/${pessoa.id}`;
  });

  // Nome do grupo
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

  // Funções
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

  // Escala livre ou com disponibilidade
  q('#pedirDisp').addEventListener('change', async (e) => {
    const { error } = await supabase.from('departamentos').update({ pedir_disponibilidade: e.target.checked }).eq('id', dep.id);
    if (error) {
      e.target.checked = !e.target.checked;
      return aviso(traduzirErro(error));
    }
    aviso(e.target.checked ? 'A banda vai ser avisada para marcar disponibilidade.' : 'Escala livre: você escala direto.');
    recarregarContexto();
  });

}
