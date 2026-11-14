-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v9 → v10
-- Cadastro completo (apelido, WhatsApp, data de nascimento e foto),
-- login com Google e foto de perfil no Storage.
-- Não apaga dados. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════

alter table public.perfis
  add column if not exists apelido    text check (char_length(apelido) between 1 and 30),
  add column if not exists nascimento date check (nascimento between '1900-01-01' and current_date);

-- A data de nascimento é só da própria pessoa: colegas veem nome, apelido, WhatsApp e foto.
-- (Permissão por coluna; a regra de linhas continua a mesma.)
revoke select on public.perfis from authenticated, anon;
grant select (id, nome, apelido, telefone, avatar_url, created_at, termos_versao, termos_aceitos_em)
  on public.perfis to authenticated;
revoke update on public.perfis from authenticated, anon;
grant update (nome, apelido, telefone, avatar_url, nascimento) on public.perfis to authenticated;

create or replace function public.meu_nascimento()
returns date language sql stable security definer set search_path = public as $$
  select nascimento from perfis where id = auth.uid();
$$;
revoke all on function public.meu_nascimento() from public, anon;
grant execute on function public.meu_nascimento() to authenticated;

-- Exclusão de conta em duas partes: primeiro confere (o app apaga a foto no meio), depois exclui
create or replace function public.conferir_exclusao_conta()
returns void language plpgsql stable security definer set search_path = public as $$
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
end $$;

create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform conferir_exclusao_conta();
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.conferir_exclusao_conta() from public, anon;
grant execute on function public.conferir_exclusao_conta() to authenticated;

-- Perfil criado no cadastro: guarda o que veio da tela (ou do Google)
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_versao text := nullif(trim(m->>'termos_versao'), '');
  v_nasc   date;
begin
  begin
    v_nasc := nullif(m->>'nascimento', '')::date;
    if v_nasc < '1900-01-01' or v_nasc > current_date then v_nasc := null; end if;
  exception when others then v_nasc := null;
  end;
  insert into public.perfis (id, nome, apelido, telefone, nascimento, avatar_url, termos_versao, termos_aceitos_em)
  values (
    new.id,
    left(coalesce(nullif(trim(m->>'nome'), ''), nullif(trim(m->>'full_name'), ''), nullif(trim(m->>'name'), ''),
                  split_part(new.email, '@', 1)), 80),
    left(nullif(trim(m->>'apelido'), ''), 30),
    left(nullif(trim(m->>'telefone'), ''), 20),
    v_nasc,
    -- Foto da conta Google, quando entra por lá
    left(coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', '')), 500),
    left(v_versao, 20),
    case when v_versao is not null then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Fotos de perfil: pasta de cada pessoa (avatares/<id>/foto.webp), leitura pública
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "avatares: enviar a própria" on storage.objects;
create policy "avatares: enviar a própria" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatares: trocar a própria" on storage.objects;
create policy "avatares: trocar a própria" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatares: apagar a própria" on storage.objects;
create policy "avatares: apagar a própria" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatares: ver a própria" on storage.objects;
create policy "avatares: ver a própria" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
