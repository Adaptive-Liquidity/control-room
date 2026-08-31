# Cutover & acceptance checklist (gates 1–24)

Use this before promoting staging → production. Mark each gate only with evidence (test output, Audit row, or screenshot). Do **not** weaken HMAC/RBAC, put resume URLs in the browser/Pusher/logs, or set `PUBLISHED` except via publish receipt.

Related contracts: [n8n-bridge.md](./n8n-bridge.md).

---

## Preflight commands (no live n8n/Pusher required)

```bash
# Schema (always migrate deploy — never db push in staging/prod)
npx prisma migrate deploy
npm run db:seed-guardian              # idempotent Guardian catalog upsert

# Staging/prod first admin (env-driven; never use ensure-dev-users here)
BOOTSTRAP_ADMIN_EMAIL=ops@example.com \
BOOTSTRAP_ADMIN_PASSWORD='...' \
BOOTSTRAP_ADMIN_NAME='Ops Admin' \
npm run db:bootstrap-admin
# Then invite a SERVICE user in-app for n8n draft attribution.

# Local E2E only (hardcoded @aeon.test accounts — do not run on staging/prod):
# npm run db:ensure-dev-users

npm test
npm run typecheck                     # tsc --noEmit
npm run build

# Authz E2E (seeded VIEWER/EDITOR/REVIEWER — local after ensure-dev-users)
set E2E_WITH_AUTH=1                   # PowerShell: $env:E2E_WITH_AUTH=1
npm run test:e2e

# Full lifecycle against live n8n Wait (optional; skip if n8n unavailable)
set E2E_FULL_LIFECYCLE=1
npm run test:e2e
```

