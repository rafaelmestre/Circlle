import { supabase } from '../lib/supabase.js';
import { app, escapar, botaoVoltar, traduzirErro, mostrarErro, limparMsg, comBotao } from '../lib/ui.js';

const TIPOS = ['Banda', 'Ministério de louvor', 'Coral', 'Orquestra', 'Grupo vocal', 'Outro'];

// Criar o grupo na hora: quem cria já coordena (sem fila de aprovação)
export function telaCriarGrupo(ctx, aoCriar) {
  let tipo = 'Banda';
  app.innerHTML = `
    <main class="tela">
      ${botaoVoltar('#/')}
      <div class="titulo">
        <h1>Criar meu grupo</h1>
        <p>Em um minuto sua banda está no Circlle. Você será o coordenador e já recebe as funções de uma banda
        (vocal, violão, guitarra, baixo, teclado, bateria e som), que dá para mudar depois.</p>
      </div>
      <form class="form card" id="criar" novalidate>
        <div class="field">
          <label for="gNome">Nome do grupo</label>
          <input id="gNome" name="nome" required minlength="2" maxlength="60" placeholder="Ex.: Banda Harmonia" autocomplete="off" />
        </div>
        <fieldset class="field">
          <legend>Que tipo de grupo?</legend>
          <div class="chips" role="group">
            ${TIPOS.map((t) => `<button type="button" class="chip" data-tipo="${escapar(t)}" aria-pressed="${t === tipo}">${escapar(t)}</button>`).join('')}
          </div>
        </fieldset>
        <div class="field">
          <label for="gCidade">Cidade (opcional)</label>
          <input id="gCidade" name="cidade" maxlength="80" placeholder="Ex.: São Paulo" autocomplete="address-level2" />
        </div>
        <button class="btn btn-primary" type="submit">Criar grupo</button>
        <p class="msg" role="status" aria-live="polite"></p>
      </form>
    </main>`;

  const form = app.querySelector('#criar');
  form.nome.focus();
  form.querySelectorAll('[data-tipo]').forEach((chip) => chip.addEventListener('click', () => {
    tipo = chip.dataset.tipo;
    form.querySelectorAll('[data-tipo]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg(form);
    const nome = form.nome.value.trim();
    if (nome.length < 2) return mostrarErro(form, 'Dê um nome ao grupo.');
    const { data, error } = await comBotao(form.querySelector('button[type="submit"]'), () =>
      supabase.rpc('criar_grupo', { p_nome: nome, p_cidade: form.cidade.value.trim() || null, p_tipo: tipo }));
    if (error) return mostrarErro(form, traduzirErro(error));
    aoCriar(data);
  });
}
