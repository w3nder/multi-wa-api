# multi-wa-api

API REST segura e modular para controlar sessões de WhatsApp com **duas engines
intercambiáveis** — [`zapo-js`](https://github.com/vinikjkkj/zapo) e
[`baileys`](https://github.com/WhiskeySockets/Baileys) — sobre um único PostgreSQL.
Uma sessão pode **migrar de engine sem re-parear** via
[`wa-store-migrate`](https://github.com/vinikjkkj/wa-store-migrate).

## Destaques

- Engine selecionável por sessão (`zapo` ou `baileys`) e migração entre elas.
- Postgres como única fonte de verdade para auth/estado das duas engines.
- Zero-payload: o consumidor nunca monta objetos do baileys/zapo; usa `@multi-wa/sdk`.
- Segurança: API Key + JWT, helmet, rate-limit, CORS, webhooks assinados (HMAC).
- Monorepo pnpm + turbo, TypeScript estrito, alta performance (Fastify, engines quentes).

## Pacotes

| Pacote | Papel |
| --- | --- |
| `@multi-wa/types` | Schemas zod + tipos compartilhados (fonte única de verdade) |
| `@multi-wa/config` | Validação de ambiente |
| `@multi-wa/db` | Pool pg, runner de migrations, schema |
| `@multi-wa/core` | Domínio engine-agnóstico: sessões, mensagens, migração, webhooks, auth |
| `@multi-wa/engine-baileys` | Engine baileys + auth-state em Postgres |
| `@multi-wa/engine-zapo` | Engine zapo + store Postgres |
| `@multi-wa/sdk` | Cliente HTTP tipado (zero-payload) |
| `@multi-wa/api` | Servidor Fastify (runnable) |

## Setup

```bash
pnpm install
cp .env.example .env   # edite DATABASE_URL e JWT_SECRET
pnpm db:migrate
pnpm dev               # sobe apps/api
```

Variáveis principais (ver `.env.example`): `DATABASE_URL`, `JWT_SECRET` (>=32 chars),
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (cria tenant+admin no boot).

## Endpoints

- `POST /auth/login`, `POST /auth/refresh`, `POST|GET|DELETE /auth/api-keys`
- `POST|GET /sessions`, `GET /sessions/:id`, `GET /sessions/:id/qr`,
  `GET /sessions/:id/events` (SSE), `POST /sessions/:id/{connect,disconnect,logout,migrate}`,
  `DELETE /sessions/:id`
- `POST /sessions/:id/messages` (conteúdo normalizado `MessageContent`)
- `POST|GET /webhooks`, `DELETE /webhooks/:id`
- `GET /health`, `GET /ready`

Autenticação: header `x-api-key: <prefix>.<secret>` (server-to-server) ou
`Authorization: Bearer <jwt>` (usuário/painel).

## SDK

```ts
import { createClient } from '@multi-wa/sdk'

const wa = createClient({ baseUrl: 'http://localhost:3000', apiKey })
const s = await wa.sessions.create({ name: 'main', engine: 'baileys' })
for await (const e of wa.sessions.events(s.id)) if (e.type === 'qr') console.log(e.qr)
await wa.messages.sendText(s.id, '5511999999999', 'olá')
await wa.messages.sendImage(s.id, '5511999999999', { url: 'https://...' }, 'legenda')
await wa.sessions.migrate(s.id, 'zapo') // sem re-parear
```

## Migração entre engines

`baileys → zapo` migra credenciais + estado Signal completo (preKeys, sessions,
identities, sender keys, app-state). `zapo → baileys` migra credenciais + app-state
(o estado Signal é re-handshakeado de forma transparente, sem aviso de "código de
segurança alterado", pois a chave de identidade é preservada).

## Scripts

```bash
pnpm build       # turbo: build de todos os pacotes (tsup)
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest
pnpm db:migrate  # aplica migrations
```
