-- ═══════════════════════════════════════════════════
-- CIRCLLE — dados de TESTE: o Coletivo Harmonia
-- Rode no Supabase DEPOIS do schema.sql: SQL Editor → New query → Run
-- Pode rodar de novo: apaga e recria tudo que é de teste.
-- NUNCA rode em produção com usuários reais.
-- ═══════════════════════════════════════════════════
--
-- Senha de todos: Circlle@123
--
--   adriana@circlle.test   Administradora do Coletivo Harmonia
--   caio@circlle.test      Coordenador da Música
--   bia@circlle.test       Coordenadora da Mídia
--   ze@circlle.test        Coordenador da Zeladoria
--   rita@circlle.test      Membro da Música, com permissão de repertório (Vocal)
--   marcos@circlle.test    Membro da Música (Violão) e da Mídia (Foto)
--   paula@circlle.test     Pediu para entrar na Música (Vocal), aguardando aprovação
--   nova@circlle.test      Conta sem vínculo: testa o primeiro acesso
--   solicitante@circlle.test  Solicitou o "Projeto Vozes da Rua", em análise no Circlle
--
-- Códigos fixos para testar a entrada:
--   Música HAR-MUS2   ·   Mídia HAR-MD7A   ·   Zeladoria HAR-ZDR3

-- ───────────────────────────────────────────────────
-- 1. Limpa o teste anterior
-- ───────────────────────────────────────────────────
delete from public.organizacoes where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');
delete from auth.users where email like '%@circlle.test';


-- ───────────────────────────────────────────────────
-- 2. Usuários (o trigger cria cada perfil)
-- ───────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated',
  u.email, extensions.crypt('Circlle@123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nome', u.nome), now(), now(), '', '', '', ''
from (values
  ('b0000000-0000-4000-8000-000000000001', 'adriana@circlle.test',     'Adriana Alves'),
  ('b0000000-0000-4000-8000-000000000002', 'caio@circlle.test',        'Caio Moreira'),
  ('b0000000-0000-4000-8000-000000000003', 'bia@circlle.test',         'Bia Santos'),
  ('b0000000-0000-4000-8000-000000000004', 'ze@circlle.test',          'Zé Carvalho'),
  ('b0000000-0000-4000-8000-000000000005', 'rita@circlle.test',        'Rita Oliveira'),
  ('b0000000-0000-4000-8000-000000000006', 'marcos@circlle.test',      'Marcos Lima'),
  ('b0000000-0000-4000-8000-000000000007', 'paula@circlle.test',       'Paula Reis'),
  ('b0000000-0000-4000-8000-000000000008', 'nova@circlle.test',        'Nina Nova'),
  ('b0000000-0000-4000-8000-000000000009', 'solicitante@circlle.test', 'Sérgio Solicitante')
) as u(id, email, nome);

-- Identidade de e-mail: sem ela o login por senha não funciona
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@circlle.test';


-- ───────────────────────────────────────────────────
-- 3. Organizações: uma ativa e uma em análise
-- ───────────────────────────────────────────────────
insert into public.organizacoes (id, nome, tipo, cidade, tamanho, whatsapp, email, status, solicitado_por, analisado_em) values
  ('a0000000-0000-4000-8000-000000000001', 'Coletivo Harmonia', 'Projeto social', 'São Paulo', '50 a 100',
   '(11) 90000-0001', 'contato@harmonia.test', 'ativa', 'b0000000-0000-4000-8000-000000000001', now()),
  ('a0000000-0000-4000-8000-000000000002', 'Projeto Vozes da Rua', 'ONG', 'Guarulhos', 'Até 20',
   '(11) 90000-0002', 'vozes@rua.test', 'em_analise', 'b0000000-0000-4000-8000-000000000009', null);

insert into public.membros_organizacao (organizacao_id, usuario_id, papel)
select 'a0000000-0000-4000-8000-000000000001', u.id,
       case when u.email = 'adriana@circlle.test' then 'admin' else 'membro' end
from auth.users u
where u.email in ('adriana@circlle.test', 'caio@circlle.test', 'bia@circlle.test', 'ze@circlle.test',
                  'rita@circlle.test', 'marcos@circlle.test', 'paula@circlle.test');


