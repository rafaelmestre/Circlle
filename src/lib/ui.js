// Utilitários de interface compartilhados pelas telas

export const app = document.querySelector('#app');

export const escapar = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const iniciais = (nome) =>
  String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export const primeiroNome = (nome) => String(nome ?? '').trim().split(/\s+/)[0] ?? '';

// Como a pessoa quer ser chamada: apelido ou, sem ele, o primeiro nome
export const nomeCurto = (p) => (p?.apelido || primeiroNome(p?.nome)) ?? '';

// Foto de perfil ou iniciais (p = { nome, avatar_url })
export const conteudoAvatar = (p) => p?.avatar_url
  ? `<img src="${escapar(p.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
  : escapar(iniciais(p?.nome));
export const avatar = (p, classe = '') =>
  `<span class="avatar ${classe}" aria-hidden="true">${conteudoAvatar(p)}</span>`;

// WhatsApp: (11) 99999-9999 enquanto digita
export function mascaraTelefone(valor) {
  const d = String(valor ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const telefoneValido = (v) => /^\d{10,11}$/.test(String(v ?? '').replace(/\D/g, ''));

// ---------- Datas ----------
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const formatarData = (iso) => {
  const d = new Date(iso);
  return `${fmtDia.format(d).replace('.', '').replace(' de ', ' ')} · ${fmtHora.format(d)}`;
};

export const diaMes = (iso) => {
  const d = new Date(iso);
  return {
    dia: String(d.getDate()).padStart(2, '0'),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  };
};

// ---------- Erros ----------
const ERROS = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Este e-mail já tem conta. Tente entrar.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'Password should be at least 6 characters.': 'A senha precisa ter pelo menos 6 caracteres.',
  'Código inválido': 'Código não encontrado. Confira com o coordenador.',
  'Você já participa deste departamento': 'Você já participa deste departamento.',
  'A pessoa não faz essa função': 'Essa pessoa não faz essa função no departamento.',
  'A pessoa não é membro ativo': 'Essa pessoa ainda não foi aprovada no departamento.',
  'Apenas o administrador define coordenadores': 'Só o administrador pode definir coordenadores.',
  'Limite de departamentos do plano atingido': 'O limite de departamentos do plano foi atingido.',
  'Conte o motivo do ajuste': 'Conte o motivo do ajuste.',
  'Esta escala não está aberta para respostas': 'Esta escala não está mais aberta para respostas.',
  'New password should be different': 'A senha nova precisa ser diferente da anterior.',
  'For security purposes, you can only request this': 'Espere um minuto antes de pedir outro link.',
  'rate limit': 'Muitas tentativas agora. Tente de novo em alguns minutos.',
  'Unable to validate email address': 'Confira o e-mail digitado.',
  'Auth session missing': 'O link expirou. Peça outro em “Esqueci minha senha”.',
  'provider is not enabled': 'O login com Google ainda não está ligado.',
  'The resource already exists': 'Isso já existe.',
  'Payload too large': 'A foto é grande demais. Tente outra.',
  'duplicate key': 'Isso já existe.'
};

export function traduzirErro(erro) {
  const msg = erro?.message ?? String(erro);
  console.error(erro);
  for (const [chave, texto] of Object.entries(ERROS)) {
    if (msg.includes(chave)) return texto;
  }
  return 'Algo deu errado. Tente novamente.';
}

// ---------- Avisos e mensagens ----------
let timerAviso;
export function aviso(texto) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = texto;
  el.classList.add('toast--visivel');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('toast--visivel'), 3000);
}

export function mostrarErro(form, texto) {
  const msg = form.querySelector('.msg');
  msg.className = 'msg msg--erro';
  msg.textContent = texto;
}

export function limparMsg(form) {
  const msg = form.querySelector('.msg');
  msg.className = 'msg';
  msg.textContent = '';
}

export const carregando = () => {
  app.innerHTML = `<main class="carregando" aria-busy="true"><img src="/favicon.svg" alt="Carregando" /></main>`;
};

// Desabilita o botão enquanto a ação roda
export async function comBotao(botao, acao) {
  botao.disabled = true;
  try {
    return await acao();
  } finally {
    botao.disabled = false;
  }
}

// ---------- Ícones (traço, herdam a cor do texto) ----------
const svg = (d, tam = 22) =>
  `<svg aria-hidden="true" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const icone = {
  inicio: (t) => svg('<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', t),
  org: (t) => svg('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>', t),
  circlle: (t) => svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 9a4 4 0 100 6"/>', t),
  perfil: (t) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', t),
  voltar: (t = 20) => svg('<path d="M15 18l-6-6 6-6"/>', t),
  mais: (t = 18) => svg('<path d="M12 5v14M5 12h14"/>', t),
  lixo: (t = 18) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', t),
  check: (t = 18) => svg('<path d="M5 12l5 5 9-10"/>', t),
  chave: (t = 22) => svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>', t),
  predio: (t = 22) => svg('<path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M3 21h18"/>', t),
  copiar: (t = 18) => svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>', t),
  whats: (t = 18) => svg('<path d="M21 12a9 9 0 01-13.5 7.8L3 21l1.3-4.4A9 9 0 1121 12z"/>', t),
  girar: (t = 18) => svg('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', t),
  relogio: (t = 16) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', t),
  local: (t = 16) => svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', t),
  seta: (t = 18) => svg('<path d="M9 6l6 6-6 6"/>', t),
  calendario: (t) => svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', t),
  escalas: (t) => svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>', t),
  musica: (t) => svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', t),
  grafico: (t) => svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', t),
  equipe: (t = 18) => svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>', t),
  lista: (t = 18) => svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', t),
  anterior: (t = 20) => svg('<path d="M15 18l-6-6 6-6"/>', t),
  proximo: (t = 20) => svg('<path d="M9 6l6 6-6 6"/>', t),
  sino: (t = 20) => svg('<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/>', t),
  editar: (t = 16) => svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', t),
  alerta: (t = 18) => svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>', t)
};

