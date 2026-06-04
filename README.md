# multi-wa-api

API REST segura e modular para controlar sessões de WhatsApp com **duas engines
intercambiáveis** — [`zapo-js`](https://github.com/vinikjkkj/zapo) e
[`baileys`](https://github.com/WhiskeySockets/Baileys) — persistindo tudo num único
**PostgreSQL**. Uma sessão escolhe a engine na criação e pode **migrar de engine sem
re-parear** via [`wa-store-migrate`](https://github.com/vinikjkkj/wa-store-migrate).

> Monorepo TypeScript (pnpm + turbo). Stack: Fastify, Postgres, JWT + API Key,
> Swagger/OpenAPI, SDK tipado zero-payload, webhooks assinados (HMAC).

## Índice

- [Destaques](#destaques)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Início rápido](#início-rápido)
- [Configuração](#configuração)
- [Autenticação](#autenticação)
- [Referência da API](#referência-da-api)
- [Tipos de mensagem](#tipos-de-mensagem)
- [Eventos & Webhooks](#eventos--webhooks)
- [SDK](#sdk)
- [Migração entre engines](#migração-entre-engines)
- [Logs](#logs)
- [Scripts](#scripts)
- [Testes](#testes)
- [Produção](#produção)

## Destaques

- **Engine por sessão** (`zapo` ou `baileys`) e **migração entre engines sem re-parear**.
- **Postgres como fonte única de verdade** do auth/estado das duas engines.
- **Zero-payload**: o consumidor nunca monta objetos do baileys/zapo — usa o
  `@multi-wa/sdk` ou o tipo normalizado `MessageContent`.
- **Multi-tenant**: tudo escopado por `tenant_id`.
- **Segurança por padrão**: API Key + JWT, `helmet`, rate-limit, CORS, body limit,
  webhooks assinados com HMAC-SHA256.
- **Alta performance**: Fastify, engines mantidas quentes em memória, pool pg único,
  serialização por schema, load shedding (`under-pressure`).
- **DX**: Swagger UI em `/docs`, OpenAPI gerado dos mesmos schemas zod, logs por
  sessão `[engine] <id>`, shutdown gracioso.

## Arquitetura

Monorepo com fronteiras claras — o domínio (`core`) não conhece nenhuma engine
concreta; só a interface `WaEngine`. As engines vivem em pacotes próprios (deps
pesadas isoladas) e são injetadas em `apps/api`.

```
apps/api  ──▶ core ──▶ db, config, types
   │           ▲
   └─▶ engine-baileys, engine-zapo ──▶ core (interface WaEngine)
sdk ──▶ types
```

| Pacote                     | Papel                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| `@multi-wa/types`          | Schemas zod + tipos compartilhados (fonte única de verdade)            |
| `@multi-wa/config`         | Validação de ambiente (zod)                                            |
| `@multi-wa/db`             | Pool pg, runner de migrations, schema                                  |
| `@multi-wa/core`           | Domínio engine-agnóstico: sessões, mensagens, migração, webhooks, auth |
| `@multi-wa/engine-baileys` | Engine baileys + auth-state em Postgres                                |
| `@multi-wa/engine-zapo`    | Engine zapo + store Postgres                                           |
| `@multi-wa/sdk`            | Cliente HTTP tipado (zero-payload)                                     |
| `@multi-wa/api`            | Servidor Fastify (aplicação executável)                                |

## Requisitos

- Node.js >= 20.9
- pnpm >= 10
- PostgreSQL >= 13

## Início rápido

```bash
pnpm install
cp .env.example .env          # edite DATABASE_URL, JWT_SECRET e o admin de bootstrap
pnpm db:migrate               # cria as tabelas
pnpm dev                      # sobe apps/api em http://localhost:3000
```

Fluxo mínimo com `curl`:

```bash
BASE=http://localhost:3000

# 1) login com o admin de bootstrap -> access token (JWT)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"sua-senha"}' | jq -r .accessToken)

# 2) criar uma API key (mostrada uma única vez)
KEY=$(curl -s -X POST $BASE/auth/api-keys \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"app"}' | jq -r .key)

# 3) criar uma sessão (engine: baileys | zapo)
SID=$(curl -s -X POST $BASE/sessions \
  -H "x-api-key: $KEY" -H 'content-type: application/json' \
  -d '{"name":"main","engine":"baileys"}' | jq -r .id)

# 4) acompanhar QR/status em tempo real (SSE) e escanear no app
curl -N $BASE/sessions/$SID/events -H "x-api-key: $KEY"

# 5) enviar mensagem
curl -X POST $BASE/sessions/$SID/messages \
  -H "x-api-key: $KEY" -H 'content-type: application/json' \
  -d '{"to":"5511999999999@s.whatsapp.net","content":{"type":"text","text":"olá"}}'
```

## Configuração

Todas as variáveis são validadas no boot (falha rápido se faltar/for inválida).

| Variável                   | Default            | Descrição                                      |
| -------------------------- | ------------------ | ---------------------------------------------- |
| `NODE_ENV`                 | `development`      | `development` ativa logs bonitos (pino-pretty) |
| `HOST` / `PORT`            | `0.0.0.0` / `3000` | Bind do servidor                               |
| `LOG_LEVEL`                | `info`             | `fatal`..`trace`/`silent`                      |
| `DATABASE_URL`             | —                  | **Obrigatório**. String de conexão Postgres    |
| `JWT_SECRET`               | —                  | **Obrigatório** (>= 32 chars)                  |
| `JWT_ACCESS_TTL`           | `900`              | TTL do access token (s)                        |
| `JWT_REFRESH_TTL`          | `2592000`          | TTL do refresh token (s)                       |
| `CORS_ORIGINS`             | `*`                | `*` ou lista separada por vírgula              |
| `RATE_LIMIT_MAX`           | `300`              | Requests por janela                            |
| `RATE_LIMIT_WINDOW`        | `1 minute`         | Janela do rate-limit                           |
| `BODY_LIMIT`               | `10485760`         | Tamanho máx. do body (bytes)                   |
| `WA_TABLE_PREFIX`          | `wa_`              | Prefixo das tabelas do store do zapo           |
| `WEBHOOK_TIMEOUT_MS`       | `10000`            | Timeout de entrega de webhook                  |
| `WEBHOOK_MAX_RETRIES`      | `5`                | Retentativas com backoff                       |
| `BOOTSTRAP_ADMIN_EMAIL`    | —                  | Se setado, cria tenant + admin no boot         |
| `BOOTSTRAP_ADMIN_PASSWORD` | —                  | Senha do admin de bootstrap (>= 8)             |
| `BOOTSTRAP_TENANT_NAME`    | `default`          | Nome do tenant de bootstrap                    |

## Autenticação

Dois esquemas, escolhidos por header:

- **API Key** (server-to-server): `x-api-key: <prefix>.<secret>`. Criada via
  `POST /auth/api-keys`; o segredo é mostrado **uma única vez** e armazenado só como hash.
- **JWT** (usuário/painel): `Authorization: Bearer <accessToken>`. Obtido em
  `POST /auth/login`; renovado em `POST /auth/refresh` (refresh token rotativo).

A gestão de API keys (`/auth/api-keys`) exige JWT. As demais rotas aceitam API Key **ou** JWT.

## Referência da API

| Método & rota                   | Auth | Descrição                            |
| ------------------------------- | :--: | ------------------------------------ |
| `POST /auth/login`              |  —   | Login → access + refresh token       |
| `POST /auth/refresh`            |  —   | Rotaciona o refresh token            |
| `POST /auth/api-keys`           | JWT  | Cria API key (segredo retornado 1x)  |
| `GET /auth/api-keys`            | JWT  | Lista API keys                       |
| `DELETE /auth/api-keys/:id`     | JWT  | Revoga API key                       |
| `POST /sessions`                | sim  | Cria e inicia uma sessão             |
| `GET /sessions`                 | sim  | Lista sessões do tenant              |
| `GET /sessions/:id`             | sim  | Detalhe da sessão                    |
| `GET /sessions/:id/qr`          | sim  | QR atual (string + data URL PNG)     |
| `GET /sessions/:id/events`      | sim  | Stream de eventos (SSE)              |
| `POST /sessions/:id/connect`    | sim  | Conecta/retoma a sessão              |
| `POST /sessions/:id/disconnect` | sim  | Desconecta (mantém credenciais)      |
| `POST /sessions/:id/logout`     | sim  | Logout (apaga credenciais)           |
| `POST /sessions/:id/migrate`    | sim  | Migra de engine sem re-parear        |
| `DELETE /sessions/:id`          | sim  | Remove a sessão                      |
| `POST /sessions/:id/messages`   | sim  | Envia mensagem normalizada           |
| `POST /webhooks`                | sim  | Registra webhook                     |
| `GET /webhooks`                 | sim  | Lista webhooks                       |
| `DELETE /webhooks/:id`          | sim  | Remove webhook                       |
| `GET /health` · `GET /ready`    |  —   | Liveness / readiness (checa o banco) |

**Documentação interativa**: Swagger UI em **`GET /docs`** e OpenAPI 3 em
**`GET /docs/json`** — gerados dos mesmos schemas zod (request, params, respostas de
sucesso e de erro com exemplos por status, security por rota). Sempre em sincronia.

## Tipos de mensagem

O corpo de `POST /sessions/:id/messages` é `{ to, content }`, onde `content` é um
union normalizado e **independente de engine** (`content.type`). `media` aceita
`{ url }` ou `{ base64 }`. O servidor traduz para o payload nativo da engine ativa.

| `type`     | Campos                                        |
| ---------- | --------------------------------------------- |
| `text`     | `text`                                        |
| `image`    | `media`, `caption?`                           |
| `video`    | `media`, `caption?`                           |
| `audio`    | `media`, `voice?` (nota de voz / PTT)         |
| `document` | `media`, `filename?`, `mimetype?`, `caption?` |
| `sticker`  | `media`                                       |
| `location` | `latitude`, `longitude`, `name?`, `address?`  |
| `contact`  | `fullName`, `phone`                           |

```json
{
  "to": "5511999999999@s.whatsapp.net",
  "content": { "type": "image", "media": { "url": "https://.../foto.jpg" }, "caption": "olá" }
}
```

No Swagger UI há um seletor de exemplo por tipo no "Example Value".

## Grupos

Operações de grupo **normalizadas** (payload e resposta iguais nas duas engines — o
cliente troca de engine sem mudar a integração). Todas sob `/sessions/:id/groups`:

| Método & rota                                      | Descrição                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `POST /sessions/:id/groups`                        | Criar grupo `{ subject, participants? }` → metadata             |
| `GET /sessions/:id/groups/:groupId`                | Metadata do grupo                                               |
| `PATCH /sessions/:id/groups/:groupId/subject`      | Alterar nome `{ subject }`                                      |
| `PATCH /sessions/:id/groups/:groupId/description`  | Alterar descrição `{ description }`                             |
| `POST /sessions/:id/groups/:groupId/participants`  | `{ action: add\|remove\|promote\|demote, participants }`        |
| `PATCH /sessions/:id/groups/:groupId/settings`     | `{ setting: announcement\|not_announcement\|locked\|unlocked }` |
| `GET /sessions/:id/groups/:groupId/invite`         | Código de convite                                               |
| `POST /sessions/:id/groups/:groupId/invite/revoke` | Revoga e gera novo código                                       |
| `GET /sessions/:id/groups/invite/:code`            | Preview do grupo via convite                                    |
| `POST /sessions/:id/groups/join`                   | Entrar via convite `{ invite }` → `{ id }`                      |
| `POST /sessions/:id/groups/:groupId/leave`         | Sair do grupo                                                   |

`participants` aceita número puro (`556195514650`) ou jid. Operações exigem sessão
conectada (senão `409`).

```ts
const g = await wa.groups.create(s.id, { subject: 'Equipe', participants: ['5511...'] })
await wa.groups.promote(s.id, g.id, ['5511...'])
await wa.groups.updateSettings(s.id, g.id, 'announcement')
const { code } = await wa.groups.inviteCode(s.id, g.id)
```

## Eventos & Webhooks

As engines emitem eventos normalizados, entregues por **SSE**
(`GET /sessions/:id/events`) e por **webhooks**:

```ts
{ type: 'qr', qr: string }
{ type: 'status', status: 'connecting' | 'qr' | 'connected' | 'disconnected' | 'logged_out', meJid?: string }
{ type: 'message', id?: string, chat: string, from: string, fromMe: boolean, text?: string, timestamp?: number }
```

Webhooks são entregues via `POST` (undici, keep-alive, retry com backoff) com:

- `X-Signature: sha256=<hmac>` — HMAC-SHA256 do corpo cru usando o `secret` do webhook
- `X-Event-Type`, `X-Session-Id`
- corpo: `{ "sessionId": "...", "event": { ... } }`

Verificação (Node):

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(rawBody: string, header: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return (
    header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  )
}
```

## SDK

`@multi-wa/sdk` é um cliente tipado que esconde HTTP e payload (os tipos vêm de
`@multi-wa/types`, então o autocomplete é completo):

```ts
import { createClient } from '@multi-wa/sdk'

const wa = createClient({ baseUrl: 'http://localhost:3000', apiKey })

const s = await wa.sessions.create({ name: 'main', engine: 'baileys' })

for await (const e of wa.sessions.events(s.id)) {
  if (e.type === 'qr') console.log('escaneie:', e.qr)
  if (e.type === 'status' && e.status === 'connected') break
}

await wa.messages.sendText(s.id, '5511999999999@s.whatsapp.net', 'olá')
await wa.messages.sendImage(s.id, '5511999999999@s.whatsapp.net', { url: 'https://...' }, 'legenda')
await wa.messages.sendLocation(s.id, '5511999999999@s.whatsapp.net', -23.55, -46.63, 'SP')

await wa.sessions.migrate(s.id, 'zapo') // troca de engine sem re-parear
```

Também aceita `accessToken` em vez de `apiKey`. Erros viram `WaApiError` (`status` + `message`).

## Migração entre engines

`POST /sessions/:id/migrate { "to": "zapo" | "baileys" }` converte o auth via
`wa-store-migrate` (IR canônico) e reconecta na engine alvo — **sem novo QR**.

- **baileys → zapo**: migra credenciais + estado Signal completo (preKeys, sessions,
  identities, sender keys, app-state).
- **zapo → baileys**: migra credenciais + app-state. O estado Signal é re-handshakeado
  de forma transparente (a chave de identidade é preservada, então **não** dispara
  "código de segurança alterado" nos contatos).

## Logs

Em `development` os logs saem no formato `[engine] <sessionId> mensagem`, com dados da
instância nos eventos de ciclo de vida:

```
[12:00:01.123] INFO: [baileys] 1f2e... starting engine
[12:00:02.456] INFO: [baileys] 1f2e... qr code generated, awaiting scan
[12:00:09.789] INFO: [zapo] 1f2e... connected
    meJid: "5511999999999:34@s.whatsapp.net"
```

Em produção os logs são JSON estruturados (campos `engine`/`session`), prontos para
agregação. O servidor faz **shutdown gracioso** em `SIGINT`/`SIGTERM` (fecha HTTP,
encerra engines e o pool, com force-exit por timeout para nunca prender a porta).

## Scripts

```bash
pnpm dev          # sobe apps/api em watch (tsx)
pnpm build        # turbo: build de todos os pacotes (tsup)
pnpm start        # roda o build de produção (node apps/api/dist)
pnpm typecheck    # tsc --noEmit em todos os pacotes
pnpm lint         # eslint
pnpm test         # vitest (unidade + integração)
pnpm db:migrate   # aplica migrations
pnpm format       # prettier --write .
```

## Testes

A suíte cobre schemas (zod), crypto, tradução de mensagens nas duas engines,
`SessionManager` / `SessionService` / `MessagingService` / `MigrationService`,
dispatcher de webhooks (HMAC, servidor HTTP real), `AuthService`, o SDK (servidor HTTP
real + parsing de SSE), as rotas da API (`fastify.inject`) e um round-trip real de
migração `baileys ↔ zapo` via `wa-store-migrate`.

Testes de integração com Postgres (repositórios + auth contra um banco real) rodam
apenas quando `TEST_DATABASE_URL` está definido — caso contrário são pulados:

```bash
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/multi_wa_test \
  pnpm --filter @multi-wa/core test
```

O schema é migrado automaticamente no banco de teste.

## Produção

```bash
pnpm build
NODE_ENV=production pnpm db:migrate
NODE_ENV=production pnpm start
```

As sessões conectadas são **retomadas automaticamente** no boot. Sockets de WhatsApp
são stateful por sessão: ao rodar múltiplas instâncias, use roteamento sticky por
`sessionId` (afinidade de instância). v1 é single-process.

## Licença

**[The Unlicense](LICENSE)** — domínio público. É **100% livre, sem limite, sem trava**:
use, copie, modifique, venda, redistribua, feche o código, faça o que quiser, para
qualquer fim (comercial ou não), **sem pedir permissão e sem precisar dar crédito**.
Casa da mãe Joana. O software é fornecido "como está", sem garantias.

## Disclaimer

Projeto independente para fins de engenharia e interoperabilidade. Não é afiliado nem
endossado pelo WhatsApp.
