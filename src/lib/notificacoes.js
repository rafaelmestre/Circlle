import { supabase } from './supabase.js';

// Notificações no celular (RF36): inscrição do aparelho e aviso para a função "notificar"
const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const suporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Converte a chave pública (base64url) para o formato que o navegador pede
function chaveEmBytes(base64) {
  const padrao = '='.repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + padrao).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

async function inscricaoAtual() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// 'sem_configuracao' (chave não definida no deploy) | 'indisponivel' | 'instalar' (iPhone fora do app instalado)
// | 'bloqueado' | 'ativo' | 'inativo'
export async function estadoNotificacoes() {
  if (!CHAVE_PUBLICA) return 'sem_configuracao';
  if (ehIOS() && !instalado()) return 'instalar';
  if (!suporta()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  try {
    return (await inscricaoAtual()) && Notification.permission === 'granted' ? 'ativo' : 'inativo';
  } catch {
    return 'inativo';
  }
}

export async function ativarNotificacoes() {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    return { error: { message: permissao === 'denied' ? 'Notificações bloqueadas' : 'Permissão não concedida' } };
  }
  // O service worker já deve estar instalado; se não ficar pronto, não deixa o botão travado
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, falha) => setTimeout(() => falha(new Error('Service worker indisponível')), 10000))
  ]).catch(() => null);
  if (!reg) return { error: { message: 'Service worker indisponível' } };
  let inscricao;
  try {
    inscricao = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE_PUBLICA) });
  } catch (erro) {
    return { error: erro };
  }
  const { endpoint, keys } = inscricao.toJSON();
  // Pela função do banco: se outra conta usou este aparelho antes, a inscrição passa para quem está logado
  return supabase.rpc('registrar_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
}

export async function desativarNotificacoes() {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return { error: null };
  const { error } = await supabase.from('push_inscricoes').delete().eq('endpoint', inscricao.endpoint);
  await inscricao.unsubscribe();
  return { error };
}

// Pede ao servidor para avisar as pessoas certas. Nunca trava a tela:
// se falhar, a ação principal já foi feita.
export function notificar(tipo, dados = {}) {
  if (!CHAVE_PUBLICA) return;
  supabase.functions.invoke('notificar', { body: { tipo, ...dados } })
    .then(({ error }) => error && console.warn('Notificação não enviada:', error.message))
    .catch(() => {});
}
