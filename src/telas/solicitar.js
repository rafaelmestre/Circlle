import { supabase } from '../lib/supabase.js';
import { app, escapar, botaoVoltar, traduzirErro, mostrarErro, limparMsg, comBotao } from '../lib/ui.js';

const TIPOS = ['Projeto social', 'ONG', 'Banda ou coral', 'Coletivo', 'Escola', 'Empresa', 'Outro'];
const TAMANHOS = ['Até 20', '20 a 50', '50 a 100', 'Mais de 100'];

// Solicitar o Circlle para o grupo (RF05)
export function telaSolicitar(ctx, aoEnviar) {
  app.innerHTML = `
    <main class="tela">
      ${botaoVoltar('#/')}
      <div class="titulo">
        <h1>Circlle para o seu grupo</h1>
        <p>Conte um pouco sobre o grupo. A equipe do Circlle vai entrar em contato para ativar.</p>
      </div>

      <form class="form card" novalidate>
        <div class="field">
          <label for="nome">Nome do grupo</label>
          <input id="nome" name="nome" required maxlength="80" placeholder="Ex.: Coletivo Harmonia" />
        </div>
        <div class="field">
          <label for="tipo">Tipo de grupo</label>
          <select id="tipo" name="tipo" required>
            <option value="">Selecione</option>
            ${TIPOS.map((t) => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="cidade">Cidade</label>
          <input id="cidade" name="cidade" required maxlength="80" autocomplete="address-level2" />
        </div>
        <div class="field">
          <label for="tamanho">Quantas pessoas, mais ou menos?</label>
          <select id="tamanho" name="tamanho" required>
            <option value="">Selecione</option>
            ${TAMANHOS.map((t) => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="whatsapp">WhatsApp para contato</label>
          <input id="whatsapp" name="whatsapp" type="tel" required maxlength="20" autocomplete="tel" placeholder="(11) 90000-0000" />
        </div>
        <div class="field">
          <label for="email">E-mail para contato</label>
          <input id="email" name="email" type="email" required maxlength="120" autocomplete="email" value="${escapar(ctx.usuario.email)}" />
        </div>
        <button class="btn btn-primary" type="submit">Enviar solicitação</button>
        <p class="msg" role="status" aria-live="polite"></p>
      </form>
    </main>`;

  const form = app.querySelector('form');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparMsg(form);
    const dados = Object.fromEntries(new FormData(form));
    for (const [campo, valor] of Object.entries(dados)) dados[campo] = valor.trim();

    if (Object.values(dados).some((v) => !v)) return mostrarErro(form, 'Preencha todos os campos.');
    if (dados.whatsapp.replace(/\D/g, '').length < 10) return mostrarErro(form, 'Confira o WhatsApp com DDD.');

    const { error } = await comBotao(form.querySelector('button[type="submit"]'), () =>
      supabase.from('organizacoes').insert({ ...dados, solicitado_por: ctx.usuario.id })
    );
    if (error) return mostrarErro(form, traduzirErro(error));
    aoEnviar();
  });
}

// Enquanto o Circlle não aprova (RF06)
export function telaEmAnalise(ctx) {
  const org = ctx.solicitacoes.find((s) => s.status === 'em_analise');

  app.innerHTML = `
    <main class="tela tela--centro">
      <img src="/favicon.svg" alt="" class="analise__logo" />
      <div class="titulo">
        <h1>Solicitação em análise</h1>
        <p>Recebemos o pedido de <strong>${escapar(org.nome)}</strong>. A equipe do Circlle vai falar com você
        pelo WhatsApp ou e-mail informados para ativar o grupo.</p>
      </div>
      <div class="acoes">
        <button class="btn btn-primary" id="atualizar">Verificar de novo</button>
        <button class="btn btn-ghost" id="sair">Sair</button>
      </div>
    </main>`;

  app.querySelector('#atualizar').addEventListener('click', () => location.reload());
  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}
