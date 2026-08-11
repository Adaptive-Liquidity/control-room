# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
AEON Marketing Command Center / Control Room — a Next.js 14 (App Router) + TypeScript web app
backed by PostgreSQL via Prisma, with NextAuth (credentials + JWT). It is the authoritative
policy/audit plane in front of n8n for content approvals.

### Services (dev)
- Next.js app — `npm run dev`, http://localhost:3000. Standard commands live in `package.json`.
- PostgreSQL 16 — required.
- Cursor Cloud boot: `.cursor/environment.json` runs `scripts/dev-env-start.sh` on start (Postgres,
  `.env` bootstrap, `prisma migrate deploy`, guardian seed, ensure-dev-users) and starts the
  Next.js terminal. If Postgres is not running manually: `sudo pg_ctlcluster 16 main start`.

### Foundation migrations
Use Prisma Migrate (`npx prisma migrate deploy` / `npm run db:migrate`), **not** `db push`.
`npm run db:push` is deprecated and exits non-zero. Cloud start script applies migrations
automatically. After a fresh DB:

```bash
npx prisma migrate deploy
npm run db:seed-guardian
npx tsx scripts/ensure-dev-users.ts
```

Staging/prod (no hardcoded users): after migrate + `npm run db:seed-guardian`, run
`npm run db:bootstrap-admin` with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
(optional `BOOTSTRAP_ADMIN_NAME`), then invite a `SERVICE` user in-app for n8n drafts.

Dev users created by `ensure-dev-users` (local/cloud only):
- `admin@aeon.test` / `AeonAdmin123!` (ADMIN)
- `reviewer@aeon.test` / `AeonReview123!` (REVIEWER)
- `editor@aeon.test` / `AeonEditor123!` (EDITOR — E2E authz)
- `viewer@aeon.test` / `AeonViewer123!` (VIEWER — E2E authz)
- `service@aeon.test` / `AeonService123!` (SERVICE — required for n8n draft ingress)

`prisma generate` after schema pulls is fine (does not apply SQL).

### Auth / signup
- Public signup is gated by `ALLOW_PUBLIC_SIGNUP`. When unset/false, only ADMIN (`settings.manage`)
  can create users (invite-style). Public signup, when enabled, always creates `VIEWER`.
- Approve / reject / request-revision require `content.approve` (ADMIN, MANAGER, REVIEWER).
- SERVICE accounts cannot human-approve.

### n8n bridge
Contract + MKT-03/04/05 templates + recovery: [docs/n8n-bridge.md](docs/n8n-bridge.md).
Cutover/acceptance gates 1–24: [docs/cutover-checklist.md](docs/cutover-checklist.md).

Required env vars: `N8N_INGRESS_SECRET`, `N8N_RESUME_SECRET`, `N8N_BRIDGE_ENCRYPTION_KEY`,
`CRON_SECRET`. Platform/LLM keys stay in n8n.

Outbox drain: `GET/POST /api/cron/outbox-drain` with `Authorization: Bearer $CRON_SECRET`.
Vercel cron in `vercel.json` is daily (Hobby limit).

### Lint / test / build
- Lint: `npm run lint` (needs `.eslintrc.json` extending `next/core-web-vitals`).
- Unit/API: `npm test`.
- Typecheck: `npm run typecheck` (`tsc --noEmit`).
- Build: `npm run build`.
- E2E: `npm run test:e2e` — set `E2E_WITH_AUTH=1` after seeding users; set
  `E2E_FULL_LIFECYCLE=1` only when staging n8n Wait is available.

### Deprecated scripts
- `npm run db:push` / `npm run db:seed` / `npm run agents:start` exit with guidance
  (migrate deploy + guardian/ensure-dev-users; agents run in n8n).
