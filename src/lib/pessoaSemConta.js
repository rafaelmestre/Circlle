import { supabase } from './supabase.js';
import { escapar, aviso, traduzirErro, comBotao, mascaraTelefone, telefoneValido } from './ui.js';

// Adicionar alguém que ainda não tem conta (nome, WhatsApp opcional e funções).
// Usado na Equipe e direto na montagem da escala.
export const formAdicionarPessoa = (funcoes, { aberto = false, rotulo = 'Adicionar pessoa sem conta' } = {}) => `
  <details class="card adicionar-pessoa" ${aberto ? 'open' : ''}>
    <summary>${escapar(rotulo)}</summary>
    <form class="form" data-adicionar-pessoa novalidate>
      <p class="texto-fraco">Para quem ainda não usa o app. Ela já entra na escala, e você pode mandar um link
      pessoal depois para ela criar a conta e ver tudo.</p>
      <div class="field">
        <label for="apNome">Nome</label>
        <input id="apNome" name="nome" required maxlength="80" placeholder="Ex.: Lucas Andrade" autocomplete="off" />
      </div>
      <div class="field">
        <label for="apWhats">WhatsApp (opcional)</label>
        <input id="apWhats" name="telefone" type="tel" inputmode="numeric" maxlength="15" placeholder="(11) 99999-9999" autocomplete="off" />
      </div>
      ${funcoes.length ? `
        <fieldset class="field">
          <legend>O que faz</legend>
          <div class="chips" role="group">
            ${funcoes.map((f) => `<button type="button" class="chip" data-ap-funcao="${f.id}" aria-pressed="false">${escapar(f.nome)}</button>`).join('')}
          </div>
        </fieldset>` : ''}
      <button class="btn btn-primary" type="submit">Adicionar</button>
    </form>
  </details>`;

export function ligarAdicionarPessoa(raiz, depId, aoAdicionar) {
  const form = raiz.querySelector('[data-adicionar-pessoa]');
  if (!form) return;
  form.telefone.addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });
  form.querySelectorAll('[data-ap-funcao]').forEach((chip) => chip.addEventListener('click', () =>
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const telefone = form.telefone.value.trim();
    if (!nome) return aviso('Informe o nome da pessoa.');
    if (telefone && !telefoneValido(telefone)) return aviso('Confira o WhatsApp, com DDD.');
    const funcoesIds = [...form.querySelectorAll('[data-ap-funcao][aria-pressed="true"]')].map((c) => c.dataset.apFuncao);
    const { data, error } = await comBotao(form.querySelector('button[type="submit"]'), () =>
      supabase.rpc('adicionar_pessoa', {
        p_dep: depId, p_nome: nome, p_telefone: telefone ? mascaraTelefone(telefone) : null, p_funcoes: funcoesIds
      }));
    if (error) return aviso(traduzirErro(error));
    aoAdicionar({ id: data, nome, funcoes: funcoesIds });
  });
}
