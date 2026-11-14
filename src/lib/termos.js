// Termos de uso e política de privacidade do Circlle (LGPD)
// Ao mudar o texto de forma relevante, troque a VERSÃO: todo mundo aceita de novo no próximo acesso.

export const TERMOS_VERSAO = '2026-11-14';
export const TERMOS_DATA = '14 de novembro de 2026';

// Canal para pedidos sobre dados pessoais (troque por um e-mail quando tiver um)
export const CONTATO = {
  rotulo: 'Instagram @cappstonestudio',
  link: 'https://instagram.com/cappstonestudio'
};

const contato = `<a href="${CONTATO.link}" target="_blank" rel="noopener">${CONTATO.rotulo}</a>`;

export const textoTermos = () => `
  <p class="documento__data">Última atualização: ${TERMOS_DATA}</p>

  <p>O Circlle é um app gratuito para organizar escalas de equipes voluntárias, feito pela
  <strong>Cappstone Studio</strong>. Este texto explica, em linguagem simples, as regras de uso
  e o que acontece com os seus dados, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

  <h2 id="uso">Termos de uso</h2>

  <h3>1. Quem pode usar</h3>
  <p>Qualquer pessoa que participe de um grupo cadastrado no Circlle. Menores de 18 anos usam com a
  autorização de um responsável. A conta é pessoal: não compartilhe sua senha.</p>

  <h3>2. Como o app funciona</h3>
  <p>Um grupo (organização) é aprovado pelo Circlle. Dentro dele, os departamentos têm coordenadores,
  que aprovam a entrada das pessoas, abrem datas, montam escalas e repertórios e publicam avisos.
  O que você vê depende do seu papel em cada departamento.</p>

  <h3>3. O que você se compromete a fazer</h3>
  <ul>
    <li>Informar dados verdadeiros e manter seu nome atualizado.</li>
    <li>Usar o mural, as escalas e os repertórios só para assuntos do grupo, com respeito.</li>
    <li>Não cadastrar conteúdo ofensivo, ilegal ou que viole direitos de outras pessoas.</li>
    <li>Cifras e letras cadastradas são de responsabilidade de quem cadastra e servem para uso interno
      do grupo, não para divulgação pública.</li>
  </ul>

  <h3>4. Responsabilidades</h3>
  <p>O Circlle organiza as informações que o próprio grupo cadastra. Quem decide as escalas, os
  repertórios e os avisos é a coordenação de cada grupo. Fazemos o possível para o app funcionar sempre,
  mas ele pode passar por manutenção ou ficar fora do ar por alguns momentos.</p>

  <h3>5. Encerramento</h3>
  <p>Você pode excluir sua conta quando quiser, pelo Perfil. O Circlle pode suspender grupos ou contas
  que descumpram estes termos.</p>

  <h2 id="privacidade">Política de privacidade</h2>

  <h3>6. Quais dados guardamos</h3>
  <ul>
    <li><strong>Conta:</strong> nome, e-mail, senha (guardada de forma criptografada) e telefone, se você informar.</li>
    <li><strong>Participação:</strong> departamentos, funções, datas em que você marcou que pode, escalas,
      respostas (confirmo ou pedido de ajuste, com o motivo que você escrever).</li>
    <li><strong>Conteúdo do grupo:</strong> avisos do mural, músicas, cifras e repertórios que você cadastrar.</li>
    <li><strong>Notificações:</strong> se você ativar, o endereço técnico do aparelho para entregar os avisos.</li>
    <li><strong>No seu aparelho:</strong> o navegador guarda a sessão (para você não precisar entrar toda vez)
      e algumas preferências, como o último departamento aberto. Não usamos cookies de propaganda nem de rastreamento.</li>
  </ul>

  <h3>7. Para que usamos</h3>
  <p>Só para o app funcionar: mostrar as escalas, avisar você sobre datas, escalas e avisos, e permitir que a
  coordenação organize a equipe. A base legal é a execução do serviço que você pediu ao criar a conta
  (art. 7º, V, da LGPD). Não vendemos dados e não usamos para publicidade.</p>

  <h3>8. Quem vê os seus dados</h3>
  <ul>
    <li>Pessoas do mesmo grupo veem seu nome; a coordenação do departamento vê suas funções,
      disponibilidade e respostas.</li>
    <li>A equipe do Circlle vê os dados das solicitações de novos grupos e o necessário para o suporte.
      Ela não acessa as escalas e os avisos dos grupos.</li>
    <li>Serviços que fazem o app funcionar: <strong>Supabase</strong> (banco de dados e login),
      <strong>Netlify</strong> (hospedagem) e o serviço de notificações do seu navegador (Google, Apple ou Mozilla),
      que recebe só o conteúdo do aviso. Esses servidores podem ficar fora do Brasil, com proteções
      adequadas (art. 33 da LGPD).</li>
  </ul>

  <h3>9. Por quanto tempo</h3>
  <p>Enquanto sua conta existir. Ao excluir a conta, apagamos na hora seu perfil, suas participações,
  disponibilidades, escalas, respostas e os aparelhos de notificação. Avisos, músicas e repertórios que
  você cadastrou continuam com o grupo, sem o seu nome.</p>

  <h3>10. Seus direitos</h3>
  <p>Você pode, a qualquer momento: confirmar que tratamos seus dados, ter acesso a eles, corrigir
  (seu nome e telefone mudam pelo Perfil), pedir a portabilidade ou a exclusão, e retirar o consentimento
  das notificações (pelo Perfil ou no aparelho). Para os pedidos que não estão no app, fale com a gente pelo
  ${contato}. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).</p>

  <h3>11. Segurança</h3>
  <p>A conexão é criptografada, a senha não fica visível nem para nós, e cada grupo só enxerga os próprios
  dados, com regras de acesso aplicadas direto no banco.</p>

  <h3>12. Mudanças</h3>
  <p>Se estes termos mudarem de forma importante, você verá o aviso ao abrir o app e precisará aceitar
  de novo para continuar.</p>

  <h3>13. Contato</h3>
  <p>Cappstone Studio, responsável pelo Circlle: ${contato}.</p>`;