Manual outbox drain:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXTAUTH_URL/api/cron/outbox-drain"
```

n8n security audit (on the n8n host; skip only if instance unreachable, then block prod until done):

```bash
n8n audit
```

---

## Acceptance gates

| # | Gate | How to verify |
|---|---|---|
| 1 | Duplicate n8n webhook produces exactly one draft | Resend same `externalDraftId` → `200` idempotent; one `Content` row |
| 2 | `n8nExecutionId` may be shared by multiple content objects | Two drafts, same execution id, distinct `externalDraftId` |
| 3 | Resume URL never reaches browser / Pusher / logs | Content APIs + Pusher payloads IDs-only; no `resumeUrl` in responses |
| 4 | Every n8n resume endpoint is authenticated | Resume uses `N8N_RESUME_SECRET` HMAC; unsigned rejected |
| 5 | Human approval refers to an immutable revision | `Approval.revisionId` set; body/hash frozen on revision |
| 6 | Any edit after approval invalidates that approval path | New revision → must re-approve current id |
| 7 | Guardian reruns on every content-changing revision | New revision has score/result/policyVersion |
| 8 | Critical Guardian failure cannot be overridden by score | CRITICAL+BLOCK → `422` on approve-with-edits |
| 9 | Only authorized roles can approve | VIEWER/EDITOR → `403`; REVIEWER/MANAGER/ADMIN ok |
| 10 | Public signup cannot create privileged production accounts | `ALLOW_PUBLIC_SIGNUP` false or signup → VIEWER only |
| 11 | n8n outage cannot lose approval decisions | Approve while n8n down → `Approval` + outbox `PENDING`/`RETRY` |
| 12 | Failed callbacks remain visible and retryable | Outbox `FAILED`/`RETRY` visible; drain retries |
| 13 | Pusher failure does not break the application | Unset Pusher env; Queue/Dashboard still poll |
| 14 | Asset uploads require authenticated signed authorization | Upload-url requires session + `content.edit`; no direct Firebase Auth upload |
| 15 | Approval does not falsely equal publication | After approve, status `APPROVED` not `PUBLISHED` |
| 16 | Only a publish receipt marks a post published | Receipt SUCCESS → `PUBLISHED`; no other code path |
| 17 | Agent cards display real execution data | Agents page from `AgentRun` / `/api/agents`. **Evidence path:** `npm run db:seed-agents` on target DB (all five names: `creator`, `publisher`, `analyzer`, `guardian`, `researcher`); run MKT workflow so Creator/Publisher emit `AgentRun` rows. **Pass criteria:** Creator/Publisher cards show recent runs and 24h stats; `analyzer`, `guardian`, and `researcher` may remain OFFLINE with 0 runs until those workflow stages emit telemetry. |
| 18 | Integration cards display real health | Settings from `/api/integrations/health` (no secrets) |
| 19 | Analytics pages display real stored observations | Analytics/Attribution from snapshots/events — use published **MKT-06** stub or real platform pulls |
| 20 | Tests exercise full draft → approval → publish lifecycle | **Jest** (`npm test`) covers API lifecycle (draft ingress, approval, outbox, publish receipt) without live n8n Wait. **Full gate evidence** requires staging E2E with `E2E_FULL_LIFECYCLE=1` (live Wait resume + outbox drain + publish receipt). Do **not** mark gate 20 done from sign-in-only or authz-only E2E (`E2E_WITH_AUTH=1` alone). |
| 21 | `npm run build` passes | CI / local build green |
| 22 | TypeScript passes without `as any` escape hatches in new bridge code | `npm run typecheck`; review n8n/lib contracts |
| 23 | Prisma migration is committed and reproducible | `prisma migrate deploy` on fresh DB |
| 24 | Production deployment uses migration deployment, not ad-hoc `db push` | Deploy scripts / docs use `migrate deploy` only |

---

## Remaining manual cutover steps

These require live infrastructure and are **not** automated in this repo alone:

1. Provision staging/prod Postgres; set all Control Room env vars from [.env.example](../.env.example) / [env matrix](./n8n-bridge.md#env-matrix).
2. Run `npx prisma migrate deploy` + `npm run db:seed-guardian` + `npm run db:seed-agents` on the target DB.
3. Bootstrap the first ADMIN with `npm run db:bootstrap-admin` (`BOOTSTRAP_ADMIN_*` env). Invite remaining users (including `SERVICE` for n8n) via ADMIN — do **not** run `ensure-dev-users` or use public signup for privileged roles.
4. Import or sync n8n workflows from [`n8n/workflows/`](../n8n/workflows/) (MKT-03/04/05 + MKT-06); attach Ingress HMAC + OpenAI credentials per [n8n-bridge.md](./n8n-bridge.md).
5. Point n8n Config Base URL at staging/prod Control Room; share `N8N_INGRESS_SECRET` / `N8N_RESUME_SECRET` (separate secrets).
6. Run `n8n audit` and remediate unprotected webhooks / unused credentials.
7. **Outbox cadence:** Vercel Hobby cron in `vercel.json` is daily (`0 0 * * *`). For production resume latency, schedule an **external** cron every **1–5 minutes** hitting `POST /api/cron/outbox-drain` with `Authorization: Bearer $CRON_SECRET`.
8. Optional: configure Pusher + Firebase Admin for realtime + assets (app works without them).
9. Execute staging E2E with `E2E_FULL_LIFECYCLE=1` against real Wait + publish receipt (do not mark gate 20 done until this passes).
10. Walk gates 1–24 with a second reviewer; then cut DNS / traffic.
11. Re-import n8n workflows so Config includes `projectId` (default `proj_aeon`). Confirm policy-check returns a `contextPack` / `composedHash` and Settings → Brand Voice can publish a new pack version.

### Ops evidence log (fill as you go)

| Item | Status | Notes |
|---|---|---|
| Gate 17 — agents seeded + AgentRuns visible | Ready to verify | Seed all five agents; Creator/Publisher runs from MKT-09; analyzer/guardian/researcher may show OFFLINE/0 until those stages emit |
| n8n audit | Pending | Run on n8n Cloud / host |
| `E2E_FULL_LIFECYCLE=1` | Pending | Needs Wait resume + frequent outbox drain |
| Outbox sub-daily cron | Pending | External scheduler recommended (Hobby daily is insufficient) |
| MKT workflow published | Done (2026-08-18) | `Mr2NsTTTVKvuGZKa` + `2lYDNN28W8gMrGtC`; mock publisher still in use |
| Agent HQ packs + projectId | Ready to verify | Re-import workflows so Config has `projectId=proj_aeon`; Settings → Brand Voice publishes a pack; policy-check returns `composedHash` |
