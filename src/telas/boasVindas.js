import { supabase } from '../lib/supabase.js';
import { app, escapar, nomeCurto, icone } from '../lib/ui.js';

// Sem grupo ainda: criar o próprio ou entrar num grupo
export function telaBoasVindas(ctx) {
  app.innerHTML = `
    <main class="tela">
      <header class="topo">
        <img src="/favicon.svg" alt="Circlle" class="topo__logo" />
        <button class="btn btn-ghost btn-sm" id="sair">Sair</button>
      </header>

      <div class="titulo">
        <h1>Bem-vindo, <span class="text-gradient">${escapar(nomeCurto(ctx.perfil))}</span>!</h1>
        <p>O Circlle organiza as escalas, o repertório e os avisos do seu grupo de música.</p>
      </div>

      <a class="opcao card" href="#/criar">
        <span class="icon-circle">${icone.musica()}</span>
        <span>
          <strong>Criar meu grupo</strong>
          <small>Coordeno uma banda, ministério ou coral e quero montar as escalas.</small>
        </span>
        ${icone.seta()}
      </a>

      <a class="opcao card" href="#/entrar">
        <span class="icon-circle">${icone.chave()}</span>
        <span>
          <strong>Entrar num grupo</strong>
          <small>Recebi um link ou um código do coordenador.</small>
        </span>
        ${icone.seta()}
      </a>
    </main>`;

  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}
