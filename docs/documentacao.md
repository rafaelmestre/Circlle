# Circlle — Documentação do Projeto

*Um produto Codemancer Studio · versão 2 (nov/2026)*

> **O que mudou na v2:** vocabulário 100% neutro (sem termos religiosos), "Equipe" passa a se chamar **Departamento**, todo mundo entra como **Membro** e só ganha acesso quando alguém acima libera, a organização é **solicitada e aprovada pelo Circlle**, a entrada no departamento é por **código**, e a escala nasce da **disponibilidade** que os membros marcam.

---

## 1. Visão geral

PWA para organizações que trabalham com voluntários ou colaboradores organizados em escalas: projetos sociais, ONGs, bandas, coletivos, escolas, igrejas, condomínios e grupos em geral. O sistema permite abrir eventos, receber a disponibilidade dos membros, montar e publicar escalas, distribuir repertório (quando o departamento é musical) e manter a comunicação de cada departamento em um só lugar.

## 2. Propósito

Dar a organizações pequenas, de periferia e de baixa renda uma ferramenta de gestão que normalmente só grandes organizações conseguem pagar. O Circlle é contratado pela organização, com valor acessível, e serve também de vitrine da Codemancer Studio.

---

## 3. Vocabulário

O app usa termos neutros. Cada organização pode renomear os rótulos para a sua realidade (RN07), mas **não existe nenhum modelo pronto com termos religiosos**.

A organização funciona como um **grupo com departamentos**: quem contrata, contrata para o grupo todo, e o grupo se divide em departamentos, cada um com seus coordenadores e membros.

| Termo | O que é | Exemplos |
|---|---|---|
| **Organização** | O grupo que contrata o Circlle | Coletivo, ONG, banda, escola |
| **Departamento** | Uma área dentro da organização, com coordenador próprio | Música, Mídia, Zeladoria |
| **Evento** | Um compromisso que precisa de escala | Apresentação, ação social, plantão |
| **Ensaio** | Preparação ligada ou não a um evento | Ensaio geral |
| **Função** | O que a pessoa faz no departamento | Violão, foto, reparo elétrico |
| **Disponibilidade** | O membro marca as datas em que pode | "Posso nos dias 7, 14 e 28" |
| **Escala** | Quem foi escolhido para o evento e em qual função | Publicada pelo coordenador |
| **Código do departamento** | Identificador curto para entrar no departamento | `HARM-4K7` |

---

## 4. Perfis e permissões

### 4.1 Regra de ouro

**Todo mundo entra como Membro.** Ninguém se autopromove: o acesso é sempre liberado por quem está acima.

| Quem libera | O quê | Para quem |
|---|---|---|
| **Circlle** (equipe comercial) | Aprova a organização e torna o solicitante **Administrador** | Quem solicitou |
| **Administrador** | Promove a **Coordenador** de um departamento | Um membro da organização |
| **Coordenador** | Concede a **permissão de repertório** no seu departamento | Um membro do departamento |

### 4.2 Perfis

- **Dono da plataforma (Circlle):** aprova solicitações de organização, define o plano contratado e pode suspender uma organização. Não vê escalas, avaliações nem dados internos das organizações (LGPD).
- **Administrador:** gerencia o grupo, cria os departamentos e promove membros a coordenadores. Tem acesso de coordenador em todos os departamentos.
- **Coordenador:** configura o seu departamento (funções, módulo de repertório), compartilha o código de entrada, aprova membros e suas funções, abre eventos, monta e publica escalas, publica avisos. Um departamento pode ter **mais de um coordenador**.
- **Membro:** marca sua disponibilidade nos eventos abertos, consulta suas escalas, pede remanejamento, edita as próprias funções e lê o mural.
- **Permissão de repertório:** não é um perfil, é uma permissão que o coordenador dá a um membro para montar e enviar repertórios.

Os papéis são **por departamento**: a mesma pessoa pode ser coordenadora da Mídia e membro da Música.

---

## 5. Personas e usuários de teste

Organização fictícia: **Coletivo Harmonia**, projeto social que contratou o Circlle para 3 departamentos: **Música**, **Mídia** e **Zeladoria**.

