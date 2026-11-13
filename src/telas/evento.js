import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, formatarData, casca, icone, botaoVoltar, vazio, aviso, traduzirErro, comBotao } from '../lib/ui.js';

// Evento: o coordenador escala a partir das disponibilidades (RF22, RF24);
// o membro vê a escala publicada.
export async function telaEvento(ctx, eventoId) {
  const { data: ev } = await supabase.from('eventos')
    .select('id, titulo, local, inicio, status, departamento_id, departamentos(id, nome, organizacao_id)')
    .eq('id', eventoId).maybeSingle();
  if (!ev) {
    location.hash = '#/';
    return aviso('Data não encontrada.');
  }

  const dep = ev.departamentos;
  const coord = ctx.coordena(dep.id, dep.organizacao_id);
  return coord ? escalar(ctx, ev, dep) : verEscala(ctx, ev, dep);
}

const cabecalho = (ev, dep, voltar) => `
  ${botaoVoltar(voltar, voltar === '#/' ? 'Início' : dep.nome)}
  <div class="titulo">
    <p class="passo">${escapar(dep.nome)}</p>
    <h1>${escapar(ev.titulo)}</h1>
    <div class="meta">
      <span>${icone.relogio()} ${escapar(formatarData(ev.inicio))}</span>
      ${ev.local ? `<span>${icone.local()} ${escapar(ev.local)}</span>` : ''}
    </div>
  </div>`;

