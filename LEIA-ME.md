# Betinho Barber Style — como colocar no ar

Arquivos:
- `index.html`, `site.js`: site do cliente (preços, fidelidade, agendamento)
- `painel-48b577d8.html`, `admin.js`: painel do barbeiro (agenda + clientes). O endereço é secreto e não aparece no site.
- `styles.css`: visual
- `config.js`: **o único arquivo que você edita** (chaves, WhatsApp, preços, horários)
- `supabase.sql`: cria o banco de dados

## 1. Banco de dados (Supabase, grátis)
1. Crie uma conta em supabase.com, depois clique em **New project**.
2. No projeto, abra **SQL Editor**, depois **New query**. Cole o conteúdo de `supabase.sql`.
   Na última linha, troque `barbeiro@exemplo.com` pelo e-mail do barbeiro e clique em **Run**.
3. Vá em **Authentication**, depois **Users**, e clique em **Add user** e **Create new user**. Use o mesmo e-mail e uma senha.
4. Em **Authentication**, abra **Sign In / Providers** e desligue **Allow new users to sign up**.
5. Em **Project Settings**, depois **API**, copie a **Project URL** e a chave **anon public**.

## 2. Configurar
Abra `config.js` e cole a URL e a chave `anon`. A chave `anon` foi feita para ficar no site, então não há problema.
Ajuste também o WhatsApp, o endereço, os preços e os horários.

## 3. Publicar na Vercel
- **Pelo GitHub:** substitua os arquivos do repositório atual do betinhobarber por estes, ou crie um repositório novo e envie os arquivos. A Vercel publica sozinha.
- **Pelo computador:** dentro da pasta, rode `npx vercel --prod`.

Se o projeto atual na Vercel estiver como Next.js, mude o **Framework Preset** para **Other** em Settings, depois Build & Deployment.

## Supabase sempre ligado
O plano grátis do Supabase pausa o projeto depois de 7 dias sem uso. Para evitar isso, o site traz `api/keepalive.js` e `vercel.json`: a Vercel chama o banco todo dia às 06:17 (horário de Brasília) e ele nunca fica parado. Não precisa configurar nada. Para conferir, abra `seusite.vercel.app/api/keepalive`: tem que aparecer `"ok": true`.
Se preferir garantia total, o plano Pro do Supabase não pausa nunca (é pago).

## Como funciona o selo automático
O cliente marca o horário pelo site e ele fica reservado na hora. No painel (`/painel-48b577d8.html`), o barbeiro toca em **Concluído** quando o cliente sai da cadeira, e o selo entra sozinho no cartão daquele WhatsApp. Se tocar por engano, **Desfazer** devolve o selo. Marcar **Faltou** ou **Cancelar** não dá selo.

## Segurança
- **Preço, duração, barbeiro e horário são conferidos no banco** (`seguranca.sql`, que também está no fim do `supabase.sql`). Mudar valores pelo navegador não adianta. Se mudar preços ou horários no `config.js`, mude também em `catalogo_servico` e `horario_funcionamento` e rode o SQL de novo.
- **Ninguém de fora lê a agenda nem os clientes.** As tabelas só abrem para o e-mail cadastrado em `admins`, logado no painel.
- **Anti-spam:** no máximo 3 horários em aberto por WhatsApp e 20 pedidos a cada 10 minutos no site todo.
- **Cabeçalhos de segurança** no `vercel.json` (CSP, HSTS, bloqueio de iframe) e o script do Supabase com verificação de integridade (SRI).
- **Senha do painel:** em `/painel-48b577d8.html`, escreva o e-mail e toque em **Criar ou trocar senha**. Chega um link por e-mail para definir a senha (mínimo 10 caracteres).

## Confirmação automática no WhatsApp (API oficial da Meta)
Quando o cliente marca, o site chama `/api/whatsapp`, que manda a mensagem de confirmação para o WhatsApp que ele digitou.
1. Em business.facebook.com crie uma conta Meta Business. Em developers.facebook.com crie um app do tipo **Business** e adicione o produto **WhatsApp**.
2. Cadastre o número que vai enviar (não pode estar em uso no app WhatsApp normal) e anote o **Phone number ID**.
3. Em **WhatsApp Manager → Modelos de mensagem**, crie o modelo `confirmacao_agendamento`, categoria **Utilidade**, idioma **Português (BR)**, com o texto:
   `Olá {{1}}! Seu horário de {{2}} na Betinho Barber Style está marcado para {{3}} às {{4}}. Se precisar remarcar, responda esta mensagem.`
4. Em **Configurações do negócio → Usuários do sistema**, crie um usuário do sistema, dê acesso ao app e gere um **token permanente** com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
5. Na Vercel, abra o projeto, depois **Settings → Environment Variables**, e adicione `WHATSAPP_TOKEN` (o token) e `WHATSAPP_PHONE_ID` (o Phone number ID). Depois faça **Redeploy**.
Enquanto isso não estiver configurado, o site funciona normal, só não manda a mensagem.
