import { supabase } from '../lib/supabase.js';
import { escapar } from '../lib/ui.js';

const numero = new Intl.NumberFormat('pt-BR');
const diaMesCurto = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function haQuanto(iso) {
  if (!iso) return 'sem atividade';
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  return `há ${Math.floor(dias / 30)} ${dias < 60 ? 'mês' : 'meses'}`;
}

// Painel da equipe Circlle no início: só números agregados (RN14)
export async function htmlPainelPlataforma() {
  const { data: p, error } = await supabase.rpc('painel_plataforma');
  if (error || !p) {
    return `<section class="secao"><h2>Painel do Circlle</h2><p class="vazio">Não foi possível carregar os números agora.</p></section>`;
  }

  const tile = (rotulo, valor, detalhe = '', rota = '') => {
    const conteudo = `
      <span class="kpi__rotulo">${escapar(rotulo)}</span>
      <strong class="kpi__valor">${numero.format(valor ?? 0)}</strong>
      ${detalhe ? `<span class="kpi__detalhe">${detalhe}</span>` : ''}`;
    return rota ? `<a class="kpi kpi--link" href="${rota}">${conteudo}</a>` : `<div class="kpi">${conteudo}</div>`;
  };

  // Gráfico de barras: novas contas por semana (uma série, sem legenda)
  const semanas = p.contas_por_semana ?? [];
  const maximo = Math.max(1, ...semanas.map((s) => s.total));
  const totalPeriodo = semanas.reduce((soma, s) => soma + s.total, 0);
  const barras = semanas.map((s, i) => {
    const altura = s.total ? Math.max(4, Math.round((s.total / maximo) * 120)) : 0; // px, trilho de 120px
    const rotulo = `Semana de ${diaMesCurto(s.semana)}: ${s.total} ${s.total === 1 ? 'conta nova' : 'contas novas'}`;
    const ultima = i === semanas.length - 1;
    return `
      <div class="barras__coluna" tabindex="0" aria-label="${escapar(rotulo)}">
        <span class="barras__dica" role="tooltip">${escapar(rotulo)}</span>
        <div class="barras__trilho">
          ${ultima && s.total ? `<span class="barras__valor">${s.total}</span>` : ''}
          <div class="barras__barra" style="height:${altura}px"></div>
        </div>
        <span class="barras__eixo">${diaMesCurto(s.semana)}</span>
      </div>`;
  }).join('');

  const grupos = p.uso_por_grupo ?? [];

  return `
    <section class="secao painel">
      <div class="secao__cab">
        <h2>Painel do Circlle</h2>
        <a class="link-sutil" href="#/plataforma">Ver grupos</a>
      </div>

      <div class="kpis">
        ${tile('Grupos ativos', p.grupos.ativos,
          p.grupos.em_analise ? `<span class="badge badge--pending">${p.grupos.em_analise} em análise</span>` : 'nenhum em análise',
          '#/plataforma')}
        ${tile('Departamentos', p.departamentos)}
        ${tile('Pessoas no app', p.pessoas, `${numero.format(p.membros_ativos)} em departamentos`)}
        ${tile('Pedidos para entrar', p.pedidos_pendentes, 'aguardando coordenadores')}
        ${tile('Datas nos próximos 30 dias', p.datas_proximas)}
        ${tile('Escalas publicadas', p.escalas_publicadas_30d, 'janela de 30 dias')}
        ${tile('“Posso” marcados', p.disponibilidades_30d, 'últimos 30 dias')}
      </div>

      <figure class="card grafico">
        <figcaption>
          <strong>Novas contas por semana</strong>
          <span>${numero.format(totalPeriodo)} nas últimas 8 semanas</span>
        </figcaption>
        <div class="barras">${barras}</div>
        <table class="so-leitor">
          <caption>Novas contas por semana</caption>
          <thead><tr><th>Semana</th><th>Contas novas</th></tr></thead>
          <tbody>${semanas.map((s) => `<tr><td>${diaMesCurto(s.semana)}</td><td>${s.total}</td></tr>`).join('')}</tbody>
        </table>
      </figure>

      <div class="card">
        <h3 class="grafico__titulo">Uso por grupo</h3>
        ${grupos.length ? `
          <div class="tabela-rolagem">
            <table class="tabela">
              <thead>
                <tr><th scope="col">Grupo</th><th scope="col">Deps.</th><th scope="col">Membros</th><th scope="col">Datas 30d</th><th scope="col">Atividade</th></tr>
              </thead>
              <tbody>
                ${grupos.map((g) => `
                  <tr>
                    <th scope="row">${escapar(g.nome)}<small>${escapar(g.cidade ?? '')}</small></th>
                    <td>${g.departamentos}</td>
                    <td>${g.membros}</td>
                    <td>${g.datas_30d}</td>
                    <td>${haQuanto(g.ultima_atividade)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="vazio">Nenhum grupo ativo ainda.</p>'}
      </div>
    </section>`;
}
