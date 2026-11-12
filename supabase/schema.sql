-- ═══════════════════════════════════════════════════
-- CIRCLLE — schema do banco (Supabase / PostgreSQL)
-- Rode no Supabase: SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════
--
-- Estrutura:
--   organização → equipes → eventos/ensaios → escalas
--   Os papéis são por equipe: a mesma pessoa pode ser líder
--   em uma equipe e membro em outra.
--
-- Segurança (RLS):
--   cada organização só enxerga os próprios dados, e as
--   avaliações de desempenho são visíveis apenas ao líder.


-- ───────────────────────────────────────────────────
-- 1. PERFIS: dados públicos de cada usuário
-- ───────────────────────────────────────────────────
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null check (char_length(nome) between 1 and 80),
  telefone    text check (char_length(telefone) <= 20),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();


-- ───────────────────────────────────────────────────
-- 2. ORGANIZAÇÕES, com nomenclatura personalizável
-- ───────────────────────────────────────────────────
create table if not exists public.organizacoes (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null check (char_length(nome) between 1 and 80),
  -- rótulos exibidos na tela (RN07: só muda o que aparece)
  termo_organizacao  text not null default 'Organização' check (char_length(termo_organizacao) <= 30),
  termo_equipe       text not null default 'Equipe'      check (char_length(termo_equipe) <= 30),
  termo_evento       text not null default 'Evento'      check (char_length(termo_evento) <= 30),
  termo_funcao       text not null default 'Função'      check (char_length(termo_funcao) <= 30),
  criado_por         uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Quem pertence à organização e quem a administra
create table if not exists public.membros_organizacao (
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id      uuid not null references public.perfis(id) on delete cascade,
  papel           text not null default 'membro' check (papel in ('admin', 'membro')),
  created_at      timestamptz not null default now(),
  primary key (organizacao_id, usuario_id)
);


-- ───────────────────────────────────────────────────
-- 3. EQUIPES, com módulos opcionais
-- ───────────────────────────────────────────────────
create table if not exists public.equipes (
  id                 uuid primary key default gen_random_uuid(),
  organizacao_id     uuid not null references public.organizacoes(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 60),
  modulo_repertorio  boolean not null default false,  -- RN06: módulo por equipe
  ativa              boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Papel da pessoa na equipe; status 'pendente' aguarda aprovação do líder (convite)
create table if not exists public.membros_equipe (
  equipe_id         uuid not null references public.equipes(id) on delete cascade,
  usuario_id        uuid not null references public.perfis(id) on delete cascade,
  papel             text not null default 'membro' check (papel in ('lider', 'membro')),
  resp_repertorio   boolean not null default false,  -- responsável pelo repertório
  status            text not null default 'pendente' check (status in ('pendente', 'ativo')),
  created_at        timestamptz not null default now(),
  primary key (equipe_id, usuario_id)
);

-- Funções da equipe (vocal, bateria, recepção...)
create table if not exists public.funcoes (
  id         uuid primary key default gen_random_uuid(),
  equipe_id  uuid not null references public.equipes(id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 40),
  unique (equipe_id, nome)
);

-- Quais funções cada membro sabe exercer
create table if not exists public.membro_funcoes (
  equipe_id   uuid not null,
  usuario_id  uuid not null,
  funcao_id   uuid not null references public.funcoes(id) on delete cascade,
  primary key (usuario_id, funcao_id),
  foreign key (equipe_id, usuario_id) references public.membros_equipe(equipe_id, usuario_id) on delete cascade
);

-- Convites por link, com validade (RF02)
create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expira_em   timestamptz not null default now() + interval '7 days',
  criado_por  uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ───────────────────────────────────────────────────
-- 4. EVENTOS E ENSAIOS
-- ───────────────────────────────────────────────────
create table if not exists public.eventos (
  id                       uuid primary key default gen_random_uuid(),
  equipe_id                uuid not null references public.equipes(id) on delete cascade,
  tipo                     text not null default 'evento' check (tipo in ('evento', 'ensaio')),
  evento_pai_id            uuid references public.eventos(id) on delete cascade,  -- ensaio vinculado (RF12)
  titulo                   text not null check (char_length(titulo) between 1 and 80),
  local                    text check (char_length(local) <= 120),
  inicio                   timestamptz not null,
  fim                      timestamptz,
  status                   text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'cancelado')),
  responsavel_repertorio   uuid references public.perfis(id) on delete set null,  -- delegação por evento
  criado_por               uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at               timestamptz not null default now(),
  check (fim is null or fim > inicio),
  check (evento_pai_id is null or tipo = 'ensaio')
);


