# n8n ↔ Control Room bridge contracts

Stable reference for the authenticated draft ingress, resume callback, and publish-receipt flows.
Apply migrations and seed Guardian rules before exercising these endpoints:

```bash
npx prisma migrate deploy
npm run db:seed-guardian
# Staging/prod first admin (then invite a SERVICE user in-app):
BOOTSTRAP_ADMIN_EMAIL=ops@example.com BOOTSTRAP_ADMIN_PASSWORD='...' npm run db:bootstrap-admin
# Local E2E only: npm run db:ensure-dev-users
```

Create at least one active user with role `SERVICE` — draft ingestion attributes content to that account. On staging/prod, invite `SERVICE` after `db:bootstrap-admin`. Locally, `ensure-dev-users` creates `service@aeon.test`.
**Architecture invariant:** Control Room is the policy/audit plane; n8n is the execution plane. Social, LLM, email, and CRM credentials live in n8n — not in this Next.js app.

---

## Env matrix

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Control Room | PostgreSQL (Prisma) |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Control Room | Session auth |
| `ALLOW_PUBLIC_SIGNUP` | Control Room | When unset/false, only ADMIN invite-style user create |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_NAME` | Bootstrap CLI only | First ADMIN via `npm run db:bootstrap-admin` (not runtime app env) |
| `N8N_INGRESS_SECRET` | Control Room + n8n | HMAC for draft / publish-receipt / metrics / attribution / agent-runs ingress |
| `N8N_RESUME_SECRET` | Control Room + n8n | HMAC for Control Room → n8n Wait resume callbacks (**separate** from ingress) |
| `N8N_BRIDGE_ENCRYPTION_KEY` | Control Room only | AES-GCM for `N8nBridgeJob.resumeUrlEncrypted` |
| `CRON_SECRET` | Control Room + scheduler | Bearer token for `/api/cron/outbox-drain` |
| `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` | Control Room | Optional realtime; UI falls back to polling |
| `FIREBASE_ADMIN_*` / `NEXT_PUBLIC_FIREBASE_*` | Control Room | Signed asset upload URLs (GCS) |
| Platform / LLM / Mailchimp / Discord / X keys | **n8n credentials only** | Never required by Control Room |

Staging/prod cutover checklist (gates 1–24): [cutover-checklist.md](./cutover-checklist.md).

---

## Shared HMAC headers (ingress)

Used by `POST /api/integrations/n8n/drafts`, `publish-receipt`, `agent-runs`, `metrics`, `attribution`, and `policy-check`.

| Header | Value |
|---|---|
| `X-N8N-Timestamp` | Unix epoch seconds (or ms) |
| `X-N8N-Signature` | `hex(HMAC_SHA256(N8N_INGRESS_SECRET, timestamp + "." + rawBody))` — optional `sha256=` prefix |
| `Content-Type` | `application/json` |

Timestamps outside ±5 minutes are rejected. Each `eventId` may be consumed once across bridge jobs and publish receipts (except draft idempotency by `externalDraftId`, see below). Policy-check does **not** consume `eventId`.

## 0. Policy check — `POST /api/integrations/n8n/policy-check`

Read-only pre-spend gate. Same ingress HMAC. Does not create content or burn `eventId`.

### Request body

```json
{
  "schemaVersion": "1",
  "campaignId": "optional_campaign_cuid"
}
```

Omit `campaignId` (or leave unset) for an unscoped allow response — useful for smoke tests. When `campaignId` is set, Control Room evaluates campaign `emergencyStopped` / `autoGenDisabled` / pause / `dailyContentLimit`.

### Response (`200`)

```json
{
  "allowed": true,
  "reason": null,
  "remainingContentToday": 12,
  "remainingPublishToday": 5,
  "requireHuman": true
}
```

`remainingContentToday` / `remainingPublishToday` are `null` when the campaign has no limit, or for the unscoped response.

- `allowed: false` → n8n must stop before LLM spend (fail closed).
- `404` → unknown campaign.
- Draft ingress **also** enforces the same campaign rules independently (409) so a skipped policy-check cannot bypass kill switches.

## 1. Draft ingress — `POST /api/integrations/n8n/drafts`

Creates `Content(origin=N8N)` + first `ContentRevision` (Guardian V2 evaluated) + `N8nBridgeJob` with an encrypted resume URL. The resume URL is **never** returned by content APIs, Pusher, or logs.

### Request body

```json
{
  "schemaVersion": "1",
  "eventId": "evt_unique_per_delivery",
  "externalDraftId": "draft_stable_id",
  "workflowId": "wf_...",
  "executionId": "exec_...",
  "resumeUrl": "https://n8n.example/webhook-waiting/...",
  "resumeExpiresAt": "2026-08-10T12:00:00.000Z",
  "campaignId": "optional_campaign_cuid",
  "content": {
    "title": "Thread title",
    "body": "Draft body...",
    "type": "TWITTER_THREAD",
    "channel": "TWITTER"
  },
  "metadata": {}
}
```

### Responses

- `201` — created `{ contentId, revisionId, status, guardianScore, guardianResult, idempotent: false }`
- `200` — same `externalDraftId` already exists `{ contentId, revisionId, status, guardianScore, idempotent: true }`
- `401` — bad/missing HMAC
- `400` — validation
- `503` — no active `SERVICE` user

## 2. Resume delivery (Control Room → n8n)

After a human decision, Control Room enqueues `OutboxEvent(type=N8N_RESUME_REQUESTED)` and POSTs to the stored resume URL.

### Auth

| Header | Value |
|---|---|
| `X-N8N-Timestamp` | Unix epoch seconds |
| `X-N8N-Signature` | `hex(HMAC_SHA256(N8N_RESUME_SECRET, timestamp + "." + rawBody))` |

`N8N_RESUME_SECRET` is **separate** from the ingress secret.

### Body

```json
{
  "schemaVersion": "1",
  "decision": "APPROVED",
  "contentId": "clx...",
  "revisionId": "clx...",
  "contentHash": "sha256hex",
  "title": "...",
  "body": "...",
  "channel": "TWITTER",
  "guardian": { "policyVersion": "2026-08-09.1", "score": 67 },
  "review": {
    "reviewerId": "clx...",
    "decidedAt": "2026-08-10T12:00:00.000Z",
    "comment": "optional"
  }
}
```

`decision` ∈ `APPROVED | REJECTED | REVISION_REQUESTED`.

Retries follow outbox backoff: `0s, 15s, 1m, 5m, 15m, 1h`, then `FAILED`. Drain via:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/outbox-drain
```

