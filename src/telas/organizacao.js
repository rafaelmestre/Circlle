import { supabase } from '../lib/supabase.js';
import { escapar, iniciais, casca, icone, vazio, aviso, traduzirErro, comBotao } from '../lib/ui.js';

// Painel do administrador: departamentos do grupo (RF08, RF35)
export async function telaOrganizacao(ctx, orgId) {
  if (!ctx.ehAdmin(orgId)) {
    location.hash = '#/';
    return;
  }
  const org = ctx.orgsAdmin.find((o) => o.id === orgId);

  const { data } = await supabase.from('departamentos')
    .select('id, nome, codigo, ativo, membros_departamento(papel, status, perfis(nome))')
    .eq('organizacao_id', orgId).order('nome');
  const deps = (data ?? []).filter((d) => d.ativo);

  casca(ctx, 'org', `
    <main class="tela tela--com-nav">
      <div class="titulo">
        <p class="passo">Administração</p>
        <h1>${escapar(org.nome)}</h1>
        <p>${deps.length} ${deps.length === 1 ? 'departamento' : 'departamentos'}</p>
      </div>

      <section class="card">
        <h2 class="cartao__titulo">Como montar o grupo</h2>
        <ol class="passos">
          <li>Crie os departamentos abaixo.</li>
          <li>Abra o departamento e mande o código para quem vai coordenar.</li>
          <li>Quando a pessoa entrar, toque em <strong>Tornar coordenador</strong>.</li>
        </ol>
      </section>

      <section class="secao">
        <h2>Departamentos</h2>
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
          }).join('') || vazio('Nenhum departamento ainda.')}
        </div>

        <form class="card form" id="novoDep" novalidate>
          <div class="field">
            <label for="nomeDep">Novo departamento</label>
            <div class="linha linha--sem-margem">
              <input id="nomeDep" name="nome" required maxlength="60" placeholder="Ex.: Música, Mídia, Zeladoria" />
              <button class="btn btn-primary btn-sm" type="submit">Criar</button>
            </div>
          </div>
        </form>
      </section>
    </main>`);

  document.querySelector('#novoDep').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = e.currentTarget.nome.value.trim();
    if (!nome) return aviso('Dê um nome ao departamento.');
    const { data: novo, error } = await comBotao(e.currentTarget.querySelector('button'), () =>
      supabase.from('departamentos').insert({ organizacao_id: orgId, nome }).select('id, codigo').single());
    if (error) return aviso(traduzirErro(error));
    aviso(`Departamento criado! Código: ${novo.codigo}`);
    location.hash = `#/dep/${novo.id}`;
  });
}
