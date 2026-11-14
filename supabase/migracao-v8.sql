-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v7 → v8 (não apaga dados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════
--
-- O que muda:
--   • Mural: aviso fixado; publica quem monta escalas ou repertórios
--   • Cifra própria nas músicas (com limite de tamanho)

begin;

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

commit;