`vercel.json` schedules this path daily (Hobby plan limit). Use an external scheduler for higher frequency if needed.

## 3. Publish receipt — `POST /api/integrations/n8n/publish-receipt`

**Sole** code path allowed to set `Content.status = PUBLISHED`. Same HMAC as draft ingress (`N8N_INGRESS_SECRET`).

### Request body

```json
{
  "schemaVersion": "1",
  "eventId": "evt_publish_unique",
  "contentId": "clx...",
  "revisionId": "clx...",
  "contentHash": "sha256hex_of_title_newline_body",
  "executionId": "exec_...",
  "channel": "TWITTER",
  "status": "SUCCESS",
  "platformPostId": "optional",
  "platformUrl": "https://...",
  "publishedAt": "2026-08-10T12:05:00.000Z",
  "errorCode": null,
  "errorMessage": null,
  "metadata": {}
}
```

- `status: SUCCESS` → insert `PublishReceipt` + set content `PUBLISHED`
- `status: FAILED` → insert receipt only; content stays `APPROVED` / `SCHEDULED`
- Idempotent on `eventId` (`200` with existing receipt)
- `422` if `contentHash` does not match the named revision

## Human approval API (for reference)

Requires session + `content.approve` (ADMIN / MANAGER / REVIEWER):

- `POST /api/queue/:id/approve` — `{ revisionId, comment?, edits? }`
- `POST /api/queue/:id/reject` — `{ revisionId, comment }`
- `POST /api/queue/:id/request-revision` — `{ revisionId, comment }`

Stale `revisionId` (≠ `Content.currentRevisionId`) → `409`. Edits that Guardian `BLOCK`s → `422`.

---

## Workflow templates (MKT-02 / 03 / 04 / 05 / 06 / 09)

Versioned exports (re-importable into n8n):

