# n8n ↔ Control Room bridge contracts

Stable reference for the authenticated draft ingress, resume callback, and publish-receipt flows.
Apply the `control_room_foundation` migration and seed Guardian rules before exercising these endpoints:

```bash
npx prisma migrate deploy
npx tsx scripts/seed-guardian-rules.ts
```

Create at least one active user with role `SERVICE` — draft ingestion attributes content to that account.

## Shared HMAC headers (ingress)

Used by `POST /api/integrations/n8n/drafts` and `POST /api/integrations/n8n/publish-receipt`.

| Header | Value |
|---|---|
| `X-N8N-Timestamp` | Unix epoch seconds (or ms) |
| `X-N8N-Signature` | `hex(HMAC_SHA256(N8N_INGRESS_SECRET, timestamp + "." + rawBody))` — optional `sha256=` prefix |
| `Content-Type` | `application/json` |

Timestamps outside ±5 minutes are rejected. Each `eventId` may be consumed once across bridge jobs and publish receipts (except draft idempotency by `externalDraftId`, see below).

## 1. Draft ingress — `POST /api/integrations/n8n/drafts`

Creates `Content(origin=N8N)` + first `ContentRevision` (Guardian V2 evaluated) + `N8nBridgeJob` with an encrypted resume URL. The resume URL is **never** returned by content APIs.

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
