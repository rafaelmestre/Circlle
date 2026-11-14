-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v5 → v6 (não apaga dados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════
--
-- O que muda:
--   • Permissão "pode montar escalas", que o coordenador liga no perfil do membro
--   • Quem tem a permissão cria datas, monta, envia prévia e publica

begin;

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

commit;
