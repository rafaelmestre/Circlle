import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import {
  escapar, iniciais, formatarData, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao,
  nomesFuncoes, badgeResposta, STATUS_EVENTO, linkWhats, textoEscala
} from '../lib/ui.js';

// Evento: o coordenador monta a escala em 3 passos (RF22, RF24);
// o membro vê a prévia ou a escala publicada e responde.
export async function telaEvento(ctx, eventoId) {
  const { data: ev } = await supabase.from('eventos')
    .select('id, titulo, local, inicio, status, departamento_id, departamentos(id, nome, organizacao_id)')
    .eq('id', eventoId).maybeSingle();
  if (!ev) {
    location.hash = '#/';
    return aviso('Data não encontrada.');
  }

  const dep = ev.departamentos;
  return ctx.escala(dep.id, dep.organizacao_id) ? montarEscala(ctx, ev, dep) : verEscala(ctx, ev, dep);
}

const cabecalho = (ev, dep, voltar, rotuloVoltar) => {
  const [rotulo, classe] = STATUS_EVENTO[ev.status];
  return `
    ${botaoVoltar(voltar, rotuloVoltar)}
    <div class="titulo">
      <p class="passo">${escapar(dep.nome)} <span class="badge ${classe}">${rotulo}</span></p>
      <h1>${escapar(ev.titulo)}</h1>
      <div class="meta">
        <span>${icone.relogio()} ${escapar(formatarData(ev.inicio))}</span>
        ${ev.local ? `<span>${icone.local()} ${escapar(ev.local)}</span>` : ''}
      </div>
    </div>`;
};

