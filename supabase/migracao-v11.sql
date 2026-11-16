-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v10 → v11
-- Circlle só para grupos de música:
--   • cada grupo nasce na hora (sem aprovação), já com as funções de uma banda;
--   • um grupo = uma organização + um departamento (o app esconde essa camada);
--   • pessoas sem cadastro na escala, com link pessoal para virar conta;
--   • escala livre, com a opção "pedir disponibilidade antes";
--   • repertório sempre ligado; tabelas sem uso removidas.
-- Não apaga dados de grupos. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════

-- ───────────────────────────────────────────────────
-- 1. Grupo nasce ativo, com nomes de música
-- ───────────────────────────────────────────────────
alter table public.organizacoes alter column status set default 'ativa';
alter table public.organizacoes alter column termo_organizacao set default 'Grupo';
alter table public.organizacoes alter column termo_departamento set default 'Grupo';
alter table public.organizacoes alter column termo_evento set default 'Data';

alter table public.departamentos
  add column if not exists pedir_disponibilidade boolean not null default false;
alter table public.departamentos alter column modulo_repertorio set default true;
update public.departamentos set modulo_repertorio = true where not modulo_repertorio;

-- Funções que todo grupo novo recebe (dá para mudar depois)
create or replace function public.funcoes_padrao()
returns text[] language sql immutable as $$
  select array['Vocal', 'Back vocal', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Som'];
$$;

-- Cria o grupo na hora: quem cria administra e coordena (RF05 v11)
create or replace function public.criar_grupo(p_nome text, p_cidade text default null, p_tipo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_dep uuid; v_nome text := trim(coalesce(p_nome, ''));
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if char_length(v_nome) not between 2 and 60 then raise exception 'Dê um nome ao grupo'; end if;
  -- Freio contra abuso: até 5 grupos criados por pessoa
  if (select count(*) from organizacoes where solicitado_por = auth.uid()) >= 5 then
    raise exception 'Limite de grupos por pessoa atingido';
  end if;

  insert into organizacoes (nome, cidade, tipo, status, solicitado_por, analisado_em)
  values (v_nome, left(nullif(trim(p_cidade), ''), 80), left(nullif(trim(p_tipo), ''), 40), 'ativa', auth.uid(), now())
  returning id into v_org;
  insert into membros_organizacao (organizacao_id, usuario_id, papel) values (v_org, auth.uid(), 'admin');
  insert into departamentos (organizacao_id, nome, modulo_repertorio) values (v_org, v_nome, true)
  returning id into v_dep;
  insert into membros_departamento (departamento_id, usuario_id, papel, status)
  values (v_dep, auth.uid(), 'coordenador', 'ativo');
  insert into funcoes (departamento_id, nome) select v_dep, unnest(funcoes_padrao());
  return v_dep;
end $$;

-- Renomear o grupo renomeia os dois níveis juntos
create or replace function public.sincronizar_nome_grupo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nome is distinct from old.nome
     and (select count(*) from departamentos where organizacao_id = new.organizacao_id) = 1 then
    update organizacoes set nome = left(new.nome, 80) where id = new.organizacao_id;
  end if;
  return new;
end $$;
drop trigger if exists nome_grupo_sincronizado on public.departamentos;
create trigger nome_grupo_sincronizado
  after update of nome on public.departamentos
  for each row execute function public.sincronizar_nome_grupo();

-- Link de convite: dá para ver o grupo antes de entrar (também sem login)
grant execute on function public.buscar_departamento(text) to anon;


-- ───────────────────────────────────────────────────
-- 2. Pessoas sem cadastro (perfil provisório + link pessoal)
-- ───────────────────────────────────────────────────
-- O perfil deixa de exigir uma conta: o provisório existe só dentro do grupo
alter table public.perfis drop constraint if exists perfis_id_fkey;
alter table public.perfis
  add column if not exists provisorio   boolean not null default false,
  add column if not exists convite_token uuid unique;

-- Conta apagada leva o perfil junto (antes era a chave estrangeira)
create or replace function public.apagar_perfil_da_conta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.perfis where id = old.id;
  return old;
end $$;
drop trigger if exists ao_apagar_usuario on auth.users;
create trigger ao_apagar_usuario
  after delete on auth.users
  for each row execute function public.apagar_perfil_da_conta();

grant select (provisorio) on public.perfis to authenticated;

-- Coordenador (ou quem monta escalas) adiciona alguém que ainda não tem conta
create or replace function public.adicionar_pessoa(p_dep uuid, p_nome text, p_telefone text default null, p_funcoes uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_nome text := trim(coalesce(p_nome, ''));
begin
  if not pode_escalar(p_dep) then raise exception 'Apenas quem monta escalas pode fazer isso'; end if;
  if char_length(v_nome) not between 1 and 80 then raise exception 'Informe o nome da pessoa'; end if;
  insert into perfis (id, nome, apelido, telefone, provisorio, convite_token)
  values (v_id, v_nome, left(split_part(v_nome, ' ', 1), 30), left(nullif(trim(p_telefone), ''), 20), true, gen_random_uuid());
  insert into membros_organizacao (organizacao_id, usuario_id) values (org_do_dep(p_dep), v_id)
    on conflict do nothing;
  insert into membros_departamento (departamento_id, usuario_id, status) values (p_dep, v_id, 'ativo');
  insert into membro_funcoes (departamento_id, usuario_id, funcao_id)
    select p_dep, v_id, f.id from funcoes f where f.departamento_id = p_dep and f.id = any(coalesce(p_funcoes, '{}'));
  return v_id;
end $$;

-- Corrige nome e WhatsApp de quem ainda não tem conta
create or replace function public.editar_pessoa(p_pessoa uuid, p_nome text, p_telefone text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text := trim(coalesce(p_nome, ''));
begin
  if not exists (select 1 from perfis where id = p_pessoa and provisorio) then raise exception 'Essa pessoa já tem conta'; end if;
  if not exists (select 1 from membros_departamento m where m.usuario_id = p_pessoa and pode_escalar(m.departamento_id)) then
    raise exception 'Apenas quem monta escalas pode fazer isso';
  end if;
  if char_length(v_nome) not between 1 and 80 then raise exception 'Informe o nome da pessoa'; end if;
  update perfis set nome = v_nome, apelido = left(split_part(v_nome, ' ', 1), 30),
                    telefone = left(nullif(trim(p_telefone), ''), 20)
  where id = p_pessoa;
end $$;

-- Link pessoal (só quem monta escalas no grupo da pessoa vê)
create or replace function public.link_pessoal(p_pessoa uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if not exists (select 1 from membros_departamento m where m.usuario_id = p_pessoa and pode_escalar(m.departamento_id)) then
    raise exception 'Apenas quem monta escalas pode fazer isso';
  end if;
  select convite_token into v_token from perfis where id = p_pessoa and provisorio;
  if v_token is null then raise exception 'Essa pessoa já tem conta'; end if;
  return v_token;
end $$;

-- O que o link pessoal mostra antes de entrar (também sem login)
create or replace function public.info_convite(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('nome', p.nome, 'apelido', p.apelido,
           'grupo', (select d.nome from membros_departamento m join departamentos d on d.id = m.departamento_id
                     where m.usuario_id = p.id order by m.created_at limit 1))
  from perfis p where p.convite_token = p_token and p.provisorio;
$$;

-- Ao entrar pelo link pessoal: tudo do perfil provisório passa para a conta
create or replace function public.vincular_convite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prov uuid; v_eu uuid := auth.uid(); v_dep uuid;
begin
  if v_eu is null then raise exception 'Faça login primeiro'; end if;
  select id into v_prov from perfis where convite_token = p_token and provisorio;
  if v_prov is null then raise exception 'Este convite já foi usado ou não existe'; end if;

  insert into membros_organizacao (organizacao_id, usuario_id)
    select organizacao_id, v_eu from membros_organizacao where usuario_id = v_prov
    on conflict do nothing;
  insert into membros_departamento (departamento_id, usuario_id, papel, perm_escala, perm_repertorio, status)
    select departamento_id, v_eu, 'membro', perm_escala, perm_repertorio, 'ativo'
    from membros_departamento where usuario_id = v_prov
    on conflict (departamento_id, usuario_id) do update set status = 'ativo';
  insert into membro_funcoes (departamento_id, usuario_id, funcao_id)
    select departamento_id, v_eu, funcao_id from membro_funcoes where usuario_id = v_prov
    on conflict do nothing;
  -- Escalas e datas marcadas: passam para a conta (se ela já estiver na data, fica a dela)
  update escalas s set usuario_id = v_eu
   where s.usuario_id = v_prov
     and not exists (select 1 from escalas x where x.evento_id = s.evento_id and x.usuario_id = v_eu);
  update disponibilidades d set usuario_id = v_eu
   where d.usuario_id = v_prov
     and not exists (select 1 from disponibilidades x where x.evento_id = d.evento_id and x.usuario_id = v_eu);
  -- WhatsApp que o coordenador anotou completa o perfil, se faltar
  update perfis set telefone = coalesce(perfis.telefone, (select telefone from perfis where id = v_prov))
   where id = v_eu;

  select departamento_id into v_dep from membros_departamento where usuario_id = v_prov order by created_at limit 1;
  delete from perfis where id = v_prov; -- leva junto o que sobrou do provisório
  return v_dep;
end $$;

-- Tirou do grupo quem não tinha conta: o perfil provisório some junto
create or replace function public.limpar_provisorio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from perfis where id = old.usuario_id and provisorio)
     and not exists (select 1 from membros_departamento where usuario_id = old.usuario_id) then
    delete from perfis where id = old.usuario_id;
  end if;
  return old;
end $$;
drop trigger if exists provisorio_limpo on public.membros_departamento;
create trigger provisorio_limpo
  after delete on public.membros_departamento
  for each row execute function public.limpar_provisorio();


-- ───────────────────────────────────────────────────
-- 3. Painel do Circlle: acompanhamento (sem fila de aprovação)
-- ───────────────────────────────────────────────────
create or replace function public.grupos_plataforma()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Apenas a equipe do Circlle pode fazer isso'; end if;
  return (
    select coalesce(json_agg(g order by g.created_at desc), '[]'::json) from (
      select o.id, o.nome, o.cidade, o.tipo, o.status, o.created_at,
        (select p.nome from perfis p where p.id = o.solicitado_por) as criado_por,
        (select count(*) from membros_departamento m join departamentos d on d.id = m.departamento_id
          where d.organizacao_id = o.id and m.status = 'ativo') as pessoas,
        (select count(*) from membros_departamento m join departamentos d on d.id = m.departamento_id
          join perfis p on p.id = m.usuario_id
          where d.organizacao_id = o.id and m.status = 'ativo' and p.provisorio) as sem_conta,
        (select count(*) from eventos e join departamentos d on d.id = e.departamento_id
          where d.organizacao_id = o.id) as datas,
        greatest(
          (select max(e.created_at) from eventos e join departamentos d on d.id = e.departamento_id where d.organizacao_id = o.id),
          (select max(s.created_at) from escalas s join eventos e on e.id = s.evento_id
             join departamentos d on d.id = e.departamento_id where d.organizacao_id = o.id),
          o.created_at) as ultima_atividade
      from organizacoes o
    ) g
  );
end $$;


-- Números do painel sem contar quem ainda não tem conta como pessoa no app
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
    'pessoas',       (select count(*) from perfis where not provisorio),
    'sem_conta',     (select count(*) from perfis where provisorio),
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
                 from perfis where not provisorio group by 1) c on c.semana = s.semana
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


-- ───────────────────────────────────────────────────
-- 4. Tabelas que nunca foram usadas
-- ───────────────────────────────────────────────────
drop table if exists public.repertorio_evento cascade;
drop table if exists public.avaliacoes cascade;


-- ───────────────────────────────────────────────────
-- 5. Permissões das funções novas
-- ───────────────────────────────────────────────────
revoke all on function public.criar_grupo(text, text, text) from public, anon;
grant execute on function public.criar_grupo(text, text, text) to authenticated;
revoke all on function public.adicionar_pessoa(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.adicionar_pessoa(uuid, text, text, uuid[]) to authenticated;
revoke all on function public.editar_pessoa(uuid, text, text) from public, anon;
grant execute on function public.editar_pessoa(uuid, text, text) to authenticated;
revoke all on function public.link_pessoal(uuid) from public, anon;
grant execute on function public.link_pessoal(uuid) to authenticated;
revoke all on function public.info_convite(uuid) from public;
grant execute on function public.info_convite(uuid) to anon, authenticated;
revoke all on function public.vincular_convite(uuid) from public, anon;
grant execute on function public.vincular_convite(uuid) to authenticated;
revoke all on function public.grupos_plataforma() from public, anon;
grant execute on function public.grupos_plataforma() to authenticated;


-- ───────────────────────────────────────────────────
-- 6. Nomes na tela: "Grupo" e "Data" para todos
-- ───────────────────────────────────────────────────
update public.organizacoes
   set termo_organizacao = 'Grupo', termo_departamento = 'Grupo', termo_evento = 'Data'
 where termo_organizacao = 'Organização' or termo_departamento = 'Departamento' or termo_evento = 'Evento';
