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
import { telaCalendario } from './telas/calendario.js';
import { telaEscalas } from './telas/escalas.js';
import { telaMembro } from './telas/membro.js';
import { telaRepertorios } from './telas/repertorios.js';
import { telaRepertorio } from './telas/repertorio.js';
import { telaMusica } from './telas/musica.js';
import { telaMural } from './telas/mural.js';
import { telaDashboard } from './telas/painelPlataforma.js';
import { iniciarAtualizacao } from './lib/atualizacao.js';

iniciarAtualizacao();

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

// Rotas: #/  #/calendario  #/escalas[/:dep[/nova]]  #/repertorios[/:dep]  #/repertorio/:id  #/musica/:id[/:tom]  #/mural/:dep  #/entrar  #/solicitar  #/perfil
//        #/org/:id  #/dep/:id  #/dep/:id/membro/:usuario  #/evento/:id  #/plataforma
function rotear() {
  if (!usuario || !ctx) return;
  const [rota, id, sub, extra] = location.hash.replace(/^#\/?/, '').split('/');

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
    case 'escalas':
      return sub === 'nova' ? telaNovasDatas(ctx, id) : telaEscalas(ctx, id);
    case 'repertorios':
      return telaRepertorios(ctx, id);
    case 'repertorio':
      return telaRepertorio(ctx, id);
    case 'musica':
      return telaMusica(ctx, id, sub);
    case 'mural':
      return telaMural(ctx, id);
    case 'dep':
      if (sub === 'datas') return location.replace(`#/escalas/${id}/nova`);
      if (sub === 'membro') return telaMembro(ctx, id, extra, atualizar);
      return telaDepartamento(ctx, id, atualizar);
    case 'evento':
      return telaEvento(ctx, id);
    case 'calendario':
      return telaCalendario(ctx);
    case 'perfil':
      return telaPerfil(ctx, atualizar);
    case 'org':
      return telaOrganizacao(ctx, id, atualizar);
    case 'plataforma':
      return telaPlataforma(ctx);
    default:
      return ctx.plataforma ? telaDashboard(ctx) : telaInicio(ctx);
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

// Toque numa notificação com o app já aberto: vai para a tela do aviso
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.tipo !== 'abrir') return;
  const destino = new URL(e.data.url, location.origin);
  if (destino.origin === location.origin) location.hash = destino.hash || '#/';
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
