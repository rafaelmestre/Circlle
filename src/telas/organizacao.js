import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, casca, icone, vazio, aviso, traduzirErro, comBotao, termos } from '../lib/ui.js';

// Painel do administrador: departamentos do grupo e os nomes usados no app (RF08, RF09, RF35)
export async function telaOrganizacao(ctx, orgId, recarregarContexto) {
  if (!ctx.ehAdmin(orgId)) {
    location.hash = '#/';
    return;
  }
  const org = ctx.orgsAdmin.find((o) => o.id === orgId);
  const t = termos(org);

  const { data } = await supabase.from('departamentos')
    .select('id, nome, codigo, ativo, membros_departamento(papel, status, perfis(nome))')
    .eq('organizacao_id', orgId).order('nome');
  const deps = (data ?? []).filter((d) => d.ativo);
  const desativados = (data ?? []).filter((d) => !d.ativo);

  casca(ctx, 'org', `
    <main class="tela tela--com-nav">
      <div class="titulo">
        <p class="passo">Administração</p>
        <h1>${escapar(org.nome)}</h1>
        <p>${deps.length} ${escapar(deps.length === 1 ? t.dep_ : t.deps_)}</p>
      </div>

      ${deps.length ? '' : `
        <section class="card">
          <h2 class="cartao__titulo">Como montar o grupo</h2>
          <ol class="passos">
            <li>Crie ${escapar(t.deps_)} abaixo.</li>
            <li>Abra cada um e mande o código para quem vai coordenar.</li>
            <li>Quando a pessoa entrar, toque em <strong>Tornar coordenador</strong>.</li>
          </ol>
        </section>`}

      <section class="secao">
        <h2>${escapar(t.deps)}</h2>
        <div class="lista">
          ${deps.map((d) => {
            const ativos = d.membros_departamento.filter((m) => m.status === 'ativo');
            const coords = ativos.filter((m) => m.papel === 'coordenador').map((m) => m.perfis?.nome).filter(Boolean);
            const pend = d.membros_departamento.length - ativos.length;
            return `
              <a class="lista__item lista__item--link" href="#/dep/${d.id}">
                <span class="avatar" aria-hidden="true">${escapar(iniciais(d.nome))}</span>
                <span class="lista__texto">
                  <strong>${escapar(d.nome)}</strong>
                  <small>${coords.length ? `Coordenação: ${escapar(coords.join(', '))}` : 'Sem coordenador'} · ${ativos.length} ${ativos.length === 1 ? 'membro' : 'membros'}</small>
                </span>
                ${pend ? `<span class="badge badge--pending">${pend} ${pend === 1 ? 'pedido' : 'pedidos'}</span>` : ''}
                ${icone.seta()}
              </a>`;
          }).join('') || vazio('Nada criado ainda.')}
        </div>

        <form class="card form" id="novoDep" novalidate>
          <div class="field">
            <label for="nomeDep">Criar ${escapar(t.dep_)}</label>
            <div class="linha linha--sem-margem">
              <input id="nomeDep" name="nome" required maxlength="60" placeholder="Ex.: Música, Mídia, Recepção" />
              <button class="btn btn-primary btn-sm" type="submit">Criar</button>
            </div>
          </div>
        </form>
      </section>

      ${desativados.length ? `
        <details class="secao outros">
          <summary>Desativados (${desativados.length})</summary>
          <p class="texto-fraco">Somem do app de todos, mas os dados ficam guardados. Reative quando quiser.</p>
          <div class="lista">
            ${desativados.map((d) => `
              <div class="lista__item">
                <span class="avatar avatar--apagado" aria-hidden="true">${escapar(iniciais(d.nome))}</span>
                <span class="lista__texto"><strong>${escapar(d.nome)}</strong></span>
                <button class="btn btn-ghost btn-sm" data-reativar="${d.id}">Reativar</button>
              </div>`).join('')}
          </div>
        </details>` : ''}

      <section class="secao">
        <h2>Nomes no app</h2>
        <p class="texto-fraco">Use as palavras do seu grupo. Elas aparecem para todo mundo do grupo.</p>
        <form class="card form" id="rotulos" novalidate>
          ${[
            ['termo_organizacao', 'O grupo todo', 'Organização', 'Ex.: Coletivo, Associação, Empresa'],
            ['termo_departamento', 'Cada área', 'Departamento', 'Ex.: Equipe, Setor, Time'],
            ['termo_evento', 'Cada data', 'Evento', 'Ex.: Ensaio, Turno, Encontro'],
            ['termo_funcao', 'O que cada um faz', 'Função', 'Ex.: Posição, Tarefa, Papel']
          ].map(([campo, rotulo, padrao, exemplo]) => `
            <div class="field">
              <label for="${campo}">${rotulo} <small class="dica">padrão: ${padrao}</small></label>
              <input id="${campo}" name="${campo}" maxlength="30" placeholder="${exemplo}"
                value="${escapar(org[campo] === padrao ? '' : org[campo] ?? '')}" />
            </div>`).join('')}
          <button class="btn btn-ghost" type="submit">Salvar nomes</button>
        </form>
      </section>
    </main>`);

  document.querySelector('#novoDep').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Dê um nome.');
    const { data: novo, error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('departamentos').insert({ organizacao_id: orgId, nome }).select('id, codigo').single());
    if (error) return aviso(traduzirErro(error));
    aviso(`Criado! Código: ${novo.codigo}`);
    location.hash = `#/dep/${novo.id}`;
  });

  document.querySelectorAll('[data-reativar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const { error } = await comBotao(b, () =>
        supabase.from('departamentos').update({ ativo: true }).eq('id', b.dataset.reativar));
      if (error) return aviso(traduzirErro(error));
      aviso('Reativado! Os membros voltam a ver as datas.');
      recarregarContexto();
    })
  );

  // Rótulos: campo vazio volta ao padrão
  document.querySelector('#rotulos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const padrao = { termo_organizacao: 'Organização', termo_departamento: 'Departamento', termo_evento: 'Evento', termo_funcao: 'Função' };
    const dados = Object.fromEntries(Object.entries(padrao).map(([campo, p]) => [campo, f[campo].value.trim() || p]));
    const { error } = await comBotao(f.querySelector('button'), () =>
      supabase.from('organizacoes').update(dados).eq('id', orgId));
    if (error) return aviso(traduzirErro(error));
    aviso('Nomes atualizados!');
    recarregarContexto();
  });
}
