# Circlle — Documentação do Projeto

*Um produto Cappstone Studio · versão 10 (nov/2026)*

> **O que mudou na v10:** **cadastro completo** (nome, como quer ser chamado, WhatsApp e nascimento obrigatórios; foto opcional), editável no Perfil, com o **apelido na escala** e a **foto** nos avatares. **Entrar com o Google** e **esqueci minha senha**. Quem entra pelo Google ou já tinha conta completa o cadastro no próximo acesso. A revisão está na seção 20.
>
> **O que mudou na v9:** o editor do repertório virou uma **playlist de verdade**: **segurar e arrastar** para mudar a ordem, **− / +** para mudar o tom de cada música e **deslizar para a esquerda** para tirar (como no WhatsApp). O mesmo gesto **exclui repertórios** na lista, com confirmação. O app instalado agora **se atualiza sozinho**, sem limpar cache nem reinstalar. E entrou a parte de **LGPD**: página de **termos de uso e privacidade**, aceite no cadastro (e para quem já tinha conta), e a exclusão de conta não deixa mais um grupo sem administrador. A revisão está na seção 19.
>
> **O que mudou na v8:** **mural** do departamento (avisos com aviso no celular, fixar no topo, resumo no Início), **cifra própria** de cada música e **troca de tom** automática, com a tela da música abrindo já no tom do repertório. A revisão está na seção 18.
>
> **O que mudou na v7:** **repertórios** como uma playlist. Quem tem a permissão cria a lista, busca ou cadastra as músicas, acerta a ordem e o tom de cada uma e aplica numa data. A equipe vê o repertório na tela da data, com o link ou a busca da cifra no Cifra Club, e recebe um aviso quando ele chega numa escala já enviada. A revisão está na seção 17.
>
> **O que mudou na v6:** o app voltou ao princípio, que é **substituir a imagem da escala do mês**. O Início mostra a **escala do mês em tabela** (datas nas linhas, funções nas colunas, com o seu nome em destaque). Cada função ganhou **uma tela**, e a barra de baixo muda conforme o papel. O perfil abre pelo avatar. A aba **Escalas** cria escala **avulsa, semanal ou mensal** e edita as datas. O coordenador libera **"pode montar escalas"** e **"pode montar repertórios"** no perfil do membro. O dono da plataforma tem **Dashboard** e **Assinantes**. O **lembrete na véspera** (v5) avisa às 18h. A revisão está na seção 16.
>
> **O que mudou na v4:** **notificações no celular** (datas abertas, prévia, escala publicada, mudanças na escala, pedidos de entrada e de ajuste), **nomes no app** definidos pelo grupo (rótulos), departamento **renomeado, desativado e reativado**, escala e datas **compartilhadas no WhatsApp**, regra de que **coordenador sempre monta repertório** e um visual mais limpo. A revisão está na seção 15.
>
> **O que mudou na v3:** **calendário pessoal** (mês e lista), escala montada em **3 passos**, **várias funções por pessoa** na mesma data, **prévia** da escala com **confirmação ou pedido de ajuste**, e **escala do mês inteiro**. O pedido de ajuste substitui o remanejamento e o atalho de repetir dias da semana substitui o "duplicar escala". A revisão completa está na seção 14.
>
> **O que mudou na v2:** vocabulário 100% neutro (sem termos religiosos), "Equipe" passa a se chamar **Departamento**, todo mundo entra como **Membro** e só ganha acesso quando alguém acima libera, a organização é **solicitada e aprovada pelo Circlle**, a entrada no departamento é por **código**, e a escala nasce da **disponibilidade** que os membros marcam.

---

## 1. Visão geral

PWA para organizações que trabalham com voluntários ou colaboradores organizados em escalas: projetos sociais, ONGs, bandas, coletivos, escolas, igrejas, condomínios e grupos em geral. O sistema permite abrir eventos, receber a disponibilidade dos membros, montar e publicar escalas, distribuir repertório (quando o departamento é musical) e manter a comunicação de cada departamento em um só lugar.