| Workflow | Live id | Repo path |
|---|---|---|
| Staged Agentic Marketing (MKT-02→05 + MKT-09) | [`Mr2NsTTTVKvuGZKa`](https://agentsea.app.n8n.cloud/workflow/Mr2NsTTTVKvuGZKa) | [`n8n/workflows/mkt-03-04-05.json`](../n8n/workflows/mkt-03-04-05.json) |
| Metrics / Attribution stub (MKT-06) | [`2lYDNN28W8gMrGtC`](https://agentsea.app.n8n.cloud/workflow/2lYDNN28W8gMrGtC) | [`n8n/workflows/mkt-06-metrics.json`](../n8n/workflows/mkt-06-metrics.json) |

**Secrets in n8n (never in Vercel for LLM/social):**

| Credential | Used for |
|---|---|
| Control Room - Ingress HMAC (`crypto`) | `N8N_INGRESS_SECRET` — drafts, receipts, agent-runs, metrics, attribution, policy-check |
| OpenAI account | MKT-02 Researcher (`gpt-4o-mini`), MKT-03 Creator (`gpt-4o`) |
| (optional) Header Auth / resume | Prefer Control Room signing resume with `N8N_RESUME_SECRET`; keep **separate** from ingress |

**Canonical `agentName` strings** (must match seeded `Agent.name` via `npm run db:seed-agents`):

`creator` · `publisher` · `analyzer` · `guardian` · `researcher`

### Live node map — MKT-02 → 05 + MKT-09

```text
Manual Trigger
→ Config Base URL (https://hq.adaptiveliquidity.com)
→ Build / HMAC / POST policy-check → Assert allowed
→ MKT-02 Researcher LLM (OpenAI) → Parse Research JSON
→ MKT-03 Creator LLM (OpenAI) → Parse Creator JSON
→ MKT-09 AgentRun RUNNING (HMAC → /agent-runs)
→ Generate eventId + externalDraftId → Normalize draft → HMAC → POST /drafts
→ MKT-09 AgentRun WAITING_APPROVAL
→ MKT-04 Wait (24h) → Parse decision → Decision Switch
   APPROVED → Validate → Channel route → (NoOp channel) → Staging Mock Publisher
            → Build SUCCESS|FAILED receipt → HMAC → POST /publish-receipt
            → MKT-09 AgentRun SUCCESS|FAILED from receipt (agentName=publisher)
   REJECTED / REVISION_REQUESTED / MALFORMED → stop (no publish)
```

### MKT-02 — Researcher

Optional stage feeding Creator. Outputs `researchBrief` JSON consumed by the Creator prompt. Uses `gpt-4o-mini`. Seed `researcher` agent if you also emit AgentRuns for this stage.

### MKT-03 — Content Generation

```text
policy-check (allowed)
→ research package (MKT-02)
→ Creator (LLM in n8n) → structured title/body/type/channel
→ POST /api/integrations/n8n/drafts  (HMAC + resumeUrl from Wait)
→ WAIT (n8n Wait / webhook-waiting)
```

Notes:

- Use a stable `externalDraftId` so retries are idempotent.
- Set `resumeExpiresAt` to the Wait node expiry (or sooner).
- Do not put LLM provider keys in Control Room env.
- Set `campaignId` in the policy-check Code node to enforce pause/stop/limits for a real campaign.

### MKT-04 — Human Approval Gate

```text
Control Room draft
               │
               ▼
              WAIT
               │
      ┌────────┼──────────┐
      ▼        ▼          ▼
 APPROVED   REJECTED   REVISION_REQUESTED
      │
      ▼
   MKT-05 publisher (on APPROVED only)
```

Notes:

- Wait node resumes only on authenticated Control Room callback (`N8N_RESUME_SECRET`).
- On `REVISION_REQUESTED`, loop back to Creator with review comment; new draft must use a **new** `externalDraftId` or a new revision path agreed with ops (do not reuse a consumed Wait URL).
- Approval in Control Room does **not** mean published.

### MKT-05 — Publisher

```text
approved revision payload from resume
→ platform formatter
→ platform API (X / LinkedIn / … credentials in n8n)  — today: Staging Mock Publisher
→ POST /api/integrations/n8n/publish-receipt  (status SUCCESS | FAILED — never "PUBLISHED")
→ Control Room sets PUBLISHED only on SUCCESS + matching contentHash
```

Notes:

- Send the exact `revisionId` + `contentHash` from the resume body.
- On platform failure, send `status: FAILED` receipt; leave content `APPROVED` for retry.
- Keep mock publisher until channel credentials exist.

### MKT-06 — Metrics / Attribution

Schedule (every 6h) + manual trigger → HMAC → `POST /api/integrations/n8n/metrics` and `/attribution`. Current export posts **stub** snapshots so Analytics/Attribution leave empty-state; replace Build bodies with real platform pulls when APIs are connected.

### MKT-09 — AgentRun telemetry

`POST /api/integrations/n8n/agent-runs` with ingress HMAC. Emit at boundaries:

| Status | When | `agentName` |
|---|---|---|
| `RUNNING` | After Creator parse | `creator` |
| `WAITING_APPROVAL` | After draft handoff, before Wait | `creator` |
| `SUCCESS` / `FAILED` | After publish-receipt (from receipt `status`) | `publisher` |

Always include `modelAlias`, `promptVersion`, and `latencyMs` when available.

Example:

```json
{
  "schemaVersion": "1",
  "eventId": "ar-running-…",
  "workflowId": "Mr2NsTTTVKvuGZKa",
  "executionId": "…",
  "status": "RUNNING",
  "agentName": "creator",
  "modelAlias": "gpt-4o",
  "promptVersion": "mkt-03-v1",
  "startedAt": "2026-08-18T15:00:00.000Z"
}
```

---

## Recovery runbook

### Expired Wait / stale resume URL

Symptoms: outbox attempts fail (HTTP 404/410/timeout); `N8nBridgeJob.resumeStatus` not delivered; content may already be `APPROVED` / `REJECTED` / `REVISION_REQUESTED`.

Actions:

1. Confirm human decision is recorded on `Approval` + `Content.status` (canonical state is safe).
2. Inspect `OutboxEvent` rows for the content (`PENDING` / `RETRY` / `FAILED`).
3. If Wait URL is dead, mark the outbox event for manual intervention (`FAILED` after backoff) — **do not** invent a new resume URL in the browser.
4. In n8n: either re-run from a fresh Wait (new `resumeUrl` via a controlled ops procedure that updates the encrypted job) or complete publishing manually and still send a **publish-receipt** so `PUBLISHED` stays receipt-gated.
5. Never log or paste decrypted resume URLs into tickets/chat.

### Outbox drain stuck

```bash
# Manual drain (staging/prod)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXTAUTH_URL/api/cron/outbox-drain"
```

Check Settings → integration health (`GET /api/integrations/health`) for pending outbox counts. Hobby Vercel cron is daily — use an external scheduler (every 1–5 min) in production.

Backoff: `0s → 15s → 1m → 5m → 15m → 1h` then `FAILED`. After fixing n8n, reset eligible events to `RETRY` with `nextAttemptAt=now()` via ops SQL only if you understand the payload; prefer re-drain of `PENDING`/`RETRY`.

### Stale revision (409)

Symptoms: reviewer gets `409` on approve/reject/request-revision.

Cause: `revisionId` ≠ `Content.currentRevisionId` (another edit or agent revision landed).

Actions:

1. Reload queue detail (`GET /api/content/:id`) and review the current revision.
2. Re-run Guardian findings on the new revision.
3. Approve/reject the **current** `revisionId` only.
4. Do not force-approve a stale id — concurrency invariant must hold.

### n8n unavailable during approval

Human decisions still commit in PostgreSQL + outbox. When n8n returns, drain outbox. Control Room state must not be corrupted by n8n downtime.

### Pusher unavailable

UI keeps working via React Query `refetchInterval`. Realtime is invalidation-only (IDs); never required for correctness.

---

## n8n security audit (runbook)

Run periodically against your n8n instance (CLI or instance UI, depending on n8n version/deployment):

```bash
# Self-hosted n8n CLI (from the n8n install / container):
n8n audit
```

Review findings for: unprotected webhooks, unused credentials, risky nodes, missing encryption / security settings.

Production expectations:

- Separate development vs production workflows.
- Wait / webhook URLs not publicly guessable without auth; Control Room resume always HMAC-signed.
- Platform and LLM credentials stored only as n8n credentials, not in Control Room `.env`.
- If live n8n is unavailable in this environment, treat `n8n audit` as a **manual cutover gate** before prod traffic (see [cutover-checklist.md](./cutover-checklist.md)).
