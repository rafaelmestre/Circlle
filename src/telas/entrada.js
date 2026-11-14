import { supabase } from '../lib/supabase.js';
import { app, escapar, traduzirErro, mostrarErro, limparMsg } from '../lib/ui.js';
import { TERMOS_VERSAO } from '../lib/termos.js';

// O que já foi digitado sobrevive a uma ida aos termos e volta
const rascunho = { modo: 'entrar', nome: '', email: '', aceite: false };

// Tela de entrar / criar conta
export function telaEntrada(modo = rascunho.modo, temConvite = false) {
  rascunho.modo = modo;
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
              <input id="nome" name="nome" autocomplete="name" required maxlength="80" value="${escapar(rascunho.nome)}" />
            </div>` : ''}
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" required value="${escapar(rascunho.email)}" />
          </div>
          <div class="field">
            <label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" minlength="6" required
              autocomplete="${criando ? 'new-password' : 'current-password'}" />
          </div>
          ${criando ? `
            <label class="aceite__marcar">
              <input type="checkbox" name="aceite" ${rascunho.aceite ? 'checked' : ''} />
              <span>Li e aceito os <a href="#/termos">termos de uso e a política de privacidade</a>.</span>
            </label>` : ''}
          <button class="btn btn-primary" type="submit">${criando ? 'Criar conta' : 'Entrar'}</button>
          <p class="msg" role="status" aria-live="polite"></p>
        </form>
        <a class="auth__termos" href="#/termos">Termos de uso e privacidade</a>
      </div>
    </main>`;

  app.querySelectorAll('[data-modo]').forEach((aba) =>
    aba.addEventListener('click', () => telaEntrada(aba.dataset.modo, temConvite))
  );

  const form = app.querySelector('form');
  form.addEventListener('input', () => {
    rascunho.nome = form.nome?.value ?? rascunho.nome;
    rascunho.email = form.email.value;
    rascunho.aceite = form.aceite?.checked ?? rascunho.aceite;
  });
  const botao = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    limparMsg(form);

    if (criando && !dados.nome?.trim()) return mostrarErro(form, 'Informe seu nome.');
    if (criando && !form.aceite.checked) return mostrarErro(form, 'Para criar a conta, aceite os termos de uso e a política de privacidade.');

    botao.disabled = true;
    const { error, data } = criando
      ? await supabase.auth.signUp({
          email: dados.email,
          password: dados.senha,
          options: { data: { nome: dados.nome.trim(), termos_versao: TERMOS_VERSAO } } // usado pelo trigger que cria o perfil
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
