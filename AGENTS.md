# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
AEON Marketing Command Center — a single Next.js 14 (App Router) + TypeScript web app backed by
PostgreSQL via Prisma, with NextAuth (credentials + JWT) auth. It is the whole product; there is no
separate backend service.

### Services (dev)
- Next.js app — `npm run dev`, http://localhost:3000. Standard commands live in `package.json`.
- PostgreSQL 16 — required by every API route / server action (Prisma). Listens on `localhost:5432`.

### Starting the environment (do this at the start of a session)
PostgreSQL is installed in the environment and the `aeon_marketing` database (role `aeon` / password
`aeon`, schema already pushed) persists on disk, but the server process is NOT auto-started on VM
boot. Start it before running the app or any DB command:

```
sudo pg_ctlcluster 16 main start
```

`.env` is git-ignored and must exist for the app to boot. It persists in the environment snapshot; if
it is ever missing, recreate it with a real `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`):

```
DATABASE_URL="postgresql://aeon:aeon@localhost:5432/aeon_marketing?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<random secret>"
```

If you change `prisma/schema.prisma`, sync the DB with `npm run db:push` (there is no `migrations/`
folder — this project uses `db push`, not migrations). Inspect data with `npm run db:studio` (Prisma
Studio, port 5555).

### Testing / linting / build gotchas
- Lint: `npm run lint`. Requires `.eslintrc.json` (extends `next/core-web-vitals`). Without it,
  `next lint` drops into an interactive setup prompt and blocks.
- Tests: `npm test` runs Jest, but the repo currently contains no test files, so it exits non-zero
  with "No tests found". Use `npx jest --passWithNoTests` if you need a clean exit in CI-style checks.
- Build: `npm run build` succeeds; the `DYNAMIC_SERVER_USAGE` notes for `/api/*` routes are expected
  (they read `headers`) and are not errors.

### Known-broken / unimplemented (do not rely on these)
- `npm run db:seed` points at `scripts/seed.ts` and `npm run agents:start` points at
  `src/services/agent-runner.ts`; neither file exists, so both fail. There is no seed data — create
  accounts/content through the app or the API.
- Many dependencies (Redis/BullMQ, Pusher, OpenAI/Anthropic, Twitter/LinkedIn/Discord/Mailchimp/
  Resend, Firebase admin) are declared in `package.json` but not wired into `src/`. None are needed to
  run or test the app; their env vars in `.env.example` are optional.

### Auth notes for manual/API testing
There is no seeded user. Create one via `POST /api/auth/signup` with `{ email, password (>=8 chars),
name }`, then sign in at `/auth/signin`. Most API routes (`/api/content`, `/api/guardian/check`,
`/api/dashboard/stats`, `/api/queue`, ...) require an authenticated NextAuth session and return 401
otherwise, so exercise them through the browser or with session cookies.