// ---------- Escala ----------
// Nomes das funções de uma linha de escala: "Violão e Vocal"
export function nomesFuncoes(escala) {
  const nomes = (escala?.escala_funcoes ?? []).map((f) => f.funcoes?.nome).filter(Boolean).sort();
  if (!nomes.length) return 'Função a definir';
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

// Etiqueta da resposta do escalado
export function badgeResposta(resposta) {
  const mapa = {
    confirmado: ['Confirmado', 'badge--confirmed'],
    ajuste: ['Pediu ajuste', 'badge--declined'],
    pendente: ['Aguardando resposta', 'badge--pending']
  };
  const [rotulo, classe] = mapa[resposta] ?? mapa.pendente;
  return `<span class="badge ${classe}">${rotulo}</span>`;
}

export const STATUS_EVENTO = {
  rascunho: ['Rascunho', 'badge--reassign'],
  aberto: ['Aberto', 'badge--pending'],
  previa: ['Prévia', 'badge--reassign'],
  publicado: ['Publicado', 'badge--confirmed'],
  realizado: ['Realizado', 'badge--confirmed'],
  cancelado: ['Cancelado', 'badge--declined']
};

// ---------- Rótulos da organização (RF09) ----------
// Plural simples em português: Função → Funções, Equipe → Equipes, Setor → Setores
export function plural(termo) {
  const [primeira, ...resto] = String(termo).trim().split(/\s+/);
  const p = primeira.toLowerCase();
  let r;
  if (/ão$/.test(p)) r = `${primeira.slice(0, -2)}ões`;
  else if (/[aeiouáéíóúâêô]$/.test(p)) r = `${primeira}s`;
  else if (/m$/.test(p)) r = `${primeira.slice(0, -1)}ns`;
  else if (/[rz]$/.test(p)) r = `${primeira}es`;
  else if (/el$/.test(p)) r = `${primeira.slice(0, -2)}éis`;
  else if (/[aou]l$/.test(p)) r = `${primeira.slice(0, -1)}is`;
  else r = primeira;
  return [r, ...resto].join(' ');
}

const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);

