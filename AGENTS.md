# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
AEON Marketing Command Center / Control Room — a Next.js 14 (App Router) + TypeScript web app
backed by PostgreSQL via Prisma, with NextAuth (credentials + JWT). It is the authoritative
policy/audit plane in front of n8n for content approvals.

### Services (dev)
- Next.js app — `npm run dev`, http://localhost:3000. Standard commands live in `package.json`.
- PostgreSQL 16 — required. Start with `sudo pg_ctlcluster 16 main start` if not running.

### Foundation migrations (important)
The repo now uses Prisma Migrate. A baseline migration is marked applied in environments that
previously used `db push`. The **`control_room_foundation` migration is generated for review and
must be applied by a human** (`npx prisma migrate deploy`) before exercising:

- Immutable revisions (`ContentRevision`)
- n8n draft ingress / publish-receipt
- Transactional approvals + outbox resume delivery

After applying the foundation migration:

```bash
npx tsx scripts/seed-guardian-rules.ts
```

Also create an active `SERVICE` role user before calling `/api/integrations/n8n/drafts`.

Do **not** run `db push` against the foundation schema in agent sessions unless explicitly asked —
prefer migrate deploy. `prisma generate` after schema pulls is fine (does not apply SQL).

### Auth / signup
- Public signup is gated by `ALLOW_PUBLIC_SIGNUP`. When unset/false, only ADMIN (`settings.manage`)
  can create users (invite-style). Public signup, when enabled, always creates `VIEWER`.
- Approve / reject / request-revision require `content.approve` (ADMIN, MANAGER, REVIEWER).
- SERVICE accounts cannot human-approve.

### n8n bridge
Contract reference: [docs/n8n-bridge.md](docs/n8n-bridge.md). Required env vars:
`N8N_INGRESS_SECRET`, `N8N_RESUME_SECRET`, `N8N_BRIDGE_ENCRYPTION_KEY`, `CRON_SECRET`.

Outbox drain: `GET/POST /api/cron/outbox-drain` with `Authorization: Bearer $CRON_SECRET`.
Vercel cron in `vercel.json` is daily (Hobby limit).

### Lint / test / build
- Lint: `npm run lint` (needs `.eslintrc.json` extending `next/core-web-vitals`).
- Tests: `npm test` — repo may have zero test files (Jest exits non-zero).
- Build: `npm run build`.

### Known-broken / unimplemented
- `npm run db:seed` / `npm run agents:start` still point at missing files unless added later.
- UI wiring for queue/dashboard React Query, Pusher, assets, AgentRun telemetry, etc. is backlog.
