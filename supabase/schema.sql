-- ═══════════════════════════════════════════════════
-- CIRCLLE — schema do banco v8 (Supabase / PostgreSQL)
-- Rode no Supabase: SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════
--
-- ⚠️  ESTA VERSÃO RECRIA O BANCO DO ZERO.
--     Apaga todas as tabelas do Circlle (organizações, equipes,
--     escalas…). As CONTAS de login continuam existindo e os
--     perfis são recriados a partir delas.
--     Já tem dados? Rode só as migrações que faltam:
--     v2 → migracao-v3.sql, v3 → migracao-v4.sql, v4 → migracao-v5.sql,
--     v5 → migracao-v6.sql, v6 → migracao-v7.sql, v7 → migracao-v8.sql.
--     O lembrete na véspera (agendador) fica só em migracao-v5.sql:
--     rode-a depois deste arquivo, com a função notificar já publicada.
--
-- Estrutura (ver docs/documentacao.md):
--   organização (grupo) → departamentos → eventos → disponibilidades → escalas
--   Todo mundo entra como membro. O Circlle aprova a organização,
--   o administrador promove coordenadores e o coordenador libera
--   a permissão de repertório.


-- ───────────────────────────────────────────────────
-- 0. RESET: remove a versão anterior
-- ───────────────────────────────────────────────────
drop trigger if exists ao_criar_usuario on auth.users;
drop table if exists
  public.push_inscricoes, public.avisos, public.avaliacoes, public.repertorio_evento,
  public.repertorio_itens, public.repertorios,
  public.musicas, public.remanejamentos, public.indisponibilidades, public.disponibilidades,
  public.escala_funcoes, public.escalas, public.eventos, public.convites, public.membro_funcoes, public.funcoes,
  public.membros_equipe, public.membros_departamento, public.equipes, public.departamentos,
  public.membros_organizacao, public.organizacoes, public.admins_plataforma, public.perfis
  cascade;
drop function if exists
  public.criar_perfil(), public.org_criador_admin(), public.aceitar_convite(text),
  public.proteger_escala(), public.excluir_minha_conta(),
  public.eh_membro_org(uuid), public.eh_admin_org(uuid), public.org_da_equipe(uuid),
  public.equipe_do_evento(uuid), public.equipe_da_escala(uuid), public.eh_membro_equipe(uuid),
  public.eh_lider_equipe(uuid), public.pode_repertorio(uuid), public.validar_escala_funcao(),
  public.responder_escala(uuid, text, text), public.proteger_departamento(),
  public.registrar_push(text, text, text), public.pode_escalar(uuid),
  public.dep_do_repertorio(uuid), public.validar_item_repertorio(), public.validar_repertorio_evento(),
  public.aplicar_repertorio(uuid, uuid), public.aceitar_termos(text)
  cascade;


-- ───────────────────────────────────────────────────
-- 1. PERFIS
-- ───────────────────────────────────────────────────
create table public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null check (char_length(nome) between 1 and 80),
  telefone    text check (char_length(telefone) <= 20),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Recria o perfil das contas que já existem
