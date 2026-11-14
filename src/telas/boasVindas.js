import { supabase } from '../lib/supabase.js';
import { app, escapar, nomeCurto, icone } from '../lib/ui.js';

// Sem vínculo nenhum: entrar com código ou solicitar o Circlle para o grupo
export function telaBoasVindas(ctx) {
  const recusada = ctx.solicitacoes.find((s) => s.status === 'recusada');

  app.innerHTML = `
    <main class="tela">
      <header class="topo">
        <img src="/favicon.svg" alt="Circlle" class="topo__logo" />
        <button class="btn btn-ghost btn-sm" id="sair">Sair</button>
      </header>

      <div class="titulo">
        <h1>Bem-vindo, <span class="text-gradient">${escapar(nomeCurto(ctx.perfil))}</span>!</h1>
        <p>Você ainda não participa de nenhum departamento.</p>
      </div>

      ${recusada ? `
        <p class="card texto-fraco">A solicitação de <strong>${escapar(recusada.nome)}</strong> não foi aprovada.
        Se quiser, fale com a equipe do Circlle ou faça uma nova solicitação.</p>` : ''}

      <a class="opcao card" href="#/entrar">
        <span class="icon-circle">${icone.chave()}</span>
        <span>
          <strong>Tenho um código</strong>
          <small>O coordenador do departamento me mandou um código.</small>
        </span>
        ${icone.seta()}
      </a>

      <a class="opcao card" href="#/solicitar">
        <span class="icon-circle">${icone.predio()}</span>
        <span>
          <strong>Quero o Circlle para meu grupo</strong>
          <small>Sou responsável pelo grupo e quero organizar as escalas dos departamentos.</small>
        </span>
        ${icone.seta()}
      </a>
    </main>`;

  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}
