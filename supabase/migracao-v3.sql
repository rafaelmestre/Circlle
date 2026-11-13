-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v2 → v3 (não apaga dados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════
--
-- O que muda:
--   • Escala com várias funções por pessoa na mesma data (tabela escala_funcoes)
--   • Prévia da escala: novo status "previa" do evento
--   • Resposta do escalado: confirmado ou pedido de ajuste com motivo
--   • O pedido de ajuste substitui a tabela de remanejamentos (que estava vazia)

begin;

-- 1. Novo status do evento: prévia
alter table public.eventos drop constraint if exists eventos_status_check;
alter table public.eventos add constraint eventos_status_check
  check (status in ('rascunho', 'aberto', 'previa', 'publicado', 'realizado', 'cancelado'));

-- 2. Resposta do escalado
alter table public.escalas add column if not exists resposta text not null default 'pendente';
alter table public.escalas drop constraint if exists escalas_resposta_check;
alter table public.escalas add constraint escalas_resposta_check
  check (resposta in ('pendente', 'confirmado', 'ajuste'));
alter table public.escalas add column if not exists motivo text;
alter table public.escalas drop constraint if exists escalas_motivo_check;
alter table public.escalas add constraint escalas_motivo_check check (char_length(motivo) <= 300);
alter table public.escalas add column if not exists respondido_em timestamptz;

-- 3. Várias funções por pessoa: leva a função atual para a tabela nova
create table if not exists public.escala_funcoes (
  escala_id  uuid not null references public.escalas(id) on delete cascade,
  funcao_id  uuid not null references public.funcoes(id) on delete cascade,
  primary key (escala_id, funcao_id)
);
create index if not exists escala_funcoes_func_idx on public.escala_funcoes (funcao_id);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'escalas' and column_name = 'funcao_id') then
    insert into public.escala_funcoes (escala_id, funcao_id)
      select id, funcao_id from public.escalas where funcao_id is not null
      on conflict do nothing;
  end if;
end $$;

drop trigger if exists escala_validada on public.escalas;
alter table public.escalas drop column if exists funcao_id;

-- 4. Pedido de ajuste substitui o remanejamento
drop table if exists public.remanejamentos cascade;

-- 5. Validações
-- Só escala quem é membro ativo do departamento
create or replace function public.validar_escala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from membros_departamento
                 where departamento_id = dep_do_evento(new.evento_id)
                   and usuario_id = new.usuario_id and status = 'ativo') then
    raise exception 'A pessoa não é membro ativo do departamento';
  end if;
  return new;
end $$;

drop trigger if exists escala_validada on public.escalas;
create trigger escala_validada
  before insert or update of usuario_id, evento_id on public.escalas
  for each row execute function public.validar_escala();

-- Cada função da escala precisa ser uma que a pessoa faz naquele departamento (RN08)
create or replace function public.validar_escala_funcao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
       select 1 from escalas s
       join eventos e on e.id = s.evento_id
       join membro_funcoes mf on mf.usuario_id = s.usuario_id
                             and mf.departamento_id = e.departamento_id
                             and mf.funcao_id = new.funcao_id
       where s.id = new.escala_id) then
    raise exception 'A pessoa não faz essa função no departamento';
  end if;
  return new;
end $$;

drop trigger if exists escala_funcao_validada on public.escala_funcoes;
create trigger escala_funcao_validada
  before insert or update on public.escala_funcoes
  for each row execute function public.validar_escala_funcao();

-- 6. Segurança
alter table public.escala_funcoes enable row level security;
drop policy if exists "eventos: ler" on public.eventos;
create policy "eventos: ler" on public.eventos for select to authenticated
  using (eh_coord_dep(departamento_id)
         or (eh_membro_dep(departamento_id) and status in ('aberto', 'previa', 'publicado', 'realizado')));
-- ESCALAS: o departamento vê a prévia e a escala publicada; coordenador gerencia
drop policy if exists "escalas: ler" on public.escalas;
create policy "escalas: ler" on public.escalas for select to authenticated
  using (eh_coord_dep(dep_do_evento(evento_id))
         or (eh_membro_dep(dep_do_evento(evento_id))
             and exists (select 1 from eventos where id = evento_id and status in ('previa', 'publicado', 'realizado'))));
drop policy if exists "escalas: coordenador gerencia" on public.escalas;
create policy "escalas: coordenador gerencia" on public.escalas for all to authenticated
  using (eh_coord_dep(dep_do_evento(evento_id))) with check (eh_coord_dep(dep_do_evento(evento_id)));

-- FUNÇÕES NA ESCALA: visíveis junto com a escala
drop policy if exists "escala_funcoes: ler" on public.escala_funcoes;
create policy "escala_funcoes: ler" on public.escala_funcoes for select to authenticated
  using (exists (select 1 from escalas s where s.id = escala_id));
drop policy if exists "escala_funcoes: coordenador gerencia" on public.escala_funcoes;
create policy "escala_funcoes: coordenador gerencia" on public.escala_funcoes for all to authenticated
  using (eh_coord_dep(dep_da_escala(escala_id))) with check (eh_coord_dep(dep_da_escala(escala_id)));

-- 7. Resposta do escalado
-- O escalado responde à prévia ou à escala publicada:
-- "confirmado" ou "ajuste" (com motivo). A vaga continua com ele até o coordenador decidir.
create or replace function public.responder_escala(p_evento uuid, p_resposta text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_resposta not in ('confirmado', 'ajuste') then raise exception 'Resposta inválida'; end if;
  if p_resposta = 'ajuste' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Conte o motivo do ajuste';
  end if;
  if not exists (select 1 from eventos where id = p_evento and status in ('previa', 'publicado'))
     or not eh_membro_dep(dep_do_evento(p_evento)) then
    raise exception 'Esta escala não está aberta para respostas';
  end if;

  update escalas
     set resposta = p_resposta,
         motivo = case when p_resposta = 'ajuste' then left(trim(p_motivo), 300) end,
         respondido_em = now()
   where evento_id = p_evento and usuario_id = auth.uid();
  if not found then raise exception 'Você não está nesta escala'; end if;
end $$;

revoke all on function public.responder_escala(uuid, text, text) from public, anon;
grant execute on function public.responder_escala(uuid, text, text) to authenticated;

-- 8. Painel do Circlle conta as prévias
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

commit;
