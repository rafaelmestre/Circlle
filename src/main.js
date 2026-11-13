import './styles/tokens.css';
import './styles/main.css';
import { supabase } from './lib/supabase.js';
import { app, carregando, traduzirErro } from './lib/ui.js';
import { carregarContexto } from './lib/contexto.js';
import { telaEntrada } from './telas/entrada.js';
import { telaBoasVindas } from './telas/boasVindas.js';
import { telaSolicitar, telaEmAnalise } from './telas/solicitar.js';
import { telaEntrarCodigo } from './telas/entrarCodigo.js';
import { telaInicio } from './telas/inicio.js';
import { telaDepartamento } from './telas/departamento.js';
import { telaNovasDatas } from './telas/novasDatas.js';
import { telaEvento } from './telas/evento.js';
import { telaPerfil } from './telas/perfil.js';
import { telaOrganizacao } from './telas/organizacao.js';
import { telaPlataforma } from './telas/plataforma.js';

let usuario = null;
let ctx = null;

// Recarrega o que sabemos da pessoa e redesenha a tela atual
async function atualizar() {
  carregando();
  try {
    ctx = await carregarContexto(usuario);
  } catch (erro) {
    return telaFalha(traduzirErro(erro));
  }
  rotear();
}

// Sem conexão ou erro inesperado: oferece tentar de novo
function telaFalha(mensagem) {
  app.innerHTML = `
    <main class="tela tela--centro">
      <img src="/favicon.svg" alt="" class="analise__logo" />
      <div class="titulo">
        <h1>Não foi possível carregar</h1>
        <p>${mensagem} Confira sua internet.</p>
      </div>
      <div class="acoes">
        <button class="btn btn-primary" id="tentar">Tentar de novo</button>
        <button class="btn btn-ghost" id="sair">Sair</button>
      </div>
    </main>`;
  app.querySelector('#tentar').addEventListener('click', atualizar);
  app.querySelector('#sair').addEventListener('click', () => supabase.auth.signOut());
}

// Rotas: #/  #/entrar  #/solicitar  #/perfil  #/org/:id  #/dep/:id  #/dep/:id/datas  #/evento/:id  #/plataforma
function rotear() {
  if (!usuario || !ctx) return;
  const [rota, id, sub] = location.hash.replace(/^#\/?/, '').split('/');

  // Telas que funcionam com ou sem vínculo
  if (rota === 'entrar') return telaEntrarCodigo(ctx, () => irPara('#/'));
  if (rota === 'solicitar') return telaSolicitar(ctx, () => irPara('#/'));

  const temAcesso = ctx.vinculos.length || ctx.orgsAdmin.length || ctx.plataforma;
  if (!temAcesso) {
    if (ctx.solicitacoes.some((s) => s.status === 'em_analise')) return telaEmAnalise(ctx);
    return telaBoasVindas(ctx);
  }

  window.scrollTo(0, 0);
  switch (rota) {
    case 'dep':
      return sub === 'datas' ? telaNovasDatas(ctx, id) : telaDepartamento(ctx, id, atualizar);
    case 'evento':
      return telaEvento(ctx, id);
    case 'perfil':
      return telaPerfil(ctx, atualizar);
    case 'org':
      return telaOrganizacao(ctx, id);
    case 'plataforma':
      return telaPlataforma(ctx);
    default:
      return telaInicio(ctx);
  }
}

// Muda de rota sempre recarregando o contexto (ex.: depois de entrar num departamento)
function irPara(hash) {
  if (location.hash === hash) atualizar();
  else {
    precisaAtualizar = true;
    location.hash = hash;
  }
}

let precisaAtualizar = false;
window.addEventListener('hashchange', () => {
  if (precisaAtualizar) {
    precisaAtualizar = false;
    atualizar();
  } else {
    rotear();
  }
});

supabase.auth.onAuthStateChange((evento, sessao) => {
  // setTimeout evita chamar o Supabase dentro do próprio callback de auth
  setTimeout(() => {
    const novoUsuario = sessao?.user ?? null;
    if (!novoUsuario) {
      usuario = null;
      ctx = null;
      if (location.hash) history.replaceState(null, '', location.pathname);
      return telaEntrada('entrar');
    }
    // Ignora renovações de token: só recarrega quando a pessoa muda
    if (usuario?.id === novoUsuario.id && evento !== 'USER_UPDATED') return;
    usuario = novoUsuario;
    atualizar();
  }, 0);
});
