# PastoFlux

MVP de gestão de pastagens, rebanho e agenda de manejo, com persistência em
Cloudflare D1/Drizzle e módulo de ofertas de aluguel por cabeça de gado.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

Cloudflare deployment is configured in `wrangler.jsonc`, with the production
D1 database bound as `DB`.

## Funcionalidades entregues

- Cadastro persistente de fazendas e áreas/piquetes.
- Rebanho, lotes, movimentações e medições de pastagem.
- Agenda de manejo com alertas de capacidade e recuperação.
- Simulador demonstrativo de remanejamento.
- Sprint 4: publicação, edição, encerramento, filtros e solicitação protegida
  de contato em ofertas de aluguel.
- Controle de acesso por usuário/fazenda, perfis de leitura/escrita e auditoria.

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Desenvolvimento e validação

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build e testes automatizados de domínio e renderização
- `npm run lint`: validação estática
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Cloudflare / D1

The production database is the D1 database configured in `wrangler.jsonc`.
From a new machine, install dependencies and authenticate Wrangler with the
Cloudflare account that owns the Worker:

```bash
npm install
npx wrangler login
```

Apply pending migrations to the remote database:

```bash
npx wrangler d1 migrations apply pastoflux-production --remote
```

Build and deploy the Worker:

```bash
npm run build
npx wrangler deploy
```

The production URL is:
`https://pastoflux.lucas-zapedus.workers.dev`

Antes da apresentação, confirme também que as migrações remotas foram aplicadas,
que o login/identidade do ambiente está ativo e que existe uma fazenda de
demonstração com áreas, animais, alertas e uma oferta publicada.

Never commit API tokens, passwords or `.env` files. The D1 `database_id` in
`wrangler.jsonc` identifies the database but is not an authentication secret.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