insert into public.perfis (id, nome)
select id, coalesce(nullif(trim(raw_user_meta_data->>'nome'), ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- Donos da plataforma (equipe do Circlle)
create table public.admins_plataforma (
  usuario_id  uuid primary key references public.perfis(id) on delete cascade,
  created_at  timestamptz not null default now()
);


-- ───────────────────────────────────────────────────
-- 2. ORGANIZAÇÕES: solicitadas pelo grupo, aprovadas pelo Circlle
-- ───────────────────────────────────────────────────
create table public.organizacoes (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null check (char_length(nome) between 1 and 80),
  tipo                  text check (char_length(tipo) <= 40),
  cidade                text check (char_length(cidade) <= 80),
  tamanho               text check (char_length(tamanho) <= 20),
  whatsapp              text check (char_length(whatsapp) <= 20),
  email                 text check (char_length(email) <= 120),
  status                text not null default 'em_analise'
                          check (status in ('em_analise', 'ativa', 'recusada', 'suspensa')),
  limite_departamentos  int check (limite_departamentos > 0),  -- vazio = sem limite
  -- rótulos exibidos na tela (só mudam o que aparece)
  termo_organizacao     text not null default 'Organização' check (char_length(termo_organizacao) <= 30),
  termo_departamento    text not null default 'Departamento' check (char_length(termo_departamento) <= 30),
  termo_evento          text not null default 'Evento' check (char_length(termo_evento) <= 30),
  termo_funcao          text not null default 'Função' check (char_length(termo_funcao) <= 30),
  solicitado_por        uuid default auth.uid() references public.perfis(id) on delete set null,
  analisado_em          timestamptz,
  created_at            timestamptz not null default now()
);

create table public.membros_organizacao (
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id      uuid not null references public.perfis(id) on delete cascade,
  papel           text not null default 'membro' check (papel in ('admin', 'membro')),
  created_at      timestamptz not null default now(),
  primary key (organizacao_id, usuario_id)
);


-- ───────────────────────────────────────────────────
-- 3. DEPARTAMENTOS, com código de entrada
-- ───────────────────────────────────────────────────
-- Código curto sem caracteres ambíguos (sem 0/O, 1/I/L), ex.: K7P-4MXQ
create or replace function public.gerar_codigo()
returns text language plpgsql volatile as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..7 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
      if i = 3 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.departamentos where codigo = c);
  end loop;
  return c;
end $$;

create table public.departamentos (
  id                 uuid primary key default gen_random_uuid(),
  organizacao_id     uuid not null references public.organizacoes(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 60),
  codigo             text not null unique,
  modulo_repertorio  boolean not null default false,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now()
);

create or replace function public.codigo_departamento()
returns trigger language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then new.codigo := public.gerar_codigo(); end if;
  return new;
end $$;

create trigger departamento_codigo
  before insert on public.departamentos
  for each row execute function public.codigo_departamento();

-- Papel por departamento. Todos entram como membro 'pendente'.
create table public.membros_departamento (
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  usuario_id       uuid not null references public.perfis(id) on delete cascade,
  papel            text not null default 'membro' check (papel in ('coordenador', 'membro')),
  perm_repertorio  boolean not null default false,
  status           text not null default 'pendente' check (status in ('pendente', 'ativo')),
  created_at       timestamptz not null default now(),
  primary key (departamento_id, usuario_id)
);

create table public.funcoes (
  id               uuid primary key default gen_random_uuid(),
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  nome             text not null check (char_length(nome) between 1 and 40),
  unique (departamento_id, nome)
);

-- O que cada membro faz no departamento
create table public.membro_funcoes (
  departamento_id  uuid not null,
  usuario_id       uuid not null,
  funcao_id        uuid not null references public.funcoes(id) on delete cascade,
  primary key (usuario_id, funcao_id),
  foreign key (departamento_id, usuario_id)
    references public.membros_departamento(departamento_id, usuario_id) on delete cascade
);


-- ───────────────────────────────────────────────────
-- 4. EVENTOS, DISPONIBILIDADE E ESCALA
-- ───────────────────────────────────────────────────
create table public.eventos (
  id                      uuid primary key default gen_random_uuid(),
  departamento_id         uuid not null references public.departamentos(id) on delete cascade,
  tipo                    text not null default 'evento' check (tipo in ('evento', 'ensaio')),
  evento_pai_id           uuid references public.eventos(id) on delete cascade,
  duplicado_de            uuid references public.eventos(id) on delete set null,
  titulo                  text not null check (char_length(titulo) between 1 and 80),
  local                   text check (char_length(local) <= 120),
  inicio                  timestamptz not null,
  fim                     timestamptz,
  status                  text not null default 'aberto'
                            check (status in ('rascunho', 'aberto', 'previa', 'publicado', 'realizado', 'cancelado')),
  responsavel_repertorio  uuid references public.perfis(id) on delete set null,
  criado_por              uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at              timestamptz not null default now(),
  check (fim is null or fim > inicio),
  check (evento_pai_id is null or tipo = 'ensaio')
);

-- "Posso nesse dia": sem função e sem limite de pessoas
create table public.disponibilidades (
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  usuario_id  uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

-- Quem foi escalado e a resposta dele (prévia e escala publicada)
create table public.escalas (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references public.eventos(id) on delete cascade,
  usuario_id     uuid not null references public.perfis(id) on delete cascade,
  resposta       text not null default 'pendente' check (resposta in ('pendente', 'confirmado', 'ajuste')),
  motivo         text check (char_length(motivo) <= 300),
  respondido_em  timestamptz,
  presenca       text check (presenca in ('presente', 'faltou')),
  sugerido       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (evento_id, usuario_id)
);

-- O que cada escalado faz naquela data: pode ser mais de uma função (tocar e cantar)
create table public.escala_funcoes (
  escala_id  uuid not null references public.escalas(id) on delete cascade,
  funcao_id  uuid not null references public.funcoes(id) on delete cascade,
  primary key (escala_id, funcao_id)
);


-- ───────────────────────────────────────────────────
-- 5. REPERTÓRIO, DESEMPENHO, MURAL E PUSH (etapas 2 e 3)
-- ───────────────────────────────────────────────────
create table public.musicas (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  titulo          text not null check (char_length(titulo) between 1 and 120),
  artista         text check (char_length(artista) <= 120),
  tom             text check (char_length(tom) <= 8),
  link            text,
  cifra           text,
  criado_por      uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table public.repertorio_evento (
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  musica_id   uuid not null references public.musicas(id) on delete cascade,
  ordem       smallint not null default 1,
  tom         text check (char_length(tom) <= 8),
  observacao  text check (char_length(observacao) <= 200),
  primary key (evento_id, musica_id)
);

create table public.avaliacoes (
  id            uuid primary key default gen_random_uuid(),
  escala_id     uuid not null unique references public.escalas(id) on delete cascade,
  avaliador     uuid default auth.uid() references public.perfis(id) on delete set null,
  seguranca     smallint check (seguranca between 1 and 5),
  preparo       smallint check (preparo between 1 and 5),
  pontualidade  smallint check (pontualidade between 1 and 5),
  comentario    text check (char_length(comentario) <= 500),
  created_at    timestamptz not null default now()
);

create table public.avisos (
  id               uuid primary key default gen_random_uuid(),
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  autor            uuid default auth.uid() references public.perfis(id) on delete set null,
  titulo           text not null check (char_length(titulo) between 1 and 100),
  corpo            text check (char_length(corpo) <= 2000),
  created_at       timestamptz not null default now()
);

create table public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);


-- ───────────────────────────────────────────────────
-- 6. ÍNDICES
-- ───────────────────────────────────────────────────
create index departamentos_org_idx    on public.departamentos (organizacao_id);
create index membros_dep_usuario_idx  on public.membros_departamento (usuario_id);
create index membros_org_usuario_idx  on public.membros_organizacao (usuario_id);
create index organizacoes_solic_idx   on public.organizacoes (solicitado_por);
create index eventos_dep_inicio_idx   on public.eventos (departamento_id, inicio);
create index disponib_usuario_idx     on public.disponibilidades (usuario_id);
create index escalas_usuario_idx      on public.escalas (usuario_id);
create index escala_funcoes_func_idx  on public.escala_funcoes (funcao_id);
create index musicas_org_idx          on public.musicas (organizacao_id);
create index avisos_dep_idx           on public.avisos (departamento_id, created_at desc);


-- ───────────────────────────────────────────────────
-- 7. FUNÇÕES AUXILIARES (security definer evita recursão do RLS)
-- ───────────────────────────────────────────────────
create or replace function public.eh_admin_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins_plataforma where usuario_id = auth.uid());
$$;

create or replace function public.org_ativa(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizacoes where id = org and status = 'ativa');
$$;

create or replace function public.eh_membro_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_organizacao where organizacao_id = org and usuario_id = auth.uid());
$$;

