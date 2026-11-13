import { supabase } from './supabase.js';

// Tudo o que as telas precisam saber sobre quem está logado
export async function carregarContexto(usuario) {
  const [perfil, plataforma, orgs, solicitacoes, vinculos] = await Promise.all([
    supabase.from('perfis').select('id, nome, telefone').eq('id', usuario.id).maybeSingle(),
    supabase.from('admins_plataforma').select('usuario_id').eq('usuario_id', usuario.id).maybeSingle(),
    supabase.from('membros_organizacao')
      .select('papel, organizacoes(id, nome, status, termo_organizacao, termo_departamento, termo_evento, termo_funcao)')
      .eq('usuario_id', usuario.id),
    supabase.from('organizacoes')
      .select('id, nome, status, created_at')
      .eq('solicitado_por', usuario.id)
      .in('status', ['em_analise', 'recusada'])
      .order('created_at', { ascending: false }),
    supabase.from('membros_departamento')
      .select(`departamento_id, papel, perm_repertorio, status,
               departamentos(id, nome, codigo, modulo_repertorio, organizacao_id,
                 organizacoes(id, nome, status, termo_departamento, termo_evento, termo_funcao))`)
      .eq('usuario_id', usuario.id)
      .order('created_at')
  ]);

  const erro = perfil.error ?? plataforma.error ?? orgs.error ?? solicitacoes.error ?? vinculos.error;
  if (erro) throw erro;

  const orgsAdmin = (orgs.data ?? [])
    .filter((m) => m.papel === 'admin' && m.organizacoes?.status === 'ativa')
    .map((m) => m.organizacoes);

  // Vínculos de organizações suspensas não aparecem
  const meusVinculos = (vinculos.data ?? [])
    .filter((v) => v.departamentos?.organizacoes?.status === 'ativa');

  return {
    usuario,
    perfil: perfil.data ?? { id: usuario.id, nome: usuario.email },
    plataforma: Boolean(plataforma.data),
    orgsAdmin,
    solicitacoes: solicitacoes.data ?? [],
    vinculos: meusVinculos,
    ativos: meusVinculos.filter((v) => v.status === 'ativo'),

    // Coordena o departamento? (coordenador ativo ou admin da organização)
    coordena(depId, orgId) {
      return meusVinculos.some((v) => v.departamento_id === depId && v.status === 'ativo' && v.papel === 'coordenador')
        || orgsAdmin.some((o) => o.id === orgId);
    },
    ehAdmin(orgId) {
      return orgsAdmin.some((o) => o.id === orgId);
    }
  };
}
