import { supabase } from '../lib/supabase.js';
import { estadoNotificacoes, ativarNotificacoes } from '../lib/notificacoes.js';
import { cartaoAviso, podePublicar } from './mural.js';
import {
  escapar, nomeCurto, formatarData, casca, icone, vazio, aviso, traduzirErro, comBotao, nomesFuncoes
} from '../lib/ui.js';

const CHAVE_DEP = 'circlle:inicio-dep';
const CHAVE_CONVITE = 'circlle:convite-notificacoes';
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

let mesVisto = null; // primeiro dia do mês mostrado na tabela

const ler = (chave) => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
// "novembro" no ano atual, "janeiro de 2027" nos outros
const tituloMes = (d) => (d.getFullYear() === new Date().getFullYear()
  ? d.toLocaleDateString('pt-BR', { month: 'long' }) : fmtMes.format(d));

// Início: a escala do mês, como a tabela que o grupo mandava no WhatsApp (RF33)
export async function telaInicio(ctx) {
  const agora = new Date().toISOString();
  const depsAtivos = ctx.ativos.map((v) => v.departamento_id);
  mesVisto ??= new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [escalasRes, abertosRes, dispRes] = await Promise.all([
    supabase.from('escalas')
      .select('id, resposta, escala_funcoes(funcoes(nome)), eventos!inner(id, titulo, local, inicio, status, departamentos(nome))')
      .eq('usuario_id', ctx.usuario.id)
      .in('eventos.status', ['previa', 'publicado'])
      .gte('eventos.inicio', agora),
    depsAtivos.length
      ? supabase.from('eventos').select('id').in('departamento_id', depsAtivos).eq('status', 'aberto').gte('inicio', agora)
      : { data: [] },
    supabase.from('disponibilidades').select('evento_id').eq('usuario_id', ctx.usuario.id)
  ]);

  const proximas = (escalasRes.data ?? []).sort((a, b) => a.eventos.inicio.localeCompare(b.eventos.inicio));
  const marcados = new Set((dispRes.data ?? []).map((d) => d.evento_id));
  const paraMarcar = (abertosRes.data ?? []).filter((e) => !marcados.has(e.id)).length;
  const pendentes = ctx.vinculos.filter((v) => v.status === 'pendente');

  // Departamento da tabela: o último escolhido, ou o primeiro
  const deps = ctx.ativos.map((v) => v.departamentos);
  let depId = ler(CHAVE_DEP);
  if (!deps.some((d) => d.id === depId)) depId = deps[0]?.id ?? null;

  const destaque = proximas[0];
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
        <a class="btn btn-sm destaque__link" href="#/evento/${destaque.eventos.id}">Ver detalhes</a>
      </div>
    </section>` : '';

  // Convite para ligar as notificações (some quando a pessoa ativa ou dispensa)
  const push = depsAtivos.length && ler(CHAVE_CONVITE) !== '1' ? await estadoNotificacoes() : 'indisponivel';
  const blocoPush = push === 'inativo' ? `
    <section class="card convite-push">
      <span class="icon-circle">${icone.sino()}</span>
      <div class="convite-push__texto">
        <strong>Receba os avisos no celular</strong>
        <small>Prévia, escala publicada e lembrete na véspera.</small>
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
        <small>Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra o Circlle pelo ícone e ative no Perfil.</small>
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
            <h1>${escapar(nomeCurto(ctx.perfil))}</h1>
          </div>
        </div>
      </header>

      ${pendentes.length ? `
        <p class="card aviso-card">Seu pedido para entrar em <strong>${pendentes.map((p) => escapar(p.departamentos.nome)).join(', ')}</strong>
        está com a coordenação. Assim que aprovarem, a escala aparece aqui.</p>` : ''}

      ${blocoDestaque}

      ${deps.length ? `
        <section class="secao escala-mes" aria-labelledby="tituloEscala">
          ${deps.length > 1 ? `
            <div class="chips chips--rolagem" role="group" aria-label="Departamento">
              ${deps.map((d) => `
                <button type="button" class="chip" data-dep="${d.id}" aria-pressed="${d.id === depId}">${escapar(d.nome)}</button>`).join('')}
            </div>` : ''}
          <div class="escala-mes__cab">
            <button type="button" class="icone-botao" id="mesAnterior" aria-label="Mês anterior">${icone.anterior()}</button>
            <div class="escala-mes__titulo">
              <span class="escala-mes__dep" id="nomeDep"></span>
              <h2 id="tituloEscala"></h2>
            </div>
            <button type="button" class="icone-botao" id="mesSeguinte" aria-label="Próximo mês">${icone.proximo()}</button>
          </div>
          <div id="tabelaMes" aria-live="polite"></div>
        </section>
        <section class="secao" id="muralResumo" hidden></section>` : pendentes.length ? '' : `
        <section class="card vazio-guia">
          <h2 class="cartao__titulo">Você ainda não está em nenhum grupo</h2>
          <p class="texto-fraco">Peça o código para a coordenação e entre pelo seu perfil.</p>
          <a class="btn btn-primary" href="#/entrar">${icone.mais()} Entrar com código</a>
        </section>`}

      ${paraMarcar ? `
        <a class="lembrete-linha" href="#/calendario">
          <span><strong>${paraMarcar}</strong> ${paraMarcar === 1 ? 'data esperando' : 'datas esperando'} você marcar se pode</span>
          ${icone.seta()}
        </a>` : ''}

      ${blocoPush}
    </main>`);

  // ---------- Tabela do mês ----------
  const caixa = document.querySelector('#tabelaMes');
  const desenhar = async () => {
    if (!caixa || !depId) return;
    const dep = deps.find((d) => d.id === depId);
    document.querySelector('#nomeDep').textContent = dep.nome;
    document.querySelector('#tituloEscala').textContent = `Escala de ${tituloMes(mesVisto)}`;
    caixa.innerHTML = '<p class="texto-fraco">Carregando…</p>';
    const fim = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 1);
    const { data, error } = await supabase.from('eventos')
      .select('id, titulo, inicio, status, escalas(usuario_id, perfis(nome, apelido, avatar_url), escala_funcoes(funcoes(id, nome)))')
      .eq('departamento_id', depId).in('status', ['previa', 'publicado', 'realizado'])
      .gte('inicio', mesVisto.toISOString()).lt('inicio', fim.toISOString()).order('inicio');
    if (error) {
      caixa.innerHTML = vazio(traduzirErro(error));
      return;
    }
    caixa.innerHTML = tabelaDoMes(data ?? [], ctx.usuario.id, mesVisto);
    desenharMural();
  };

  // Mural: os últimos avisos do departamento escolhido
  const desenharMural = async () => {
    const caixaMural = document.querySelector('#muralResumo');
    if (!caixaMural) return;
    const alvo = depId;
    const { data } = await supabase.from('avisos')
      .select('id, titulo, corpo, fixado, created_at, perfis(nome, apelido, avatar_url)').eq('departamento_id', alvo)
      .order('fixado', { ascending: false }).order('created_at', { ascending: false }).limit(2);
    if (alvo !== depId) return;
    const publica = podePublicar(ctx, alvo);
    caixaMural.hidden = !(data?.length || publica);
    caixaMural.innerHTML = `
      <div class="secao__cab">
        <h2>Mural</h2>
        <a class="link-sutil" href="#/mural/${alvo}">${data?.length ? 'Ver tudo' : 'Escrever aviso'}</a>
      </div>
      ${(data ?? []).map((a) => cartaoAviso(a)).join('')}`;
  };

  document.querySelectorAll('[data-dep]').forEach((chip) =>
    chip.addEventListener('click', () => {
      depId = chip.dataset.dep;
      gravar(CHAVE_DEP, depId);
      document.querySelectorAll('[data-dep]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      desenhar();
    }));
  document.querySelector('#mesAnterior')?.addEventListener('click', () => {
    mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() - 1, 1);
    desenhar();
  });
  document.querySelector('#mesSeguinte')?.addEventListener('click', () => {
    mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 1);
    desenhar();
  });
  desenhar();

  // ---------- Ações ----------
  document.querySelector('#confirmarProxima')?.addEventListener('click', async (e) => {
    const { error } = await comBotao(e.currentTarget, () =>
      supabase.rpc('responder_escala', { p_evento: destaque.eventos.id, p_resposta: 'confirmado', p_motivo: null }));
    if (error) return aviso(traduzirErro(error));
    aviso('Presença confirmada!');
    telaInicio(ctx);
  });

  const fecharConvite = () => {
    gravar(CHAVE_CONVITE, '1');
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
}

// Datas nas linhas, funções nas colunas, como a escala do mês que o grupo já conhece
function tabelaDoMes(eventos, eu, mes) {
  if (!eventos.length) {
    return vazio(`Nenhuma escala de ${fmtMes.format(mes).split(' ')[0]} publicada ainda.`);
  }

  // Colunas: as funções usadas no mês, em ordem alfabética
  const funcoes = new Map();
  for (const e of eventos) {
    for (const s of e.escalas ?? []) {
      for (const f of s.escala_funcoes ?? []) if (f.funcoes) funcoes.set(f.funcoes.id, f.funcoes.nome);
    }
  }
  const colunas = [...funcoes.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const titulosDiferentes = new Set(eventos.map((e) => e.titulo)).size > 1;

  const linha = (e) => {
    const d = new Date(e.inicio);
    const porFuncao = new Map(colunas.map(([id]) => [id, []]));
    for (const s of e.escalas ?? []) {
      for (const f of s.escala_funcoes ?? []) {
        porFuncao.get(f.funcoes?.id)?.push({ nome: nomeCurto(s.perfis), eu: s.usuario_id === eu });
      }
    }
    const minha = (e.escalas ?? []).some((s) => s.usuario_id === eu);
    return `
      <tr class="${minha ? 'escala-tabela__minha' : ''}">
        <th scope="row">
          <a href="#/evento/${e.id}" class="escala-tabela__data">
            <strong>${String(d.getDate()).padStart(2, '0')}</strong>
            <span>${escapar(fmtSemana.format(d).replace('.', ''))} · ${escapar(fmtHora.format(d))}</span>
            ${titulosDiferentes ? `<small>${escapar(e.titulo)}</small>` : ''}
            ${e.status === 'previa' ? '<span class="badge badge--reassign">prévia</span>' : ''}
          </a>
        </th>
        ${colunas.map(([id]) => {
          const nomes = porFuncao.get(id);
          return `<td>${nomes.length
            ? nomes.map((p) => p.eu ? `<mark>${escapar(p.nome)}</mark>` : escapar(p.nome)).join('<br>')
            : '<span class="escala-tabela__vazio" aria-label="ninguém">–</span>'}</td>`;
        }).join('')}
      </tr>`;
  };

  return `
    <div class="tabela-rolagem escala-tabela__caixa">
      <table class="escala-tabela">
        <thead>
          <tr>
            <th scope="col">Data</th>
            ${colunas.map(([, nome]) => `<th scope="col">${escapar(nome)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${eventos.map(linha).join('')}</tbody>
      </table>
    </div>
    ${colunas.length ? '' : '<p class="texto-fraco">As datas deste mês ainda não têm ninguém escalado.</p>'}
    <p class="texto-fraco escala-tabela__legenda"><mark>Seu nome</mark> aparece em destaque. Toque na data para ver detalhes e confirmar.</p>`;
}