## 2. Propósito

Dar a organizações pequenas, de periferia e de baixa renda uma ferramenta de gestão que normalmente só grandes organizações conseguem pagar. O Circlle é contratado pela organização, com valor acessível, e serve também de vitrine da Cappstone Studio.

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
| **Escala** | Quem foi escolhido para o evento e em quais funções | Rita no Vocal, Marcos no Violão e no Vocal |
| **Prévia** | A escala enviada para a equipe conferir antes de publicar | "Prévia de novembro" |
| **Resposta** | O que o escalado diz sobre a escala | Confirmo, Pedir ajuste, Não vou poder |
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
- **Coordenador:** configura o seu departamento (nome, funções, módulo de repertório), sempre pode montar o repertório, compartilha o código de entrada, aprova membros e suas funções, abre as datas do mês, monta as escalas, envia a prévia, atende os pedidos de ajuste, publica e publica avisos. Um departamento pode ter **mais de um coordenador**.
- **Membro:** marca sua disponibilidade nas datas abertas, vê suas escalas no calendário, confirma ou pede ajuste, edita as próprias funções e lê o mural.
- **Permissão de repertório:** não é um perfil, é uma permissão que o coordenador dá a um membro para montar e enviar repertórios. Coordenadores e administradores já têm essa permissão sempre.

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
4. **Datas do mês:** o coordenador abre as datas do mês de uma vez, por exemplo todos os domingos de dezembro, com horário e local. Não há limite de pessoas: quanto mais disponíveis, mais liberdade para escolher.
5. **Disponibilidade:** o membro vê as datas abertas e marca **"posso nestes dias"**. A função não é escolhida aqui: o coordenador já sabe o que cada um faz.
6. **Escala em 3 passos:** em cada data, o coordenador escolhe **quem vai** (os que marcaram "posso" aparecem primeiro), define **o que cada um faz** (uma ou mais funções por pessoa, como tocar e cantar) e **revisa**. Mais adiante, a **sugestão automática** poderá preencher o primeiro passo.
7. **Prévia:** o coordenador envia a prévia, de uma data ou do mês inteiro. A equipe vê a escala e cada escalado responde **Confirmo** ou **Pedir ajuste**, contando o motivo.
8. **Ajustes:** o coordenador vê os pedidos com o motivo, muda o que precisar e salva. O pedido conta como resolvido e a pessoa confirma de novo.
9. **Publicação:** o coordenador publica a data ou o mês inteiro. Cada um vê a escala no **calendário**.

### 6.4 Rotina: escalas recorrentes

1. As funções do membro ficam salvas; ele não precisa informar de novo.
2. O **início** mostra a **próxima escala** com o botão **Confirmo**, as **datas abertas** para marcar "posso" e os departamentos. O **calendário** mostra o mês inteiro e a lista de todas as escalas.
3. No fim do mês, o coordenador abre as datas do mês seguinte com o atalho de **repetir dias da semana**, e o ciclo recomeça.
4. Se surgir um imprevisto depois de publicada, o escalado responde **Não vou poder**, com o motivo; a vaga continua com ele até o coordenador decidir.

---

## 7. Requisitos funcionais

### 7.1 Conta e perfil

- **RF01** Criar conta com nome completo, como quer ser chamado, WhatsApp, data de nascimento, e-mail e senha; ou **entrar com o Google** (o nome e a foto vêm da conta Google e o resto é completado no primeiro acesso). Entrar e sair.
- **RF01.1** Esqueci minha senha: o link chega por e-mail e abre a tela de senha nova. A resposta é a mesma exista ou não a conta.
- **RF02** Perfil do usuário com foto (opcional, recortada e reduzida no aparelho), nome, apelido, WhatsApp, nascimento e a lista de **departamentos e funções** em cada um. Tudo editável no Perfil. O apelido aparece na escala, no mural e na saudação.
- **RF03** O membro edita as próprias funções no perfil; a alteração fica visível ao coordenador.
- **RF04** Excluir a própria conta e todos os dados (LGPD).

