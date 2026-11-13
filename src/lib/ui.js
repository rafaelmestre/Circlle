// Utilitários de interface compartilhados pelas telas

export const app = document.querySelector('#app');

export const escapar = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const iniciais = (nome) =>
  String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export const primeiroNome = (nome) => String(nome ?? '').trim().split(/\s+/)[0] ?? '';

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
  check: (t = 18) => svg('<path d="M5 12l5 5 9-10"/>', t),
  chave: (t = 22) => svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>', t),
  predio: (t = 22) => svg('<path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M3 21h18"/>', t),
  copiar: (t = 18) => svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>', t),
  whats: (t = 18) => svg('<path d="M21 12a9 9 0 01-13.5 7.8L3 21l1.3-4.4A9 9 0 1121 12z"/>', t),
  girar: (t = 18) => svg('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', t),
  relogio: (t = 16) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', t),
  local: (t = 16) => svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', t),
  seta: (t = 18) => svg('<path d="M9 6l6 6-6 6"/>', t)
};

// ---------- Estrutura com navegação inferior ----------
export function casca(ctx, ativo, conteudo) {
  const itens = [
    { id: 'inicio', rota: '#/', rotulo: 'Início', icone: icone.inicio() }
  ];
  if (ctx.orgsAdmin.length) itens.push({ id: 'org', rota: `#/org/${ctx.orgsAdmin[0].id}`, rotulo: ctx.orgsAdmin[0].termo_organizacao, icone: icone.org() });
  if (ctx.plataforma) itens.push({ id: 'plataforma', rota: '#/plataforma', rotulo: 'Circlle', icone: icone.circlle() });
  itens.push({ id: 'perfil', rota: '#/perfil', rotulo: 'Perfil', icone: icone.perfil() });

  app.innerHTML = `
    <div class="casca">
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
