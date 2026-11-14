import { supabase } from '../lib/supabase.js';
import { app, aviso, traduzirErro, comBotao, nomeCurto } from '../lib/ui.js';
import { camposPerfil, ligarCamposPerfil, lerCamposPerfil } from '../lib/formPerfil.js';

// Quem entrou pelo Google ou tinha conta antes do cadastro completo preenche o que falta
export function telaCompletarPerfil(ctx, aoTerminar) {
  const p = ctx.perfil;
  app.innerHTML = `
    <main class="tela completar">
      <div class="titulo">
        <p class="passo">Falta pouco${nomeCurto(p) ? `, ${nomeCurto(p)}` : ''}</p>
        <h1>Complete seu cadastro</h1>
        <p>A coordenação usa esses dados para montar a escala e falar com você.</p>
      </div>
      <form class="form card" id="completar" novalidate>
        ${camposPerfil(p, { foto: true, prefixo: 'k' })}
        <button class="btn btn-primary" type="submit">Salvar e continuar</button>
      </form>
      <button class="btn btn-ghost" id="sair">Sair</button>
    </main>`;
  window.scrollTo(0, 0);
  const form = app.querySelector('#completar');
  ligarCamposPerfil(form, { uid: ctx.usuario.id, perfil: p });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { erro, dados } = lerCamposPerfil(form);
    if (erro) return aviso(erro);
    const { error } = await comBotao(form.querySelector('button[type="submit"]'), () =>
      supabase.from('perfis').update(dados).eq('id', ctx.usuario.id));
    if (error) return aviso(traduzirErro(error));
    Object.assign(ctx.perfil, dados);
    aoTerminar();
  });
  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}
