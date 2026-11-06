# Betinho Barber Style — como colocar no ar

Arquivos:
- `index.html`, `site.js`: site do cliente (preços, fidelidade, agendamento)
- `admin.html`, `admin.js`: painel do barbeiro (agenda + clientes)
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
O cliente marca o horário pelo site e ele fica reservado na hora. No painel (`/admin.html`), o barbeiro toca em **Concluído** quando o cliente sai da cadeira, e o selo entra sozinho no cartão daquele WhatsApp. Se tocar por engano, **Desfazer** devolve o selo. Marcar **Faltou** ou **Cancelar** não dá selo.