create or replace function public.eh_admin_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_organizacao
                 where organizacao_id = org and usuario_id = auth.uid() and papel = 'admin')
     and public.org_ativa(org);
$$;

create or replace function public.org_do_dep(dep uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organizacao_id from departamentos where id = dep;
$$;

create or replace function public.dep_do_evento(ev uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select departamento_id from eventos where id = ev;
$$;

create or replace function public.dep_da_escala(esc uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.departamento_id from escalas s join eventos e on e.id = s.evento_id where s.id = esc;
$$;

create or replace function public.eh_membro_dep(dep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_departamento
                 where departamento_id = dep and usuario_id = auth.uid() and status = 'ativo')
     and public.org_ativa(public.org_do_dep(dep));
$$;

-- Coordenador do departamento ou administrador da organização
create or replace function public.eh_coord_dep(dep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (select 1 from membros_departamento
                  where departamento_id = dep and usuario_id = auth.uid()
                    and status = 'ativo' and papel = 'coordenador')
          and public.org_ativa(public.org_do_dep(dep)))
      or public.eh_admin_org(public.org_do_dep(dep));
$$;

create or replace function public.pode_repertorio(dep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from departamentos where id = dep and modulo_repertorio)
     and (public.eh_coord_dep(dep)
          or exists (select 1 from membros_departamento
                     where departamento_id = dep and usuario_id = auth.uid()
                       and status = 'ativo' and perm_repertorio));
$$;


-- ───────────────────────────────────────────────────
-- 8. AÇÕES (RPC) que precisam passar por regras
-- ───────────────────────────────────────────────────

-- Circlle aprova, recusa ou suspende uma organização (RF07)
create or replace function public.analisar_organizacao(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_solicitante uuid;
begin
  if not eh_admin_plataforma() then raise exception 'Apenas a equipe do Circlle pode fazer isso'; end if;
  if p_status not in ('ativa', 'recusada', 'suspensa') then raise exception 'Status inválido'; end if;

  update organizacoes set status = p_status, analisado_em = now()
  where id = p_org returning solicitado_por into v_solicitante;
  if not found then raise exception 'Organização não encontrada'; end if;

  -- Quem solicitou vira administrador
  if p_status = 'ativa' and v_solicitante is not null then
    insert into membros_organizacao (organizacao_id, usuario_id, papel)
    values (p_org, v_solicitante, 'admin')
    on conflict (organizacao_id, usuario_id) do update set papel = 'admin';
  end if;
end $$;

-- Mostra o departamento de um código antes de pedir para entrar (RF13)
create or replace function public.buscar_departamento(p_codigo text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', d.id,
    'nome', d.nome,
    'organizacao', o.nome,
    'termo_funcao', o.termo_funcao,
    'funcoes', coalesce((select json_agg(json_build_object('id', f.id, 'nome', f.nome) order by f.nome)
                         from funcoes f where f.departamento_id = d.id), '[]'::json),
    'ja_participa', exists (select 1 from membros_departamento m
                            where m.departamento_id = d.id and m.usuario_id = auth.uid())
  )
  from departamentos d join organizacoes o on o.id = d.organizacao_id
  where d.codigo = upper(trim(p_codigo)) and d.ativo and o.status = 'ativa';
$$;

-- Pede para entrar no departamento já marcando as funções (RF13)
create or replace function public.entrar_departamento(p_codigo text, p_funcoes uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_dep uuid; v_org uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;

  select d.id, d.organizacao_id into v_dep, v_org
  from departamentos d join organizacoes o on o.id = d.organizacao_id
  where d.codigo = upper(trim(p_codigo)) and d.ativo and o.status = 'ativa';
  if v_dep is null then raise exception 'Código inválido'; end if;

  if exists (select 1 from membros_departamento where departamento_id = v_dep and usuario_id = auth.uid()) then
    raise exception 'Você já participa deste departamento';
  end if;

  insert into membros_organizacao (organizacao_id, usuario_id) values (v_org, auth.uid())
    on conflict do nothing;
  insert into membros_departamento (departamento_id, usuario_id) values (v_dep, auth.uid());
  insert into membro_funcoes (departamento_id, usuario_id, funcao_id)
    select v_dep, auth.uid(), f.id from funcoes f
    where f.departamento_id = v_dep and f.id = any(coalesce(p_funcoes, '{}'));
  return v_dep;
end $$;

-- Gera um novo código; o anterior deixa de valer (RF12)
create or replace function public.novo_codigo(p_dep uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not eh_coord_dep(p_dep) then raise exception 'Apenas coordenadores podem fazer isso'; end if;
  c := gerar_codigo();
  update departamentos set codigo = c where id = p_dep;
  return c;
end $$;

-- Exclui a própria conta e todos os dados (LGPD)
create or replace function public.excluir_minha_conta()
returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;


-- ───────────────────────────────────────────────────
-- 9. REGRAS QUE O RLS SOZINHO NÃO GARANTE
-- ───────────────────────────────────────────────────

-- Status e limite da organização: só o Circlle muda
create or replace function public.proteger_organizacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not eh_admin_plataforma()
     and (new.status <> old.status or new.limite_departamentos is distinct from old.limite_departamentos
          or new.solicitado_por is distinct from old.solicitado_por) then
    raise exception 'Apenas a equipe do Circlle pode alterar isso';
  end if;
  return new;
end $$;

create trigger organizacao_protegida
  before update on public.organizacoes
  for each row execute function public.proteger_organizacao();

-- Limite de departamentos do plano (vazio = sem limite)
create or replace function public.limitar_departamentos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limite int;
begin
  select limite_departamentos into v_limite from organizacoes where id = new.organizacao_id;
  if v_limite is not null and
     (select count(*) from departamentos where organizacao_id = new.organizacao_id and ativo) >= v_limite then
    raise exception 'Limite de departamentos do plano atingido';
  end if;
  return new;
end $$;

create trigger departamento_limite
  before insert on public.departamentos
  for each row execute function public.limitar_departamentos();

-- Só o administrador promove a coordenador (RN01)
create or replace function public.proteger_papel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' and new.papel = 'coordenador' or tg_op = 'UPDATE' and new.papel <> old.papel)
     and not eh_admin_org(org_do_dep(new.departamento_id)) then
    raise exception 'Apenas o administrador define coordenadores';
  end if;
  return new;
end $$;

create trigger papel_protegido
  before insert or update on public.membros_departamento
  for each row execute function public.proteger_papel();

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


-- ───────────────────────────────────────────────────
-- 10. SEGURANÇA (Row Level Security)
-- ───────────────────────────────────────────────────
alter table public.perfis                enable row level security;
alter table public.admins_plataforma     enable row level security;
alter table public.organizacoes          enable row level security;
alter table public.membros_organizacao   enable row level security;
alter table public.departamentos         enable row level security;
alter table public.membros_departamento  enable row level security;
alter table public.funcoes               enable row level security;
alter table public.membro_funcoes        enable row level security;
alter table public.eventos               enable row level security;
alter table public.disponibilidades      enable row level security;
alter table public.escalas               enable row level security;
alter table public.escala_funcoes        enable row level security;
alter table public.musicas               enable row level security;
alter table public.repertorio_evento     enable row level security;
alter table public.avaliacoes            enable row level security;
alter table public.avisos                enable row level security;
alter table public.push_inscricoes       enable row level security;

-- PERFIS: o próprio, colegas de organização e, para análise, o Circlle
create policy "perfis: ler" on public.perfis for select to authenticated
  using (id = auth.uid() or eh_admin_plataforma() or exists (
    select 1 from membros_organizacao a join membros_organizacao b using (organizacao_id)
    where a.usuario_id = auth.uid() and b.usuario_id = perfis.id));
create policy "perfis: editar o próprio" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ADMINS DA PLATAFORMA: cada um sabe se é
create policy "plataforma: ler a própria" on public.admins_plataforma for select to authenticated
  using (usuario_id = auth.uid());

-- ORGANIZAÇÕES
create policy "org: ler" on public.organizacoes for select to authenticated
  using (eh_membro_org(id) or solicitado_por = auth.uid() or eh_admin_plataforma());
create policy "org: solicitar" on public.organizacoes for insert to authenticated
  with check (solicitado_por = auth.uid() and status = 'em_analise' and limite_departamentos is null);
create policy "org: admin edita" on public.organizacoes for update to authenticated
  using (eh_admin_org(id) or eh_admin_plataforma())
  with check (eh_admin_org(id) or eh_admin_plataforma());

-- MEMBROS DA ORGANIZAÇÃO
create policy "membros_org: ler" on public.membros_organizacao for select to authenticated
  using (usuario_id = auth.uid() or eh_membro_org(organizacao_id));
create policy "membros_org: admin gerencia" on public.membros_organizacao for all to authenticated
  using (eh_admin_org(organizacao_id)) with check (eh_admin_org(organizacao_id));
create policy "membros_org: sair" on public.membros_organizacao for delete to authenticated
  using (usuario_id = auth.uid());

-- DEPARTAMENTOS: admin cria; coordenador edita
create policy "dep: ler" on public.departamentos for select to authenticated
  using (eh_membro_org(organizacao_id));
create policy "dep: admin gerencia" on public.departamentos for all to authenticated
  using (eh_admin_org(organizacao_id)) with check (eh_admin_org(organizacao_id));
create policy "dep: coordenador edita" on public.departamentos for update to authenticated
  using (eh_coord_dep(id)) with check (eh_coord_dep(id));

-- MEMBROS DO DEPARTAMENTO
create policy "membros_dep: ler" on public.membros_departamento for select to authenticated
  using (usuario_id = auth.uid() or eh_membro_dep(departamento_id) or eh_coord_dep(departamento_id));
create policy "membros_dep: coordenador gerencia" on public.membros_departamento for all to authenticated
  using (eh_coord_dep(departamento_id)) with check (eh_coord_dep(departamento_id));
create policy "membros_dep: sair" on public.membros_departamento for delete to authenticated
  using (usuario_id = auth.uid());

-- FUNÇÕES DO DEPARTAMENTO
create policy "funcoes: ler" on public.funcoes for select to authenticated
  using (eh_membro_org(org_do_dep(departamento_id)));
create policy "funcoes: coordenador gerencia" on public.funcoes for all to authenticated
  using (eh_coord_dep(departamento_id)) with check (eh_coord_dep(departamento_id));

-- O QUE CADA MEMBRO FAZ: o próprio membro edita (RF03); coordenador também
create policy "membro_funcoes: ler" on public.membro_funcoes for select to authenticated
  using (usuario_id = auth.uid() or eh_membro_dep(departamento_id) or eh_coord_dep(departamento_id));
create policy "membro_funcoes: o próprio" on public.membro_funcoes for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid()
              and exists (select 1 from funcoes f where f.id = funcao_id and f.departamento_id = membro_funcoes.departamento_id));
create policy "membro_funcoes: coordenador" on public.membro_funcoes for all to authenticated
  using (eh_coord_dep(departamento_id))
  with check (eh_coord_dep(departamento_id)
              and exists (select 1 from funcoes f where f.id = funcao_id and f.departamento_id = membro_funcoes.departamento_id));

-- EVENTOS: membros veem os abertos e publicados; coordenador gerencia
create policy "eventos: ler" on public.eventos for select to authenticated
  using (eh_coord_dep(departamento_id)
         or (eh_membro_dep(departamento_id) and status in ('aberto', 'previa', 'publicado', 'realizado')));
create policy "eventos: coordenador gerencia" on public.eventos for all to authenticated
  using (eh_coord_dep(departamento_id)) with check (eh_coord_dep(departamento_id));

-- DISPONIBILIDADE: o membro marca enquanto o evento está aberto
create policy "disponib: ler" on public.disponibilidades for select to authenticated
  using (usuario_id = auth.uid() or eh_coord_dep(dep_do_evento(evento_id)));
create policy "disponib: marcar" on public.disponibilidades for insert to authenticated
  with check (usuario_id = auth.uid() and eh_membro_dep(dep_do_evento(evento_id))
              and exists (select 1 from eventos where id = evento_id and status = 'aberto'));
create policy "disponib: desmarcar" on public.disponibilidades for delete to authenticated
  using (usuario_id = auth.uid()
         and exists (select 1 from eventos where id = evento_id and status = 'aberto'));
create policy "disponib: coordenador" on public.disponibilidades for delete to authenticated
  using (eh_coord_dep(dep_do_evento(evento_id)));

-- ESCALAS: o departamento vê a prévia e a escala publicada; coordenador gerencia
create policy "escalas: ler" on public.escalas for select to authenticated
  using (eh_coord_dep(dep_do_evento(evento_id))
         or (eh_membro_dep(dep_do_evento(evento_id))
             and exists (select 1 from eventos where id = evento_id and status in ('previa', 'publicado', 'realizado'))));
create policy "escalas: coordenador gerencia" on public.escalas for all to authenticated
  using (eh_coord_dep(dep_do_evento(evento_id))) with check (eh_coord_dep(dep_do_evento(evento_id)));

-- FUNÇÕES NA ESCALA: visíveis junto com a escala
create policy "escala_funcoes: ler" on public.escala_funcoes for select to authenticated
  using (exists (select 1 from escalas s where s.id = escala_id));
create policy "escala_funcoes: coordenador gerencia" on public.escala_funcoes for all to authenticated
  using (eh_coord_dep(dep_da_escala(escala_id))) with check (eh_coord_dep(dep_da_escala(escala_id)));

-- MÚSICAS: banco privado da organização
create policy "musicas: ler" on public.musicas for select to authenticated
  using (eh_membro_org(organizacao_id));
create policy "musicas: gerenciar" on public.musicas for all to authenticated
  using (eh_admin_org(organizacao_id) or exists (
    select 1 from departamentos d where d.organizacao_id = musicas.organizacao_id and pode_repertorio(d.id)))
  with check (eh_admin_org(organizacao_id) or exists (
    select 1 from departamentos d where d.organizacao_id = musicas.organizacao_id and pode_repertorio(d.id)));

create policy "repertorio: ler" on public.repertorio_evento for select to authenticated
  using (eh_membro_dep(dep_do_evento(evento_id)) or eh_coord_dep(dep_do_evento(evento_id)));
create policy "repertorio: montar" on public.repertorio_evento for all to authenticated
  using (pode_repertorio(dep_do_evento(evento_id)))
  with check (pode_repertorio(dep_do_evento(evento_id)));

-- DESEMPENHO: só coordenadores
create policy "avaliacoes: coordenador" on public.avaliacoes for all to authenticated
  using (eh_coord_dep(dep_da_escala(escala_id))) with check (eh_coord_dep(dep_da_escala(escala_id)));

-- MURAL
create policy "avisos: ler" on public.avisos for select to authenticated
  using (eh_membro_dep(departamento_id) or eh_coord_dep(departamento_id));
create policy "avisos: publicar" on public.avisos for all to authenticated
  using (eh_coord_dep(departamento_id) or pode_repertorio(departamento_id))
  with check (eh_coord_dep(departamento_id) or pode_repertorio(departamento_id));

-- PUSH
create policy "push: dono" on public.push_inscricoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());


-- ───────────────────────────────────────────────────
-- 11. PERMISSÕES DAS AÇÕES
-- ───────────────────────────────────────────────────
revoke all on function public.analisar_organizacao(uuid, text) from public, anon;
revoke all on function public.buscar_departamento(text) from public, anon;
revoke all on function public.entrar_departamento(text, uuid[]) from public, anon;
revoke all on function public.novo_codigo(uuid) from public, anon;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.analisar_organizacao(uuid, text) to authenticated;
grant execute on function public.buscar_departamento(text) to authenticated;
grant execute on function public.entrar_departamento(text, uuid[]) to authenticated;
grant execute on function public.novo_codigo(uuid) to authenticated;
grant execute on function public.excluir_minha_conta() to authenticated;


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


-- ───────────────────────────────────────────────────
-- 11b. PAINEL DO CIRCLLE (só números agregados, RN14)
-- ───────────────────────────────────────────────────
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


-- ───────────────────────────────────────────────────
-- 11c. v4: DEPARTAMENTO PROTEGIDO E NOTIFICAÇÕES
-- ───────────────────────────────────────────────────

-- O coordenador pode renomear o departamento, mas só o administrador
-- desativa ou reativa, e nenhum departamento muda de organização.
create or replace function public.proteger_departamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limite int;
begin
  if auth.uid() is null or eh_admin_plataforma() then return new; end if;
  if new.organizacao_id <> old.organizacao_id then
    raise exception 'O departamento não pode mudar de organização';
  end if;
  if new.ativo <> old.ativo then
    if not eh_admin_org(old.organizacao_id) then
      raise exception 'Apenas o administrador ativa ou desativa departamentos';
    end if;
    -- Reativar conta no limite do plano
    if new.ativo then
      select limite_departamentos into v_limite from organizacoes where id = new.organizacao_id;
      if v_limite is not null and
         (select count(*) from departamentos where organizacao_id = new.organizacao_id and ativo) >= v_limite then
        raise exception 'Limite de departamentos do plano atingido';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists departamento_protegido on public.departamentos;
create trigger departamento_protegido
  before update on public.departamentos
  for each row execute function public.proteger_departamento();

-- Liga as notificações deste aparelho à conta logada
-- (se outra conta usou o mesmo aparelho antes, a inscrição passa para esta)
create or replace function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Inscrição inválida';
  end if;
  insert into push_inscricoes (usuario_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh,
        auth = excluded.auth, created_at = now();
end $$;

revoke all on function public.registrar_push(text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text) to authenticated;


-- ───────────────────────────────────────────────────
-- 11d. v6: PERMISSÃO DE MONTAR ESCALAS
-- ───────────────────────────────────────────────────

-- O coordenador pode liberar para um membro montar escalas (RN21)
alter table public.membros_departamento
  add column if not exists perm_escala boolean not null default false;

-- Monta escalas: coordena/administra ou recebeu a permissão
create or replace function public.pode_escalar(dep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_coord_dep(dep)
      or (exists (select 1 from membros_departamento
                  where departamento_id = dep and usuario_id = auth.uid()
                    and status = 'ativo' and perm_escala)
          and public.org_ativa(public.org_do_dep(dep)));
$$;

drop policy if exists "eventos: ler" on public.eventos;
drop policy if exists "eventos: coordenador gerencia" on public.eventos;
create policy "eventos: ler" on public.eventos for select to authenticated
  using (pode_escalar(departamento_id)
         or (eh_membro_dep(departamento_id) and status in ('aberto', 'previa', 'publicado', 'realizado')));
create policy "eventos: coordenador gerencia" on public.eventos for all to authenticated
  using (pode_escalar(departamento_id)) with check (pode_escalar(departamento_id));

drop policy if exists "disponib: ler" on public.disponibilidades;
drop policy if exists "disponib: coordenador" on public.disponibilidades;
create policy "disponib: ler" on public.disponibilidades for select to authenticated
  using (usuario_id = auth.uid() or pode_escalar(dep_do_evento(evento_id)));
create policy "disponib: coordenador" on public.disponibilidades for delete to authenticated
  using (pode_escalar(dep_do_evento(evento_id)));

drop policy if exists "escalas: ler" on public.escalas;
drop policy if exists "escalas: coordenador gerencia" on public.escalas;
create policy "escalas: ler" on public.escalas for select to authenticated
  using (pode_escalar(dep_do_evento(evento_id))
         or (eh_membro_dep(dep_do_evento(evento_id))
             and exists (select 1 from eventos where id = evento_id and status in ('previa', 'publicado', 'realizado'))));
create policy "escalas: coordenador gerencia" on public.escalas for all to authenticated
  using (pode_escalar(dep_do_evento(evento_id))) with check (pode_escalar(dep_do_evento(evento_id)));

drop policy if exists "escala_funcoes: coordenador gerencia" on public.escala_funcoes;
create policy "escala_funcoes: coordenador gerencia" on public.escala_funcoes for all to authenticated
  using (pode_escalar(dep_da_escala(escala_id))) with check (pode_escalar(dep_da_escala(escala_id)));

revoke all on function public.pode_escalar(uuid) from public, anon;
grant execute on function public.pode_escalar(uuid) to authenticated;


-- ───────────────────────────────────────────────────
-- 11e. v7: REPERTÓRIOS (como uma playlist, aplicada nas datas)
-- ───────────────────────────────────────────────────

create table if not exists public.repertorios (
  id               uuid primary key default gen_random_uuid(),
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  nome             text not null check (char_length(nome) between 1 and 80),
  criado_por       uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists repertorios_dep_idx on public.repertorios (departamento_id);

create table if not exists public.repertorio_itens (
  id             uuid primary key default gen_random_uuid(),
  repertorio_id  uuid not null references public.repertorios(id) on delete cascade,
  musica_id      uuid not null references public.musicas(id) on delete cascade,
  ordem          smallint not null default 1,
  tom            text check (char_length(tom) <= 8),
  observacao     text check (char_length(observacao) <= 200),
  unique (repertorio_id, musica_id)
);
create index if not exists repertorio_itens_rep_idx on public.repertorio_itens (repertorio_id, ordem);

-- Cada data pode ter um repertório aplicado
alter table public.eventos
  add column if not exists repertorio_id uuid references public.repertorios(id) on delete set null;

create or replace function public.dep_do_repertorio(rep uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select departamento_id from repertorios where id = rep;
$$;

-- A música tem que ser da mesma organização do repertório
create or replace function public.validar_item_repertorio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select organizacao_id from musicas where id = new.musica_id)
     is distinct from org_do_dep(dep_do_repertorio(new.repertorio_id)) then
    raise exception 'A música não é desta organização';
  end if;
  return new;
end $$;
drop trigger if exists item_repertorio_valido on public.repertorio_itens;
create trigger item_repertorio_valido
  before insert or update on public.repertorio_itens
  for each row execute function public.validar_item_repertorio();

-- O repertório aplicado tem que ser do mesmo departamento da data
create or replace function public.validar_repertorio_evento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.repertorio_id is not null
     and dep_do_repertorio(new.repertorio_id) is distinct from new.departamento_id then
    raise exception 'O repertório é de outro departamento';
  end if;
  return new;
end $$;
drop trigger if exists repertorio_evento_valido on public.eventos;
create trigger repertorio_evento_valido
  before insert or update of repertorio_id on public.eventos
  for each row execute function public.validar_repertorio_evento();

-- Quem monta repertório aplica numa data (mesmo sem poder editar a escala)
create or replace function public.aplicar_repertorio(p_evento uuid, p_repertorio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (pode_repertorio(dep_do_evento(p_evento)) or pode_escalar(dep_do_evento(p_evento))) then
    raise exception 'Sem permissão para o repertório desta data';
  end if;
  update eventos set repertorio_id = p_repertorio where id = p_evento;
end $$;
revoke all on function public.aplicar_repertorio(uuid, uuid) from public, anon;
grant execute on function public.aplicar_repertorio(uuid, uuid) to authenticated;

alter table public.repertorios      enable row level security;
alter table public.repertorio_itens enable row level security;

drop policy if exists "repertorios: ler" on public.repertorios;
drop policy if exists "repertorios: montar" on public.repertorios;
create policy "repertorios: ler" on public.repertorios for select to authenticated
  using (eh_membro_dep(departamento_id) or pode_escalar(departamento_id));
create policy "repertorios: montar" on public.repertorios for all to authenticated
  using (pode_repertorio(departamento_id)) with check (pode_repertorio(departamento_id));

drop policy if exists "repertorio_itens: ler" on public.repertorio_itens;
drop policy if exists "repertorio_itens: montar" on public.repertorio_itens;
create policy "repertorio_itens: ler" on public.repertorio_itens for select to authenticated
  using (exists (select 1 from repertorios r where r.id = repertorio_id));
create policy "repertorio_itens: montar" on public.repertorio_itens for all to authenticated
  using (pode_repertorio(dep_do_repertorio(repertorio_id)))
  with check (pode_repertorio(dep_do_repertorio(repertorio_id)));

grant all on public.repertorios, public.repertorio_itens to authenticated;


-- ───────────────────────────────────────────────────
-- 11f. v8: MURAL E CIFRAS
-- ───────────────────────────────────────────────────

-- Aviso fixado fica no topo do mural
alter table public.avisos add column if not exists fixado boolean not null default false;

-- Cifra própria: texto com os acordes (até 20 mil caracteres)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'musicas_cifra_tamanho') then
    alter table public.musicas add constraint musicas_cifra_tamanho check (char_length(cifra) <= 20000);
  end if;
end $$;

-- Publica no mural quem monta escalas ou repertórios; cada um edita o seu,
-- e a coordenação pode editar ou tirar qualquer aviso
drop policy if exists "avisos: publicar" on public.avisos;
drop policy if exists "avisos: editar" on public.avisos;
drop policy if exists "avisos: apagar" on public.avisos;
create policy "avisos: publicar" on public.avisos for insert to authenticated
  with check (autor = auth.uid() and (pode_escalar(departamento_id) or pode_repertorio(departamento_id)));
create policy "avisos: editar" on public.avisos for update to authenticated
  using (autor = auth.uid() or eh_coord_dep(departamento_id))
  with check (autor = auth.uid() or eh_coord_dep(departamento_id));
create policy "avisos: apagar" on public.avisos for delete to authenticated
  using (autor = auth.uid() or eh_coord_dep(departamento_id));


-- ───────────────────────────────────────────────────
-- 12. DONO DA PLATAFORMA
--     Troque o e-mail se for outra conta. Precisa já ter feito cadastro.
-- ───────────────────────────────────────────────────
insert into public.admins_plataforma (usuario_id)
select id from auth.users where email = 'rafaelmestredosanjos@gmail.com'
on conflict do nothing;


-- ───────────────────────────────────────────────────
-- v9 — LGPD: aceite dos termos e exclusão de conta segura
-- ───────────────────────────────────────────────────

-- Versão dos termos que a pessoa aceitou e quando
alter table public.perfis
  add column if not exists termos_versao     text check (char_length(termos_versao) <= 20),
  add column if not exists termos_aceitos_em timestamptz;

-- Perfil criado no cadastro já guarda o aceite marcado na tela
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_versao text := nullif(trim(new.raw_user_meta_data->>'termos_versao'), '');
begin
  insert into public.perfis (id, nome, termos_versao, termos_aceitos_em)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
    left(v_versao, 20),
    case when v_versao is not null then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Aceite de quem já tinha conta (ou quando os termos mudarem), com a hora do servidor
create or replace function public.aceitar_termos(p_versao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  if coalesce(trim(p_versao), '') = '' or char_length(p_versao) > 20 then raise exception 'Versão inválida'; end if;
  update perfis set termos_versao = trim(p_versao), termos_aceitos_em = now() where id = auth.uid();
end $$;

-- Exclui a própria conta e os dados ligados a ela (LGPD).
-- Trava: o único administrador de um grupo que tem outras pessoas não pode sair sem passar a administração.
create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = public as $$
declare v_org text;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select o.nome into v_org
  from membros_organizacao eu
  join organizacoes o on o.id = eu.organizacao_id
  where eu.usuario_id = auth.uid() and eu.papel = 'admin'
    and not exists (select 1 from membros_organizacao a
                    where a.organizacao_id = eu.organizacao_id and a.papel = 'admin' and a.usuario_id <> auth.uid())
    and (exists (select 1 from membros_organizacao m
                 where m.organizacao_id = eu.organizacao_id and m.usuario_id <> auth.uid())
         or exists (select 1 from membros_departamento md join departamentos d on d.id = md.departamento_id
                    where d.organizacao_id = eu.organizacao_id and md.usuario_id <> auth.uid()))
  limit 1;
  if v_org is not null then
    raise exception 'Único administrador: %', v_org;
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.aceitar_termos(text) from public, anon;
grant execute on function public.aceitar_termos(text) to authenticated;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
