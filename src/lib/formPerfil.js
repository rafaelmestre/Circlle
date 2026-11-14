import { escapar, avatar, aviso, traduzirErro, mascaraTelefone, telefoneValido } from './ui.js';
import { enviarFoto, removerFoto } from './foto.js';

const hoje = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD no fuso do aparelho

// Campos do cadastro (cadastro, completar perfil e Perfil)
export function camposPerfil(p = {}, { foto = false, prefixo = 'p' } = {}) {
  return `
    ${foto ? `
      <div class="foto-campo">
        <span data-foto-preview>${avatar(p, 'avatar--grande')}</span>
        <div class="foto-campo__acoes">
          <label class="btn btn-ghost btn-sm foto-campo__escolher">
            <input type="file" accept="image/*" data-foto hidden />
            ${p.avatar_url ? 'Trocar foto' : 'Escolher foto'}
          </label>
          <button type="button" class="link-botao link-botao--perigo" data-foto-remover ${p.avatar_url ? '' : 'hidden'}>Remover</button>
          <small class="dica">Opcional. Aparece para a sua equipe.</small>
        </div>
      </div>` : ''}
    <div class="field">
      <label for="${prefixo}Nome">Nome completo</label>
      <input id="${prefixo}Nome" name="nome" required maxlength="80" autocomplete="name" value="${escapar(p.nome ?? '')}" />
    </div>
    <div class="field">
      <label for="${prefixo}Apelido">Como quer ser chamado</label>
      <input id="${prefixo}Apelido" name="apelido" required maxlength="30" autocomplete="nickname"
        placeholder="Ex.: Rafa" value="${escapar(p.apelido ?? '')}" />
      <small class="dica">É o nome que aparece na escala.</small>
    </div>
    <div class="form-par">
      <div class="field">
        <label for="${prefixo}Whats">WhatsApp</label>
        <input id="${prefixo}Whats" name="telefone" type="tel" inputmode="numeric" required autocomplete="tel-national"
          placeholder="(11) 99999-9999" maxlength="15" value="${escapar(mascaraTelefone(p.telefone ?? ''))}" />
      </div>
      <div class="field">
        <label for="${prefixo}Nasc">Nascimento</label>
        <input id="${prefixo}Nasc" name="nascimento" type="date" required min="1900-01-01" max="${hoje()}"
          value="${escapar(p.nascimento ?? '')}" />
      </div>
    </div>`;
}

// Máscara do WhatsApp e, quando houver, a foto (enviada na hora)
export function ligarCamposPerfil(raiz, { uid, perfil } = {}) {
  raiz.querySelector('[name="telefone"]')?.addEventListener('input', (e) => {
    e.target.value = mascaraTelefone(e.target.value);
  });
  const arquivo = raiz.querySelector('[data-foto]');
  if (!arquivo || !uid) return;
  const preview = raiz.querySelector('[data-foto-preview]');
  const remover = raiz.querySelector('[data-foto-remover]');
  const rotulo = raiz.querySelector('.foto-campo__escolher');
  const mostrar = (url) => {
    perfil.avatar_url = url;
    preview.innerHTML = avatar(perfil, 'avatar--grande');
    remover.hidden = !url;
    rotulo.lastChild.textContent = url ? ' Trocar foto' : ' Escolher foto';
    // Avatar do topo acompanha
    const topo = document.querySelector('.casca__perfil');
    if (topo) topo.innerHTML = preview.firstElementChild.innerHTML;
    const cab = document.querySelector('[data-cab-avatar]');
    if (cab) cab.innerHTML = avatar(perfil, 'avatar--grande');
  };
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    arquivo.value = '';
    if (!f) return;
    rotulo.classList.add('btn--carregando');
    try {
      mostrar(await enviarFoto(uid, f));
      aviso('Foto atualizada.');
    } catch (erro) {
      aviso(erro.message?.startsWith('Escolha') || erro.message?.startsWith('Não deu') ? erro.message : traduzirErro(erro));
    } finally {
      rotulo.classList.remove('btn--carregando');
    }
  });
  remover.addEventListener('click', async () => {
    remover.disabled = true;
    try {
      await removerFoto(uid);
      mostrar(null);
      aviso('Foto removida.');
    } catch (erro) {
      aviso(traduzirErro(erro));
    } finally {
      remover.disabled = false;
    }
  });
}

// Lê e confere os campos; devolve { erro } ou { dados }
export function lerCamposPerfil(form) {
  const nome = form.nome.value.trim();
  const apelido = form.apelido.value.trim();
  const telefone = form.telefone.value.trim();
  const nascimento = form.nascimento.value;
  if (!nome) return { erro: 'Informe seu nome completo.' };
  if (!apelido) return { erro: 'Conte como quer ser chamado.' };
  if (!telefoneValido(telefone)) return { erro: 'Informe o WhatsApp com DDD, ex.: (11) 99999-9999.' };
  if (!nascimento) return { erro: 'Informe sua data de nascimento.' };
  if (nascimento < '1900-01-01' || nascimento > hoje()) return { erro: 'Confira a data de nascimento.' };
  return { dados: { nome, apelido, telefone: mascaraTelefone(telefone), nascimento } };
}

export const perfilCompleto = (p) => Boolean(p?.apelido && p?.telefone && p?.nascimento);
