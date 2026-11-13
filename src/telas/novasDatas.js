import { supabase } from '../lib/supabase.js';
import { escapar, casca, botaoVoltar, mostrarErro, limparMsg, traduzirErro, comBotao, aviso } from '../lib/ui.js';

const fmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const rotuloData = (iso) => fmt.format(new Date(`${iso}T12:00`)).replace('.', '').replace(' de ', ' ');

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Este mês e os dois seguintes
function proximosMeses() {
  const hoje = new Date();
  return [0, 1, 2].map((i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const nome = d.toLocaleDateString('pt-BR', d.getFullYear() === hoje.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
    return { valor: `${d.getFullYear()}-${d.getMonth()}`, nome: nome.charAt(0).toUpperCase() + nome.slice(1) };
  });
}

// Abrir várias datas de uma vez para os membros marcarem disponibilidade (RF17)
export async function telaNovasDatas(ctx, depId) {
  const { data: dep } = await supabase.from('departamentos')
    .select('id, nome, organizacao_id').eq('id', depId).maybeSingle();
  if (!dep || !ctx.coordena(dep.id, dep.organizacao_id)) {
    location.hash = '#/';
    return;
  }

  const datas = new Set();
  const hoje = isoLocal(new Date());

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(`#/dep/${dep.id}`, dep.nome)}
      <div class="titulo">
        <h1>Abrir datas</h1>
        <p>Crie as datas do período. Os membros de ${escapar(dep.nome)} vão marcar em quais podem.</p>
      </div>

      <form class="form card" novalidate>
        <div class="field">
          <label for="titulo">Nome</label>
          <input id="titulo" name="titulo" required maxlength="80" placeholder="Ex.: Apresentação na praça" />
        </div>
        <div class="field">
          <label for="local">Local (opcional)</label>
          <input id="local" name="local" maxlength="120" placeholder="Ex.: Sede do coletivo" />
        </div>
        <div class="field">
          <label for="hora">Horário</label>
          <input id="hora" name="hora" type="time" required value="19:00" />
        </div>
        <fieldset class="field repetir">
          <legend>Atalho: repetir toda semana no mês</legend>
          <div class="chips" role="group" aria-label="Dias da semana">
            ${SEMANA.map((d, i) => `<button type="button" class="chip" data-semana="${i}" aria-pressed="false">${d}</button>`).join('')}
          </div>
          <div class="linha linha--sem-margem">
            <select id="mes" aria-label="Mês">
              ${proximosMeses().map((m) => `<option value="${m.valor}">${escapar(m.nome)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" type="button" id="repetir">Adicionar</button>
          </div>
          <small class="dica">Ex.: marque Dom e escolha dezembro para abrir todos os domingos do mês.</small>
        </fieldset>

        <fieldset class="field">
          <legend>Datas</legend>
          <div class="linha linha--sem-margem">
            <input id="data" type="date" min="${hoje}" aria-label="Escolher data" />
            <button class="btn btn-ghost btn-sm" type="button" id="addData">Adicionar</button>
          </div>
          <div class="chips" id="datas"></div>
        </fieldset>
        <button class="btn btn-primary" type="submit">Abrir para disponibilidade</button>
        <p class="msg" role="status" aria-live="polite"></p>
      </form>
    </main>`);

  const form = document.querySelector('form');
  const caixa = document.querySelector('#datas');
  const campoData = document.querySelector('#data');

  const desenharDatas = () => {
    caixa.innerHTML = [...datas].sort().map((d) => `
      <span class="chip chip--fixo">${escapar(rotuloData(d))}
        <button type="button" class="chip__x" data-tirar="${d}" aria-label="Tirar ${escapar(rotuloData(d))}">×</button>
      </span>`).join('') || '<small class="dica">Nenhuma data escolhida.</small>';
    caixa.querySelectorAll('[data-tirar]').forEach((b) =>
      b.addEventListener('click', () => { datas.delete(b.dataset.tirar); desenharDatas(); }));
  };
  desenharDatas();

  const adicionar = () => {
    if (campoData.value) datas.add(campoData.value);
    campoData.value = '';
    desenharDatas();
  };
  document.querySelector('#addData').addEventListener('click', adicionar);

  // Repetir: todos os dias da semana escolhidos no mês escolhido, a partir de hoje
  const semanas = new Set();
  document.querySelectorAll('[data-semana]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.semana);
      semanas.has(d) ? semanas.delete(d) : semanas.add(d);
      b.setAttribute('aria-pressed', String(semanas.has(d)));
    }));
  document.querySelector('#repetir').addEventListener('click', () => {
    if (!semanas.size) return aviso('Escolha pelo menos um dia da semana.');
    const [ano, mes] = document.querySelector('#mes').value.split('-').map(Number);
    let novas = 0;
    for (let d = new Date(ano, mes, 1); d.getMonth() === mes; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      if (semanas.has(d.getDay()) && iso >= hoje && !datas.has(iso)) {
        datas.add(iso);
        novas++;
      }
    }
    desenharDatas();
    aviso(novas ? `${novas} ${novas === 1 ? 'data adicionada' : 'datas adicionadas'}.` : 'Essas datas já estão na lista.');
  });
  campoData.addEventListener('change', adicionar);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg(form);
    const titulo = form.titulo.value.trim();
    const local = form.local.value.trim() || null;
    const hora = form.hora.value;
    if (!titulo) return mostrarErro(form, 'Dê um nome.');
    if (!hora) return mostrarErro(form, 'Informe o horário.');
    if (!datas.size) return mostrarErro(form, 'Escolha pelo menos uma data.');

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
    aviso(`${linhas.length} ${linhas.length === 1 ? 'data aberta' : 'datas abertas'}!`);
    location.hash = `#/dep/${dep.id}`;
  });
}