| Persona | Papel | Objetivo | Dor hoje |
|---|---|---|---|
| **Adriana** | Administradora | Ter todos os departamentos organizados num lugar só | Tudo acontece em grupos de WhatsApp diferentes |
| **Caio** | Coordenador da Música | Montar a escala do mês sem cobrar um por um | Passa dias perguntando quem pode em cada data |
| **Bia** | Coordenadora da Mídia | Saber quem fotografa e filma em cada evento | Descobre faltas em cima da hora |
| **Zé** | Coordenador da Zeladoria | Distribuir plantões de limpeza e reparos | Sempre os mesmos voluntários são chamados |
| **Rita** | Membro da Música com permissão de repertório | Mandar as músicas com o tom certo | Repertório chega picado em várias mensagens |
| **Marcos** | Membro da Música (violão) e da Mídia (foto) | Ver tudo o que tem que fazer num lugar | Se perde entre os grupos |
| **Paula** | Membro recém-chegada, aguardando aprovação | Começar a participar | Não sabe a quem pedir para entrar |

Todos os usuários de teste usam e-mails `@circlle.test` (ver `supabase/seed-teste.sql`).

---

## 6. Fluxos

### 6.1 Contratação: da solicitação ao primeiro administrador

1. A pessoa cria a conta e faz login. Sem vínculo, vê a tela de boas-vindas.
2. Escolhe **Solicitar organização** e informa: nome da organização, tipo de grupo, cidade, quantidade aproximada de pessoas, WhatsApp e e-mail para contato.
3. A organização fica **em análise**. A pessoa vê apenas uma tela de "em análise", sem configurar nada.
4. A equipe comercial do Circlle conversa com o solicitante, aprova a organização e define o plano (quantidade de departamentos).
5. O solicitante vira **Administrador** e passa a ver o painel da organização.

### 6.2 Montagem: departamentos e coordenadores

1. O administrador cria os departamentos do grupo (ex.: Música, Mídia e Zeladoria). Cada um ganha um **código** próprio.
2. O administrador envia o código do departamento para quem vai coordená-lo. A pessoa entra como **Membro**, como qualquer outra.
3. O administrador **promove a coordenador**. Um departamento pode ter mais de um.
4. O coordenador configura o departamento: funções e se usa repertório.

### 6.3 Primeira escala

1. **Código:** o coordenador copia o código do departamento (ex.: `HARM-4K7`) e envia pelo WhatsApp.
2. **Vínculo:** o membro faz login (ainda sem acesso a nada), busca o código e pede para entrar no departamento, marcando **o que faz** entre as funções do departamento (violão, foto, reparo elétrico…).
3. **Aprovação:** o coordenador vê o pedido, confere ou ajusta as funções e aprova. As funções ficam registradas para as próximas escalas.
4. **Eventos abertos:** o coordenador cria os eventos do período (data, horário e local) e os abre para disponibilidade. Não há limite de pessoas: quanto mais disponíveis, mais liberdade para escolher.
5. **Disponibilidade:** o membro vê as datas abertas e marca **"posso nestes dias"**. A função não é escolhida aqui: o coordenador já sabe o que cada um faz.
6. **Escala:** o coordenador vê, em cada evento, quem está disponível e o que cada um faz, e monta a escala **manualmente** ou pede a **sugestão automática**, que ele pode ajustar.
7. **Publicação:** o coordenador publica. Os escalados são avisados e veem o evento na agenda.

### 6.4 Rotina: escalas recorrentes

1. As funções do membro ficam salvas; ele não precisa informar de novo.
2. O painel do membro mostra: **próxima escala**, **datas abertas para marcar disponibilidade**, **mural do departamento** e seus departamentos.
3. Para repetir um formato, o coordenador **duplica uma escala** para uma nova data: o evento e as pessoas vêm como rascunho, prontos para ajustar.
4. Se um escalado não puder ir, pede **remanejamento**; a vaga continua com ele até o coordenador decidir.

---

## 7. Requisitos funcionais

### 7.1 Conta e perfil