// Equipe agrupada por função: "Vocal: Rita, Marcos"
function equipePorFuncao(escalas, euId) {
  const grupos = new Map();
  for (const s of escalas) {
    const funcoes = (s.escala_funcoes ?? []).map((f) => f.funcoes?.nome).filter(Boolean);
    for (const f of funcoes.length ? funcoes : ['Função a definir']) {
      if (!grupos.has(f)) grupos.set(f, []);
      grupos.get(f).push(s);
    }
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([funcao, pessoas]) => `
    <div class="grupo-funcao">
      <h3>${escapar(funcao)}</h3>
      <div class="lista">
        ${pessoas.map((s) => `
          <div class="lista__item ${s.usuario_id === euId ? 'lista__item--eu' : ''}">
            <span class="avatar" aria-hidden="true">${escapar(iniciais(s.perfis?.nome))}</span>
            <span class="lista__texto">
              <strong>${escapar(s.perfis?.nome ?? '')}${s.usuario_id === euId ? ' (você)' : ''}</strong>
            </span>
            ${badgeResposta(s.resposta)}
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// Compartilhar a escala no grupo do WhatsApp (RF32)
const botaoWhats = (ev, dep, escalas) => `
  <a class="btn btn-ghost" target="_blank" rel="noopener"
     href="${linkWhats(`${textoEscala(ev, dep.nome, escalas)}\n\n${ev.status === 'previa' ? 'Confira' : 'Confirme'} no Circlle: ${location.origin}/#/evento/${ev.id}`)}">
    ${icone.whats()} Mandar no WhatsApp
  </a>`;

// ==========================================================
// Membro: prévia ou escala publicada, com resposta
// ==========================================================
async function verEscala(ctx, ev, dep) {
  const [escRes, dispRes] = await Promise.all([
    supabase.from('escalas')
      .select('id, usuario_id, resposta, motivo, perfis(nome), escala_funcoes(funcoes(nome))')
      .eq('evento_id', ev.id),
    supabase.from('disponibilidades').select('evento_id')
      .eq('evento_id', ev.id).eq('usuario_id', ctx.usuario.id)
  ]);
  const escalas = escRes.data ?? [];
  const minha = escalas.find((s) => s.usuario_id === ctx.usuario.id);
  const marcado = (dispRes.data ?? []).length > 0;
  const previa = ev.status === 'previa';
  const respondivel = previa || ev.status === 'publicado';
  let editando = false;

  const blocoMinha = () => {
    if (ev.status === 'aberto') {
      return `
        <section class="card resposta">
          <h2 class="cartao__titulo">A escala ainda não saiu</h2>
          <p class="texto-fraco">Marque se você pode nessa data. O coordenador monta a escala com quem marcou.</p>
          <button class="btn ${marcado ? 'btn-ghost' : 'btn-primary'}" id="posso" aria-pressed="${marcado}">
            ${marcado ? `${icone.check()} Marquei que posso` : 'Posso nessa data'}
          </button>
        </section>`;
    }
    if (!minha) {
      return `<p class="card aviso-card">Você não está nesta escala.</p>`;
    }

    const mostrarBotoes = respondivel && (minha.resposta === 'pendente' || editando);
    return `
      <section class="card resposta">
        <span class="resposta__rotulo">${previa ? 'Prévia da escala · você está como' : 'Você está escalado como'}</span>
        <strong class="resposta__funcao">${escapar(nomesFuncoes(minha))}</strong>
        ${!mostrarBotoes ? `
          <div class="resposta__estado">
            ${badgeResposta(minha.resposta)}
            ${respondivel ? '<button class="link-botao" id="mudar">Mudar resposta</button>' : ''}
          </div>
          ${minha.resposta === 'ajuste' && minha.motivo ? `<p class="texto-fraco">Você disse: “${escapar(minha.motivo)}”</p>` : ''}` : `
          <p class="texto-fraco">${previa
            ? 'O coordenador ainda pode mudar. Está tudo certo pra você ou precisa de algum ajuste?'
            : 'Confirme que vai, ou avise o coordenador se surgiu um imprevisto.'}</p>
          <div class="acoes">
            <button class="btn btn-primary" id="confirmar">${icone.check()} Confirmo</button>
            <button class="btn btn-ghost" id="abrirAjuste">${previa ? 'Pedir ajuste' : 'Não vou poder'}</button>
          </div>
          <form class="form" id="ajuste" hidden novalidate>
            <div class="field">
              <label for="motivo">${previa ? 'O que precisa mudar?' : 'O que aconteceu?'}</label>
              <textarea id="motivo" name="motivo" rows="3" maxlength="300" required
                placeholder="${previa ? 'Ex.: nesse dia só consigo chegar às 20h' : 'Ex.: surgiu um compromisso de trabalho'}"></textarea>
            </div>
            <button class="btn btn-primary" type="submit">Enviar ao coordenador</button>
            <p class="msg" role="status" aria-live="polite"></p>
          </form>`}
      </section>`;
  };

  const render = () => {
    casca(ctx, 'calendario', `
      <main class="tela tela--com-nav">
        ${cabecalho(ev, dep, '#/calendario', 'Calendário')}
        ${blocoMinha()}
        ${escalas.length ? `
          <section class="secao">
            <h2>${previa ? 'Quem está na prévia' : 'Equipe'}</h2>
            ${equipePorFuncao(escalas, ctx.usuario.id)}
            ${botaoWhats(ev, dep, escalas)}
          </section>` : ''}
      </main>`);

    const q = (sel) => document.querySelector(sel);
    q('#posso')?.addEventListener('click', async (e) => {
      const { error } = await comBotao(e.currentTarget, () => marcado
        ? supabase.from('disponibilidades').delete().eq('evento_id', ev.id).eq('usuario_id', ctx.usuario.id)
        : supabase.from('disponibilidades').insert({ evento_id: ev.id, usuario_id: ctx.usuario.id }));
      if (error) return aviso(traduzirErro(error));
      verEscala(ctx, ev, dep);
    });
    q('#mudar')?.addEventListener('click', () => { editando = true; render(); });
    q('#confirmar')?.addEventListener('click', async (e) => {
      const { error } = await comBotao(e.currentTarget, () =>
        supabase.rpc('responder_escala', { p_evento: ev.id, p_resposta: 'confirmado', p_motivo: null }));
      if (error) return aviso(traduzirErro(error));
      aviso('Presença confirmada!');
      verEscala(ctx, ev, dep);
    });
    q('#abrirAjuste')?.addEventListener('click', () => {
      q('#ajuste').hidden = false;
      q('#motivo').focus();
    });
    q('#ajuste')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const motivo = q('#motivo').value.trim();
      const msg = e.currentTarget.querySelector('.msg');
      if (!motivo) {
        msg.className = 'msg msg--erro';
        msg.textContent = 'Conte rapidinho o motivo.';
        return;
      }
      const { error } = await comBotao(e.currentTarget.querySelector('button'), () =>
        supabase.rpc('responder_escala', { p_evento: ev.id, p_resposta: 'ajuste', p_motivo: motivo }));
      if (error) return aviso(traduzirErro(error));
      notificar('ajuste', { evento_id: ev.id });
      aviso('Pedido enviado ao coordenador.');
      verEscala(ctx, ev, dep);
    });
  };

  render();
}

// ==========================================================
// Coordenador: montar a escala em 3 passos
// ==========================================================
async function montarEscala(ctx, ev, dep) {
  const [membrosRes, mfRes, funcoesRes, dispRes, escRes] = await Promise.all([
    supabase.from('membros_departamento').select('usuario_id, perfis(nome)')
      .eq('departamento_id', dep.id).eq('status', 'ativo'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', dep.id),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', dep.id).order('nome'),
    supabase.from('disponibilidades').select('usuario_id').eq('evento_id', ev.id),
    supabase.from('escalas').select('id, usuario_id, resposta, motivo, escala_funcoes(funcao_id)').eq('evento_id', ev.id)
  ]);

  const funcoes = funcoesRes.data ?? [];
  const nomeFuncao = Object.fromEntries(funcoes.map((f) => [f.id, f.nome]));
  const funcoesDe = {};
  for (const mf of mfRes.data ?? []) (funcoesDe[mf.usuario_id] ??= []).push(mf.funcao_id);
  const disponiveis = new Set((dispRes.data ?? []).map((d) => d.usuario_id));
  const existentes = new Map((escRes.data ?? []).map((e) => [e.usuario_id, e]));

  const pessoas = (membrosRes.data ?? [])
    .map((m) => ({
      id: m.usuario_id,
      nome: m.perfis?.nome ?? 'Sem nome',
      disponivel: disponiveis.has(m.usuario_id),
      funcoes: (funcoesDe[m.usuario_id] ?? []).filter((id) => nomeFuncao[id])
        .sort((a, b) => nomeFuncao[a].localeCompare(nomeFuncao[b]))
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const pessoa = Object.fromEntries(pessoas.map((p) => [p.id, p]));

  // Quem está escalado e em quais funções (começa com a escala salva)
  const escolha = new Map();
  for (const [uid, e] of existentes) {
    if (pessoa[uid]) escolha.set(uid, new Set((e.escala_funcoes ?? []).map((f) => f.funcao_id)));
  }

  const jaEnviada = ['previa', 'publicado', 'realizado'].includes(ev.status);
  let passo = jaEnviada ? 3 : 1;
  const voltar = `#/escalas/${dep.id}`;

  const progresso = () => `
    <ol class="passos-escala" aria-label="Etapas da escala">
      ${['Quem vai', 'O que cada um faz', 'Revisar e enviar'].map((nome, i) => `
        <li class="${i + 1 === passo ? 'atual' : i + 1 < passo ? 'feito' : ''}" ${i + 1 === passo ? 'aria-current="step"' : ''}>
          <span class="passos-escala__num">${i + 1 < passo ? icone.check(14) : i + 1}</span>
          <span class="passos-escala__nome">${nome}</span>
        </li>`).join('')}
    </ol>`;

  const nomesDe = (ids) => [...ids].map((id) => nomeFuncao[id]).filter(Boolean).sort().join(', ');

  // ---------- Passo 1: quem vai ----------
  const passo1 = () => {
    const cartao = (p) => `
      <button type="button" class="pessoa-opcao" data-pessoa="${p.id}" aria-pressed="${escolha.has(p.id)}">
        <span class="avatar" aria-hidden="true">${escapar(iniciais(p.nome))}</span>
        <span class="lista__texto">
          <strong>${escapar(p.nome)}</strong>
          <small>${escapar(nomesDe(p.funcoes) || 'Sem função marcada')}</small>
        </span>
        <span class="pessoa-opcao__marca" aria-hidden="true">${icone.check(16)}</span>
      </button>`;
    const disp = pessoas.filter((p) => p.disponivel);
    const outros = pessoas.filter((p) => !p.disponivel);
    const outrosEscolhidos = outros.some((p) => escolha.has(p.id));

    return `
      <div class="passo-cab">
        <h2>Quem vai nessa data?</h2>
        <p class="texto-fraco">${disp.length
          ? `<strong>${disp.length}</strong> ${disp.length === 1 ? 'pessoa marcou' : 'pessoas marcaram'} que pode. Toque para escolher.`
          : 'Ninguém marcou que pode ainda. Você pode escolher qualquer pessoa do departamento.'}</p>
      </div>
      <div class="lista">${disp.map(cartao).join('') || vazio('Ninguém marcou “posso” nessa data.')}</div>
      ${outros.length ? `
        <details class="outros" ${outrosEscolhidos || !disp.length ? 'open' : ''}>
          <summary>Outras pessoas do departamento (${outros.length})</summary>
          <p class="texto-fraco">Não marcaram “posso” nessa data.</p>
          <div class="lista">${outros.map(cartao).join('')}</div>
        </details>` : ''}`;
  };

  // ---------- Passo 2: o que cada um faz ----------
  const passo2 = () => {
    const contagem = Object.fromEntries(funcoes.map((f) => [f.id, 0]));
    for (const ids of escolha.values()) for (const id of ids) if (id in contagem) contagem[id]++;

    return `
      <div class="passo-cab">
        <h2>O que cada um faz?</h2>
        <p class="texto-fraco">Toque nas funções. Uma pessoa pode ter mais de uma, como tocar e cantar.</p>
      </div>
      <div class="cobertura" aria-label="Funções preenchidas">
        ${funcoes.map((f) => `
          <span class="cobertura__item ${contagem[f.id] ? '' : 'cobertura__item--vazia'}">
            ${escapar(f.nome)} <strong>${contagem[f.id]}</strong>
          </span>`).join('')}
      </div>
      ${[...escolha.keys()].map((uid) => pessoa[uid]).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => `
        <div class="card funcoes-pessoa" data-pessoa="${p.id}">
          <div class="pessoa">
            <span class="avatar" aria-hidden="true">${escapar(iniciais(p.nome))}</span>
            <strong class="pessoa__nome">${escapar(p.nome)}</strong>
            ${escolha.get(p.id).size ? '' : '<span class="badge badge--pending">Escolha a função</span>'}
          </div>
          <div class="chips" role="group" aria-label="Funções de ${escapar(p.nome)}">
            ${p.funcoes.map((fid) => `
              <button type="button" class="chip" data-funcao="${fid}" aria-pressed="${escolha.get(p.id).has(fid)}">
                ${escapar(nomeFuncao[fid])}
              </button>`).join('') || '<small class="dica">Essa pessoa ainda não marcou o que faz. Ela pode marcar no perfil.</small>'}
          </div>
        </div>`).join('')}`;
  };

  // ---------- Passo 3: revisar e enviar ----------
  const passo3 = () => {
    const grupos = new Map(funcoes.map((f) => [f.id, []]));
    const semFuncao = [];
    for (const [uid, ids] of escolha) {
      if (!ids.size) semFuncao.push(uid);
      for (const id of ids) grupos.get(id)?.push(uid);
    }
    const respostas = [...escolha.keys()].map((uid) => existentes.get(uid)?.resposta ?? 'novo');
    const ajustes = [...escolha.keys()].filter((uid) => existentes.get(uid)?.resposta === 'ajuste');
    const confirmados = respostas.filter((r) => r === 'confirmado').length;

    const linhaPessoa = (uid) => {
      const e = existentes.get(uid);
      return `
        <div class="lista__item">
          <span class="avatar" aria-hidden="true">${escapar(iniciais(pessoa[uid].nome))}</span>
          <span class="lista__texto"><strong>${escapar(pessoa[uid].nome)}</strong></span>
          ${jaEnviada && e ? badgeResposta(e.resposta) : ''}
        </div>`;
    };

    return `
      <div class="passo-cab">
        <h2>${jaEnviada ? 'Escala' : 'Confira a escala'}</h2>
        ${jaEnviada
          ? `<p class="texto-fraco"><strong>${confirmados}</strong> de ${escolha.size} confirmaram.</p>`
          : '<p class="texto-fraco">Envie como <strong>prévia</strong> para a equipe conferir e pedir ajustes, ou publique direto.</p>'}
      </div>

      ${jaEnviada && existentes.get(ctx.usuario.id)?.resposta === 'pendente' ? `
        <section class="card eu-tambem">
          <span>Você também está nesta escala.</span>
          <button class="btn btn-primary btn-sm" id="euConfirmo">${icone.check(16)} Confirmo</button>
        </section>` : ''}

      ${ajustes.length ? `
        <section class="card ajustes">
          <h3>${icone.alerta()} ${ajustes.length === 1 ? '1 pedido de ajuste' : `${ajustes.length} pedidos de ajuste`}</h3>
          ${ajustes.map((uid) => `
            <p><strong>${escapar(pessoa[uid].nome)}:</strong> “${escapar(existentes.get(uid).motivo ?? '')}”</p>`).join('')}
          <p class="texto-fraco">Toque em <strong>Editar equipe</strong> para mudar. Ao salvar, o pedido conta como resolvido e a pessoa confirma de novo.</p>
        </section>` : ''}

      ${[...grupos.entries()].filter(([, uids]) => uids.length).map(([fid, uids]) => `
        <div class="grupo-funcao">
          <h3>${escapar(nomeFuncao[fid])}</h3>
          <div class="lista">${uids.sort((a, b) => pessoa[a].nome.localeCompare(pessoa[b].nome)).map(linhaPessoa).join('')}</div>
        </div>`).join('')}
      ${semFuncao.length ? `
        <div class="grupo-funcao">
          <h3>Função a definir</h3>
          <div class="lista">${semFuncao.map(linhaPessoa).join('')}</div>
        </div>` : ''}
      ${escolha.size ? '' : vazio('Ninguém escolhido ainda.')}

      <div class="acoes">
        <button class="btn btn-ghost" data-ir="1">Editar equipe</button>
        ${jaEnviada && escolha.size ? botaoWhats(ev, dep, [...escolha].map(([uid, ids]) => ({
          perfis: { nome: pessoa[uid].nome },
          escala_funcoes: [...ids].map((fid) => ({ funcoes: { nome: nomeFuncao[fid] } }))
        }))) : ''}
      </div>`;
  };

  const barra = () => {
    if (passo === 1) {
      return `
        <span class="barra-acao__info"><strong>${escolha.size}</strong> ${escolha.size === 1 ? 'escolhida' : 'escolhidas'}</span>
        <button class="btn btn-primary" data-ir="2" ${escolha.size ? '' : 'disabled'}>Continuar</button>`;
    }
    if (passo === 2) {
      return `
        <button class="btn btn-ghost" data-ir="1">Voltar</button>
        <button class="btn btn-primary" data-ir="3">Revisar</button>`;
    }
    if (ev.status === 'previa') {
      return `
        <button class="btn btn-ghost" data-salvar="previa">Salvar prévia</button>
        <button class="btn btn-primary" data-salvar="publicado">Publicar</button>`;
    }
    if (ev.status === 'publicado' || ev.status === 'realizado') {
      return `<button class="btn btn-primary" data-salvar="${ev.status}">Salvar alterações</button>`;
    }
    return `
      <button class="btn btn-ghost" data-salvar="publicado">Publicar</button>
      <button class="btn btn-primary" data-salvar="previa">Enviar prévia</button>`;
  };

  // Editar nome, dia, horário e local da data (CRUD da escala)
  const editarData = () => {
    const d = new Date(ev.inicio);
    const p2 = (n) => String(n).padStart(2, '0');
    return `
      <details class="secao outros">
        <summary>Editar nome, dia e horário</summary>
        <form class="form card" id="editarData" novalidate>
          <div class="field">
            <label for="edTitulo">Nome</label>
            <input id="edTitulo" name="titulo" required maxlength="80" value="${escapar(ev.titulo)}" />
          </div>
          <div class="linha linha--sem-margem form-duas">
            <div class="field">
              <label for="edDia">Dia</label>
              <input id="edDia" name="dia" type="date" required value="${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}" />
            </div>
            <div class="field">
              <label for="edHora">Horário</label>
              <input id="edHora" name="hora" type="time" required value="${p2(d.getHours())}:${p2(d.getMinutes())}" />
            </div>
          </div>
          <div class="field">
            <label for="edLocal">Local (opcional)</label>
            <input id="edLocal" name="local" maxlength="120" value="${escapar(ev.local ?? '')}" />
          </div>
          <button class="btn btn-ghost" type="submit">Salvar alterações da data</button>
        </form>
      </details>`;
  };

  const render = () => {
    casca(ctx, 'escalas', `
      <main class="tela tela--com-nav tela--com-barra">
        ${cabecalho(ev, dep, voltar, 'Escalas')}
        ${progresso()}
        ${passo === 1 ? passo1() : passo === 2 ? passo2() : passo3()}
        ${passo === 3 ? `${editarData()}<button class="btn btn-ghost btn-perigo" id="excluir">Excluir esta data</button>` : ''}
      </main>
      <div class="barra-acao">${barra()}</div>`);
    ligar();
  };

  const ir = (n) => {
    // Quem tem uma função só já entra com ela marcada
    if (n === 2) {
      for (const [uid, ids] of escolha) {
        if (!ids.size && pessoa[uid].funcoes.length === 1) ids.add(pessoa[uid].funcoes[0]);
      }
    }
    passo = n;
    render();
    window.scrollTo(0, 0);
  };

  // Grava a escala: tira quem saiu, inclui quem entrou e regrava as funções
  const salvar = async (status) => {
    const ficam = [...escolha.keys()];
    const sairam = [...existentes.keys()].filter((uid) => !escolha.has(uid));

    if (sairam.length) {
      const r = await supabase.from('escalas').delete().eq('evento_id', ev.id).in('usuario_id', sairam);
      if (r.error) return r;
    }

    const novos = ficam.filter((uid) => !existentes.has(uid));
    const ids = Object.fromEntries(ficam.filter((uid) => existentes.has(uid)).map((uid) => [uid, existentes.get(uid).id]));
    if (novos.length) {
      const r = await supabase.from('escalas')
        .insert(novos.map((uid) => ({ evento_id: ev.id, usuario_id: uid }))).select('id, usuario_id');
      if (r.error) return r;
      for (const e of r.data) ids[e.usuario_id] = e.id;
    }

    // Quem teve a função mudada ou pediu ajuste volta a confirmar
    const mudouFuncao = (uid) => {
      const antes = new Set((existentes.get(uid).escala_funcoes ?? []).map((f) => f.funcao_id));
      const agora = escolha.get(uid);
      return antes.size !== agora.size || [...agora].some((id) => !antes.has(id));
    };
    const alterados = ficam.filter((uid) => existentes.has(uid)
      && (existentes.get(uid).resposta === 'ajuste' || mudouFuncao(uid)));
    const reconfirmar = alterados.filter((uid) => existentes.get(uid).resposta !== 'pendente');
    if (reconfirmar.length) {
      const r = await supabase.from('escalas').update({ resposta: 'pendente', motivo: null, respondido_em: null })
        .eq('evento_id', ev.id).in('usuario_id', reconfirmar);
      if (r.error) return r;
    }

    const todasIds = Object.values(ids);
    if (todasIds.length) {
      const r1 = await supabase.from('escala_funcoes').delete().in('escala_id', todasIds);
      if (r1.error) return r1;
      const linhas = ficam.flatMap((uid) => [...escolha.get(uid)].map((fid) => ({ escala_id: ids[uid], funcao_id: fid })));
      if (linhas.length) {
        const r2 = await supabase.from('escala_funcoes').insert(linhas);
        if (r2.error) return r2;
      }
    }

    if (status !== ev.status) {
      const r = await supabase.from('eventos').update({ status }).eq('id', ev.id);
      if (r.error) return r;
    }

    // Avisos: quando a escala sai (prévia ou publicação), todos os escalados;
    // depois disso, só quem entrou ou teve a função trocada
    const saiu = ['previa', 'publicado'].includes(status) && status !== ev.status;
    if (saiu) notificar('escala', { eventos: [ev.id] });
    else if (jaEnviada && (novos.length || alterados.length)) {
      notificar('escala_alterada', { evento_id: ev.id, usuarios: [...novos, ...alterados] });
    }
    return { error: null };
  };

  const ligar = () => {
    document.querySelectorAll('[data-ir]').forEach((b) =>
      b.addEventListener('click', () => ir(Number(b.dataset.ir))));

    document.querySelectorAll('.pessoa-opcao').forEach((b) =>
      b.addEventListener('click', () => {
        const uid = b.dataset.pessoa;
        escolha.has(uid) ? escolha.delete(uid) : escolha.set(uid, new Set());
        b.setAttribute('aria-pressed', String(escolha.has(uid)));
        document.querySelector('.barra-acao').innerHTML = barra();
        document.querySelector('.barra-acao [data-ir]').addEventListener('click', () => ir(2));
      }));

    document.querySelectorAll('.funcoes-pessoa [data-funcao]').forEach((b) =>
      b.addEventListener('click', () => {
        const ids = escolha.get(b.closest('[data-pessoa]').dataset.pessoa);
        const fid = b.dataset.funcao;
        ids.has(fid) ? ids.delete(fid) : ids.add(fid);
        render();
      }));

    document.querySelectorAll('[data-salvar]').forEach((b) =>
      b.addEventListener('click', async () => {
        const status = b.dataset.salvar;
        if (!escolha.size && !confirm('Ninguém foi escolhido. Salvar mesmo assim?')) return;
        const semFuncao = [...escolha.values()].filter((ids) => !ids.size).length;
        if (semFuncao && !confirm(`${semFuncao} ${semFuncao === 1 ? 'pessoa está' : 'pessoas estão'} sem função. Continuar?`)) return;

        const { error } = await comBotao(b, () => salvar(status));
        if (error) return aviso(traduzirErro(error));
        const textos = {
          previa: ev.status === 'previa' ? 'Prévia atualizada! A equipe já vê a versão nova.' : 'Prévia enviada! A equipe pode conferir e pedir ajustes.',
          publicado: ev.status === 'publicado' ? 'Escala atualizada!' : 'Escala publicada!',
          realizado: 'Escala atualizada!'
        };
        aviso(textos[status]);
        location.hash = voltar;
      }));

    document.querySelector('#euConfirmo')?.addEventListener('click', async (e) => {
      const { error } = await comBotao(e.currentTarget, () =>
        supabase.rpc('responder_escala', { p_evento: ev.id, p_resposta: 'confirmado', p_motivo: null }));
      if (error) return aviso(traduzirErro(error));
      existentes.get(ctx.usuario.id).resposta = 'confirmado';
      aviso('Presença confirmada!');
      render();
    });

    document.querySelector('#editarData')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const titulo = f.titulo.value.trim();
      if (!titulo || !f.dia.value || !f.hora.value) return aviso('Preencha nome, dia e horário.');
      const dados = { titulo, local: f.local.value.trim() || null, inicio: new Date(`${f.dia.value}T${f.hora.value}`).toISOString() };
      const mudouDia = new Date(dados.inicio).getTime() !== new Date(ev.inicio).getTime();
      const { error } = await comBotao(f.querySelector('button'), () => supabase.from('eventos').update(dados).eq('id', ev.id));
      if (error) return aviso(traduzirErro(error));
      Object.assign(ev, dados);
      // Escala já enviada e o dia mudou: avisa quem está nela
      if (mudouDia && ['previa', 'publicado'].includes(ev.status) && existentes.size) {
        notificar('escala_alterada', { evento_id: ev.id, usuarios: [...existentes.keys()] });
      }
      aviso('Data atualizada.');
      render();
    });

    document.querySelector('#excluir')?.addEventListener('click', async (e) => {
      if (!confirm('Excluir esta data? A disponibilidade e a escala dela também saem.')) return;
      const { error } = await comBotao(e.currentTarget, () => supabase.from('eventos').delete().eq('id', ev.id));
      if (error) return aviso(traduzirErro(error));
      aviso('Data excluída.');
      location.hash = voltar;
    });
  };

  render();
}