-- ───────────────────────────────────────────────────
-- 4. Departamentos, funções e membros
-- ───────────────────────────────────────────────────
insert into public.departamentos (id, organizacao_id, nome, codigo, modulo_repertorio) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Música',    'HAR-MUS2', true),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Mídia',     'HAR-MD7A', false),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Zeladoria', 'HAR-ZDR3', false);

insert into public.funcoes (id, departamento_id, nome) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Vocal'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Violão'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Teclado'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Bateria'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Foto'),
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'Vídeo'),
  ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'Transmissão'),
  ('d0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000003', 'Limpeza'),
  ('d0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000003', 'Reparo elétrico'),
  ('d0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000003', 'Hidráulica');

insert into public.membros_departamento (departamento_id, usuario_id, papel, perm_repertorio, status) values
  -- Música
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'coordenador', false, 'ativo'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'membro',      true,  'ativo'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'membro',      false, 'ativo'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000007', 'membro',      false, 'pendente'),
  -- Mídia
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'coordenador', false, 'ativo'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'membro',      false, 'ativo'),
  -- Zeladoria
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'coordenador', false, 'ativo');

insert into public.membro_funcoes (departamento_id, usuario_id, funcao_id) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000006'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000009');


-- ───────────────────────────────────────────────────
-- 5. Datas: uma publicada, uma em prévia e três abertas
-- ───────────────────────────────────────────────────
insert into public.eventos (id, departamento_id, titulo, local, inicio, status, criado_por) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Apresentação na praça', 'Praça Central',
   (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '3 days 19 hours') at time zone 'America/Sao_Paulo', 'publicado', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Apresentação na praça', 'Praça Central',
   (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '10 days 19 hours') at time zone 'America/Sao_Paulo', 'previa', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Apresentação na praça', 'Praça Central',
   (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '17 days 19 hours') at time zone 'America/Sao_Paulo', 'aberto', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Sarau de fim de mês', 'Sede do coletivo',
   (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '24 days 18 hours') at time zone 'America/Sao_Paulo', 'aberto', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'Mutirão de limpeza', 'Sede do coletivo',
   (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '6 days 9 hours') at time zone 'America/Sao_Paulo', 'aberto', 'b0000000-0000-4000-8000-000000000004');

-- Quem já marcou disponibilidade
insert into public.disponibilidades (evento_id, usuario_id) values
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005');

-- Escalas: a primeira apresentação já publicada e a segunda em prévia.
-- Marcos toca violão e canta na mesma data (duas funções).
insert into public.escalas (id, evento_id, usuario_id, resposta, motivo, respondido_em) values
  ('f1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'confirmado', null, now()),
  ('f1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'pendente',   null, null),
  ('f1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'confirmado', null, now()),
  ('f1000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'confirmado', null, now()),
  ('f1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'ajuste',
   'Nesse dia só consigo chegar às 20h. Dá pra eu ficar só no vocal?', now()),
  ('f1000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'pendente',   null, null);

insert into public.escala_funcoes (escala_id, funcao_id) values
  ('f1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),  -- Rita: Vocal
  ('f1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002'),  -- Marcos: Violão
  ('f1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001'),  -- Marcos: Vocal
  ('f1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003'),  -- Caio: Teclado
  ('f1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003');


-- ───────────────────────────────────────────────────
-- 6. Conferência
-- ───────────────────────────────────────────────────
select p.nome, u.email,
       coalesce(
         (select string_agg(d.nome || ': ' || m.papel
                 || case when m.perm_repertorio then ' + repertório' else '' end
                 || case when m.status = 'pendente' then ' (pendente)' else '' end, ' | ' order by d.nome)
          from public.membros_departamento m join public.departamentos d on d.id = m.departamento_id
          where m.usuario_id = u.id),
         (select 'admin: ' || string_agg(o.nome, ', ') from public.membros_organizacao mo
            join public.organizacoes o on o.id = mo.organizacao_id
           where mo.usuario_id = u.id and mo.papel = 'admin'),
         (select 'solicitou: ' || o.nome || ' (' || o.status || ')' from public.organizacoes o where o.solicitado_por = u.id limit 1),
         'sem vínculo') as situacao
from auth.users u
join public.perfis p on p.id = u.id
where u.email like '%@circlle.test'
order by u.email;
