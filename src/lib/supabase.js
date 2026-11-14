import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Supabase não configurado: crie o arquivo .env a partir do .env.example');
}

// Usados para ler as configurações públicas do login (ex.: Google ligado ou não)
export const supabaseUrl = url ?? '';
export const supabaseKey = key ?? '';

export const supabase = createClient(url ?? '', key ?? '', {
  auth: { persistSession: true, autoRefreshToken: true }
});