-- ───────────────────────────────────────────────────
-- 5. ESCALAS, INDISPONIBILIDADES E REMANEJAMENTOS
-- ───────────────────────────────────────────────────
create table if not exists public.escalas (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  funcao_id     uuid references public.funcoes(id) on delete set null,
  usuario_id    uuid not null references public.perfis(id) on delete cascade,
  confirmacao   text not null default 'pendente'
                  check (confirmacao in ('pendente', 'confirmado', 'remanejamento')),
  presenca      text check (presenca in ('presente', 'faltou')),  -- preenchido após o evento
  sugerido      boolean not null default false,  -- veio da sugestão automática (RF06)
  created_at    timestamptz not null default now(),
  unique (evento_id, usuario_id, funcao_id)
);

-- Dias em que a pessoa não pode (vale para todas as equipes dela)
create table if not exists public.indisponibilidades (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  data_inicio  date not null,
  data_fim     date not null,
  motivo       text check (char_length(motivo) <= 200),
  created_at   timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

-- Pedido de remanejamento: a vaga segue com o membro até o líder decidir (RF09–RF11)
create table if not exists public.remanejamentos (
  id                uuid primary key default gen_random_uuid(),
  escala_id         uuid not null references public.escalas(id) on delete cascade,
  solicitante       uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  motivo            text check (char_length(motivo) <= 300),
  data_alternativa  date,
  sugestao_troca    uuid references public.perfis(id) on delete set null,
  status            text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  decidido_por      uuid references public.perfis(id) on delete set null,
  decidido_em       timestamptz,
  created_at        timestamptz not null default now()
);


-- ───────────────────────────────────────────────────
-- 6. REPERTÓRIO (módulo opcional)
-- ───────────────────────────────────────────────────
-- Banco de músicas privado de cada organização (RN03)
create table if not exists public.musicas (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  titulo          text not null check (char_length(titulo) between 1 and 120),
  artista         text check (char_length(artista) <= 120),
  tom             text check (char_length(tom) <= 8),
  link            text,
  cifra           text,  -- formato ChordPro, para transpor o tom (RF16–RF17)
  criado_por      uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.repertorio_evento (
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  musica_id   uuid not null references public.musicas(id) on delete cascade,
  ordem       smallint not null default 1,
  tom         text check (char_length(tom) <= 8),  -- tom deste evento, se diferente do original
  observacao  text check (char_length(observacao) <= 200),
  primary key (evento_id, musica_id)
);


-- ───────────────────────────────────────────────────
-- 7. DESEMPENHO (visível só ao líder) E MURAL
-- ───────────────────────────────────────────────────
create table if not exists public.avaliacoes (
  id           uuid primary key default gen_random_uuid(),
  escala_id    uuid not null unique references public.escalas(id) on delete cascade,
  avaliador    uuid default auth.uid() references public.perfis(id) on delete set null,
  seguranca    smallint check (seguranca between 1 and 5),
  preparo      smallint check (preparo between 1 and 5),
  pontualidade smallint check (pontualidade between 1 and 5),
  comentario   text check (char_length(comentario) <= 500),
  created_at   timestamptz not null default now()
);

create table if not exists public.avisos (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  autor       uuid default auth.uid() references public.perfis(id) on delete set null,
  titulo      text not null check (char_length(titulo) between 1 and 100),
  corpo       text check (char_length(corpo) <= 2000),
  created_at  timestamptz not null default now()
);

-- Inscrições de notificação push do PWA (uma por aparelho)
create table if not exists public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);


-- ───────────────────────────────────────────────────
-- 8. ÍNDICES
-- ───────────────────────────────────────────────────
create index if not exists equipes_org_idx           on public.equipes (organizacao_id);
create index if not exists membros_equipe_user_idx   on public.membros_equipe (usuario_id);
create index if not exists membros_org_user_idx      on public.membros_organizacao (usuario_id);
create index if not exists eventos_equipe_inicio_idx on public.eventos (equipe_id, inicio);
create index if not exists escalas_evento_idx        on public.escalas (evento_id);
create index if not exists escalas_usuario_idx       on public.escalas (usuario_id);
create index if not exists indisp_usuario_idx        on public.indisponibilidades (usuario_id, data_inicio);
create index if not exists remanej_escala_idx        on public.remanejamentos (escala_id);
create index if not exists musicas_org_idx           on public.musicas (organizacao_id);
create index if not exists avisos_equipe_idx         on public.avisos (equipe_id, created_at desc);


-- ───────────────────────────────────────────────────
-- 9. FUNÇÕES AUXILIARES PARA AS POLÍTICAS
--    security definer evita recursão do RLS nas tabelas de membros
-- ───────────────────────────────────────────────────
create or replace function public.eh_membro_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_organizacao
                 where organizacao_id = org and usuario_id = auth.uid());
