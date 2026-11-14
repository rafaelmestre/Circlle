-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v6 → v7 (não apaga dados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════
--
-- O que muda:
--   • Repertórios: listas de músicas por departamento, como uma playlist
--   • Cada data pode ter um repertório aplicado

begin;

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

commit;
