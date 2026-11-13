import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import {
  escapar, iniciais, formatarData, diaMes, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao, STATUS_EVENTO,
  termos, linkWhats, textoEscala
} from '../lib/ui.js';


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
    supabase.from('departamentos').select('id, nome, codigo, ativo, modulo_repertorio, organizacao_id, organizacoes(nome, termo_departamento, termo_evento, termo_funcao)').eq('id', depId).maybeSingle(),
    supabase.from('membros_departamento').select('usuario_id, papel, perm_repertorio, status, perfis(nome)').eq('departamento_id', depId).order('created_at'),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', depId).order('nome'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', depId),
    supabase.from('eventos').select('id, titulo, local, inicio, status, disponibilidades(count), escalas(count)')
      .eq('departamento_id', depId).gte('inicio', new Date(Date.now() - 86400000).toISOString()).order('inicio')
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
  const eventos = eventosRes.data ?? [];
  const textoConvite = `Entre em ${dep.nome} (${dep.organizacoes.nome}) pelo app Circlle: ${location.origin} — código ${dep.codigo}`;

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${botaoVoltar('#/')}
      <div class="titulo">
        <p class="passo">${escapar(dep.organizacoes.nome)}</p>
        <h1>${escapar(dep.nome)}</h1>
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
        <div class="secao__cab">
          <h2>Datas</h2>
          <a class="btn btn-primary btn-sm" href="#/dep/${dep.id}/datas">${icone.mais()} Abrir datas</a>
        </div>
        ${eventos.length ? meses(eventos).map(([nomeMes, lista]) => {
          const comEscala = lista.filter((e) => (e.escalas?.[0]?.count ?? 0) > 0);
          const paraPrevia = comEscala.filter((e) => ['rascunho', 'aberto'].includes(e.status));
          const paraPublicar = comEscala.filter((e) => ['rascunho', 'aberto', 'previa'].includes(e.status));
          const abertas = lista.filter((e) => e.status === 'aberto');
          const enviadas = lista.filter((e) => ['previa', 'publicado'].includes(e.status));
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
              ${abertas.length || enviadas.length ? `
                <div class="compartilhar">
                  <span class="compartilhar__rotulo">${icone.whats(16)} Mandar no grupo:</span>
                  ${abertas.length ? `<button class="link-botao" data-whats="datas" data-ids="${abertas.map((e) => e.id).join(',')}">datas para marcar</button>` : ''}
                  ${enviadas.length ? `<button class="link-botao" data-whats="escala" data-ids="${enviadas.map((e) => e.id).join(',')}">escala do mês</button>` : ''}
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

  // WhatsApp: datas para marcar ou escala do mês (RF32)
  document.querySelectorAll('[data-whats]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ids = b.dataset.ids.split(',');
      const mes = b.closest('[data-mes]').dataset.mes;
      // Abre a janela antes da consulta para o navegador não bloquear
      const janela = window.open('', '_blank');
      let texto;
      if (b.dataset.whats === 'datas') {
        const lista = eventos.filter((e) => ids.includes(e.id));
        texto = [`*${dep.nome} · ${mes}*`, 'Marque no Circlle em quais datas você pode:', '',
          ...lista.map((e) => `• ${formatarData(e.inicio)} — ${e.titulo}`), '', `${location.origin}/#/calendario`].join('\n');
      } else {
        const { data, error } = await supabase.from('escalas')
          .select('evento_id, perfis(nome), escala_funcoes(funcoes(nome))').in('evento_id', ids);
        if (error) {
          janela?.close();
          return aviso(traduzirErro(error));
        }
        const lista = eventos.filter((e) => ids.includes(e.id));
        const blocos = lista.map((e) => textoEscala(e, null, (data ?? []).filter((s) => s.evento_id === e.id)));
        texto = [`*Escala de ${dep.nome} · ${mes}*`, '', blocos.join('\n\n'), '',
          `Confirme no Circlle: ${location.origin}/#/calendario`].join('\n');
      }
      if (janela) janela.location.href = linkWhats(texto);
      else location.href = linkWhats(texto);
    })
  );

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
      notificar('escala', { eventos: ids });
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