$$;

create or replace function public.eh_admin_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_organizacao
                 where organizacao_id = org and usuario_id = auth.uid() and papel = 'admin');
$$;

create or replace function public.org_da_equipe(eq uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organizacao_id from equipes where id = eq;
$$;

create or replace function public.equipe_do_evento(ev uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select equipe_id from eventos where id = ev;
$$;

create or replace function public.equipe_da_escala(esc uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.equipe_id from escalas s join eventos e on e.id = s.evento_id where s.id = esc;
$$;

create or replace function public.eh_membro_equipe(eq uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_equipe
                 where equipe_id = eq and usuario_id = auth.uid() and status = 'ativo');
$$;

-- Líder da equipe ou admin da organização
create or replace function public.eh_lider_equipe(eq uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_equipe
                 where equipe_id = eq and usuario_id = auth.uid()
                   and status = 'ativo' and papel = 'lider')
      or public.eh_admin_org(public.org_da_equipe(eq));
$$;

-- Pode montar repertório: equipe com módulo ativo e (líder ou responsável)
create or replace function public.pode_repertorio(eq uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipes where id = eq and modulo_repertorio)
     and (public.eh_lider_equipe(eq)
          or exists (select 1 from membros_equipe
                     where equipe_id = eq and usuario_id = auth.uid()
                       and status = 'ativo' and resp_repertorio));
$$;

-- Quem cria a organização vira admin automaticamente
create or replace function public.org_criador_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into membros_organizacao (organizacao_id, usuario_id, papel)
  values (new.id, new.criado_por, 'admin');
  return new;
end $$;

drop trigger if exists ao_criar_organizacao on public.organizacoes;
create trigger ao_criar_organizacao
  after insert on public.organizacoes
  for each row execute function public.org_criador_admin();

-- Entrar numa equipe por convite: cria o vínculo como 'pendente' (RF02)
create or replace function public.aceitar_convite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_equipe uuid; v_org uuid;
begin
  select equipe_id into v_equipe from convites where token = p_token and expira_em > now();
  if v_equipe is null then raise exception 'Convite inválido ou expirado'; end if;
  v_org := org_da_equipe(v_equipe);
  insert into membros_organizacao (organizacao_id, usuario_id) values (v_org, auth.uid())
    on conflict do nothing;
  insert into membros_equipe (equipe_id, usuario_id) values (v_equipe, auth.uid())
    on conflict do nothing;
  return v_equipe;
end $$;


-- ───────────────────────────────────────────────────
-- 10. SEGURANÇA (Row Level Security)
-- ───────────────────────────────────────────────────
alter table public.perfis               enable row level security;
alter table public.organizacoes         enable row level security;
alter table public.membros_organizacao  enable row level security;
alter table public.equipes              enable row level security;
alter table public.membros_equipe       enable row level security;
alter table public.funcoes              enable row level security;
alter table public.membro_funcoes       enable row level security;
alter table public.convites             enable row level security;
alter table public.eventos              enable row level security;
alter table public.escalas              enable row level security;
alter table public.indisponibilidades   enable row level security;
alter table public.remanejamentos       enable row level security;
alter table public.musicas              enable row level security;
alter table public.repertorio_evento    enable row level security;
alter table public.avaliacoes           enable row level security;
alter table public.avisos               enable row level security;
alter table public.push_inscricoes      enable row level security;

-- PERFIS: cada um edita o próprio; colegas de organização se enxergam
drop policy if exists "perfis: ler" on public.perfis;
create policy "perfis: ler" on public.perfis for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from membros_organizacao a join membros_organizacao b using (organizacao_id)
    where a.usuario_id = auth.uid() and b.usuario_id = perfis.id));
drop policy if exists "perfis: editar o próprio" on public.perfis;
create policy "perfis: editar o próprio" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ORGANIZAÇÕES
drop policy if exists "org: ler" on public.organizacoes;
create policy "org: ler" on public.organizacoes for select to authenticated
  using (eh_membro_org(id) or criado_por = auth.uid());
drop policy if exists "org: criar" on public.organizacoes;
create policy "org: criar" on public.organizacoes for insert to authenticated
  with check (criado_por = auth.uid());
drop policy if exists "org: admin edita" on public.organizacoes;
create policy "org: admin edita" on public.organizacoes for update to authenticated
  using (eh_admin_org(id)) with check (eh_admin_org(id));
drop policy if exists "org: admin exclui" on public.organizacoes;
create policy "org: admin exclui" on public.organizacoes for delete to authenticated
  using (eh_admin_org(id));

-- MEMBROS DA ORGANIZAÇÃO
drop policy if exists "membros_org: ler" on public.membros_organizacao;
create policy "membros_org: ler" on public.membros_organizacao for select to authenticated
  using (eh_membro_org(organizacao_id));
drop policy if exists "membros_org: admin gerencia" on public.membros_organizacao;
create policy "membros_org: admin gerencia" on public.membros_organizacao for all to authenticated
  using (eh_admin_org(organizacao_id)) with check (eh_admin_org(organizacao_id));
drop policy if exists "membros_org: sair" on public.membros_organizacao;
create policy "membros_org: sair" on public.membros_organizacao for delete to authenticated
  using (usuario_id = auth.uid());

-- EQUIPES
drop policy if exists "equipes: ler" on public.equipes;
create policy "equipes: ler" on public.equipes for select to authenticated
  using (eh_membro_org(organizacao_id));
drop policy if exists "equipes: admin gerencia" on public.equipes;
create policy "equipes: admin gerencia" on public.equipes for all to authenticated
  using (eh_admin_org(organizacao_id)) with check (eh_admin_org(organizacao_id));
drop policy if exists "equipes: líder edita" on public.equipes;
create policy "equipes: líder edita" on public.equipes for update to authenticated
  using (eh_lider_equipe(id)) with check (eh_lider_equipe(id));

-- MEMBROS DA EQUIPE
drop policy if exists "membros_eq: ler" on public.membros_equipe;
create policy "membros_eq: ler" on public.membros_equipe for select to authenticated
  using (usuario_id = auth.uid() or eh_membro_equipe(equipe_id) or eh_lider_equipe(equipe_id));
drop policy if exists "membros_eq: líder gerencia" on public.membros_equipe;
create policy "membros_eq: líder gerencia" on public.membros_equipe for all to authenticated
  using (eh_lider_equipe(equipe_id)) with check (eh_lider_equipe(equipe_id));
drop policy if exists "membros_eq: sair" on public.membros_equipe;
create policy "membros_eq: sair" on public.membros_equipe for delete to authenticated
  using (usuario_id = auth.uid());

-- FUNÇÕES
drop policy if exists "funcoes: ler" on public.funcoes;
create policy "funcoes: ler" on public.funcoes for select to authenticated
  using (eh_membro_org(org_da_equipe(equipe_id)));
drop policy if exists "funcoes: líder gerencia" on public.funcoes;
create policy "funcoes: líder gerencia" on public.funcoes for all to authenticated
  using (eh_lider_equipe(equipe_id)) with check (eh_lider_equipe(equipe_id));

drop policy if exists "membro_funcoes: ler" on public.membro_funcoes;
create policy "membro_funcoes: ler" on public.membro_funcoes for select to authenticated
  using (eh_membro_equipe(equipe_id) or eh_lider_equipe(equipe_id));
drop policy if exists "membro_funcoes: líder gerencia" on public.membro_funcoes;
create policy "membro_funcoes: líder gerencia" on public.membro_funcoes for all to authenticated
  using (eh_lider_equipe(equipe_id)) with check (eh_lider_equipe(equipe_id));

-- CONVITES: só o líder vê e cria; a entrada é pela função aceitar_convite
drop policy if exists "convites: líder gerencia" on public.convites;
create policy "convites: líder gerencia" on public.convites for all to authenticated
  using (eh_lider_equipe(equipe_id)) with check (eh_lider_equipe(equipe_id));

-- EVENTOS: membros veem os publicados; líder vê e gerencia tudo
drop policy if exists "eventos: ler" on public.eventos;
create policy "eventos: ler" on public.eventos for select to authenticated
  using (eh_lider_equipe(equipe_id) or (eh_membro_equipe(equipe_id) and status <> 'rascunho'));
drop policy if exists "eventos: líder gerencia" on public.eventos;
create policy "eventos: líder gerencia" on public.eventos for all to authenticated
  using (eh_lider_equipe(equipe_id)) with check (eh_lider_equipe(equipe_id));

-- ESCALAS: o membro vê a escala da equipe e confirma a própria
drop policy if exists "escalas: ler" on public.escalas;
create policy "escalas: ler" on public.escalas for select to authenticated
  using (usuario_id = auth.uid()
      or eh_lider_equipe(equipe_do_evento(evento_id))
      or (eh_membro_equipe(equipe_do_evento(evento_id))
          and exists (select 1 from eventos where id = evento_id and status = 'publicado')));
drop policy if exists "escalas: líder gerencia" on public.escalas;
create policy "escalas: líder gerencia" on public.escalas for all to authenticated
  using (eh_lider_equipe(equipe_do_evento(evento_id)))
  with check (eh_lider_equipe(equipe_do_evento(evento_id)));
drop policy if exists "escalas: membro confirma" on public.escalas;
create policy "escalas: membro confirma" on public.escalas for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Membro só altera a própria confirmação: líder controla o resto
create or replace function public.proteger_escala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not eh_lider_equipe(equipe_do_evento(old.evento_id)) then
    if new.evento_id <> old.evento_id or new.usuario_id <> old.usuario_id
       or new.funcao_id is distinct from old.funcao_id
       or new.presenca is distinct from old.presenca
       or new.sugerido <> old.sugerido then
      raise exception 'Apenas o líder pode alterar a escala';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists escala_protegida on public.escalas;
create trigger escala_protegida
  before update on public.escalas
  for each row execute function public.proteger_escala();

-- INDISPONIBILIDADES: dono gerencia; líderes das equipes dele consultam
drop policy if exists "indisp: dono" on public.indisponibilidades;
create policy "indisp: dono" on public.indisponibilidades for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "indisp: líder consulta" on public.indisponibilidades;
create policy "indisp: líder consulta" on public.indisponibilidades for select to authenticated
  using (exists (select 1 from membros_equipe m
                 where m.usuario_id = indisponibilidades.usuario_id and eh_lider_equipe(m.equipe_id)));

-- REMANEJAMENTOS: o membro pede para a própria escala; o líder decide
drop policy if exists "remanej: ler" on public.remanejamentos;
create policy "remanej: ler" on public.remanejamentos for select to authenticated
  using (solicitante = auth.uid() or eh_lider_equipe(equipe_da_escala(escala_id)));
drop policy if exists "remanej: membro pede" on public.remanejamentos;
create policy "remanej: membro pede" on public.remanejamentos for insert to authenticated
  with check (solicitante = auth.uid() and status = 'pendente'
              and exists (select 1 from escalas where id = escala_id and usuario_id = auth.uid()));
drop policy if exists "remanej: líder decide" on public.remanejamentos;
create policy "remanej: líder decide" on public.remanejamentos for update to authenticated
  using (eh_lider_equipe(equipe_da_escala(escala_id)))
  with check (eh_lider_equipe(equipe_da_escala(escala_id)));

-- MÚSICAS: banco privado da organização
drop policy if exists "musicas: ler" on public.musicas;
create policy "musicas: ler" on public.musicas for select to authenticated
  using (eh_membro_org(organizacao_id));
drop policy if exists "musicas: quem monta repertório gerencia" on public.musicas;
create policy "musicas: quem monta repertório gerencia" on public.musicas for all to authenticated
  using (eh_admin_org(organizacao_id) or exists (
    select 1 from equipes e where e.organizacao_id = musicas.organizacao_id and pode_repertorio(e.id)))
  with check (eh_admin_org(organizacao_id) or exists (
    select 1 from equipes e where e.organizacao_id = musicas.organizacao_id and pode_repertorio(e.id)));

-- REPERTÓRIO DO EVENTO
drop policy if exists "repertorio: ler" on public.repertorio_evento;
create policy "repertorio: ler" on public.repertorio_evento for select to authenticated
  using (eh_membro_equipe(equipe_do_evento(evento_id)) or eh_lider_equipe(equipe_do_evento(evento_id)));
drop policy if exists "repertorio: monta" on public.repertorio_evento;
create policy "repertorio: monta" on public.repertorio_evento for all to authenticated
  using (pode_repertorio(equipe_do_evento(evento_id))
         or exists (select 1 from eventos where id = evento_id and responsavel_repertorio = auth.uid()))
  with check (pode_repertorio(equipe_do_evento(evento_id))
         or exists (select 1 from eventos where id = evento_id and responsavel_repertorio = auth.uid()));

-- AVALIAÇÕES: exclusivas do líder (RN02) — nem o próprio membro vê
drop policy if exists "avaliacoes: só líder" on public.avaliacoes;
create policy "avaliacoes: só líder" on public.avaliacoes for all to authenticated
  using (eh_lider_equipe(equipe_da_escala(escala_id)))
  with check (eh_lider_equipe(equipe_da_escala(escala_id)));

-- AVISOS: membros leem; líder e responsável pelo repertório publicam
drop policy if exists "avisos: ler" on public.avisos;
create policy "avisos: ler" on public.avisos for select to authenticated
  using (eh_membro_equipe(equipe_id) or eh_lider_equipe(equipe_id));
drop policy if exists "avisos: publicar" on public.avisos;
create policy "avisos: publicar" on public.avisos for all to authenticated
  using (eh_lider_equipe(equipe_id) or exists (
    select 1 from membros_equipe where equipe_id = avisos.equipe_id
      and usuario_id = auth.uid() and status = 'ativo' and resp_repertorio))
  with check (eh_lider_equipe(equipe_id) or exists (
    select 1 from membros_equipe where equipe_id = avisos.equipe_id
      and usuario_id = auth.uid() and status = 'ativo' and resp_repertorio));

-- PUSH: cada um gerencia os próprios aparelhos
drop policy if exists "push: dono" on public.push_inscricoes;
create policy "push: dono" on public.push_inscricoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());


-- ───────────────────────────────────────────────────
-- 11. LGPD: excluir a própria conta e todos os dados (RNF04)
--     As chaves "on delete cascade" apagam o resto.
-- ───────────────────────────────────────────────────
create or replace function public.excluir_minha_conta()
returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;
