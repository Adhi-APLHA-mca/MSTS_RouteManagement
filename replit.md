# MSTS Client Dashboard

A route and buyer management dashboard for MSTS operations — tracks transport routes, manages buyer assignments, and sends welcome emails via Gmail/Grok AI.

## Run & Operate

Two workflows run the app (both configured in Replit):

- **Dashboard** — `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/msts-dashboard run dev` (port 3000, webview)
- **API Server** — `PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080, console)

The Vite dev server proxies `/api` → `localhost:8080`, so both services work from one preview URL.

Other useful commands:
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required secrets / env vars

| Key | Where to get it | Notes |
|-----|-----------------|-------|
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Project Settings → Service Accounts | Service account email |
| `FIREBASE_PRIVATE_KEY` | Same service account JSON | Include `-----BEGIN PRIVATE KEY-----` header |
| `SMTP_USER` | Gmail address | Same as `SMTP_FROM` (teamtscr.aba@gmail.com) |
| `SMTP_PASS` | Gmail App Password | Requires 2FA enabled on the account |
| `GROK_API_KEY` | [x.ai console](https://console.x.ai) | Used for AI-generated welcome emails only; app starts without it |
| `DATABASE_URL` | Auto-provisioned by Replit | Postgres connection string — do not set manually |

Non-secret env vars already set in `.replit` (`FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
