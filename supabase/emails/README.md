# E-mails do Circlle (Supabase Auth)

Modelos em português para colar em **Supabase → Authentication → Emails → Templates**.
Para cada modelo: troque o **Subject** pelo assunto abaixo e cole o conteúdo do arquivo `.html` inteiro no campo **Body** (aba "Source").

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu cadastro no Circlle | `confirmar-cadastro.html` |
| Reset password | Crie uma nova senha no Circlle | `redefinir-senha.html` |
| Change email address | Confirme seu novo e-mail no Circlle | `trocar-email.html` |
| Magic link | Seu link de acesso ao Circlle | `link-de-acesso.html` |
| Invite user | Você foi convidado para o Circlle | `convite.html` |
| Reauthentication | Seu código de confirmação do Circlle | `codigo-de-confirmacao.html` |

As marcações `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .NewEmail }}` e `{{ .Token }}` são preenchidas pelo próprio Supabase: não apague.

O logo vem de `{{ .SiteURL }}/icons/icon-96x96.png`, então o **Site URL** do Supabase precisa ser o endereço do app (ex.: `https://circlle.rafaelmestre.com.br`).

O visual usa só tabelas e estilos na própria linha, que é o que funciona no Gmail, Outlook e Apple Mail. Se algum cliente bloquear imagens, o nome "Circlle" aparece em texto logo abaixo.
