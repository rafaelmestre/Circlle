import { supabase } from '../lib/supabase.js';
import { escapar, casca, icone, vazio, aviso, traduzirErro, comBotao, diaMes } from '../lib/ui.js';

const CHAVE_DEP = 'circlle:repertorios-dep';

// Repertórios do departamento: como playlists, aplicadas nas datas da escala
export async function telaRepertorios(ctx, depParam) {
  const deps = ctx.depsRepertorio;
  if (!deps.length) {
    location.hash = '#/';
    return;
  }
  let lembrado = null;
  try { lembrado = localStorage.getItem(CHAVE_DEP); } catch { /* sem armazenamento */ }
  const dep = deps.find((d) => d.id === depParam) ?? deps.find((d) => d.id === lembrado) ?? deps[0];
  try { localStorage.setItem(CHAVE_DEP, dep.id); } catch { /* sem armazenamento */ }

  const [repsRes, eventosRes] = await Promise.all([
    supabase.from('repertorios').select('id, nome, created_at, repertorio_itens(count)')
      .eq('departamento_id', dep.id).order('created_at', { ascending: false }),
    supabase.from('eventos').select('id, inicio, repertorio_id')
      .eq('departamento_id', dep.id).not('repertorio_id', 'is', null)
      .gte('inicio', new Date(Date.now() - 86400000).toISOString()).order('inicio')
  ]);
  if (repsRes.error) aviso(traduzirErro(repsRes.error));
  const reps = repsRes.data ?? [];
  const datasDe = {};
  for (const e of eventosRes.data ?? []) (datasDe[e.repertorio_id] ??= []).push(e);

  casca(ctx, 'repertorios', `
    <main class="tela tela--com-nav">
      <div class="titulo titulo--topo">
        <h1>Repertórios</h1>
      </div>

      ${deps.length > 1 ? `
        <div class="chips chips--rolagem" role="group" aria-label="Departamento">
          ${deps.map((d) => `
            <a class="chip" href="#/repertorios/${d.id}" aria-pressed="${d.id === dep.id}">${escapar(d.nome)}</a>`).join('')}
        </div>` : ''}

      <form class="card form" id="novo" novalidate>
        <div class="field">
          <label for="nomeRep">Novo repertório</label>
          <div class="linha linha--sem-margem">
            <input id="nomeRep" name="nome" required maxlength="80" placeholder="Ex.: Apresentação de dezembro" />
            <button class="btn btn-primary btn-sm" type="submit">Criar</button>
          </div>
        </div>
      </form>

      <section class="secao">
        <h2>${escapar(dep.nome)}</h2>
        <div class="lista">
          ${reps.map((r) => {
            const n = r.repertorio_itens?.[0]?.count ?? 0;
            const datas = datasDe[r.id] ?? [];
            return `
              <a class="lista__item lista__item--link" href="#/repertorio/${r.id}">
                <span class="icon-circle repertorio__icone" aria-hidden="true">${icone.musica(20)}</span>
                <span class="lista__texto">
                  <strong>${escapar(r.nome)}</strong>
                  <small>${n} ${n === 1 ? 'música' : 'músicas'}${datas.length
                    ? ` · em ${datas.slice(0, 3).map((e) => { const d = diaMes(e.inicio); return `${d.dia} ${d.mes}`; }).join(', ')}${datas.length > 3 ? '…' : ''}`
                    : ' · sem data'}</small>
                </span>
                ${icone.seta()}
              </a>`;
          }).join('') || vazio('Nenhum repertório ainda. Crie o primeiro e aplique numa data da escala.')}
        </div>
      </section>
    </main>`);

  document.querySelector('#novo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Dê um nome ao repertório.');
    const { data, error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('repertorios').insert({ departamento_id: dep.id, nome }).select('id').single());
    if (error) return aviso(traduzirErro(error));
    location.hash = `#/repertorio/${data.id}`;
  });
}
