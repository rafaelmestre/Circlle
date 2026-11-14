-- ═══════════════════════════════════════════════════
-- CIRCLLE — migração v4 → v5 (não apaga dados)
-- Lembrete na véspera: todo dia às 18h (Brasília) o banco chama
-- a função "notificar", que avisa quem está escalado para amanhã.
-- Pode rodar mais de uma vez.
--
-- Antes: publique a função supabase/functions/notificar com
-- "Verify JWT" desligado. Se o seu projeto não for o do Circlle,
-- troque o endereço em url := (Settings → API → Project URL).
-- ═══════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Segredo do agendador, gerado aqui mesmo e guardado no Vault
-- (ninguém precisa copiar nem colar)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'circlle_cron') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'circlle_cron',
      'Confere que o lembrete da véspera veio do agendador do banco');
  end if;
end $$;

-- A função "notificar" pergunta ao banco se o segredo recebido é o certo
create or replace function public.cron_valido(p_segredo text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'circlle_cron' and decrypted_secret = p_segredo
  );
$$;
revoke all on function public.cron_valido(text) from public, anon, authenticated;
grant execute on function public.cron_valido(text) to service_role;

-- Agenda: 21h UTC = 18h em Brasília
select cron.unschedule(jobid) from cron.job where jobname = 'circlle-lembrete-vespera';
select cron.schedule(
  'circlle-lembrete-vespera',
  '0 21 * * *',
  $job$
  select net.http_post(
    url := 'https://iuwwbmxjojbryxowvadm.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-circlle-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'circlle_cron')
    ),
    body := '{"tipo": "lembrete"}'::jsonb
  );
  $job$
);
