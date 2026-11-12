# Circlle — Documentação do Projeto

*Um produto Codemancer Studio*

## 1. Visão geral

Aplicação web progressiva (PWA) para organizações que trabalham com equipes de voluntários organizadas em escalas: igrejas de qualquer religião, bandas, corais, ONGs, projetos sociais e grupos em geral. O sistema permite montar escalas de eventos e ensaios, distribuir repertórios musicais, acompanhar a evolução dos membros e manter a comunicação da equipe em um só lugar.

## 2. Propósito

Oferecer gratuitamente a organizações pequenas, de periferia e de baixa renda uma ferramenta de gestão que normalmente só grandes organizações conseguem pagar. O app também serve de vitrine e portfólio da Codemancer Studio. Um plano pago opcional poderá existir no futuro para organizações grandes ou recursos extras.

## 3. Terminologia neutra

| Termo no sistema | Exemplo em igreja | Exemplo em banda/ONG |
| --- | --- | --- |
| Organização | Igreja | Banda, ONG |
| Equipe | Ministério | Naipe, grupo de voluntários |
| Evento | Culto | Show, ação social |
| Função | Vocal, teclado | Guitarra, recepção |

Os termos neutros são o padrão. Na criação da organização, o administrador pode renomeá-los (ex.: "Equipe" vira "Ministério" e "Evento" vira "Culto"). A estrutura por baixo é a mesma; muda apenas o que aparece na tela.

## 4. Perfis de usuário

Os papéis são atribuídos por equipe: uma mesma pessoa pode ser líder em uma equipe e membro em outra.

- **Administrador:** cria a organização e as equipes, define líderes.
- **Líder de equipe:** monta escalas, aprova membros e remanejamentos, acompanha desempenho, publica avisos.
- **Responsável pelo repertório:** monta e envia o repertório; pode ser o próprio líder ou alguém delegado, inclusive por evento. Existe apenas em equipes com o módulo de repertório ativo.
- **Membro:** vê suas escalas, marca indisponibilidade, confirma presença e pede remanejamento.

## 5. Requisitos funcionais

### 5.1 Organizações e equipes

- RF01: Cadastrar organização e suas equipes.
- RF02: Convidar membros por link com validade (ex.: 7 dias); a entrada exige aprovação do líder.
- RF03: Definir funções por equipe (ex.: vocal, bateria, recepção).

### 5.2 Escalas

- RF04: Criar eventos com data, horário e funções necessárias.
- RF05: O membro marca dias de indisponibilidade.
- RF06: O sistema sugere uma escala em rodízio, respeitando indisponibilidades e equilibrando membros em evolução com membros mais preparados, com base no histórico de desempenho.
- RF07: O líder ajusta livremente a sugestão e publica a escala.
- RF08: O membro confirma presença em cada escala.

### 5.3 Remanejamento

- RF09: Em vez de recusar, o membro pede remanejamento de um dia específico, com motivo opcional, data alternativa e sugestão de quem pode trocar com ele.
- RF10: O líder aprova, troca a data ou conversa antes de decidir.
- RF11: Até a decisão do líder, a vaga continua com o membro; a escala nunca fica descoberta sem o líder saber.

### 5.4 Ensaios

- RF12: Criar ensaio vinculado a um evento, herdando escala e repertório.
- RF13: Criar ensaio avulso, convocando quem o líder escolher.

### 5.5 Repertório (módulo opcional por equipe)

Ativado ou desativado na criação ou edição da equipe. Com o módulo desativado (ex.: recepção, ONG, limpeza), a aba de repertório e o papel de responsável pelo repertório não aparecem para aquela equipe.

- RF14: Montar repertório por evento com nome, artista, tom, link (YouTube/Spotify) e cifra.
- RF15: Botão "ver cifra" que abre a busca da música no Cifra Club (o app não copia conteúdo de terceiros).
- RF16: Colar ou escrever cifras próprias (formato ChordPro), salvas no banco de músicas privado da organização.
- RF17: Transpor o tom das cifras salvas automaticamente.

### 5.6 Desempenho

- RF18: Após cada evento, o líder registra uma avaliação rápida por função (ex.: segurança, preparo, pontualidade).
- RF19: Gráfico de evolução de cada membro ao longo do tempo, visível somente ao líder, que repassa feedbacks pessoalmente.

### 5.7 Calendário

- RF20: Calendário unificado do membro com escalas e ensaios de todas as equipes e organizações.
- RF21: Sincronização opcional com Google Agenda e calendário do celular.

### 5.8 Notificações

- RF22: Push na publicação da escala, no envio do repertório, em pedidos de remanejamento e como lembrete um dia antes do evento.
- RF23: Botão "compartilhar no WhatsApp" para escalas e repertórios.

### 5.9 Mural de avisos

- RF24: Líder e responsável pelo repertório publicam avisos; membros leem.

### 5.10 Relatórios

- RF25: Frequência por membro: vezes escalado, confirmações e faltas.
- RF26: Músicas mais tocadas, data da última execução e músicas esquecidas há muito tempo (somente equipes com repertório ativo).

### 5.11 Personalização

- RF27: Ativar ou desativar módulos por equipe (inicialmente, o repertório). Novos módulos opcionais, como checklist de tarefas, poderão ser adicionados no futuro.
- RF28: O administrador renomeia os termos padrão (organização, equipe, evento, função) para a linguagem da organização.

## 6. Regras de negócio

- RN01: Não existem rótulos fixos de nível; o equilíbrio da escala usa apenas o histórico de desempenho.
- RN02: Dados de desempenho são visíveis exclusivamente ao líder da equipe.
- RN03: O banco de cifras é privado por organização; não existe biblioteca pública.
- RN04: Quem decide remanejamentos é sempre o líder.
- RN05: Um membro pode participar de várias equipes e organizações com papéis diferentes.
- RN06: Módulos são definidos por equipe, não por organização: a mesma organização pode ter equipes com e sem repertório.
- RN07: Nomenclaturas personalizadas alteram apenas os rótulos exibidos; regras, permissões e dados são os mesmos para todas as organizações.

## 7. Requisitos não funcionais

- RNF01: PWA instalável, responsivo e com foco em celulares simples.
- RNF02: Backend em Supabase (Postgres, Auth, Storage), com políticas de RLS isolando os dados de cada organização.
- RNF03: Notificações push gratuitas via PWA.
- RNF04: LGPD: termo de uso no cadastro e opção de excluir a conta e todos os dados pessoais.
- RNF05: Custo zero de operação na fase inicial.

## 8. Etapas de entrega

1. **Etapa 1 (MVP):** organizações, equipes com módulos opcionais, nomenclatura personalizável, convites, escalas com confirmação, repertório e notificações.
2. **Etapa 2:** remanejamento, ensaios, calendário unificado e mural de avisos.
3. **Etapa 3:** sugestão automática de escala, desempenho, relatórios, sincronização de agenda e transposição de cifras.
