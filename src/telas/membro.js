import { supabase } from '../lib/supabase.js';
import { escapar, avatar, casca, botaoVoltar, aviso, traduzirErro, comBotao, termos, icone, linkWhats, mascaraTelefone, telefoneValido } from '../lib/ui.js';
import { linkPessoal } from '../lib/convite.js';

// Perfil do membro visto pela coordenação: funções e permissões (RF10, RF15, RF16, RN21)
export async function telaMembro(ctx, depId, usuarioId, recarregarContexto) {
  const [depRes, membroRes, funcoesRes, minhasRes] = await Promise.all([
    supabase.from('departamentos')
      .select('id, nome, organizacao_id, modulo_repertorio, organizacoes(termo_funcao)').eq('id', depId).maybeSingle(),
    supabase.from('membros_departamento').select('papel, status, perm_escala, perm_repertorio, perfis(nome, apelido, avatar_url, telefone, provisorio)')
      .eq('departamento_id', depId).eq('usuario_id', usuarioId).maybeSingle(),
    supabase.from('funcoes').select('id, nome').eq('departamento_id', depId).order('nome'),
    supabase.from('membro_funcoes').select('funcao_id').eq('departamento_id', depId).eq('usuario_id', usuarioId)
  ]);

  const dep = depRes.data;
  const m = membroRes.data;
  if (!dep || !m || !ctx.coordena(dep.id, dep.organizacao_id)) {
    location.hash = dep ? `#/dep/${depId}` : '#/';
    return;
  }

  const admin = ctx.ehAdmin(dep.organizacao_id);
  const eu = usuarioId === ctx.usuario.id;
  const coord = m.papel === 'coordenador';
  const t = termos(dep.organizacoes);
  const minhas = new Set((minhasRes.data ?? []).map((f) => f.funcao_id));
  const nome = m.perfis?.nome ?? 'Sem nome';
  const semConta = Boolean(m.perfis?.provisorio);

  const permissao = (campo, titulo, texto, ligado) => `
    <label class="toggle">
      <input type="checkbox" data-perm="${campo}" ${ligado ? 'checked' : ''} />
      <span class="toggle__trilho" aria-hidden="true"></span>
      <span><strong>${titulo}</strong><small>${texto}</small></span>
    </label>`;

  casca(ctx, 'escalas', `
    <main class="tela tela--com-nav">
      ${botaoVoltar(`#/dep/${dep.id}`, 'Equipe')}
      <div class="perfil__cab">
        ${avatar(m.perfis, 'avatar--grande')}
        <div>
          <h1>${escapar(nome)}${eu ? ' (você)' : ''}</h1>
          <p class="texto-fraco">${escapar(dep.nome)}${coord ? ' · Coordenação' : ''}${semConta ? ' · Sem conta no app' : ''}</p>
        </div>
      </div>

      ${semConta ? `
        <section class="card convite-grupo">
          <h2 class="convite-grupo__titulo">${icone.whats(20)} Link pessoal</h2>
          <p class="texto-fraco">${escapar(nome)} já pode ser escalado. Mande este link para criar a conta:
          as escalas, as funções e as datas dele já aparecem lá.</p>
          <div class="acoes acoes--linha">
            <button class="btn btn-primary btn-sm" id="mandarLink">${icone.whats()} Mandar no WhatsApp</button>
            <button class="btn btn-ghost btn-sm" id="copiarLinkPessoal">${icone.copiar()} Copiar link</button>
          </div>
        </section>

        <details class="card">
          <summary>Corrigir nome ou WhatsApp</summary>
          <form class="form" id="editarPessoa" novalidate>
            <div class="field">
              <label for="epNome">Nome</label>
              <input id="epNome" name="nome" required maxlength="80" value="${escapar(nome)}" />
            </div>
            <div class="field">
              <label for="epWhats">WhatsApp (opcional)</label>
              <input id="epWhats" name="telefone" type="tel" inputmode="numeric" maxlength="15" value="${escapar(mascaraTelefone(m.perfis?.telefone ?? ''))}" placeholder="(11) 99999-9999" />
            </div>
            <button class="btn btn-ghost" type="submit">Salvar</button>
          </form>
        </details>` : ''}

      <section class="secao">
        <h2>${escapar(t.funcoes)}</h2>
        <div class="card">
          <div class="chips" role="group" aria-label="${escapar(t.funcoes)}">
            ${(funcoesRes.data ?? []).map((f) => `
              <button type="button" class="chip" data-funcao="${f.id}" aria-pressed="${minhas.has(f.id)}">${escapar(f.nome)}</button>`).join('')
              || '<small class="dica">O grupo ainda não tem funções.</small>'}
          </div>
        </div>
      </section>

      ${coord ? `
        <p class="card aviso-card">Quem coordena já monta escalas${dep.modulo_repertorio ? ' e repertórios' : ''}.</p>` : `
        <section class="secao">
          <h2>Permissões</h2>
          <div class="card form">
            ${semConta ? '<small class="dica">As permissões ficam disponíveis quando a pessoa criar a conta.</small>' : permissao('perm_escala', 'Pode montar escalas', 'Cria datas, monta, envia a prévia e publica. Não aprova membros nem mexe nos ajustes.', m.perm_escala)}
            ${!semConta && dep.modulo_repertorio ? permissao('perm_repertorio', 'Pode montar repertórios', 'Monta o repertório e aplica nas datas da escala.', m.perm_repertorio) : ''}
          </div>
        </section>`}

      ${!eu && (admin || !coord) ? `
        <section class="secao">
          <h2>Participação</h2>
          ${admin && !semConta ? `<button class="btn btn-ghost" id="coordenacao">${coord ? 'Tirar da coordenação' : 'Tornar coordenador'}</button>` : ''}
          <button class="btn btn-ghost btn-perigo" id="remover">Remover de ${escapar(dep.nome)}</button>
        </section>` : ''}
    </main>`);

  const atualizar = (dados) => supabase.from('membros_departamento').update(dados)
    .eq('departamento_id', dep.id).eq('usuario_id', usuarioId);

  // Funções: tocar liga e desliga na hora
  document.querySelectorAll('[data-funcao]').forEach((chip) =>
    chip.addEventListener('click', async () => {
      const ligado = chip.getAttribute('aria-pressed') === 'true';
      const funcao_id = chip.dataset.funcao;
      const { error } = await comBotao(chip, () => ligado
        ? supabase.from('membro_funcoes').delete().eq('departamento_id', dep.id).eq('usuario_id', usuarioId).eq('funcao_id', funcao_id)
        : supabase.from('membro_funcoes').insert({ departamento_id: dep.id, usuario_id: usuarioId, funcao_id }));
      if (error) return aviso(traduzirErro(error));
      chip.setAttribute('aria-pressed', String(!ligado));
    }));

  document.querySelectorAll('[data-perm]').forEach((campo) =>
    campo.addEventListener('change', async () => {
      campo.disabled = true;
      const { error } = await atualizar({ [campo.dataset.perm]: campo.checked });
      campo.disabled = false;
      if (error) {
        campo.checked = !campo.checked;
        return aviso(traduzirErro(error));
      }
      aviso(campo.checked ? 'Permissão liberada.' : 'Permissão retirada.');
      if (eu) recarregarContexto();
    }));

  document.querySelector('#coordenacao')?.addEventListener('click', async (e) => {
    const { error } = await comBotao(e.currentTarget, () => atualizar({ papel: coord ? 'membro' : 'coordenador' }));
    if (error) return aviso(traduzirErro(error));
    aviso(coord ? 'Coordenação retirada.' : 'Agora é coordenador!');
    telaMembro(ctx, depId, usuarioId, recarregarContexto);
  });

  // Pessoa sem conta: link pessoal e correções
  const pegarLink = async (botao) => {
    const { data, error } = await comBotao(botao, () => supabase.rpc('link_pessoal', { p_pessoa: usuarioId }));
    if (error) {
      aviso(traduzirErro(error));
      return null;
    }
    return linkPessoal(data);
  };
  document.querySelector('#mandarLink')?.addEventListener('click', async (e) => {
    // Abre a janela antes do await para o navegador não bloquear
    const janela = window.open('about:blank', '_blank');
    const link = await pegarLink(e.currentTarget);
    if (!link) return janela?.close();
    const fone = String(m.perfis?.telefone ?? '').replace(/\D/g, '');
    const texto = `Oi, ${m.perfis?.apelido || nome}! Coloquei você na escala do ${dep.nome} no Circlle. Cria sua conta por este link para ver suas datas e confirmar: ${link}`;
    const url = fone.length >= 10 ? `https://wa.me/55${fone}?text=${encodeURIComponent(texto)}` : linkWhats(texto);
    if (janela) janela.location.href = url; else location.href = url;
  });
  document.querySelector('#copiarLinkPessoal')?.addEventListener('click', async (e) => {
    const link = await pegarLink(e.currentTarget);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      aviso('Link copiado!');
    } catch {
      aviso(link);
    }
  });
  const editar = document.querySelector('#editarPessoa');
  editar?.telefone.addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });
  editar?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const novoNome = editar.nome.value.trim();
    const telefone = editar.telefone.value.trim();
    if (!novoNome) return aviso('Informe o nome.');
    if (telefone && !telefoneValido(telefone)) return aviso('Confira o WhatsApp, com DDD.');
    const { error } = await comBotao(editar.querySelector('button'), () =>
      supabase.rpc('editar_pessoa', { p_pessoa: usuarioId, p_nome: novoNome, p_telefone: telefone || null }));
    if (error) return aviso(traduzirErro(error));
    aviso('Dados atualizados.');
    telaMembro(ctx, depId, usuarioId, recarregarContexto);
  });

  document.querySelector('#remover')?.addEventListener('click', async (e) => {
    if (!confirm(`Remover ${nome} de ${dep.nome}?`)) return;
    const { error } = await comBotao(e.currentTarget, () =>
      supabase.from('membros_departamento').delete().eq('departamento_id', dep.id).eq('usuario_id', usuarioId));
    if (error) return aviso(traduzirErro(error));
    aviso('Membro removido.');
    location.hash = `#/dep/${dep.id}`;
  });
}