### 7.2 Organização (contratação)

- **RF05** Solicitar organização informando nome, tipo de grupo, cidade, quantidade aproximada de pessoas, WhatsApp e e-mail.
- **RF06** Tela "em análise" para o solicitante enquanto a organização não é aprovada.
- **RF07** Painel do Circlle para listar, aprovar, recusar e suspender organizações.
- **RF08** Administrador cria, desativa e reativa departamentos; administrador e coordenador renomeiam.
- **RF09** Personalizar os rótulos (organização, departamento, evento, função), na tela do administrador. Campo vazio volta ao padrão.

### 7.3 Departamentos e papéis

- **RF10** Administrador promove um membro a coordenador de um departamento e pode revogar.
- **RF11** Coordenador edita o departamento: funções e módulo de repertório.
- **RF12** Código do departamento, curto e fácil de digitar, com opção de gerar um novo (o anterior deixa de valer).
- **RF13** Membro busca o código e pede para entrar, marcando suas funções.
- **RF14** Coordenador aprova ou recusa o pedido, podendo ajustar as funções.
- **RF15** Coordenador concede ou retira, no perfil do membro, a permissão de repertório e a de montar escalas.
- **RF16** Coordenador remove um membro do departamento.

### 7.4 Eventos e disponibilidade

- **RF17** Nova escala em três tipos: **avulsa** (uma data), **semanal** (escolhe a semana e os dias, e as datas já aparecem) ou **mensal** (escolhe o mês e os dias). Dá para tirar ou acrescentar datas antes de criar, e depois editar nome, dia, horário e local de cada data ou excluí-la.
- **RF18** Ciclo do evento: **aberto para disponibilidade → prévia → publicado → realizado** (ou cancelado).
- **RF19** Membro vê as datas abertas dos seus departamentos e marca de uma vez em quais pode.
- **RF20** Membro desmarca a disponibilidade enquanto a data está aberta.
- **RF21** Coordenador envia a prévia e publica as escalas do mês inteiro de uma vez.

### 7.5 Escala

- **RF22** Coordenador monta a escala em 3 passos: **quem vai** (disponíveis primeiro), **o que cada um faz** (uma ou mais funções por pessoa, com o resumo de quantos em cada função) e **revisar e enviar**.
- **RF23** Sugestão automática: escolhe entre os disponíveis, cobrindo as funções do departamento, fazendo rodízio (quem foi menos escalado primeiro) e equilibrando quem está começando com quem tem mais experiência.
- **RF24** Coordenador envia como prévia ou publica direto, e pode ajustar depois de publicada.
- **RF25** Resposta do escalado: **Confirmo**, ou **Pedir ajuste** (na prévia) / **Não vou poder** (depois de publicada), sempre com o motivo. O coordenador vê as respostas de cada pessoa.
- **RF26** Ensaios ligados a um evento ou avulsos.

### 7.6 Repertório (departamentos com o módulo ativo)

- **RF27** Banco de músicas privado da organização: nome, artista, tom, link e cifra própria. A cifra aceita acordes entre colchetes no meio da letra (`[G]Numa folha`) ou numa linha só de acordes em cima da letra.
- **RF28** Repertório como uma playlist do departamento: nome, músicas em ordem e tom de cada uma. Um repertório pode ser aplicado em várias datas (cada data usa um). Os escalados recebem um aviso quando o repertório chega numa escala já enviada.
- **RF28.1** Editar o repertório como uma playlist: segurar a alça (⋮⋮) e arrastar para mudar a ordem, com as outras músicas abrindo espaço; − / + ao lado do tom sobem ou descem meio tom (ou digita-se o tom); deslizar a música para a esquerda mostra **Apagar**; tocar no nome abre a cifra no tom da lista. Tudo salva na hora, sem recarregar a tela.
- **RF28.2** Na lista de repertórios, deslizar para a esquerda mostra **Excluir**, com confirmação.
- **RF29** Troca de tom automática: a cifra abre no tom do repertório e muda com − / + ou escolhendo o tom; sustenidos ou bemóis conforme o tom. Atalho de busca no Cifra Club (ou o link cadastrado) quando ainda não há cifra.

