import { supabase } from './supabase.js';

// Convites por link:
//   #/g/ABC-1234   → link do grupo (qualquer pessoa pede para entrar)
//   #/p/<token>    → link pessoal de quem o coordenador já colocou na escala sem conta
// Quem abre sem estar logado guarda o convite aqui e segue depois do cadastro.

const CHAVE = 'circlle:convite';

export const linkGrupo = (codigo) => `${location.origin}/#/g/${codigo}`;
export const linkPessoal = (token) => `${location.origin}/#/p/${token}`;

export function guardarConvite(tipo, valor) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ tipo, valor })); } catch { /* sem armazenamento */ }
  try { localStorage.setItem(CHAVE, JSON.stringify({ tipo, valor, em: Date.now() })); } catch { /* sem armazenamento */ }
}

export function conviteGuardado() {
  for (const armazem of [sessionStorage, localStorage]) {
    try {
      const c = JSON.parse(armazem.getItem(CHAVE) ?? 'null');
      // Vale por 2 dias (tempo de confirmar o e-mail)
      if (c?.tipo && c?.valor && (!c.em || Date.now() - c.em < 2 * 86400000)) return c;
    } catch { /* ignora */ }
  }
  return null;
}

export function esquecerConvite() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
  try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
}

// O que mostrar na tela de entrada para quem chegou por um convite
export async function resumoConvite(c) {
  if (!c) return null;
  if (c.tipo === 'p') {
    const { data } = await supabase.rpc('info_convite', { p_token: c.valor });
    if (!data) return null;
    return {
      titulo: `Oi, ${data.apelido || data.nome}!`,
      texto: `Você está na escala de ${data.grupo}. Crie sua conta (ou entre) para ver suas datas e confirmar.`
    };
  }
  const { data } = await supabase.rpc('buscar_departamento', { p_codigo: c.valor });
  if (!data) return null;
  return {
    titulo: `Convite para ${data.nome}`,
    texto: 'Crie sua conta (ou entre) para participar das escalas do grupo.'
  };
}
