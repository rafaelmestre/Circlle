import { supabase } from '../lib/supabase.js';
import { escapar, casca, vazio, aviso, traduzirErro, comBotao } from '../lib/ui.js';

const STATUS = {
  em_analise: ['Em análise', 'badge--pending'],
  ativa: ['Ativa', 'badge--confirmed'],
  recusada: ['Recusada', 'badge--declined'],
  suspensa: ['Suspensa', 'badge--declined']
};

// Painel da equipe do Circlle: aprovar, recusar e suspender grupos (RF07)
export async function telaPlataforma(ctx) {
  if (!ctx.plataforma) {
    location.hash = '#/';
    return;
  }

  const { data, error } = await supabase.from('organizacoes')
    .select('id, nome, tipo, cidade, tamanho, whatsapp, email, status, created_at, perfis!organizacoes_solicitado_por_fkey(nome)')
    .order('created_at', { ascending: false });
  if (error) aviso(traduzirErro(error));
  const orgs = data ?? [];
  const pendentes = orgs.filter((o) => o.status === 'em_analise');
  const demais = orgs.filter((o) => o.status !== 'em_analise');

  const zap = (numero) => `https://wa.me/55${String(numero ?? '').replace(/\D/g, '').replace(/^55/, '')}`;

  const cartao = (o) => {
    const [rotulo, classe] = STATUS[o.status];
    return `
      <article class="card solicitacao" data-org="${o.id}">
        <div class="equipe__cab">
          <div>
            <p class="equipe__org">${escapar(o.tipo ?? '')} · ${escapar(o.cidade ?? '')} · ${escapar(o.tamanho ?? '')} pessoas</p>
            <h2 class="cartao__titulo">${escapar(o.nome)}</h2>
          </div>
          <span class="badge ${classe}">${rotulo}</span>
        </div>
        <p class="texto-fraco">
          Solicitado por <strong>${escapar(o.perfis?.nome ?? '—')}</strong>
          em ${new Date(o.created_at).toLocaleDateString('pt-BR')}<br>
          <a href="${zap(o.whatsapp)}" target="_blank" rel="noopener">${escapar(o.whatsapp ?? '')}</a> ·
          <a href="mailto:${escapar(o.email ?? '')}">${escapar(o.email ?? '')}</a>
        </p>
        <div class="acoes acoes--linha">
          ${o.status === 'em_analise' ? `
            <button class="btn btn-ghost btn-sm" data-status="recusada">Recusar</button>
            <button class="btn btn-primary btn-sm" data-status="ativa">Aprovar</button>` : ''}
          ${o.status === 'ativa' ? '<button class="btn btn-ghost btn-sm btn-perigo" data-status="suspensa">Suspender</button>' : ''}
          ${o.status === 'suspensa' || o.status === 'recusada' ? '<button class="btn btn-ghost btn-sm" data-status="ativa">Ativar</button>' : ''}
        </div>
      </article>`;
  };

  const contar = (st) => orgs.filter((o) => o.status === st).length;
  const filtros = [['todas', 'Todos', orgs.length], ['em_analise', 'Em análise', pendentes.length],
    ['ativa', 'Ativos', contar('ativa')], ['suspensa', 'Suspensos', contar('suspensa')], ['recusada', 'Recusados', contar('recusada')]];

  casca(ctx, 'plataforma', `
    <main class="tela tela--com-nav">
      <div class="titulo titulo--topo">
        <p class="passo">Equipe Circlle</p>
        <h1>Assinantes</h1>
        <p>${orgs.length} ${orgs.length === 1 ? 'grupo' : 'grupos'} · ${pendentes.length} em análise</p>
      </div>

      <div class="field">
        <label class="so-leitor" for="buscaOrg">Buscar assinante</label>
        <input id="buscaOrg" type="search" placeholder="Buscar por nome, cidade ou responsável" />
      </div>
      <div class="chips" role="group" aria-label="Filtrar por situação">
        ${filtros.map(([id, rotulo, n]) => `
          <button type="button" class="chip" data-filtro="${id}" aria-pressed="${id === (pendentes.length ? 'em_analise' : 'todas')}">
            ${rotulo} <span class="contador">${n}</span>
          </button>`).join('')}
      </div>

      <section class="secao" id="listaOrgs">
        ${[...pendentes, ...demais].map(cartao).join('') || vazio('Nenhum assinante ainda.')}
      </section>
      <p class="vazio" id="semResultado" hidden>Nada encontrado com esse filtro.</p>
    </main>`);

  // Filtro por situação e busca, sem nova consulta
  const busca = document.querySelector('#buscaOrg');
  const aplicar = () => {
    const filtro = document.querySelector('[data-filtro][aria-pressed="true"]')?.dataset.filtro ?? 'todas';
    const termo = busca.value.trim().toLowerCase();
    let visiveis = 0;
    document.querySelectorAll('#listaOrgs [data-org]').forEach((cartaoEl) => {
      const o = orgs.find((x) => x.id === cartaoEl.dataset.org);
      const texto = `${o.nome} ${o.cidade ?? ''} ${o.perfis?.nome ?? ''} ${o.tipo ?? ''}`.toLowerCase();
      const ok = (filtro === 'todas' || o.status === filtro) && (!termo || texto.includes(termo));
      cartaoEl.hidden = !ok;
      if (ok) visiveis++;
    });
    document.querySelector('#semResultado').hidden = visiveis > 0 || !orgs.length;
  };
  document.querySelectorAll('[data-filtro]').forEach((chip) =>
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filtro]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      aplicar();
    }));
  busca.addEventListener('input', aplicar);
  aplicar();

  const textos = { ativa: 'aprovar/ativar', recusada: 'recusar', suspensa: 'suspender' };
  document.querySelectorAll('[data-status]').forEach((botao) =>
    botao.addEventListener('click', async () => {
      const org = botao.closest('[data-org]');
      const nome = org.querySelector('.cartao__titulo').textContent;
      if (!confirm(`Confirma ${textos[botao.dataset.status]} "${nome}"?`)) return;
      const { error } = await comBotao(botao, () =>
        supabase.rpc('analisar_organizacao', { p_org: org.dataset.org, p_status: botao.dataset.status }));
      if (error) return aviso(traduzirErro(error));
      aviso('Feito!');
      telaPlataforma(ctx);
    })
  );
}
