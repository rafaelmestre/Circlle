-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v8 → v9 (LGPD)
-- Aceite dos termos de uso e da política de privacidade,
-- e exclusão de conta que não deixa um grupo sem administrador.
-- Não apaga dados. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════

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
