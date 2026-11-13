import { supabase } from '../lib/supabase.js';
import { notificar } from '../lib/notificacoes.js';
import { app, escapar, botaoVoltar, traduzirErro, mostrarErro, limparMsg, comBotao, aviso } from '../lib/ui.js';

// Normaliza o que a pessoa digitou: "har mus2" → "HAR-MUS2"
export function normalizarCodigo(texto) {
  const limpo = String(texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpo.length > 3 ? `${limpo.slice(0, 3)}-${limpo.slice(3, 7)}` : limpo;
}

// Entrar num departamento pelo código, marcando o que faz (RF13)
export function telaEntrarCodigo(ctx, aoEntrar) {
  let departamento = null;
  const escolhidas = new Set();

  const render = () => {
    app.innerHTML = `
      <main class="tela">
        ${botaoVoltar('#/')}
        <div class="titulo">
          <h1>Entrar com código</h1>
          <p>Digite o código que o coordenador do departamento te mandou.</p>
        </div>

        <form class="form card" id="buscar" novalidate>
          <div class="field">
            <label for="codigo">Código do departamento</label>
            <input id="codigo" name="codigo" class="input-codigo" required maxlength="8"
              autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC-1234"
              value="${escapar(departamento?.codigo ?? '')}" />
          </div>
          ${departamento ? '' : '<button class="btn btn-primary" type="submit">Buscar</button>'}
          <p class="msg" role="status" aria-live="polite"></p>
        </form>

        ${departamento ? `
          <form class="form card" id="pedir" novalidate>
            <div>
              <p class="equipe__org">${escapar(departamento.organizacao)}</p>
              <h2 class="cartao__titulo">${escapar(departamento.nome)}</h2>
            </div>
            <fieldset class="field">
              <legend>O que você faz aqui? Marque tudo que se aplica.</legend>
              <div class="chips">
                ${departamento.funcoes.map((f) => `
                  <button type="button" class="chip" data-funcao="${f.id}" aria-pressed="${escolhidas.has(f.id)}">
                    ${escapar(f.nome)}
                  </button>`).join('')}
              </div>
              ${departamento.funcoes.length ? '' : '<small class="dica">O coordenador ainda não cadastrou funções. Você pode pedir para entrar mesmo assim.</small>'}
            </fieldset>
            <button class="btn btn-primary" type="submit">Pedir para entrar</button>
            <button class="btn btn-ghost" type="button" id="outro">Usar outro código</button>
            <p class="msg" role="status" aria-live="polite"></p>
          </form>` : ''}
      </main>`;

    const buscar = app.querySelector('#buscar');
    const campo = buscar.codigo;
    campo.addEventListener('input', () => {
      campo.value = normalizarCodigo(campo.value);
    });

    if (!departamento) {
      campo.focus();
      buscar.addEventListener('submit', async (e) => {
        e.preventDefault();
        limparMsg(buscar);
        const codigo = normalizarCodigo(campo.value);
        if (codigo.length < 8) return mostrarErro(buscar, 'O código tem 7 letras e números, como ABC-1234.');

        const { data, error } = await comBotao(buscar.querySelector('button'), () =>
          supabase.rpc('buscar_departamento', { p_codigo: codigo })
        );
        if (error) return mostrarErro(buscar, traduzirErro(error));
        if (!data) return mostrarErro(buscar, 'Código não encontrado. Confira com o coordenador.');
        if (data.ja_participa) return mostrarErro(buscar, `Você já participa de ${data.nome}.`);
        departamento = { ...data, codigo };
        render();
      });
      return;
    }

    campo.readOnly = true;
    const pedir = app.querySelector('#pedir');
    pedir.querySelectorAll('[data-funcao]').forEach((chip) =>
      chip.addEventListener('click', () => {
        const id = chip.dataset.funcao;
        escolhidas.has(id) ? escolhidas.delete(id) : escolhidas.add(id);
        chip.setAttribute('aria-pressed', escolhidas.has(id));
      })
    );
    pedir.querySelector('#outro').addEventListener('click', () => {
      departamento = null;
      escolhidas.clear();
      render();
    });
    pedir.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparMsg(pedir);
      if (departamento.funcoes.length && !escolhidas.size) return mostrarErro(pedir, 'Marque pelo menos uma função.');

      const { error } = await comBotao(pedir.querySelector('button[type="submit"]'), () =>
        supabase.rpc('entrar_departamento', { p_codigo: departamento.codigo, p_funcoes: [...escolhidas] })
      );
      if (error) return mostrarErro(pedir, traduzirErro(error));
      notificar('pedido_entrada', { departamento_id: departamento.id });
      aviso(`Pedido enviado! Agora é só o coordenador de ${departamento.nome} aprovar.`);
      aoEntrar();
    });
  };

  render();
}
