import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import {
  escapar, formatarData, diaMes, casca, icone, vazio, aviso, traduzirErro, comBotao, STATUS_EVENTO,
  linkWhats, textoEscala
} from '../lib/ui.js';

const CHAVE_DEP = 'circlle:escalas-dep';
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

// Escalas: criar (avulsa, semanal, mensal), montar, enviar prévia e publicar (RF17–RF24)
export async function telaEscalas(ctx, depParam) {
  const deps = ctx.depsEscala;
  if (!deps.length) {
    location.hash = '#/';
    return;
  }
  let lembrado = null;
  try { lembrado = localStorage.getItem(CHAVE_DEP); } catch { /* sem armazenamento */ }
  const dep = deps.find((d) => d.id === depParam) ?? deps.find((d) => d.id === lembrado) ?? deps[0];
  try { localStorage.setItem(CHAVE_DEP, dep.id); } catch { /* sem armazenamento */ }

  const [eventosRes, pedidosRes] = await Promise.all([
    supabase.from('eventos').select('id, titulo, local, inicio, status, disponibilidades(count), escalas(count)')
      .eq('departamento_id', dep.id).gte('inicio', new Date(Date.now() - 86400000).toISOString()).order('inicio'),
    dep.coordena
      ? supabase.from('membros_departamento').select('usuario_id', { count: 'exact', head: true })
          .eq('departamento_id', dep.id).eq('status', 'pendente')
      : { count: 0 }
  ]);
  const eventos = eventosRes.data ?? [];
  const pedidos = pedidosRes.count ?? 0;

  casca(ctx, 'escalas', `
    <main class="tela tela--com-nav">
      <div class="titulo titulo--topo">
        <h1>Escalas</h1>
      </div>

      ${deps.length > 1 ? `
        <div class="chips chips--rolagem" role="group" aria-label="Departamento">
          ${deps.map((d) => `
            <a class="chip" href="#/escalas/${d.id}" aria-pressed="${d.id === dep.id}">${escapar(d.nome)}</a>`).join('')}
        </div>` : ''}

      <div class="escalas__acoes">
        <a class="btn btn-primary" href="#/escalas/${dep.id}/nova">${icone.mais()} Nova escala</a>
        ${dep.coordena ? `
          <a class="btn btn-ghost" href="#/dep/${dep.id}">${icone.equipe()} Equipe e ajustes
            ${pedidos ? `<span class="contador">${pedidos}</span>` : ''}</a>` : ''}
      </div>

      ${eventos.length ? meses(eventos).map(([nomeMes, lista]) => {
        const comEscala = lista.filter((e) => (e.escalas?.[0]?.count ?? 0) > 0);
        const paraPrevia = comEscala.filter((e) => ['rascunho', 'aberto'].includes(e.status));
        const paraPublicar = comEscala.filter((e) => ['rascunho', 'aberto', 'previa'].includes(e.status));
        const abertas = lista.filter((e) => e.status === 'aberto');
        const enviadas = lista.filter((e) => ['previa', 'publicado'].includes(e.status));
        return `
          <section class="secao mes-bloco" data-mes="${escapar(nomeMes)}">
            <div class="mes-bloco__cab">
              <h2>${escapar(nomeMes)}</h2>
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
                        <span>${escapar(formatarData(e.inicio).split(' · ')[1])} · ${disp} ${disp === 1 ? 'pode' : 'podem'} · ${esc} ${esc === 1 ? 'escalado' : 'escalados'}</span>
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
          </section>`;
      }).join('') : `
        <section class="card vazio-guia">
          <h2 class="cartao__titulo">Nenhuma escala em andamento</h2>
          <p class="texto-fraco">Crie uma escala avulsa, da semana ou do mês. A equipe marca em quais datas pode,
          e você monta a escala com quem marcou.</p>
        </section>`}
    </main>`);

  // WhatsApp: datas para marcar ou escala do mês (RF32)
  document.querySelectorAll('[data-whats]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ids = b.dataset.ids.split(',');
      const mes = b.closest('[data-mes]').dataset.mes;
      // Abre a janela antes da consulta para o navegador não bloquear
      const janela = window.open('', '_blank');
      const lista = eventos.filter((e) => ids.includes(e.id));
      let texto;
      if (b.dataset.whats === 'datas') {
        texto = [`*${dep.nome} · ${mes}*`, 'Marque no Circlle em quais datas você pode:', '',
          ...lista.map((e) => `• ${formatarData(e.inicio)} — ${e.titulo}`), '', `${location.origin}/#/calendario`].join('\n');
      } else {
        const { data, error } = await supabase.from('escalas')
          .select('evento_id, perfis(nome), escala_funcoes(funcoes(nome))').in('evento_id', ids);
        if (error) {
          janela?.close();
          return aviso(traduzirErro(error));
        }
        const blocos = lista.map((e) => textoEscala(e, null, (data ?? []).filter((s) => s.evento_id === e.id)));
        texto = [`*Escala de ${dep.nome} · ${mes}*`, '', blocos.join('\n\n'), '',
          `Confirme no Circlle: ${location.origin}/#/`].join('\n');
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
      telaEscalas(ctx, dep.id);
    })
  );
}