- **RF01** Criar conta com nome, e-mail e senha; entrar e sair.
- **RF02** Perfil do usuário com nome, foto (opcional) e a lista de **departamentos e funções** em cada um.
- **RF03** O membro edita as próprias funções no perfil; a alteração fica visível ao coordenador.
- **RF04** Excluir a própria conta e todos os dados (LGPD).

### 7.2 Organização (contratação)

- **RF05** Solicitar organização informando nome, tipo de grupo, cidade, quantidade aproximada de pessoas, WhatsApp e e-mail.
- **RF06** Tela "em análise" para o solicitante enquanto a organização não é aprovada.
- **RF07** Painel do Circlle para listar, aprovar, recusar e suspender organizações.
- **RF08** Administrador cria, renomeia e desativa departamentos.
- **RF09** Personalizar os rótulos (organização, departamento, evento, função).

### 7.3 Departamentos e papéis

- **RF10** Administrador promove um membro a coordenador de um departamento e pode revogar.
- **RF11** Coordenador edita o departamento: funções e módulo de repertório.
- **RF12** Código do departamento, curto e fácil de digitar, com opção de gerar um novo (o anterior deixa de valer).
- **RF13** Membro busca o código e pede para entrar, marcando suas funções.
- **RF14** Coordenador aprova ou recusa o pedido, podendo ajustar as funções.
- **RF15** Coordenador concede ou retira a permissão de repertório.
- **RF16** Coordenador remove um membro do departamento.

### 7.4 Eventos e disponibilidade

- **RF17** Coordenador cria eventos com título, data, horário e local, sem limite de pessoas.
- **RF18** Ciclo do evento: **rascunho → aberto para disponibilidade → escala publicada → realizado** (ou cancelado).
- **RF19** Membro vê as datas abertas dos seus departamentos e marca de uma vez em quais pode.
- **RF20** Membro desmarca a disponibilidade enquanto a escala não foi publicada.
- **RF21** Coordenador duplica uma escala para uma nova data, como rascunho.

### 7.5 Escala

- **RF22** Coordenador vê, em cada evento, quem está disponível e as funções de cada um, e escala manualmente escolhendo a função de cada pessoa.
- **RF23** Sugestão automática: escolhe entre os disponíveis, cobrindo as funções do departamento, fazendo rodízio (quem foi menos escalado primeiro) e equilibrando quem está começando com quem tem mais experiência.
- **RF24** Coordenador ajusta livremente e publica.
- **RF25** Remanejamento: o escalado pede, informando motivo, data alternativa e quem pode trocar; o coordenador decide.
- **RF26** Ensaios ligados a um evento ou avulsos.

### 7.6 Repertório (departamentos com o módulo ativo)

- **RF27** Banco de músicas privado da organização: nome, artista, tom, link e cifra (ChordPro).
- **RF28** Quem tem permissão monta o repertório do evento e envia aos escalados.
- **RF29** Atalho de busca da cifra no Cifra Club e troca de tom automática.

### 7.7 Comunicação

- **RF30** Mural do departamento: coordenadores e quem tem permissão de repertório publicam; membros leem.
- **RF31** Notificações push: pedido de entrada, entrada aprovada, datas abertas, escala publicada, repertório enviado, pedido de remanejamento e lembrete na véspera.
- **RF32** Botão "compartilhar no WhatsApp" para código, evento e escala.

### 7.8 Painéis

- **RF33** Painel do membro: próxima escala, datas abertas para marcar disponibilidade, mural e departamentos.
- **RF34** Painel do coordenador: pedidos de entrada, eventos abertos com o número de disponíveis e atalhos para escalar.
- **RF35** Painel do administrador: departamentos e coordenadores.

### 7.9 Acompanhamento (etapa 3)

- **RF36** Desempenho por função após cada evento, visível só para os coordenadores.
- **RF37** Relatórios de frequência, disponibilidade e músicas mais tocadas.
- **RF38** Sincronização opcional com Google Agenda.

---

## 8. Regras de negócio

