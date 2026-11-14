import { supabase } from '../lib/supabase.js';
import { app, icone, aviso, traduzirErro, comBotao } from '../lib/ui.js';
import { textoTermos, TERMOS_VERSAO } from '../lib/termos.js';

// Página pública dos termos (abre com ou sem login, pelo link #/termos)
export function telaTermos({ voltar = '#/', rotuloVoltar = 'Voltar' } = {}) {
  app.innerHTML = `
    <main class="tela documento">
      <a class="voltar" href="${voltar}" id="voltarTermos">${icone.voltar()} ${rotuloVoltar}</a>
      <div class="titulo">
        <p class="passo">Circlle</p>
        <h1>Termos de uso e privacidade</h1>
      </div>
      <article class="documento__texto">${textoTermos()}</article>
    </main>`;
  window.scrollTo(0, 0);
  // Voltar para a tela anterior quando houver (ex.: veio do cadastro)
  app.querySelector('#voltarTermos').addEventListener('click', (e) => {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

// Quem já tinha conta (ou quando os termos mudarem) aceita antes de continuar
export function telaAceiteTermos(ctx, aoAceitar) {
  const primeiraVez = !ctx.perfil.termos_versao;
  app.innerHTML = `
    <main class="tela tela--centro aceite">
      <img src="/favicon.svg" alt="" class="analise__logo" />
      <div class="titulo">
        <h1>${primeiraVez ? 'Antes de continuar' : 'Atualizamos os termos'}</h1>
        <p>${primeiraVez
          ? 'Para seguir usando o Circlle, leia e aceite os termos de uso e a política de privacidade. Eles explicam, em linguagem simples, como seus dados são usados e como excluir sua conta.'
          : 'Os termos de uso e a política de privacidade mudaram. Leia e aceite para continuar.'}</p>
      </div>
      <a class="btn btn-ghost" href="#/termos">${icone.seta(16)} Ler os termos</a>
      <label class="aceite__marcar">
        <input type="checkbox" id="concordo" />
        <span>Li e aceito os termos de uso e a política de privacidade.</span>
      </label>
      <div class="acoes">
        <button class="btn btn-primary" id="aceitar" disabled>Aceitar e continuar</button>
        <button class="btn btn-ghost" id="sair">Sair</button>
      </div>
    </main>`;
  const botao = app.querySelector('#aceitar');
  app.querySelector('#concordo').addEventListener('change', (e) => { botao.disabled = !e.target.checked; });
  botao.addEventListener('click', async () => {
    const { error } = await comBotao(botao, () => supabase.rpc('aceitar_termos', { p_versao: TERMOS_VERSAO }));
    if (error) return aviso(traduzirErro(error));
    ctx.perfil.termos_versao = TERMOS_VERSAO;
    aoAceitar();
  });
  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}
