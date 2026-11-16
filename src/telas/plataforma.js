import { supabase } from '../lib/supabase.js';
import { escapar, casca, vazio, aviso, traduzirErro, comBotao } from '../lib/ui.js';

const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');

// "há 3 dias", "hoje"
function haQuanto(iso) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

// Painel da equipe do Circlle: acompanhar os grupos e suspender em caso de abuso
export async function telaPlataforma(ctx) {
  if (!ctx.plataforma) {
    location.hash = '#/';
    return;
  }

  const { data, error } = await supabase.rpc('grupos_plataforma');
  if (error) aviso(traduzirErro(error));
  const grupos = data ?? [];
  const ativos = grupos.filter((g) => g.status === 'ativa');
  const parados = ativos.filter((g) => Date.now() - new Date(g.ultima_atividade) > 14 * 86400000);
  const semana = grupos.filter((g) => Date.now() - new Date(g.created_at) < 7 * 86400000).length;

  const cartao = (g) => `
    <article class="card solicitacao" data-org="${g.id}">
      <div class="equipe__cab">
        <div>
          <p class="equipe__org">${[g.tipo, g.cidade].filter(Boolean).map(escapar).join(' · ') || 'Grupo'}</p>
          <h2 class="cartao__titulo">${escapar(g.nome)}</h2>
        </div>
        ${g.status === 'ativa' ? '' : '<span class="badge badge--declined">Suspenso</span>'}
      </div>
      <div class="grupo-numeros">
        <span><strong>${g.pessoas}</strong> ${g.pessoas === 1 ? 'pessoa' : 'pessoas'}${g.sem_conta ? ` (${g.sem_conta} sem conta)` : ''}</span>
        <span><strong>${g.datas}</strong> ${g.datas === 1 ? 'data' : 'datas'}</span>
        <span>Ativo ${escapar(haQuanto(g.ultima_atividade))}</span>
      </div>
      <p class="texto-fraco">Criado por <strong>${escapar(g.criado_por ?? '—')}</strong> em ${escapar(fmtData(g.created_at))}</p>
      <div class="acoes acoes--linha">
        ${g.status === 'ativa'
          ? '<button class="btn btn-ghost btn-sm btn-perigo" data-status="suspensa">Suspender</button>'
          : '<button class="btn btn-ghost btn-sm" data-status="ativa">Reativar</button>'}
      </div>
    </article>`;

  const filtros = [['todos', 'Todos', grupos.length], ['ativos', 'Ativos', ativos.length],
    ['parados', 'Parados há 14 dias', parados.length], ['suspensos', 'Suspensos', grupos.length - ativos.length]];

  casca(ctx, 'plataforma', `
    <main class="tela tela--com-nav">
      <div class="titulo titulo--topo">
        <p class="passo">Equipe Circlle</p>
        <h1>Grupos</h1>
        <p>${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'} · ${semana} ${semana === 1 ? 'novo' : 'novos'} nesta semana</p>
      </div>

      <div class="field">
        <label class="so-leitor" for="buscaOrg">Buscar grupo</label>
        <input id="buscaOrg" type="search" placeholder="Buscar por nome, cidade ou quem criou" />
      </div>
      <div class="chips chips--rolagem" role="group" aria-label="Filtrar">
        ${filtros.map(([id, rotulo, n]) => `
          <button type="button" class="chip" data-filtro="${id}" aria-pressed="${id === 'todos'}">
            ${rotulo} <span class="contador">${n}</span>
          </button>`).join('')}
      </div>

      <section class="secao" id="listaOrgs">
        ${grupos.map(cartao).join('') || vazio('Nenhum grupo ainda. Eles aparecem aqui assim que alguém cria o seu.')}
      </section>
      <p class="vazio" id="semResultado" hidden>Nada encontrado com esse filtro.</p>
    </main>`);

  const busca = document.querySelector('#buscaOrg');
  const aplicar = () => {
    const filtro = document.querySelector('[data-filtro][aria-pressed="true"]')?.dataset.filtro ?? 'todos';
    const termo = busca.value.trim().toLowerCase();
    let visiveis = 0;
    document.querySelectorAll('#listaOrgs [data-org]').forEach((el) => {
      const g = grupos.find((x) => x.id === el.dataset.org);
      const texto = `${g.nome} ${g.cidade ?? ''} ${g.criado_por ?? ''} ${g.tipo ?? ''}`.toLowerCase();
      const passa = {
        todos: true,
        ativos: g.status === 'ativa',
        parados: parados.includes(g),
        suspensos: g.status !== 'ativa'
      }[filtro];
      const ok = passa && (!termo || texto.includes(termo));
      el.hidden = !ok;
      if (ok) visiveis++;
    });
    document.querySelector('#semResultado').hidden = visiveis > 0 || !grupos.length;
  };
  document.querySelectorAll('[data-filtro]').forEach((chip) =>
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filtro]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      aplicar();
    }));
  busca.addEventListener('input', aplicar);

  document.querySelectorAll('[data-status]').forEach((botao) =>
    botao.addEventListener('click', async () => {
      const org = botao.closest('[data-org]');
      const nome = org.querySelector('.cartao__titulo').textContent;
      const suspender = botao.dataset.status === 'suspensa';
      if (!confirm(suspender
        ? `Suspender "${nome}"? O grupo some do app de todos os membros até você reativar.`
        : `Reativar "${nome}"?`)) return;
      const { error } = await comBotao(botao, () =>
        supabase.rpc('analisar_organizacao', { p_org: org.dataset.org, p_status: botao.dataset.status }));
      if (error) return aviso(traduzirErro(error));
      aviso(suspender ? 'Grupo suspenso.' : 'Grupo reativado.');
      telaPlataforma(ctx);
    })
  );
}
