-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v3 → v4 (não apaga dados)
-- Rode no Supabase: SQL Editor → New query → Run
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════
--
-- O que muda:
--   • Só o administrador desativa ou reativa um departamento
--     (o coordenador continua podendo renomear)
--   • Função registrar_push, usada para ligar as notificações no celular

begin;

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

commit;
