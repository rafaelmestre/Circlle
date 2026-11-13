-- ═══════════════════════════════════════════════════
-- CIRCLLE — painel da equipe Circlle (números agregados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Não apaga nada. Já está incluído no schema.sql para instalações novas.
-- ═══════════════════════════════════════════════════
--
-- Só números: nenhum nome, escala ou aviso das organizações sai daqui (RN14).

create or replace function public.painel_plataforma()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Apenas a equipe do Circlle pode fazer isso'; end if;

  return json_build_object(
    'grupos', json_build_object(
      'ativos',     (select count(*) from organizacoes where status = 'ativa'),
      'em_analise', (select count(*) from organizacoes where status = 'em_analise'),
      'suspensos',  (select count(*) from organizacoes where status in ('suspensa', 'recusada'))
    ),
    'departamentos', (select count(*) from departamentos d join organizacoes o on o.id = d.organizacao_id
                      where d.ativo and o.status = 'ativa'),
    'pessoas',       (select count(*) from perfis),
    'membros_ativos', (select count(distinct m.usuario_id) from membros_departamento m
                       join departamentos d on d.id = m.departamento_id
                       join organizacoes o on o.id = d.organizacao_id
                       where m.status = 'ativo' and o.status = 'ativa'),
    'pedidos_pendentes', (select count(*) from membros_departamento where status = 'pendente'),
    'datas_proximas', (select count(*) from eventos
                       where inicio between now() and now() + interval '30 days'
                         and status in ('aberto', 'previa', 'publicado')),
    'escalas_publicadas_30d', (select count(*) from eventos
                               where status in ('publicado', 'realizado')
                                 and inicio between now() - interval '30 days' and now() + interval '30 days'),
    'disponibilidades_30d', (select count(*) from disponibilidades where created_at > now() - interval '30 days'),

    -- Novas contas por semana (últimas 8 semanas, da mais antiga para a mais recente)
    'contas_por_semana', (
      select json_agg(json_build_object('semana', s.semana, 'total', coalesce(c.total, 0)) order by s.semana)
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as s(semana)
      left join (select date_trunc('week', created_at) as semana, count(*) as total
                 from perfis group by 1) c on c.semana = s.semana
    ),

    -- Uso por grupo ativo
    'uso_por_grupo', (
      select coalesce(json_agg(g order by g.membros desc, g.nome), '[]'::json) from (
        select o.id, o.nome, o.cidade, o.created_at,
          (select count(*) from departamentos d where d.organizacao_id = o.id and d.ativo) as departamentos,
          (select count(distinct m.usuario_id) from membros_departamento m
             join departamentos d on d.id = m.departamento_id
            where d.organizacao_id = o.id and m.status = 'ativo') as membros,
          (select count(*) from eventos e join departamentos d on d.id = e.departamento_id
            where d.organizacao_id = o.id and e.inicio > now() - interval '30 days') as datas_30d,
          (select max(e.created_at) from eventos e join departamentos d on d.id = e.departamento_id
            where d.organizacao_id = o.id) as ultima_atividade
        from organizacoes o
        where o.status = 'ativa'
      ) g
    )
  );
end $$;

revoke all on function public.painel_plataforma() from public, anon;
grant execute on function public.painel_plataforma() to authenticated;
