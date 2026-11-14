import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { escapar, casca, botaoVoltar, mostrarErro, limparMsg, traduzirErro, comBotao, aviso } from '../lib/ui.js';

const fmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const rotuloData = (iso) => fmt.format(new Date(`${iso}T12:00`)).replace(/\./g, '').replace(' de ', ' ');

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const curto = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(/\./g, '').replace(' de ', ' ');

// Este mês e os três seguintes
function proximosMeses() {
  const hoje = new Date();
  return [0, 1, 2, 3].map((i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const nome = d.toLocaleDateString('pt-BR', d.getFullYear() === hoje.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
    return { valor: `${d.getFullYear()}-${d.getMonth()}`, nome: nome.charAt(0).toUpperCase() + nome.slice(1) };
  });
}

// Esta semana (domingo a sábado) e as sete seguintes
function proximasSemanas() {
  const hoje = new Date();
  const domingo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
  return [...Array(8)].map((_, i) => {
    const ini = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + i * 7);
    const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
    return { valor: isoLocal(ini), nome: `${i === 0 ? 'Esta semana' : i === 1 ? 'Próxima semana' : 'Semana'} · ${curto(ini)} a ${curto(fim)}` };
  });
}

// Nova escala: avulsa, da semana ou do mês. As datas abrem para a equipe marcar se pode (RF17)
export async function telaNovasDatas(ctx, depId) {
  const { data: dep } = await supabase.from('departamentos')
    .select('id, nome, organizacao_id, organizacoes(termo_evento)').eq('id', depId).maybeSingle();
  if (!dep || !ctx.escala(dep.id, dep.organizacao_id)) {
    location.hash = '#/escalas';
    return;
  }

  const hoje = isoLocal(new Date());
  const termo = dep.organizacoes?.termo_evento;
  let tipo = 'mensal';
  const dias = new Set(); // dias da semana marcados
  const tiradas = new Set(); // datas geradas que a pessoa tirou
  const extras = new Set(); // datas avulsas acrescentadas à mão

  casca(ctx, 'escalas', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(`#/escalas/${dep.id}`, 'Escalas')}
      <div class="titulo">
        <p class="passo">${escapar(dep.nome)}</p>
        <h1>Nova escala</h1>
        <p>As datas abrem para a equipe marcar em quais pode. Depois você monta a escala com quem marcou.</p>
      </div>

      <form class="form card" novalidate>
        <fieldset class="field">
          <legend>Tipo</legend>
          <div class="segmentos" role="group" aria-label="Tipo de escala">
            <button type="button" data-tipo="avulsa" aria-pressed="false">Avulsa</button>
            <button type="button" data-tipo="semanal" aria-pressed="false">Semanal</button>
            <button type="button" data-tipo="mensal" aria-pressed="true">Mensal</button>
          </div>
        </fieldset>

        <div class="field" data-so="avulsa" hidden>
          <label for="dataAvulsa">Data</label>
          <input id="dataAvulsa" type="date" min="${hoje}" />
        </div>
        <div class="field" data-so="semanal" hidden>
          <label for="semana">Semana</label>
          <select id="semana">
            ${proximasSemanas().map((s) => `<option value="${s.valor}">${escapar(s.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field" data-so="mensal">
          <label for="mes">Mês</label>
          <select id="mes">
            ${proximosMeses().map((m) => `<option value="${m.valor}">${escapar(m.nome)}</option>`).join('')}
          </select>
        </div>
        <fieldset class="field" data-so="semanal mensal">
          <legend>Em quais dias da semana</legend>
          <div class="chips" role="group" aria-label="Dias da semana">
            ${SEMANA.map((d, i) => `<button type="button" class="chip" data-dia="${i}" aria-pressed="false">${d}</button>`).join('')}
          </div>
        </fieldset>

        <div class="field">
          <label for="titulo">Nome</label>
          <input id="titulo" name="titulo" required maxlength="80" placeholder="Ex.: Apresentação na praça"
            value="${escapar(termo && termo !== 'Evento' ? termo : '')}" />
        </div>
        <div class="linha linha--sem-margem form-duas">
          <div class="field">
            <label for="hora">Horário</label>
            <input id="hora" name="hora" type="time" required value="19:00" />
          </div>
          <div class="field">
            <label for="local">Local (opcional)</label>
            <input id="local" name="local" maxlength="120" placeholder="Ex.: Sede" />
          </div>
        </div>

        <fieldset class="field">
          <legend>Datas desta escala <span class="contador" id="total">0</span></legend>
          <div class="chips" id="datas"></div>
          <div class="linha linha--sem-margem" data-so="semanal mensal">
            <input id="extra" type="date" min="${hoje}" aria-label="Acrescentar outra data" />
            <button class="btn btn-ghost btn-sm" type="button" id="addExtra">+ Outra data</button>
          </div>
        </fieldset>
        <button class="btn btn-primary" type="submit">Criar escala</button>
        <p class="msg" role="status" aria-live="polite"></p>
      </form>
    </main>`);

  const form = document.querySelector('form');
  const caixa = document.querySelector('#datas');
  const $ = (sel) => document.querySelector(sel);

  // As datas saem do tipo escolhido; a pessoa ainda pode tirar ou acrescentar
  const gerar = () => {
    const lista = new Set();
    if (tipo === 'avulsa') {
      if ($('#dataAvulsa').value >= hoje) lista.add($('#dataAvulsa').value);
      return lista;
    }
    let inicio;
    let fim;
    if (tipo === 'semanal') {
      inicio = new Date(`${$('#semana').value}T12:00`);
      fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 12);
    } else {
      const [ano, mes] = $('#mes').value.split('-').map(Number);
      inicio = new Date(ano, mes, 1, 12);
      fim = new Date(ano, mes + 1, 0, 12);
    }
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      if (dias.has(d.getDay()) && iso >= hoje && !tiradas.has(iso)) lista.add(iso);
    }
    for (const iso of extras) lista.add(iso);
    return lista;
  };

  let datas = new Set();
  const desenhar = () => {
    datas = gerar();
    $('#total').textContent = datas.size;
    caixa.innerHTML = [...datas].sort().map((d) => `
      <span class="chip chip--fixo">${escapar(rotuloData(d))}
        ${tipo === 'avulsa' ? '' : `<button type="button" class="chip__x" data-tirar="${d}" aria-label="Tirar ${escapar(rotuloData(d))}">×</button>`}
      </span>`).join('')
      || `<small class="dica">${tipo === 'avulsa' ? 'Escolha a data.' : 'Marque os dias da semana para ver as datas.'}</small>`;
    caixa.querySelectorAll('[data-tirar]').forEach((b) =>
      b.addEventListener('click', () => {
        extras.delete(b.dataset.tirar);
        tiradas.add(b.dataset.tirar);
        desenhar();
      }));
  };

  const mostrarTipo = () => {
    document.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)));
    document.querySelectorAll('[data-so]').forEach((el) => { el.hidden = !el.dataset.so.split(' ').includes(tipo); });
    desenhar();
  };
  document.querySelectorAll('[data-tipo]').forEach((b) =>
    b.addEventListener('click', () => {
      tipo = b.dataset.tipo;
      tiradas.clear();
      extras.clear();
      mostrarTipo();
    }));
  document.querySelectorAll('[data-dia]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.dia);
      dias.has(d) ? dias.delete(d) : dias.add(d);
      b.setAttribute('aria-pressed', String(dias.has(d)));
      desenhar();
    }));
  ['#dataAvulsa', '#semana', '#mes'].forEach((sel) =>
    $(sel).addEventListener('change', () => { tiradas.clear(); desenhar(); }));
  $('#addExtra').addEventListener('click', () => {
    const v = $('#extra').value;
    if (!v || v < hoje) return aviso('Escolha uma data a partir de hoje.');
    extras.add(v);
    tiradas.delete(v);
    $('#extra').value = '';
    desenhar();
  });
  mostrarTipo();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg(form);
    const titulo = form.titulo.value.trim();
    const local = form.local.value.trim() || null;
    const hora = form.hora.value;
    if (!datas.size) return mostrarErro(form, tipo === 'avulsa' ? 'Escolha a data.' : 'Marque pelo menos um dia da semana.');
    if (!titulo) return mostrarErro(form, 'Dê um nome.');
    if (!hora) return mostrarErro(form, 'Informe o horário.');

    const linhas = [...datas].sort().map((d) => ({
      departamento_id: dep.id,
      titulo,
      local,
      inicio: new Date(`${d}T${hora}`).toISOString(),
      status: 'aberto'
    }));
    const { error } = await comBotao(form.querySelector('button[type="submit"]'), () =>
      supabase.from('eventos').insert(linhas));
    if (error) return mostrarErro(form, traduzirErro(error));
    notificar('datas_abertas', { departamento_id: dep.id, quantidade: linhas.length });
    aviso(`Escala criada com ${linhas.length} ${linhas.length === 1 ? 'data' : 'datas'}! A equipe já pode marcar.`);
    location.hash = `#/escalas/${dep.id}`;
  });
}