### 7.7 Comunicação

- **RF30** Mural do departamento: publica quem monta escalas ou repertórios; todos os membros leem e recebem o aviso no celular. Aviso pode ser fixado no topo. Cada um apaga o seu; a coordenação pode apagar qualquer um. O Início mostra os dois últimos.
- **RF31** Notificações push, ligadas por aparelho no Perfil (ou pelo convite no Início): pedido de entrada, entrada aprovada, datas abertas, prévia enviada, escala publicada, escala alterada, pedido de ajuste, repertório numa escala já enviada e aviso novo no mural. Lembrete na véspera: todo dia às 18h (Brasília) o servidor avisa quem está escalado para o dia seguinte, menos quem pediu ajuste.
- **RF32** Compartilhar no WhatsApp: código do departamento, escala de uma data, escala do mês e datas abertas para marcar.

### 7.8 Painéis

- **RF33** Início: a próxima escala com o botão Confirmo e a **escala do mês em tabela** de cada departamento, com navegação entre meses. Datas para marcar aparecem como um atalho para o Calendário.
- **RF34** Painel do coordenador: pedidos de entrada, eventos abertos com o número de disponíveis e atalhos para escalar.
- **RF35** Painel do administrador: departamentos e coordenadores.

### 7.9 Acompanhamento (etapa 3)

- **RF36** Desempenho por função após cada evento, visível só para os coordenadores.
- **RF37** Relatórios de frequência, disponibilidade e músicas mais tocadas.
- **RF38** Sincronização opcional com Google Agenda.

### 7.10 Calendário

- **RF39** Calendário pessoal do mês, com marcações de formas diferentes: **escalado**, **data aberta para marcar**, **marquei "posso"** e **data que eu coordeno**. Tocando no dia, aparecem os compromissos e as ações.
- **RF40** Visão em lista com todas as escalas da pessoa, agrupadas por mês, com função e resposta, as datas esperando ela marcar e as escalas anteriores.

---

## 8. Regras de negócio

- **RN01** Todo usuário entra como membro; só o perfil acima libera acesso.
- **RN02** Uma organização só funciona depois de aprovada pelo Circlle.
- **RN03** Por enquanto não há limite de departamentos; no futuro, o plano contratado poderá limitar.
- **RN04** Um departamento pode ter vários coordenadores; o administrador tem acesso de coordenador em todos.
- **RN05** Os papéis valem por departamento: a pessoa pode ser coordenadora em um e membro em outro.
- **RN06** Entrar no departamento exige aprovação de um coordenador, junto com a confirmação das funções.
- **RN07** Rótulos personalizados mudam apenas o que aparece na tela.
- **RN08** Cada função da escala precisa ser uma que a pessoa faz naquele departamento. Uma pessoa pode ter várias funções na mesma data.
- **RN09** Disponibilidade não garante escala: quem decide é o coordenador.
- **RN10** Depois que a data sai do "aberto", o membro não desmarca a disponibilidade; responde à escala.
- **RN11** Até o coordenador decidir um pedido de ajuste, a vaga continua com o membro. Ao salvar a escala, o pedido conta como resolvido.
- **RN12** Dados de desempenho são visíveis só aos coordenadores do departamento.
- **RN13** O banco de músicas é privado por organização.
- **RN14** O dono da plataforma não acessa escalas, avaliações e avisos das organizações.
- **RN15** Se o coordenador mudar as funções de alguém que já respondeu, a pessoa volta a confirmar.
- **RN16** A prévia é visível para todo o departamento; só os escalados respondem.
- **RN17** Coordenadores e administradores sempre podem montar o repertório dos seus departamentos (com o módulo ativo); a permissão de repertório é só para membros.
- **RN18** Só o administrador desativa ou reativa um departamento. Desativado, ele some do app dos membros e coordenadores, mas nada é apagado. Nenhum departamento muda de organização.
- **RN19** As notificações valem por aparelho. Ao sair da conta, o aparelho deixa de receber; se outra conta entrar e ativar, os avisos passam a ser dela.
- **RN20** As notificações saem do servidor, que confere se quem pediu o aviso tem direito (ex.: só quem monta escalas avisa sobre a escala do seu departamento).
- **RN21** "Pode montar escalas" dá ao membro tudo o que o coordenador faz nas escalas daquele departamento (criar datas, montar, enviar prévia, publicar, editar e excluir datas), mas não aprova membros nem mexe em funções e ajustes. Só a coordenação liga ou desliga.
- **RN22** A barra de baixo mostra só o que cada papel usa: membro (Início, Calendário); com repertório (+ Repertórios); quem monta escalas (+ Escalas); administrador do grupo (+ aba do grupo); dono da plataforma (Dashboard, Assinantes). O perfil abre pelo avatar, em qualquer tela.
- **RN23** Tirar uma música do repertório não pede confirmação (ela continua no banco de músicas e volta com dois toques). Excluir um repertório pede confirmação e avisa quantas datas ficam sem repertório; as músicas continuam cadastradas.
- **RN24** Apelido, WhatsApp e nascimento são obrigatórios; sem eles, o app pede para completar antes de seguir. A data de nascimento só a própria pessoa vê (permissão por coluna no banco); colegas veem nome, apelido, WhatsApp e foto.

