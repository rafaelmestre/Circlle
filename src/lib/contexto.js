import { supabase } from './supabase.js';

// Tudo o que as telas precisam saber sobre quem está logado
export async function carregarContexto(usuario) {
  const [perfil, nascimento, plataforma, orgs, solicitacoes, vinculos] = await Promise.all([
    supabase.from('perfis').select('id, nome, apelido, telefone, avatar_url, termos_versao').eq('id', usuario.id).maybeSingle(),
    supabase.rpc('meu_nascimento'),
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
      .select(`departamento_id, papel, perm_repertorio, perm_escala, status,
               departamentos(id, nome, codigo, modulo_repertorio, organizacao_id, ativo,
                 organizacoes(id, nome, status, termo_organizacao, termo_departamento, termo_evento, termo_funcao))`)
      .eq('usuario_id', usuario.id)
      .order('created_at')
  ]);

  const erro = perfil.error ?? nascimento.error ?? plataforma.error ?? orgs.error ?? solicitacoes.error ?? vinculos.error;
  if (erro) throw erro;

  const orgsAdmin = (orgs.data ?? [])
    .filter((m) => m.papel === 'admin' && m.organizacoes?.status === 'ativa')
    .map((m) => m.organizacoes);

  // Departamentos das organizações que a pessoa administra
  const depsOrgRes = orgsAdmin.length
    ? await supabase.from('departamentos').select('id, nome, organizacao_id, modulo_repertorio')
        .in('organizacao_id', orgsAdmin.map((o) => o.id)).eq('ativo', true).order('nome')
    : { data: [] };

  // Vínculos de organizações suspensas e de departamentos desativados não aparecem
  const meusVinculos = (vinculos.data ?? [])
    .filter((v) => v.departamentos?.ativo && v.departamentos?.organizacoes?.status === 'ativa');

  const ativos = meusVinculos.filter((v) => v.status === 'ativo');
  const coordena = (depId, orgId) =>
    ativos.some((v) => v.departamento_id === depId && v.papel === 'coordenador')
    || orgsAdmin.some((o) => o.id === orgId);

  // Onde a pessoa monta escalas: coordena, administra ou recebeu a permissão (RN21)
  const porId = new Map();
  for (const v of ativos) {
    const d = v.departamentos;
    porId.set(d.id, { id: d.id, nome: d.nome, organizacao_id: d.organizacao_id, modulo_repertorio: d.modulo_repertorio,
      coordena: coordena(d.id, d.organizacao_id), escala: coordena(d.id, d.organizacao_id) || v.perm_escala,
      repertorio: d.modulo_repertorio && (coordena(d.id, d.organizacao_id) || v.perm_repertorio) });
  }
  for (const d of depsOrgRes.data ?? []) {
    if (!porId.has(d.id)) porId.set(d.id, { ...d, coordena: true, escala: true, repertorio: d.modulo_repertorio });
  }
  const deps = [...porId.values()];

  return {
    usuario,
    perfil: { ...(perfil.data ?? { id: usuario.id, nome: usuario.email }), nascimento: nascimento.data ?? null },
    plataforma: Boolean(plataforma.data),
    orgsAdmin,
    solicitacoes: solicitacoes.data ?? [],
    vinculos: meusVinculos,
    ativos,
    depsEscala: deps.filter((d) => d.escala),
    depsRepertorio: deps.filter((d) => d.repertorio),

    // Coordena o departamento? (coordenador ativo ou admin da organização)
    coordena,
    // Pode montar escalas? (coordena ou recebeu a permissão)
    escala(depId, orgId) {
      return coordena(depId, orgId)
        || ativos.some((v) => v.departamento_id === depId && v.perm_escala);
    },
    ehAdmin(orgId) {
      return orgsAdmin.some((o) => o.id === orgId);
    }
  };
}
