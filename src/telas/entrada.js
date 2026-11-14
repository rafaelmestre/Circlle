import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase.js';
import { app, escapar, traduzirErro, mostrarErro, limparMsg, comBotao } from '../lib/ui.js';
import { TERMOS_VERSAO } from '../lib/termos.js';
import { camposPerfil, ligarCamposPerfil, lerCamposPerfil } from '../lib/formPerfil.js';

// O que já foi digitado sobrevive a uma ida aos termos e volta
const rascunho = { modo: 'entrar', email: '', aceite: false, perfil: {} };

// O botão do Google só aparece quando o login com Google está ligado no Supabase
let googleLigado = null;
async function temGoogle() {
  if (googleLigado !== null) return googleLigado;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    googleLigado = Boolean((await r.json())?.external?.google);
  } catch {
    googleLigado = false;
  }
  return googleLigado;
}

const logoGoogle = `
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>`;

// Tela de entrar / criar conta
export function telaEntrada(modo = rascunho.modo, temConvite = false) {
  if (modo === 'esqueci') return telaEsqueci(temConvite);
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

        <div id="google"></div>

        <form class="form card" novalidate>
          ${criando ? camposPerfil(rascunho.perfil, { prefixo: 'c' }) : ''}
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" required value="${escapar(rascunho.email)}" />
          </div>
          <div class="field">
            <label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" minlength="6" required
              autocomplete="${criando ? 'new-password' : 'current-password'}" />
            ${criando ? '<small class="dica">Pelo menos 6 caracteres.</small>' : ''}
          </div>
          ${criando ? `
            <label class="aceite__marcar">
              <input type="checkbox" name="aceite" ${rascunho.aceite ? 'checked' : ''} />
              <span>Li e aceito os <a href="#/termos">termos de uso e a política de privacidade</a>.</span>
            </label>` : `
            <button type="button" class="link-botao auth__esqueci" data-modo="esqueci">Esqueci minha senha</button>`}
          <button class="btn btn-primary" type="submit">${criando ? 'Criar conta' : 'Entrar'}</button>
          <p class="msg" role="status" aria-live="polite"></p>
        </form>
        <a class="auth__termos" href="#/termos">Termos de uso e privacidade</a>
      </div>
    </main>`;

  app.querySelectorAll('[data-modo]').forEach((aba) =>
    aba.addEventListener('click', () => telaEntrada(aba.dataset.modo, temConvite))
  );

  // Google (quando ligado)
  temGoogle().then((ligado) => {
    const caixa = app.querySelector('#google');
    if (!ligado || !caixa) return;
    caixa.innerHTML = `
      <button type="button" class="btn btn-ghost btn-google">${logoGoogle} Continuar com o Google</button>
      <p class="auth__ou"><span>ou com e-mail</span></p>`;
    caixa.querySelector('button').addEventListener('click', async (e) => {
      const { error } = await comBotao(e.currentTarget, () => supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/` }
      }));
      if (error) mostrarErro(app.querySelector('form'), traduzirErro(error));
    });
  });

  const form = app.querySelector('form');
  if (criando) ligarCamposPerfil(form);
  form.addEventListener('input', () => {
    rascunho.email = form.email.value;
    if (!criando) return;
    rascunho.aceite = form.aceite.checked;
    for (const c of ['nome', 'apelido', 'telefone', 'nascimento']) rascunho.perfil[c] = form[c].value;
  });
  const botao = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparMsg(form);
    const email = form.email.value.trim();
    const senha = form.senha.value;

    let dados = null;
    if (criando) {
      const lido = lerCamposPerfil(form);
      if (lido.erro) return mostrarErro(form, lido.erro);
      dados = lido.dados;
      if (!email) return mostrarErro(form, 'Informe seu e-mail.');
      if (senha.length < 6) return mostrarErro(form, 'A senha precisa ter pelo menos 6 caracteres.');
      if (!form.aceite.checked) return mostrarErro(form, 'Para criar a conta, aceite os termos de uso e a política de privacidade.');
    }

    botao.disabled = true;
    const { error, data } = criando
      ? await supabase.auth.signUp({
          email,
          password: senha,
          // usado pelo trigger que cria o perfil
          options: { data: { ...dados, termos_versao: TERMOS_VERSAO }, emailRedirectTo: `${location.origin}/` }
        })
      : await supabase.auth.signInWithPassword({ email, password: senha });
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

// Esqueci a senha: manda o link por e-mail
function telaEsqueci(temConvite) {
  app.innerHTML = `
    <main class="auth">
      <div class="auth__box">
        <div>
          <img class="auth__logo" src="/favicon.svg" alt="" />
          <h1 class="auth__title">Esqueci minha senha</h1>
          <p class="auth__subtitle">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
        </div>
        <form class="form card" novalidate>
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" required value="${escapar(rascunho.email)}" />
          </div>
          <button class="btn btn-primary" type="submit">Mandar o link</button>
          <p class="msg" role="status" aria-live="polite"></p>
        </form>
        <button type="button" class="btn btn-ghost" id="voltar">Voltar para entrar</button>
      </div>
    </main>`;
  app.querySelector('#voltar').addEventListener('click', () => telaEntrada('entrar', temConvite));
  const form = app.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg(form);
    const email = form.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return mostrarErro(form, 'Informe um e-mail válido.');
    rascunho.email = email;
    const { error } = await comBotao(form.querySelector('button'), () =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` }));
    if (error) return mostrarErro(form, traduzirErro(error));
    // Mesma resposta exista ou não a conta (não revela quem tem cadastro)
    const msg = form.querySelector('.msg');
    msg.className = 'msg msg--ok';
    msg.textContent = 'Se houver uma conta com esse e-mail, o link chega em alguns minutos. Confira também o spam.';
  });
}

// Chegou pelo link do e-mail: cria a senha nova
export function telaNovaSenha(aoTerminar) {
  app.innerHTML = `
    <main class="auth">
      <div class="auth__box">
        <div>
          <img class="auth__logo" src="/favicon.svg" alt="" />
          <h1 class="auth__title">Nova senha</h1>
          <p class="auth__subtitle">Escolha a senha que você vai usar daqui para frente.</p>
        </div>
        <form class="form card" novalidate>
          <div class="field">
            <label for="senha">Nova senha</label>
            <input id="senha" name="senha" type="password" minlength="6" required autocomplete="new-password" />
            <small class="dica">Pelo menos 6 caracteres.</small>
          </div>
          <div class="field">
            <label for="senha2">Repita a senha</label>
            <input id="senha2" name="senha2" type="password" minlength="6" required autocomplete="new-password" />
          </div>
          <button class="btn btn-primary" type="submit">Salvar senha</button>
          <p class="msg" role="status" aria-live="polite"></p>
        </form>
      </div>
    </main>`;
  const form = app.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg(form);
    const senha = form.senha.value;
    if (senha.length < 6) return mostrarErro(form, 'A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== form.senha2.value) return mostrarErro(form, 'As duas senhas não estão iguais.');
    const { error } = await comBotao(form.querySelector('button'), () => supabase.auth.updateUser({ password: senha }));
    if (error) return mostrarErro(form, traduzirErro(error));
    aoTerminar();
  });
}