// ---------- Membro: escala publicada ----------
async function verEscala(ctx, ev, dep) {
  const { data } = await supabase.from('escalas')
    .select('usuario_id, perfis(nome), funcoes(nome)').eq('evento_id', ev.id);
  const escala = (data ?? []).sort((a, b) => (a.funcoes?.nome ?? '').localeCompare(b.funcoes?.nome ?? ''));

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${cabecalho(ev, dep, '#/')}
      <section class="secao">
        <h2>Escala</h2>
        <div class="lista">
          ${ev.status === 'publicado' || ev.status === 'realizado'
            ? escala.map((s) => `
              <div class="lista__item ${s.usuario_id === ctx.usuario.id ? 'lista__item--eu' : ''}">
                <span class="avatar" aria-hidden="true">${escapar(iniciais(s.perfis?.nome))}</span>
                <span class="lista__texto">
                  <strong>${escapar(s.perfis?.nome ?? '')}${s.usuario_id === ctx.usuario.id ? ' (você)' : ''}</strong>
                  <small>${escapar(s.funcoes?.nome ?? 'Função a definir')}</small>
                </span>
              </div>`).join('') || vazio('Ninguém escalado.')
            : vazio('A escala ainda não foi publicada.')}
        </div>
      </section>
    </main>`);
}

// ---------- Coordenador: montar e publicar a escala ----------
async function escalar(ctx, ev, dep) {
  const [membrosRes, mfRes, funcoesRes, dispRes, escRes] = await Promise.all([
    supabase.from('membros_departamento').select('usuario_id, perfis(nome)')
      .eq('departamento_id', dep.id).eq('status', 'ativo'),
    supabase.from('membro_funcoes').select('usuario_id, funcao_id').eq('departamento_id', dep.id),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', dep.id).order('nome'),
    supabase.from('disponibilidades').select('usuario_id').eq('evento_id', ev.id),
    supabase.from('escalas').select('usuario_id, funcao_id').eq('evento_id', ev.id)
  ]);

  const funcoes = funcoesRes.data ?? [];
  const funcoesDe = {};
  for (const mf of mfRes.data ?? []) (funcoesDe[mf.usuario_id] ??= []).push(mf.funcao_id);
  const disponiveis = new Set((dispRes.data ?? []).map((d) => d.usuario_id));
  const escalaAtual = Object.fromEntries((escRes.data ?? []).map((e) => [e.usuario_id, e.funcao_id ?? '']));

  // Disponíveis primeiro, depois quem já está escalado, depois os demais
  const pessoas = (membrosRes.data ?? [])
    .map((m) => ({
      id: m.usuario_id,
      nome: m.perfis?.nome ?? 'Sem nome',
      disponivel: disponiveis.has(m.usuario_id),
      funcoes: (funcoesDe[m.usuario_id] ?? []).map((id) => funcoes.find((f) => f.id === id)).filter(Boolean)
    }))
    .sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || a.nome.localeCompare(b.nome));
  const outros = pessoas.filter((p) => !p.disponivel && !(p.id in escalaAtual));
  const principais = pessoas.filter((p) => p.disponivel || p.id in escalaAtual);

  const publicado = ev.status === 'publicado' || ev.status === 'realizado';

  const linha = (p) => `
    <div class="lista__item escala-linha" data-usuario="${p.id}">
      <span class="avatar" aria-hidden="true">${escapar(iniciais(p.nome))}</span>
      <span class="lista__texto">
        <strong>${escapar(p.nome)}</strong>
        <small>${p.disponivel ? 'Disponível' : 'Não marcou este dia'}</small>
      </span>
      <select aria-label="Função de ${escapar(p.nome)}" ${p.funcoes.length ? '' : 'disabled'}>
        <option value="-">Não escalar</option>
        ${p.funcoes.map((f) => `
          <option value="${f.id}" ${escalaAtual[p.id] === f.id ? 'selected' : ''}>${escapar(f.nome)}</option>`).join('')}
        ${p.id in escalaAtual && !escalaAtual[p.id] ? '<option value="" selected>Sem função</option>' : ''}
      </select>
    </div>`;

  casca(ctx, 'inicio', `
    <main class="tela tela--com-nav">
      ${cabecalho(ev, dep, `#/dep/${dep.id}`)}

      <p class="card aviso-card">
        ${publicado
          ? 'Escala publicada. Se mudar algo, os escalados veem a versão nova.'
          : `<strong>${disponiveis.size}</strong> ${disponiveis.size === 1 ? 'pessoa marcou' : 'pessoas marcaram'} que pode.
             Escolha a função de cada um e publique.`}
      </p>

      <section class="secao">
        <h2>${publicado ? 'Escala' : 'Disponíveis'}</h2>
        <div class="lista">
          ${principais.map(linha).join('') || vazio('Ninguém marcou disponibilidade ainda.')}
        </div>
      </section>

      ${outros.length ? `
        <details class="secao outros">
          <summary>Escalar quem não marcou (${outros.length})</summary>
          <div class="lista">${outros.map(linha).join('')}</div>
        </details>` : ''}

      <div class="acoes">
        <button class="btn btn-primary" id="publicar">${publicado ? 'Salvar escala' : 'Publicar escala'}</button>
        ${publicado ? '' : '<button class="btn btn-ghost" id="rascunho">Salvar sem publicar</button>'}
        <button class="btn btn-ghost btn-perigo" id="excluir">Excluir esta data</button>
      </div>
    </main>`);

  // Salva a escala: remove quem saiu, grava quem entrou
  const salvar = async () => {
    const escolhas = [...document.querySelectorAll('.escala-linha')]
      .map((l) => ({ usuario_id: l.dataset.usuario, valor: l.querySelector('select').value }));
    const escalados = escolhas.filter((e) => e.valor !== '-');
    const sairam = escolhas.filter((e) => e.valor === '-' && e.usuario_id in escalaAtual).map((e) => e.usuario_id);

    if (sairam.length) {
      const r = await supabase.from('escalas').delete().eq('evento_id', ev.id).in('usuario_id', sairam);
      if (r.error) return r;
    }
    if (escalados.length) {
      const r = await supabase.from('escalas').upsert(
        escalados.map((e) => ({ evento_id: ev.id, usuario_id: e.usuario_id, funcao_id: e.valor || null })),
        { onConflict: 'evento_id,usuario_id' });
      if (r.error) return r;
    }
    return { error: null, total: escalados.length };
  };

  document.querySelector('#publicar').addEventListener('click', async (e) => {
    const resultado = await comBotao(e.currentTarget, async () => {
      const r = await salvar();
      if (r.error) return r;
      if (!r.total && !confirm('Ninguém foi escalado. Publicar mesmo assim?')) return { error: null, cancelado: true };
      if (!publicado) {
        const p = await supabase.from('eventos').update({ status: 'publicado' }).eq('id', ev.id);
        if (p.error) return p;
      }
      return r;
    });
    if (resultado.error) return aviso(traduzirErro(resultado.error));
    if (resultado.cancelado) return;
    aviso(publicado ? 'Escala atualizada!' : 'Escala publicada! Os escalados já podem ver.');
    location.hash = `#/dep/${dep.id}`;
  });

  document.querySelector('#rascunho')?.addEventListener('click', async (e) => {
    const r = await comBotao(e.currentTarget, salvar);
    if (r.error) return aviso(traduzirErro(r.error));
    aviso('Escala salva. Ela só aparece para os membros quando você publicar.');
  });

  document.querySelector('#excluir').addEventListener('click', async (e) => {
    if (!confirm('Excluir esta data? A disponibilidade e a escala dela também saem.')) return;
    const { error } = await comBotao(e.currentTarget, () => supabase.from('eventos').delete().eq('id', ev.id));
    if (error) return aviso(traduzirErro(error));
    aviso('Data excluída.');
    location.hash = `#/dep/${dep.id}`;
  });
}