---

## 9. Critérios de aceite do MVP

O MVP está pronto quando, com os usuários de teste, for possível:

1. **Paula** cria a conta, digita o código da Música, marca "Vocal" e fica aguardando.
2. **Caio** vê o pedido da Paula, confirma a função e aprova.
3. **Caio** cria as apresentações dos dias 7, 14 e 28 e abre para disponibilidade.
4. **Paula** marca que pode nos dias 7 e 28; **Marcos**, em todos.
5. **Caio** escala o dia 7 com Paula no Vocal e Marcos no **Violão e no Vocal**, e envia a **prévia**.
6. **Marcos** pede ajuste: "nesse dia só consigo chegar às 20h". **Caio** vê o motivo, tira o Violão dele e publica.
7. **Paula** confirma pelo início; **Marcos** confirma de novo.
8. **Paula** e **Marcos** veem a escala no **calendário**, no mês e na lista.
9. **Caio** abre todos os domingos do mês seguinte de uma vez.
10. **Marcos** vê no perfil que faz Violão e Vocal na Música e Foto na Mídia.
11. Um membro de outra organização não vê nada do Coletivo Harmonia.

*Repertório (Rita) passou para a Etapa 2.*

---

## 10. Requisitos não funcionais

- **RNF01** PWA instalável, responsivo e pensado para celulares simples.
- **RNF02** Supabase (Postgres, Auth, Storage) com RLS isolando cada organização.
- **RNF03** Notificações push gratuitas via PWA.
- **RNF04** LGPD: termos de uso e política de privacidade numa página aberta (`#/termos`), aceite obrigatório no cadastro e, para quem já tinha conta, no próximo acesso; o aceite guarda a versão e a hora. Exclusão de conta pelo Perfil, que apaga os dados na hora; o único administrador de um grupo com outras pessoas precisa passar a administração antes. Ao mudar os termos, troca-se a versão e todos aceitam de novo.
- **RNF05** Código do departamento sem caracteres ambíguos (sem 0/O, 1/I/L).
- **RNF06** Custo de operação zero na fase inicial.
- **RNF07** Atualização automática: o app instalado procura versão nova sempre que volta para a frente da tela (e a cada 30 minutos) e recarrega sozinho. Ninguém precisa limpar cache nem reinstalar.
- **RNF08** Gestos com alternativa: a ordem também muda pelo teclado (setas na alça) e o botão de apagar aparece ao receber foco. Com "reduzir movimento" ligado no aparelho, as animações ficam instantâneas.

