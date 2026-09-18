# UTMTrack

Seu próprio painel de rastreamento de vendas — no estilo Utmify. Gere links UTM para
seus anúncios, receba vendas automaticamente via webhook do seu gateway de pagamento,
puxe o gasto de campanhas direto do Facebook Ads e acompanhe receita, ROAS e CPA em um
painel só.

## Como funciona

1. Você cria um **link de rastreamento** para um produto/campanha (`/links` no painel).
2. Usa esse link no anúncio do Facebook. Quando alguém clica, a API registra o clique
   e redireciona para sua página de checkout já com `utm_source`, `utm_campaign` etc. e
   um `click_id` na URL.
3. Seu checkout (Hotmart, Kiwify, ou um checkout próprio) precisa repassar esse
   `click_id` até a confirmação da venda — a maioria das plataformas tem um campo de
   "parâmetro de rastreamento" para isso.
4. Quando a venda é aprovada, a plataforma chama o **webhook** único da sua conta
   (URL disponível em `/settings`), o pedido é gravado e casado com o clique original.
5. Em paralelo, você sincroniza o **Facebook Ads** (token + ID da conta) para trazer o
   gasto diário por campanha.
6. O painel cruza receita (dos pedidos) com investimento (do Facebook) e calcula ROAS,
   CPA e ticket médio.
7. Quando configurado o Pixel, cada venda paga também é enviada para o Facebook via
   **Conversions API**, para otimizar os próprios anúncios.

## Stack

- **Backend** (`apps/api`): Node.js + Express + TypeScript, Prisma ORM, PostgreSQL,
  autenticação JWT.
- **Frontend** (`apps/web`): React + Vite + TypeScript, React Router, Recharts.

## Rodando localmente

### 1. Banco de dados

```bash
docker compose up -d          # sobe um Postgres local em localhost:5432
```

(Ou aponte `DATABASE_URL` para qualquer Postgres que já tenha, ex: Supabase, Neon, RDS.)

### 2. Backend

```bash
cd apps/api
cp .env.example .env          # ajuste DATABASE_URL / JWT_SECRET se necessário
npm install
npx prisma migrate dev        # cria as tabelas
npm run dev                   # API em http://localhost:4000
```

### 3. Frontend

```bash
cd apps/web
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # painel em http://localhost:5173
```

Crie sua conta em `http://localhost:5173/register` e pronto.

## Configurando o Facebook Ads

1. Crie um app em [developers.facebook.com](https://developers.facebook.com/) e gere um
   **token de acesso** de longa duração com as permissões `ads_read` e `ads_management`
   (e `pixel_events` / `ads_management` se for usar a Conversions API).
2. Pegue o **ID da conta de anúncios** (número, sem o prefixo `act_`).
3. Se quiser enviar eventos de compra de volta pro Facebook, pegue também o **ID do
   Pixel**.
4. Cole tudo em `/settings` no painel e clique em "Testar conexão".
5. Clique em "Sincronizar Facebook Ads" no painel para puxar o gasto por campanha dos
   últimos dias (ou chame `POST /api/facebook/sync` periodicamente, ex: via cron, para
   manter os dados sempre atualizados).

## Configurando os webhooks de venda

Cada conta tem uma URL de webhook única (visível em `/settings`) para cada gateway
suportado:

- **Hotmart**: cole a URL no painel de webhooks do produto. Se configurar o campo
  "Segredo Hotmart", o `hottok` enviado pela Hotmart é validado.
- **Kiwify**: cole a URL nas configurações de webhook da conta. Se configurar o
  "Segredo Kiwify", a assinatura enviada em `?signature=` é validada.
- **Genérico**: para qualquer outro gateway ou um checkout próprio. Espera um JSON
  normalizado:

  ```json
  {
    "external_id": "id-unico-da-venda",
    "status": "paid",
    "amount": 197.0,
    "currency": "BRL",
    "customer_email": "cliente@email.com",
    "product_name": "Nome do produto",
    "click_id": "o click_id recebido do link de rastreamento",
    "utm_source": "facebook",
    "utm_campaign": "nome-da-campanha"
  }
  ```

  Se configurar o "Segredo genérico", a requisição precisa enviar o header
  `X-Webhook-Secret` com esse valor.

> Os parsers de Hotmart e Kiwify cobrem os campos mais comuns dos payloads dessas
> plataformas, mas cada conta pode variar um pouco o formato — se uma venda não for
> reconhecida corretamente, veja o payload bruto salvo em `WebhookLog` (tabela no banco)
> para ajustar o parser em `apps/api/src/services/orders.service.ts`.

## Deploy em produção

- Backend: qualquer host Node (Railway, Render, Fly.io, um VPS com PM2 etc.) + um
  Postgres gerenciado. Rode `npm run build && npm start` em `apps/api`, e
  `npx prisma migrate deploy` antes de subir uma nova versão.
- Frontend: qualquer host estático (Vercel, Netlify, Cloudflare Pages). Rode
  `npm run build` em `apps/web` e sirva a pasta `dist/`.
- Lembre de apontar `PUBLIC_API_URL` (backend) para o domínio público da API — é a
  base usada para montar os links de rastreamento e as URLs de webhook — e
  `WEB_ORIGIN` para o domínio do painel (CORS).
