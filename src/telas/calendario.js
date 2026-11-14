import { supabase } from '../lib/supabase.js';
import { escapar, casca, icone, vazio, aviso, traduzirErro, comBotao, nomesFuncoes, badgeResposta, STATUS_EVENTO } from '../lib/ui.js';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' });

const chaveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const primeiroDoMes = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const PREF = 'circlle:calendario-visao';
const lerVisao = () => { try { return localStorage.getItem(PREF) || 'mes'; } catch { return 'mes'; } };
const gravarVisao = (v) => { try { localStorage.setItem(PREF, v); } catch { /* sem armazenamento */ } };

// Mantém o mês e o dia escolhidos enquanto a pessoa navega pelo app
let mesVisivel = primeiroDoMes(new Date());
let diaEscolhido = chaveDia(new Date());

// Calendário pessoal: mês com as marcações e lista de todas as escalas
export async function telaCalendario(ctx) {
  const eu = ctx.usuario.id;
  const depsAtivos = ctx.ativos.map((v) => v.departamento_id);

  // Departamentos em que a pessoa monta escalas (coordena, administra ou tem a permissão)
  const coordena = new Set(ctx.depsEscala.map((d) => d.id));

  const [minhasRes, abertosRes, dispRes, coordRes] = await Promise.all([
    supabase.from('escalas')
      .select('id, resposta, escala_funcoes(funcoes(nome)), eventos!inner(id, titulo, local, inicio, status, departamentos(nome))')
      .eq('usuario_id', eu)
      .in('eventos.status', ['previa', 'publicado', 'realizado']),
    depsAtivos.length
      ? supabase.from('eventos').select('id, titulo, local, inicio, departamento_id, departamentos(nome)')
          .in('departamento_id', depsAtivos).eq('status', 'aberto')
      : { data: [] },
    supabase.from('disponibilidades').select('evento_id').eq('usuario_id', eu),
    coordena.size
      ? supabase.from('eventos').select('id, titulo, local, inicio, status, departamento_id, departamentos(nome), escalas(count), disponibilidades(count)')
          .in('departamento_id', [...coordena]).neq('status', 'cancelado')
      : { data: [] }
  ]);

  const erro = minhasRes.error ?? abertosRes.error ?? dispRes.error ?? coordRes.error;
  if (erro) aviso(traduzirErro(erro));

  const minhas = (minhasRes.data ?? []).sort((a, b) => a.eventos.inicio.localeCompare(b.eventos.inicio));
  const marcados = new Set((dispRes.data ?? []).map((d) => d.evento_id));
  const coordEventos = coordRes.data ?? [];
  const idsCoord = new Set(coordEventos.map((e) => e.id));
  // Datas abertas dos departamentos que a pessoa coordena aparecem como coordenação
  const abertos = (abertosRes.data ?? []).filter((e) => !idsCoord.has(e.id));

  // Tudo o que acontece em cada dia
  const porDia = new Map();
  const add = (iso, item) => {
    const k = chaveDia(new Date(iso));
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(item);
  };
  for (const e of minhas) add(e.eventos.inicio, { tipo: 'escalado', ev: e.eventos, escala: e });
  for (const e of abertos) add(e.inicio, { tipo: 'aberto', ev: e });
  for (const e of coordEventos) add(e.inicio, { tipo: 'coord', ev: e });
  for (const itens of porDia.values()) itens.sort((a, b) => a.ev.inicio.localeCompare(b.ev.inicio));

  const hoje = chaveDia(new Date());
  const agora = new Date().toISOString();
  const inicioDeHoje = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  let visao = lerVisao();

  // ---------- Peças ----------
  const marcas = (itens) => {
    const tem = (t, f = () => true) => itens.some((i) => i.tipo === t && f(i));
    return [
      tem('escalado') ? '<span class="marca marca--escalado"></span>' : '',
      tem('aberto', (i) => !marcados.has(i.ev.id)) ? '<span class="marca marca--aberto"></span>' : '',
      tem('aberto', (i) => marcados.has(i.ev.id)) ? `<span class="marca marca--posso">${icone.check(10)}</span>` : '',
      tem('coord') ? '<span class="marca marca--coord"></span>' : ''
    ].join('');
  };

  const descreverDia = (itens) => itens.map((i) => {
    if (i.tipo === 'escalado') return `escalado em ${i.ev.titulo}`;
    if (i.tipo === 'aberto') return marcados.has(i.ev.id) ? `marcou que pode em ${i.ev.titulo}` : `${i.ev.titulo} aberta para marcar`;
    return `${i.ev.titulo}, que você organiza`;
  }).join('; ');

  const itemDia = (i) => {
    const hora = fmtHora.format(new Date(i.ev.inicio));
    const dep = i.ev.departamentos?.nome ?? '';
    if (i.tipo === 'escalado') {
      return `
        <a class="evento-dia evento-dia--escalado" href="#/evento/${i.ev.id}">
          <span class="evento-dia__hora">${hora}</span>
          <span class="lista__texto">
            <strong>${escapar(i.ev.titulo)}</strong>
            <small>${escapar(dep)} · ${escapar(nomesFuncoes(i.escala))}</small>
            <span class="evento-dia__badges">
              ${i.ev.status === 'previa' ? '<span class="badge badge--reassign">Prévia</span>' : ''}
              ${i.ev.status === 'realizado' ? '' : badgeResposta(i.escala.resposta)}
            </span>
          </span>
          ${icone.seta()}
        </a>`;
    }
    if (i.tipo === 'aberto') {
      const marcado = marcados.has(i.ev.id);
      return `
        <div class="evento-dia evento-dia--aberto">
          <span class="evento-dia__hora">${hora}</span>
          <span class="lista__texto">
            <strong>${escapar(i.ev.titulo)}</strong>
            <small>${escapar(dep)}${i.ev.local ? ` · ${escapar(i.ev.local)}` : ''}</small>
          </span>
          <button class="chip chip--posso" data-posso="${i.ev.id}" aria-pressed="${marcado}">
            ${marcado ? `${icone.check(16)} Posso` : 'Posso'}
          </button>
        </div>`;
    }
    const [rotulo, classe] = STATUS_EVENTO[i.ev.status];
    const disp = i.ev.disponibilidades?.[0]?.count ?? 0;
    const esc = i.ev.escalas?.[0]?.count ?? 0;
    return `
      <a class="evento-dia evento-dia--coord" href="#/evento/${i.ev.id}">
        <span class="evento-dia__hora">${hora}</span>
        <span class="lista__texto">
          <strong>${escapar(i.ev.titulo)}</strong>
          <small>Você organiza · ${escapar(dep)} · ${disp} ${disp === 1 ? 'disponível' : 'disponíveis'} · ${esc} ${esc === 1 ? 'escalado' : 'escalados'}</small>
          <span class="evento-dia__badges"><span class="badge ${classe}">${rotulo}</span></span>
        </span>
        ${icone.seta()}
      </a>`;
  };

  const visaoMes = () => {
    const inicio = mesVisivel;
    const deslocamento = inicio.getDay();
    const diasNoMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < deslocamento; i++) celulas.push('<span class="cal__vazio" aria-hidden="true"></span>');
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const data = new Date(inicio.getFullYear(), inicio.getMonth(), dia);
      const k = chaveDia(data);
      const itens = porDia.get(k) ?? [];
      const rotulo = `${fmtDiaLongo.format(data)}${itens.length ? `: ${descreverDia(itens)}` : ''}`;
      celulas.push(`
        <button class="cal__dia ${k === hoje ? 'cal__dia--hoje' : ''} ${k < hoje ? 'cal__dia--passado' : ''}"
          data-dia="${k}" aria-pressed="${k === diaEscolhido}" aria-label="${escapar(rotulo)}">
          <span class="cal__num">${dia}</span>
          <span class="cal__marcas" aria-hidden="true">${marcas(itens)}</span>
        </button>`);
    }

    const itensDia = porDia.get(diaEscolhido) ?? [];
    const [a, m, d] = diaEscolhido.split('-').map(Number);

    return `
      <div class="cal card">
        <div class="cal__cab">
          <button class="icone-botao" id="mesAnterior" aria-label="Mês anterior">${icone.anterior()}</button>
          <h2 class="cal__titulo">${escapar(maiuscula(fmtMes.format(inicio)))}</h2>
          <button class="icone-botao" id="mesProximo" aria-label="Próximo mês">${icone.proximo()}</button>
        </div>
        <div class="cal__grade">
          ${DIAS.map((d) => `<span class="cal__semana" aria-hidden="true">${d}</span>`).join('')}
          ${celulas.join('')}
        </div>
        <ul class="cal__legenda">
          <li><span class="marca marca--escalado"></span> Escalado</li>
          <li><span class="marca marca--aberto"></span> Aberta para marcar</li>
          <li><span class="marca marca--posso">${icone.check(10)}</span> Marquei “posso”</li>
          ${coordena.size ? '<li><span class="marca marca--coord"></span> Eu organizo</li>' : ''}
        </ul>
      </div>

      <section class="secao" aria-live="polite">
        <h2>${escapar(maiuscula(fmtDiaLongo.format(new Date(a, m - 1, d))))}</h2>
        <div class="lista">${itensDia.map(itemDia).join('') || vazio('Nada neste dia.')}</div>
      </section>`;
  };

  const visaoLista = () => {
    const proximas = minhas.filter((e) => e.eventos.inicio >= inicioDeHoje);
    const anteriores = minhas.filter((e) => e.eventos.inicio < inicioDeHoje).reverse();
    const abertasPendentes = abertos.filter((e) => e.inicio >= agora && !marcados.has(e.id))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    const porMes = new Map();
    for (const e of proximas) {
      const k = maiuscula(fmtMes.format(new Date(e.eventos.inicio)));
      if (!porMes.has(k)) porMes.set(k, []);
      porMes.get(k).push(e);
    }

    const cartao = (e) => {
      const data = new Date(e.eventos.inicio);
      return `
        <a class="lista__item lista__item--link escala-cartao" href="#/evento/${e.eventos.id}">
          <div class="data__dia"><strong>${String(data.getDate()).padStart(2, '0')}</strong><span>${escapar(fmtDiaCurto.format(data).split(',')[0].replace('.', ''))}</span></div>
          <span class="lista__texto">
            <strong>${escapar(e.eventos.titulo)}</strong>
            <small>${fmtHora.format(data)} · ${escapar(e.eventos.departamentos?.nome ?? '')}</small>
            <small class="escala-cartao__funcao">${escapar(nomesFuncoes(e))}</small>
            <span class="evento-dia__badges">
              ${e.eventos.status === 'previa' ? '<span class="badge badge--reassign">Prévia</span>' : ''}
              ${e.eventos.status === 'realizado' ? '' : badgeResposta(e.resposta)}
            </span>
          </span>
          ${icone.seta()}
        </a>`;
    };

    return `
      ${proximas.length ? [...porMes.entries()].map(([mes, itens]) => `
        <section class="secao">
          <h2>${escapar(mes)} <span class="contador">${itens.length}</span></h2>
          <div class="lista">${itens.map(cartao).join('')}</div>
        </section>`).join('') : `
        <section class="card vazio-guia">
          <h2 class="cartao__titulo">Você ainda não está em nenhuma escala</h2>
          <p class="texto-fraco">Quando o coordenador montar uma escala com você, ela aparece aqui.
          ${abertasPendentes.length ? 'Enquanto isso, marque os dias em que você pode:' : ''}</p>
        </section>`}

      ${abertasPendentes.length ? `
        <section class="secao">
          <h2>Datas esperando você marcar <span class="contador">${abertasPendentes.length}</span></h2>
          <div class="lista">${abertasPendentes.map((e) => itemDia({ tipo: 'aberto', ev: e })).join('')}</div>
        </section>` : ''}

      ${anteriores.length ? `
        <details class="secao outros">
          <summary>Escalas anteriores (${anteriores.length})</summary>
          <div class="lista">${anteriores.map(cartao).join('')}</div>
        </details>` : ''}`;
  };

  const render = () => {
    const aguardando = minhas.filter((e) => e.resposta === 'pendente' && e.eventos.inicio >= agora
      && ['previa', 'publicado'].includes(e.eventos.status)).length;

    casca(ctx, 'calendario', `
      <main class="tela tela--com-nav">
        <div class="secao__cab">
          <div class="titulo"><h1>Calendário</h1></div>
          <div class="segmentos" role="group" aria-label="Modo de visualização">
            <button data-visao="mes" aria-pressed="${visao === 'mes'}">${icone.calendario(16)} Mês</button>
            <button data-visao="lista" aria-pressed="${visao === 'lista'}">${icone.lista(16)} Lista</button>
          </div>
        </div>

        ${aguardando ? `
          <p class="card aviso-card">
            ${aguardando === 1 ? '<strong>1 escala</strong> espera' : `<strong>${aguardando} escalas</strong> esperam`} sua resposta.
            Toque nela para confirmar ou pedir ajuste.
          </p>` : ''}

        ${visao === 'mes' ? visaoMes() : visaoLista()}
      </main>`);
    ligar();
  };

  const ligar = () => {
    document.querySelectorAll('[data-visao]').forEach((b) =>
      b.addEventListener('click', () => {
        visao = b.dataset.visao;
        gravarVisao(visao);
        render();
      }));

    document.querySelector('#mesAnterior')?.addEventListener('click', () => {
      mesVisivel = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1);
      render();
    });
    document.querySelector('#mesProximo')?.addEventListener('click', () => {
      mesVisivel = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1);
      render();
    });
    document.querySelectorAll('[data-dia]').forEach((b) =>
      b.addEventListener('click', () => {
        diaEscolhido = b.dataset.dia;
        render();
        document.querySelector(`[data-dia="${diaEscolhido}"]`)?.focus();
      }));

    document.querySelectorAll('[data-posso]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.posso;
        const marcado = marcados.has(id);
        const { error } = await comBotao(b, () => marcado
          ? supabase.from('disponibilidades').delete().eq('evento_id', id).eq('usuario_id', eu)
          : supabase.from('disponibilidades').insert({ evento_id: id, usuario_id: eu }));
        if (error) return aviso(traduzirErro(error));
        marcado ? marcados.delete(id) : marcados.add(id);
        render();
      }));
  };

  render();
}
