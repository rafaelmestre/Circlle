import { supabase } from '../lib/supabase.js';
import { app, traduzirErro, mostrarErro, limparMsg } from '../lib/ui.js';

// Tela de entrar / criar conta
export function telaEntrada(modo = 'entrar', temConvite = false) {
  const criando = modo === 'criar';

  app.innerHTML = `
    <main class="auth">
      <div class="auth__box">
        <div>
          <img class="auth__logo" src="/favicon.svg" alt="" />
          <h1 class="auth__title"><span class="text-gradient">Circlle</span></h1>
          <p class="auth__subtitle">${temConvite
            ? 'Você recebeu um convite! Entre ou crie sua conta para participar.'
            : 'Sua equipe no mesmo ritmo.'}</p>
        </div>

        <div class="tabs" role="tablist">
          <button role="tab" data-modo="entrar" aria-selected="${!criando}">Entrar</button>
          <button role="tab" data-modo="criar" aria-selected="${criando}">Criar conta</button>
        </div>

        <form class="form card" novalidate>
          ${criando ? `
            <div class="field">
              <label for="nome">Nome</label>
              <input id="nome" name="nome" autocomplete="name" required maxlength="80" />
            </div>` : ''}
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" minlength="6" required
              autocomplete="${criando ? 'new-password' : 'current-password'}" />
          </div>
          <button class="btn btn-primary" type="submit">${criando ? 'Criar conta' : 'Entrar'}</button>
          <p class="msg" role="status" aria-live="polite"></p>
        </form>
      </div>
    </main>`;

  app.querySelectorAll('[data-modo]').forEach((aba) =>
    aba.addEventListener('click', () => telaEntrada(aba.dataset.modo, temConvite))
  );

  const form = app.querySelector('form');
  const botao = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    limparMsg(form);

    if (criando && !dados.nome?.trim()) return mostrarErro(form, 'Informe seu nome.');

    botao.disabled = true;
    const { error, data } = criando
      ? await supabase.auth.signUp({
          email: dados.email,
          password: dados.senha,
          options: { data: { nome: dados.nome.trim() } } // usado pelo trigger que cria o perfil
        })
      : await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
    botao.disabled = false;

    if (error) {
      mostrarErro(form, traduzirErro(error));
    } else if (criando && !data.session) {
      const msg = form.querySelector('.msg');
      msg.className = 'msg msg--ok';
      msg.textContent = 'Conta criada! Confira seu e-mail para confirmar.';
    }
  });
}