// Termos de uma organização, com plural e minúsculas prontos para o texto
export function termos(org) {
  const base = {
    org: org?.termo_organizacao || 'Organização',
    dep: org?.termo_departamento || 'Departamento',
    evento: org?.termo_evento || 'Evento',
    funcao: org?.termo_funcao || 'Função'
  };
  const t = { ...base, deps: plural(base.dep), eventos: plural(base.evento), funcoes: plural(base.funcao) };
  for (const k of Object.keys(t)) t[`${k}_`] = minuscula(t[k]);
  return t;
}

// ---------- WhatsApp (RF32) ----------
export const linkWhats = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

// Escala em texto: "*Vocal:* Rita, Marcos"
export function textoEscala(ev, depNome, escalas) {
  const grupos = new Map();
  for (const s of escalas) {
    const nome = (s.perfis?.nome ?? '').trim().split(/\s+/)[0];
    const funcoes = (s.escala_funcoes ?? []).map((f) => f.funcoes?.nome).filter(Boolean);
    for (const f of funcoes.length ? funcoes : ['Função a definir']) {
      if (!grupos.has(f)) grupos.set(f, []);
      grupos.get(f).push(nome);
    }
  }
  const linhas = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([f, nomes]) => `*${f}:* ${nomes.sort().join(', ')}`);
  return [
    depNome ? `*${ev.titulo}* · ${depNome}` : `*${ev.titulo}*`,
    `${formatarData(ev.inicio)}${ev.local ? ` · ${ev.local}` : ''}`,
    ev.status === 'previa' ? '_Prévia: ainda pode mudar_' : null,
    '',
    ...(linhas.length ? linhas : ['Ninguém escalado ainda.'])
  ].filter((l) => l !== null).join('\n');
}

// ---------- Estrutura com navegação inferior ----------
// Barra de baixo conforme o papel de cada um; o perfil abre pelo avatar
export function itensNav(ctx) {
  if (ctx.plataforma) {
    const itens = [
      { id: 'inicio', rota: '#/', rotulo: 'Dashboard', icone: icone.grafico() },
      { id: 'plataforma', rota: '#/plataforma', rotulo: 'Assinantes', icone: icone.circlle() }
    ];
    if (ctx.vinculos.length) itens.push({ id: 'calendario', rota: '#/calendario', rotulo: 'Calendário', icone: icone.calendario() });
    return itens;
  }
  const itens = [{ id: 'inicio', rota: '#/', rotulo: 'Início', icone: icone.inicio() }];
  if (ctx.depsEscala.length) itens.push({ id: 'escalas', rota: '#/escalas', rotulo: 'Escalas', icone: icone.escalas() });
  itens.push({ id: 'calendario', rota: '#/calendario', rotulo: 'Calendário', icone: icone.calendario() });
  if (ctx.depsRepertorio.length) itens.push({ id: 'repertorios', rota: '#/repertorios', rotulo: 'Repertórios', icone: icone.musica() });
  if (ctx.orgsAdmin.length) {
    itens.push({ id: 'org', rota: `#/org/${ctx.orgsAdmin[0].id}`, rotulo: ctx.orgsAdmin[0].termo_organizacao, icone: icone.org() });
  }
  return itens;
}

export function casca(ctx, ativo, conteudo) {
  const itens = itensNav(ctx);

  app.innerHTML = `
    <div class="casca">
      ${ativo === 'perfil' ? '' : `
        <a class="casca__perfil avatar avatar--link" href="#/perfil" aria-label="Meu perfil">${conteudoAvatar(ctx.perfil)}</a>`}
      ${conteudo}
      <nav class="nav" aria-label="Navegação principal" style="--itens:${itens.length}">
        ${itens.map((i) => `
          <a href="${i.rota}" class="nav__item" ${i.id === ativo ? 'aria-current="page"' : ''}>
            ${i.icone}<span>${escapar(i.rotulo)}</span>
          </a>`).join('')}
      </nav>
    </div>`;
}

export const botaoVoltar = (rota, rotulo = 'Voltar') =>
  `<a class="voltar" href="${rota}">${icone.voltar()} ${escapar(rotulo)}</a>`;

export const vazio = (texto) => `<p class="vazio">${escapar(texto)}</p>`;