---

## 11. Etapas de entrega

1. **Etapa 1 (MVP):** solicitação e aprovação de organização, papéis, departamentos com código, vínculo com funções, datas do mês, disponibilidade, escala em 3 passos com várias funções, prévia e respostas, publicação do mês, calendário pessoal, início do membro e notificações básicas.
2. **Etapa 2:** repertório, mural, cifra e troca de tom (✅ feitos); sugestão automática e ensaios (próximos).
3. **Etapa 3:** desempenho, relatórios e sincronização de agenda.

---

## 12. Banco de dados (v10)

**v10**

- `perfis.apelido` e `perfis.nascimento`. A data de nascimento fica fora da leitura dos colegas (permissão por coluna) e a pessoa lê a sua pela função `meu_nascimento`.
- O cadastro (e o login com Google) já grava apelido, WhatsApp, nascimento e foto no perfil.
- Fotos no Storage, pasta `avatares/<id>/foto`, com leitura pública e escrita só da própria pessoa.
- `conferir_exclusao_conta`: o app confere antes de apagar a foto e a conta.
- Banco da v9: `supabase/migracao-v10.sql`, que não apaga dados.


**v9**

- `perfis.termos_versao` e `perfis.termos_aceitos_em`; o cadastro já grava o aceite, e a função `aceitar_termos` registra o de quem já tinha conta, com a hora do servidor.
- `excluir_minha_conta` agora bloqueia o único administrador de um grupo que tem outras pessoas.
- Banco da v8: `supabase/migracao-v9.sql`, que não apaga dados. A ordem e o tom do repertório continuam em `repertorio_itens`.


**v8**

- `avisos.fixado`; regras do mural separadas em publicar, editar e apagar.
- Limite de 20 mil caracteres na cifra.
- Banco da v7: `supabase/migracao-v8.sql`, que não apaga dados.


**v7**

- Tabelas `repertorios` (por departamento) e `repertorio_itens` (música, ordem, tom e observação); `eventos.repertorio_id` liga a data ao repertório.
- Travas: a música é da mesma organização e o repertório é do mesmo departamento da data. A função `aplicar_repertorio` deixa quem monta repertório aplicar numa data sem poder mexer na escala.
- Banco da v6: `supabase/migracao-v7.sql`, que não apaga dados.


**v6**

- Coluna `membros_departamento.perm_escala` e função `pode_escalar`, usada nas regras de eventos, disponibilidade, escalas e funções na escala.
- Banco da v5: `supabase/migracao-v6.sql`, que não apaga dados.


**v4**

- Trava `proteger_departamento`: coordenador renomeia, só o administrador desativa ou reativa (respeitando o limite do plano) e nenhum departamento troca de organização.
- Função `registrar_push`: liga as notificações do aparelho à conta logada.
- Função de servidor `notificar` (Supabase Edge Function): confere a permissão e envia os avisos.
- Banco da v3: `supabase/migracao-v4.sql`, que não apaga dados.
- Lembrete na véspera: `supabase/migracao-v5.sql` liga o agendador do banco (pg_cron + pg_net), guarda um segredo no Vault e cria `cron_valido`, que a função usa para conferir que a chamada veio do agendador.

**v3**

- `eventos.status`: **aberto → previa → publicado → realizado** (ou cancelado).
- `escalas`: uma linha por pessoa e data, com `resposta` (pendente, confirmado, ajuste), `motivo` e `respondido_em`.
- Nova tabela `escala_funcoes`: as funções de cada escalado naquela data (uma ou mais).
- Função `responder_escala`: o escalado confirma ou pede ajuste, só na prévia ou na escala publicada.
- Saiu a tabela `remanejamentos`: o pedido de ajuste ocupa o lugar dela.
- Instalação nova: `supabase/schema.sql`. Banco da v2: `supabase/migracao-v3.sql`, que não apaga dados.

