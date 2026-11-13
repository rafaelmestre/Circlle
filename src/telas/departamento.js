import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, formatarData, diaMes, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao, STATUS_EVENTO } from '../lib/ui.js';


const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

// Agrupa as datas por mês: [["Dezembro de 2026", [...]], ...]
function meses(eventos) {
  const grupos = new Map();
  for (const e of eventos) {
    const nome = fmtMes.format(new Date(e.inicio));
    const chave = nome.charAt(0).toUpperCase() + nome.slice(1);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(e);
  }
  return [...grupos.entries()];
}

// Painel do coordenador (RF11, RF12, RF14–RF16, RF34)
export async function telaDepartamento(ctx, depId, recarregarContexto) {
  const [depRes, membrosRes, funcoesRes, mfRes, eventosRes] = await Promise.all([
    supabase.from('departamentos').select('id, nome, codigo, modulo_repertorio, organizacao_id, organizacoes(nome)').eq('id', depId).maybeSingle(),
    supabase.from('membros_departamento').select('usuario_id, papel, perm_repertorio, status, perfis(nome)').eq('departamento_id', depId).order('created_at'),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', depId).order('nome'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', depId),
    supabase.from('eventos').select('id, titulo, inicio, status, disponibilidades(count), escalas(count)')
      .eq('departamento_id', depId).gte('inicio', new Date(Date.now() - 86400000).toISOString()).order('inicio')
  ]);

  const dep = depRes.data;
  if (!dep || !ctx.coordena(dep.id, dep.organizacao_id)) {
    location.hash = '#/';
    return aviso('Você não coordena este departamento.');
  }

  const admin = ctx.ehAdmin(dep.organizacao_id);
  const funcoes = funcoesRes.data ?? [];
  const nomeFuncao = Object.fromEntries(funcoes.map((f) => [f.id, f.nome]));
  const funcoesDe = {};
  for (const mf of mfRes.data ?? []) (funcoesDe[mf.usuario_id] ??= new Set()).add(mf.funcao_id);
  const membros = membrosRes.data ?? [];
  const pendentes = membros.filter((m) => m.status === 'pendente');
  const ativos = membros.filter((m) => m.status === 'ativo');
  const eventos = eventosRes.data ?? [];
  const textoConvite = `Entre no departamento ${dep.nome} (${dep.organizacoes.nome}) pelo app Circlle: ${location.origin} — código ${dep.codigo}`;

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${botaoVoltar('#/')}
      <div class="titulo">
        <p class="passo">${escapar(dep.organizacoes.nome)}</p>
        <h1>${escapar(dep.nome)}</h1>
      </div>

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
        <div class="secao__cab">
          <h2>Datas</h2>
          <a class="btn btn-primary btn-sm" href="#/dep/${dep.id}/datas">${icone.mais()} Abrir datas</a>
        </div>
        ${eventos.length ? meses(eventos).map(([nomeMes, lista]) => {
          const comEscala = lista.filter((e) => (e.escalas?.[0]?.count ?? 0) > 0);
          const paraPrevia = comEscala.filter((e) => ['rascunho', 'aberto'].includes(e.status));
          const paraPublicar = comEscala.filter((e) => ['rascunho', 'aberto', 'previa'].includes(e.status));
          return `
            <div class="mes-bloco" data-mes="${escapar(nomeMes)}">
              <div class="mes-bloco__cab">
                <h3>${escapar(nomeMes)}</h3>
                <span class="texto-fraco">${lista.length} ${lista.length === 1 ? 'data' : 'datas'} · ${comEscala.length} com escala</span>
              </div>
              <div class="lista">
                ${lista.map((e) => {
                  const { dia, mes } = diaMes(e.inicio);
                  const [rotulo, classe] = STATUS_EVENTO[e.status];
                  const disp = e.disponibilidades?.[0]?.count ?? 0;
                  const esc = e.escalas?.[0]?.count ?? 0;
                  return `
                    <a class="lista__item lista__item--link" href="#/evento/${e.id}">
                      <div class="data">
                        <div class="data__dia"><strong>${dia}</strong><span>${escapar(mes)}</span></div>
                        <div class="data__info">
                          <strong>${escapar(e.titulo)}</strong>
                          <span>${escapar(formatarData(e.inicio).split(' · ')[1])} · ${disp} ${disp === 1 ? 'disponível' : 'disponíveis'} · ${esc} ${esc === 1 ? 'escalado' : 'escalados'}</span>
                        </div>
                        <span class="badge ${classe}">${rotulo}</span>
                      </div>
                    </a>`;
                }).join('')}
              </div>
              ${paraPrevia.length || paraPublicar.length ? `
                <div class="acoes acoes--linha">
                  ${paraPrevia.length ? `<button class="btn btn-ghost btn-sm" data-lote="previa" data-ids="${paraPrevia.map((e) => e.id).join(',')}">
                    Enviar prévia do mês (${paraPrevia.length})</button>` : ''}
                  <button class="btn btn-primary btn-sm" data-lote="publicado" data-ids="${paraPublicar.map((e) => e.id).join(',')}">
                    Publicar o mês (${paraPublicar.length})</button>
                </div>` : ''}
            </div>`;
        }).join('') : vazio('Nenhuma data aberta. Abra as datas do mês para os membros marcarem em quais podem.')}
      </section>

      <section class="secao">
        <h2>Membros <span class="contador">${ativos.length}</span></h2>
        <div class="lista">
          ${ativos.length ? ativos.map((m) => {
            const coord = m.papel === 'coordenador';
            const nomes = [...(funcoesDe[m.usuario_id] ?? [])].map((id) => nomeFuncao[id]).filter(Boolean).join(', ');
            return `
              <div class="lista__item membro" data-usuario="${m.usuario_id}">
                <span class="avatar" aria-hidden="true">${escapar(iniciais(m.perfis?.nome))}</span>
                <span class="lista__texto">
                  <strong>${escapar(m.perfis?.nome ?? 'Sem nome')}${m.usuario_id === ctx.usuario.id ? ' (você)' : ''}</strong>
                  <small>${escapar(nomes || 'Sem função marcada')}</small>
                </span>
                <span class="membro__acoes">
                  ${coord ? '<span class="badge badge--reassign">Coordenador</span>' : ''}
                  ${dep.modulo_repertorio && !coord ? `
                    <button class="chip chip--mini" data-acao="repertorio" aria-pressed="${m.perm_repertorio}">Repertório</button>` : ''}
                  ${admin && m.usuario_id !== ctx.usuario.id ? `
                    <button class="chip chip--mini" data-acao="coordenador" aria-pressed="${coord}">
                      ${coord ? 'Tirar coordenação' : 'Tornar coordenador'}
                    </button>` : ''}
                  ${m.usuario_id !== ctx.usuario.id && (!coord || admin) ? `
                    <button class="chip chip--mini chip--perigo" data-acao="remover" aria-label="Remover ${escapar(m.perfis?.nome)}">Remover</button>` : ''}
                </span>
              </div>`;
          }).join('') : vazio('Ninguém aprovado ainda. Mande o código pelo WhatsApp.')}
        </div>
      </section>

      <section class="secao">
        <h2>Configurações</h2>
        <div class="card form">
          <fieldset class="field">
            <legend>Funções do departamento</legend>
            <div class="chips">
              ${funcoes.map((f) => `
                <span class="chip chip--fixo">${escapar(f.nome)}
                  <button type="button" class="chip__x" data-remover-funcao="${f.id}" aria-label="Remover ${escapar(f.nome)}">×</button>
                </span>`).join('') || '<small class="dica">Nenhuma função ainda.</small>'}
            </div>
            <form class="linha" id="novaFuncao">
              <input name="nome" placeholder="Nova função, ex.: Violão" maxlength="40" aria-label="Nova função" />
              <button class="btn btn-ghost btn-sm" type="submit">Adicionar</button>
            </form>
          </fieldset>

          <label class="toggle">
            <input type="checkbox" id="repertorio" ${dep.modulo_repertorio ? 'checked' : ''} />
            <span class="toggle__trilho" aria-hidden="true"></span>
            <span>
              <strong>Usa repertório de músicas</strong>
              <small>Libera músicas, tons e cifras para este departamento.</small>
            </span>
          </label>
        </div>
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

  // Prévia ou publicação do mês inteiro
  document.querySelectorAll('[data-lote]').forEach((botao) =>
    botao.addEventListener('click', async () => {
      const ids = botao.dataset.ids.split(',').filter(Boolean);
      const status = botao.dataset.lote;
      const texto = status === 'previa'
        ? `Enviar a prévia de ${ids.length} ${ids.length === 1 ? 'data' : 'datas'}? A equipe vai poder conferir e pedir ajustes.`
        : `Publicar ${ids.length} ${ids.length === 1 ? 'escala' : 'escalas'}? Só as datas que já têm gente escalada entram.`;
      if (!confirm(texto)) return;
      const { error } = await comBotao(botao, () => supabase.from('eventos').update({ status }).in('id', ids));
      if (error) return aviso(traduzirErro(error));
      aviso(status === 'previa' ? 'Prévia do mês enviada!' : 'Escalas do mês publicadas!');
      recarregar();
    })
  );

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

  // Membros: repertório, coordenação e remoção (RF10, RF15, RF16)
  document.querySelectorAll('.membro').forEach((linha) => {
    const usuario = linha.dataset.usuario;
    const atualizar = (dados) => supabase.from('membros_departamento').update(dados)
      .eq('departamento_id', dep.id).eq('usuario_id', usuario);

    linha.querySelector('[data-acao="repertorio"]')?.addEventListener('click', async (e) => {
      const ativo = e.currentTarget.getAttribute('aria-pressed') === 'true';
      const { error } = await comBotao(e.currentTarget, () => atualizar({ perm_repertorio: !ativo }));
      if (error) return aviso(traduzirErro(error));
      aviso(!ativo ? 'Permissão de repertório liberada.' : 'Permissão de repertório retirada.');
      recarregar();
    });
    linha.querySelector('[data-acao="coordenador"]')?.addEventListener('click', async (e) => {
      const coord = e.currentTarget.getAttribute('aria-pressed') === 'true';
      const { error } = await comBotao(e.currentTarget, () => atualizar({ papel: coord ? 'membro' : 'coordenador' }));
      if (error) return aviso(traduzirErro(error));
      aviso(coord ? 'Coordenação retirada.' : 'Agora é coordenador!');
      recarregar();
    });
    linha.querySelector('[data-acao="remover"]')?.addEventListener('click', async (e) => {
      if (!confirm('Remover esta pessoa do departamento?')) return;
      const { error } = await comBotao(e.currentTarget, () =>
        supabase.from('membros_departamento').delete().eq('departamento_id', dep.id).eq('usuario_id', usuario));
      if (error) return aviso(traduzirErro(error));
      aviso('Membro removido.');
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
