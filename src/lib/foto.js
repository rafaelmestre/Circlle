import { supabase } from './supabase.js';

const LADO = 400; // px: suficiente para o avatar grande em tela retina

// Recorta no centro, reduz e converte para WebP (fica com uns 20–40 KB)
export async function prepararFoto(arquivo) {
  if (!arquivo?.type?.startsWith('image/')) throw new Error('Escolha uma imagem.');
  const bitmap = await createImageBitmap(arquivo).catch(() => { throw new Error('Não deu para abrir essa imagem.'); });
  const lado = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(LADO, lado);
  canvas.getContext('2d').drawImage(
    bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, canvas.width, canvas.height
  );
  bitmap.close?.();
  const tipo = 'image/webp';
  const blob = await new Promise((r) => canvas.toBlob(r, tipo, 0.85));
  // Safari antigo não gera WebP: cai para JPEG
  if (!blob || blob.type !== tipo) return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob;
}

const caminho = (uid) => `${uid}/foto`;

// Envia a foto e grava o endereço no perfil
export async function enviarFoto(uid, arquivo) {
  const blob = await prepararFoto(arquivo);
  const { error } = await supabase.storage.from('avatares')
    .upload(caminho(uid), blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('avatares').getPublicUrl(caminho(uid));
  const url = `${data.publicUrl}?v=${Date.now()}`; // força a foto nova a aparecer
  const res = await supabase.from('perfis').update({ avatar_url: url }).eq('id', uid);
  if (res.error) throw res.error;
  return url;
}

// Tira a foto do perfil e apaga o arquivo
export async function removerFoto(uid) {
  await supabase.storage.from('avatares').remove([caminho(uid)]).catch(() => {});
  const res = await supabase.from('perfis').update({ avatar_url: null }).eq('id', uid);
  if (res.error) throw res.error;
}