---

## 13. Situação atual

| Item | Situação |
|---|---|
| Marca, logo, paleta e tokens | ✅ Pronto |
| Protótipo navegável | ✅ Pronto (precisa trocar os termos religiosos) |
| Projeto Vite + PWA, publicado no Netlify | ✅ Pronto |
| Banco v8 com RLS | ✅ Pronto |
| Contratação, departamentos, código e aprovação | ✅ Pronto |
| Datas do mês, disponibilidade e escala em 3 passos | ✅ Pronto |
| Prévia, respostas e publicação do mês | ✅ Pronto |
| Calendário pessoal | ✅ Pronto |
| Painel do Circlle | ✅ Pronto |
| Notificações push e lembrete na véspera | ✅ Pronto |
| Rótulos, departamentos desativados e WhatsApp | ✅ Pronto |
| Uma tela por função e permissões no perfil do membro | ✅ Pronto |
| Repertório como playlist (arrastar, tom, deslizar para apagar) | ✅ Pronto |
| Mural, cifra própria e troca de tom | ✅ Pronto |
| Atualização automática do app instalado | ✅ Pronto |
| Termos de uso, privacidade e exclusão de conta (LGPD) | ✅ Pronto |
| Cadastro completo, foto, Google e esqueci a senha | ✅ Pronto |
| Sugestão automática e ensaios | ⏳ Etapa 2 |
| Desempenho, relatórios e agenda | ⏳ Etapa 3 |

---

## 14. Revisão de requisitos (v3)

| | Requisito | O que aconteceu |
|---|---|---|
| ➕ Entra | Calendário pessoal com mês e lista (RF39, RF40) | Saiu da Etapa 2 e entrou no MVP |
| ➕ Entra | Prévia da escala com Confirmo e Pedir ajuste | Nova etapa entre "aberto" e "publicado" |
| ➕ Entra | Várias funções por pessoa na mesma data | RN08 reescrita |
| ➕ Entra | Escala do mês: repetir dias da semana, prévia e publicação do mês | RF17 e RF21 |
| 🔁 Muda | Montar escala (RF22) | Passa a ser em 3 passos |
| 🔁 Muda | Remanejamento (RF25, RN11) | Vira a resposta "Pedir ajuste" / "Não vou poder", com motivo |
| 🔁 Muda | Início do membro (RF33) | Fica só a próxima escala, com Confirmo; a lista completa vai para o calendário |
| 🔁 Muda | Ciclo do evento (RF18) | Ganha a prévia; o rascunho deixa de ser um passo do fluxo |
| ➖ Sai | Duplicar escala | Substituído pelo atalho de repetir dias da semana |
| ➖ Sai | Data alternativa e sugestão de troca no remanejamento | O motivo em texto cobre os dois casos |
| ⏭️ Adia | Repertório no critério de aceite | Fica para a Etapa 2, junto com o mural |

---

## 15. Revisão de requisitos (v4)

| | Requisito | O que aconteceu |
|---|---|---|
| ✅ Feito | Notificações push (RF31) | Sete avisos e o lembrete na véspera; repertório enviado fica para depois |
| ✅ Feito | Rótulos (RF09) | Tela "Nomes no app" do administrador; o nome do evento vira sugestão ao abrir datas |
| ✅ Feito | Renomear e desativar departamento (RF08) | Coordenador renomeia; administrador desativa e reativa |
| ✅ Feito | WhatsApp (RF32) | Escala de uma data, escala do mês e datas abertas |
| ➕ Entra | RN17 a RN20 | Repertório dos coordenadores, departamento desativado e regras das notificações |
| 🎨 Muda | Visual | Mais minimalista: menos brilho e gradiente, cartões mais leves; a marca continua |
| ⏭️ Fica | Foto no perfil (RF02) | Segue opcional, sem data |

---

## 16. Revisão de requisitos (v6)

