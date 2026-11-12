<p align="center"><img src="assets/logo/circlle-gradiente.svg" width="140" alt="Logo do Circlle"></p>

<h1 align="center">Circlle</h1>

> Escalas de voluntários sem planilha e sem grupo de WhatsApp bagunçado: monte a escala, envie o repertório, receba confirmações e acompanhe a evolução da equipe. Um PWA gratuito para igrejas, bandas, corais, ONGs e qualquer grupo que se organiza em escalas.

![Status](https://img.shields.io/badge/status-em%20planejamento-F59E0B)
![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?logo=pwa&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white)
![Custo](https://img.shields.io/badge/para%20o%20usuário-gratuito-22C55E)

📄 **[Documentação completa do projeto →](docs/documentacao.md)**

---

## 🎯 O problema

Quem já foi líder de equipe de voluntários conhece a rotina: a escala sai numa planilha ou numa foto no grupo, alguém avisa em cima da hora que não pode, o repertório chega picado em várias mensagens e ninguém sabe ao certo quem confirmou.

E montar uma boa escala não é só rodiziar nomes. É saber colocar quem está começando ao lado de quem já tem segurança, respeitar a agenda de cada um e dar feedback para a equipe crescer.

O **Circlle** nasceu dessa experiência real como líder de ministério de música, mas foi pensado para **qualquer grupo**, religioso ou não, que trabalha com escalas.

## 💡 Propósito

Ferramentas de gestão costumam ser caras e feitas para grandes organizações. O Circlle é **gratuito para o usuário**, com foco em organizações pequenas, de periferia e de baixa renda, que também merecem tecnologia boa.

---

## ✨ Funcionalidades planejadas

**Escalas**
- **Sugestão de escala em rodízio**, respeitando indisponibilidades e equilibrando membros em evolução com os mais preparados
- **O líder tem a palavra final**: ajusta a sugestão livremente antes de publicar
- **Confirmação de presença** por membro, em cada escala
- **Pedido de remanejamento** em vez de recusa: o membro indica o dia, o motivo e até quem pode trocar com ele, e a vaga só muda quando o líder aprova
- **Ensaios** vinculados a um evento ou avulsos

**Repertório** (módulo opcional, ativado por equipe: a de louvor usa, a de recepção não)
- Música, artista, tom, link do YouTube/Spotify e cifra
- Atalho para a cifra no Cifra Club e **banco de cifras privado** da organização
- **Transposição de tom** automática para cifras salvas (formato ChordPro)

**Equipe**
- **Acompanhamento de desempenho** por função, visível só ao líder, como apoio para dar feedback e capacitar a equipe
- **Mural de avisos** do líder e do responsável pelo repertório
- **Calendário unificado** do membro, com sincronização opcional com o Google Agenda
- **Convite por link** com aprovação do líder

**Relatórios**
- Frequência, confirmações e faltas por membro
- Músicas mais tocadas e músicas esquecidas há muito tempo

---

## 🧩 Terminologia neutra

| No Circlle | Em uma igreja | Em uma banda ou ONG |
|---|---|---|
| Organização | Igreja | Banda, ONG |
| Equipe | Ministério | Naipe, grupo de voluntários |
| Evento | Culto | Show, ação social |
| Função | Vocal, teclado | Guitarra, recepção |

Os termos neutros são o padrão, e **cada organização pode renomeá-los** para a sua própria linguagem.

## 👥 Perfis

Os papéis são definidos **por equipe**: a mesma pessoa pode ser líder na música e membro na recepção.

| Perfil | O que faz |
|---|---|
| **Administrador** | Cria a organização, as equipes e define os líderes |
| **Líder de equipe** | Monta escalas, aprova membros e remanejamentos, acompanha o desempenho |
| **Responsável pelo repertório** | Monta e envia as músicas; pode ser o líder ou alguém delegado por evento. Só existe em equipes com repertório ativo |
| **Membro** | Vê suas escalas, marca indisponibilidade, confirma presença e pede remanejamento |

---

## 🎨 Identidade visual

Modo escuro como padrão, gradiente vibrante e formas arredondadas, com o **círculo** como elemento central da marca.

O símbolo é um **"C" envolvido por um círculo**: a equipe no centro e as pessoas ao redor, girando como o rodízio da escala. As versões (gradiente, cor única, branca, escura e ícone do app) ficam em [`assets/logo/`](assets/logo/), e os ícones do PWA em [`icons/`](icons/). Os tokens ficam em [`css/tokens.css`](css/tokens.css), com modo claro automático.

| Papel | Cor |
|---|---|
| Gradiente da marca | `#8B3DFF` → `#3B82F6` → `#22D3EE` |
| Fundo / cards (escuro) | `#0F1B33` / `#1A2847` |
| Fundo / cards (claro) | `#F5F7FB` / `#FFFFFF` |
| Destaque | `#FB923C` |

| Status da escala | Cor |
|---|---|
| Confirmado | `#22C55E` |
| Pendente | `#FB923C` |
| Remanejamento | `#8B3DFF` |
| Recusa ou falta | `#F43F5E` |

---

## 🛠️ Tecnologias previstas

- **PWA** instalável, com notificações push gratuitas
- **Supabase:** Auth, PostgreSQL e Storage, com **Row Level Security** isolando os dados de cada organização
- **LGPD:** termo de uso no cadastro e exclusão de conta e dados pelo próprio usuário

---

## 🗺️ Roadmap

**Etapa 1: MVP**
- [ ] Organizações, equipes e convites
- [ ] Módulos opcionais por equipe e nomenclatura personalizável
- [ ] Escalas com confirmação de presença
- [ ] Repertório
- [ ] Notificações

**Etapa 2**
- [ ] Remanejamento
- [ ] Ensaios
- [ ] Calendário unificado
- [ ] Mural de avisos

**Etapa 3**
- [ ] Sugestão automática de escala
- [ ] Acompanhamento de desempenho
- [ ] Relatórios
- [ ] Sincronização com agenda e transposição de cifras

---

## 👤 Autor

**Rafael Mestre A. Araujo**: estudante de Análise e Desenvolvimento de Sistemas (PUC Minas), ex-líder de ministério de música e fundador da **Codemancer Studio**.

- GitHub: [@rafaelmestre](https://github.com/rafaelmestre)
- Instagram: [@codemancerstudio](https://instagram.com/codemancerstudio)