- **RN01** Todo usuário entra como membro; só o perfil acima libera acesso.
- **RN02** Uma organização só funciona depois de aprovada pelo Circlle.
- **RN03** Por enquanto não há limite de departamentos; no futuro, o plano contratado poderá limitar.
- **RN04** Um departamento pode ter vários coordenadores; o administrador tem acesso de coordenador em todos.
- **RN05** Os papéis valem por departamento: a pessoa pode ser coordenadora em um e membro em outro.
- **RN06** Entrar no departamento exige aprovação de um coordenador, junto com a confirmação das funções.
- **RN07** Rótulos personalizados mudam apenas o que aparece na tela.
- **RN08** O coordenador só escala alguém em uma função que a pessoa faz naquele departamento.
- **RN09** Disponibilidade não garante escala: quem decide é o coordenador.
- **RN10** Depois de publicada a escala, o membro não desmarca a disponibilidade; pede remanejamento.
- **RN11** Até o coordenador decidir um remanejamento, a vaga continua com o membro.
- **RN12** Dados de desempenho são visíveis só aos coordenadores do departamento.
- **RN13** O banco de músicas é privado por organização.
- **RN14** O dono da plataforma não acessa escalas, avaliações e avisos das organizações.

---

## 9. Critérios de aceite do MVP

O MVP está pronto quando, com os usuários de teste, for possível:

1. **Paula** cria a conta, digita o código da Música, marca "Vocal" e fica aguardando.
2. **Caio** vê o pedido da Paula, confirma a função e aprova.
3. **Caio** cria as apresentações dos dias 7, 14 e 28 e abre para disponibilidade.
4. **Paula** marca que pode nos dias 7 e 28; **Marcos**, em todos.
5. **Caio** escala o dia 7 com Paula no Vocal e Marcos no Violão e publica.
6. **Paula** e **Marcos** veem a escala na próxima escala do painel.
7. **Rita** monta o repertório da apresentação e os escalados recebem.
8. **Marcos** vê no perfil que faz Violão na Música e Foto na Mídia.
9. Um membro de outra organização não vê nada do Coletivo Harmonia.

---

## 10. Requisitos não funcionais

- **RNF01** PWA instalável, responsivo e pensado para celulares simples.
- **RNF02** Supabase (Postgres, Auth, Storage) com RLS isolando cada organização.
- **RNF03** Notificações push gratuitas via PWA.
- **RNF04** LGPD: termo de uso no cadastro e exclusão de conta pelo usuário.
- **RNF05** Código do departamento sem caracteres ambíguos (sem 0/O, 1/I/L).
- **RNF06** Custo de operação zero na fase inicial.

---

## 11. Etapas de entrega

1. **Etapa 1 (MVP):** solicitação e aprovação de organização, papéis, departamentos com código, vínculo com funções, eventos abertos, disponibilidade, escala manual, publicação, painel do membro e notificações básicas.
2. **Etapa 2:** sugestão automática, duplicar escala, remanejamento, ensaios, repertório, mural e calendário.
3. **Etapa 3:** desempenho, relatórios, sincronização de agenda e troca de tom.

---

## 12. Impacto no banco (próxima atualização do schema)

- `admins_plataforma`: quem é dono do Circlle.
- `organizacoes`: `status` (em análise, ativa, recusada, suspensa), dados da solicitação (tipo, cidade, tamanho, WhatsApp, e-mail) e `limite_departamentos` (vazio = sem limite).
- `equipes` passa a se chamar `departamentos`, com `codigo` próprio.
- `membros_departamento`: `papel` (coordenador, membro) e `perm_repertorio` no lugar de `resp_repertorio`.
- `eventos`: status `aberto` e `duplicado_de` (evento de origem, quando vem de uma escala duplicada).
- Nova tabela `disponibilidades` (membro, evento).
- `convites` com validade dá lugar ao código fixo do departamento.

---

## 13. Situação atual

| Item | Situação |
|---|---|
| Marca, logo, paleta e tokens | ✅ Pronto |
| Protótipo navegável | ✅ Pronto (precisa trocar os termos religiosos) |
| Projeto Vite + PWA + login | ✅ Pronto |
| Banco v1 com RLS | ✅ Pronto (será atualizado conforme a seção 12) |
| Primeiro acesso v1 (criar organização e convite por link) | 🔁 Será refeito com solicitação e código |
| Documentação v2 | ✅ Este documento |
| Etapa 1 | ⏳ Próximo passo |