| | Requisito | O que aconteceu |
|---|---|---|
| 🎯 Princípio | Substituir a imagem da escala do mês | O Início virou a escala do mês em tabela |
| ✅ Feito | Uma tela por função (RN22) | Barra de baixo por papel; perfil pelo avatar |
| ✅ Feito | Nova escala avulsa, semanal ou mensal (RF17) | Aba Escalas, com edição e exclusão de datas |
| ➕ Entra | Pode montar escalas (RN21) | O coordenador liga no perfil do membro, junto com a de repertório |
| ✅ Feito | Dashboard e Assinantes | Telas do dono da plataforma, com busca e filtro por situação |
| ✅ Feito | Lembrete na véspera (v5) | Todo dia às 18h, para quem está escalado no dia seguinte |
| ⏭️ Próxima etapa | Repertórios | Aba já aparece para quem tem a permissão, como "em breve" |

---

## 17. Revisão de requisitos (v7)

| | Requisito | O que aconteceu |
|---|---|---|
| ✅ Feito | Repertório como playlist (RF28) | Criar, buscar e cadastrar músicas, ordem, tom por música, aplicar e tirar de datas |
| ✅ Feito | Repertório na tela da data | Membros veem a lista com tom e o atalho da cifra |
| ✅ Feito | Aviso de repertório (RF31) | Quando aplicado numa escala em prévia ou publicada |
| ✅ Feito | Calendário | Botões Mês e Lista abaixo do título, sem encostar no avatar |
| ⏭️ Fica | Cifra própria e troca de tom automática (RF27, RF29) | Próxima etapa |

---

## 18. Revisão de requisitos (v8)

| | Requisito | O que aconteceu |
|---|---|---|
| ✅ Feito | Mural (RF30) | Página do mural, resumo no Início, aviso no celular, fixar e apagar |
| ✅ Feito | Cifra própria (RF27) | Dois jeitos de escrever: colchetes ou acordes em cima da letra |
| ✅ Feito | Troca de tom (RF29) | Abre no tom do repertório; − / + e escolha do tom |
| ⏭️ Fica | Sugestão automática e ensaios | Próximas etapas |

---

## 19. Revisão de requisitos (v9)

| | Requisito | O que aconteceu |
|---|---|---|
| ✅ Feito | Ordem do repertório (RF28.1) | Segurar e arrastar, com transição suave, no lugar das setas ↑ ↓ |
| ✅ Feito | Tom por música (RF28.1) | − à esquerda e + à direita, meio tom por toque, salvando na hora |
| ✅ Feito | Tirar música (RF28.1, RN23) | Deslizar para a esquerda mostra Apagar, no lugar do × |
| ✅ Feito | Excluir repertório (RF28.2, RN23) | Mesmo gesto na lista de repertórios, com confirmação |
| ✅ Feito | Atualização do app (RNF07) | O app instalado se atualiza sozinho ao voltar para a tela |
| ✅ Feito | LGPD (RNF04) | Página de termos e privacidade, aceite no cadastro e no próximo acesso, exclusão de conta sem deixar grupo sem administrador |
| ⏭️ Fica | Sugestão automática e ensaios | Próximas etapas |

---

## 20. Revisão de requisitos (v10)

| | Requisito | O que aconteceu |
|---|---|---|
| ✅ Feito | Cadastro completo (RF01, RN24) | Nome, apelido, WhatsApp (com máscara) e nascimento obrigatórios |
| ✅ Feito | Foto no perfil (RF02) | Opcional; recortada e reduzida no aparelho; aparece nos avatares |
| ✅ Feito | Editar no Perfil (RF02) | Todos os dados e a foto |
| ✅ Feito | Entrar com o Google (RF01) | O botão aparece quando o Google está ligado no Supabase |
| ✅ Feito | Esqueci minha senha (RF01.1) | Link por e-mail e tela de senha nova |
| ⏭️ Fica | Aniversariantes do mês | A data já está guardada; a tela fica para depois |
