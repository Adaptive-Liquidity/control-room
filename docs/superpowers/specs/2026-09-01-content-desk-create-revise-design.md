# Content desk: create, generate, approve, revise

**Date:** 2026-09-01  
**Status:** Draft for review (not an implementation plan)  
**HQ:** Control Room is the policy/audit plane. n8n is the execution plane. This spec does not add live social publish.

## 1. Goal

An Adaptive Liquidity / AEON operator can:

1. Create a post in Studio (type or Generate with AI).
2. Save a draft and submit it for review without creating a second content row on later edits.
3. Have a reviewer approve, reject, or request revision with a comment.
4. Open that same post in Studio, see the comment, edit or ask the agent to help rewrite, and resubmit.

Success: one `Content` id stays the Queue card through create → review → rewrite → review again.

## 2. Invariants (do not break)

- HMAC on n8n ingress and generate (`N8N_INGRESS_SECRET` / `N8N_GENERATE_SECRET`).
- Resume URLs stay encrypted server-side. Never in browser, Pusher, logs, or content APIs.
- `PUBLISHED` only via SUCCESS publish-receipt matching current revision + `contentHash`.
- Approve / reject / request revision require `content.approve`. SERVICE cannot approve.
- Prisma `migrate deploy` only in staging/prod.
- Request revision in this spec does **not** resume n8n. Approve and reject still resume when `origin === 'N8N'` and a bridge job exists.

## 3. Approach

Studio-first revision (option A). The author owns the rewrite. The agent helps only when they click **Rewrite with agent**. n8n does not auto-spawn a second draft.

A later spec may add **Send to agent** (n8n Creator loop + new `externalDraftId`). Out of scope here.

## 4. Status machine

One content row:

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► APPROVED
                         │
                         ├──reject──► REJECTED ──PATCH+submit──► PENDING_REVIEW
                         │
                         └──request revision──► REVISION_REQUESTED ──PATCH+submit──► PENDING_REVIEW
```

- Every Save / Rewrite with agent that changes title, body, type, or channel creates a new `ContentRevision` and Guardian result.
- Approve binds to `currentRevisionId`. Mismatch → `409`.
- `PENDING_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` are not PATCH-editable for body fields.

## 5. APIs

### 5.1 `PATCH /api/content/:id`

Requires session + `content.edit` on the active project.

**Who:** the `authorId`, or anyone with `content.approve` on the project.

**Allowed statuses:** `DRAFT`, `REVISION_REQUESTED`, `REJECTED`. Otherwise `409`.

**Body (all optional, at least one required):** `title`, `body`, `type`, `channel`, `campaignId` (string or `null`).

**Behavior:** call `contentService.update` only after status/auth guards. `update` must refuse body-field changes unless status is one of the allowed three (so other callers cannot bypass the route). Title/body/type/channel changes go through `createRevision`. If Guardian result is `BLOCK`, roll back — no new revision, HTTP `422`. Empty title or body → `400`.

Do not change status on PATCH. Submit is a separate call.

### 5.2 `POST /api/content/:id/submit`

Requires `content.edit`. Same author/approver rule as PATCH.

**Allowed statuses:** `DRAFT`, `REVISION_REQUESTED`, `REJECTED`.

Sets `PENDING_REVIEW`. If current revision Guardian is `BLOCK` → `422`. If title or body empty → `400`.

### 5.3 `POST /api/queue/:id/request-revision`

Unchanged request shape: `{ revisionId, comment }` with comment `min(1)`.

Change `approvalService.decide`: enqueue `N8N_RESUME_REQUESTED` only when `decision` is `APPROVED` or `REJECTED` (and `origin === 'N8N'` with a bridge job). `REVISION_REQUESTED` still writes `Approval`, sets content status, activity log — **no outbox**.

The n8n Wait stays open so a later approve can still resume that execution.

### 5.4 `POST /api/studio/generate`

Existing route. Extend `generateRequestSchema` with:

- `contentId` (optional)
- `mode`: `'create' | 'rewrite'` (optional, default `'create'`)

When `contentId` is set (rewrite):

- Load that content in the active project. `404` if missing.
- Caller must pass PATCH-equivalent auth (author or `content.approve`).
- Server injects current title/body and the latest `REVISION_REQUESTED` approval comment into the n8n payload. Do not trust client-supplied body as the source of truth for rewrite.
- Campaign policy still applies if the content or request has `campaignId`.

When `contentId` is omitted: same as today (blank/prompt generate). Requires published company + project context packs (`409` if missing). Webhook unset → `503`. Failure does not write content.

n8n payload additions (rewrite): `mode`, `contentId`, `currentTitle`, `currentBody`, `reviewComment` (string or null), existing `contextPack` / `composedHash`.

Generate never auto-saves and never creates a Wait.

### 5.5 `GET /api/content/:id`

Add to the existing detail payload:

- `assets`: attached `ContentAsset` + asset filename/mime (empty array if none).
- `revisionRequest`: `{ comment, reviewerName, createdAt } | null` — latest approval with status `REVISION_REQUESTED`, else null.

## 6. Studio

- `/studio` — new post (today).
- `/studio?id=<contentId>` — load `GET /api/content/:id`, fill fields, keep that id for PATCH/submit.
- After first save of a new post, set `id` in the URL (replaceState) so further Save uses PATCH, not a second `POST /api/content`.
- Campaign picker: list active-project campaigns; optional `campaignId` on create and PATCH.
- If `revisionRequest` is present, show the comment above the editor.
- **Rewrite with agent:** `POST /api/studio/generate` with `contentId` + `mode: 'rewrite'`. On success, fill title/body only. Author still Save / Submit.
- Save: `DRAFT` stays `DRAFT` (PATCH or first POST). Submit: `POST .../submit` after the row exists; first-time submit may still `POST /api/content` with `status: PENDING_REVIEW` when there is no id yet.
- No rich-text toolbar.

Queue shows **Open in Studio** on `DRAFT` and `REVISION_REQUESTED` only when the session user is the author or has `content.approve`. Link: `/studio?id=`. Existing Queue filters stay; `REVISION_REQUESTED` already appears in the list.

## 7. Queue

- Request revision: comment required (already API-enforced). Keep the comment box visible.
- Approve: optional reviewer edits field. If non-empty, send `edits: { title?, body? }` with the existing approve API.
- Detail pane: list attached assets by filename (no new upload UI here).
- Do not show resume URLs. Platform URL after publish is out of scope (no live publish in this spec).

## 8. n8n Studio Generate

- Add `N8N_GENERATE_WEBHOOK_URL` and optional `N8N_GENERATE_SECRET` to `.env.example` (documented today only in `docs/n8n-bridge.md`).
- Export a real workflow to `n8n/workflows/studio-generate.json`: Webhook → use Control Room `contextPack` + prompt / `reviewComment` + `currentBody` → Creator LLM → Respond with `{ title, body }`.
- Replace the stub Code node on cloud workflow `58oYBY2ODlpRYhcc` by re-importing that export (do not create a duplicate workflow). Attach OpenAI + HMAC as in MKT-03.
- MKT-03/04/05 Wait + mock publisher unchanged.

## 9. Errors (operator-visible)

| Case | HTTP / UI |
|---|---|
| Generate webhook missing | `503`; Studio toast; editor unchanged |
| Generate fail / non-JSON | toast; editor unchanged |
| Guardian BLOCK on PATCH or submit | `422`; no revision / no status change |
| Submit empty title/body | `400` |
| Request revision without comment | `400` (already) |
| PATCH while `PENDING_REVIEW` / `APPROVED` | `409` |
| VIEWER PATCH | `403` |
| SERVICE approve | `403` (already) |
| Stale `revisionId` | `409` (already) |
| Approve after Wait expired | Approval saved; outbox `FAILED`; existing recovery runbook. Do not invent a resume URL |

## 10. Tests

**Jest**

- PATCH updates the same content id; second save does not insert another `Content` row.
- Submit: `REVISION_REQUESTED` → `PENDING_REVIEW`.
- Request revision does not call `outboxService.enqueue`; approve of `origin=N8N` still does.
- Generate with `contentId` loads server body + latest revision comment into the webhook payload.
- VIEWER `403` on PATCH; SERVICE `403` on approve; stale revision `409`.
- Guardian BLOCK on PATCH → `422`, revision count unchanged.

**E2E** (`E2E_WITH_AUTH=1`, seeded editor + reviewer)

- Editor: Studio save → submit → Queue pending.
- Reviewer: request revision with comment.
- Editor: `/studio?id=` shows comment, submit again → Queue pending.
- Generate with webhook unset: `503` and Studio still usable.

No live n8n Wait and no real X post in this spec.

## 11. Out of scope

- Live X / LinkedIn / Discord / email / blog publish (mock publisher stays).
- Changing approve/reject resume behavior.
- n8n auto-rewrite / **Send to agent** / new `externalDraftId` on revision.
- Scheduled publish worker.
- MANAGER invite, role/deactivate, Guardian settings wiring, agent seed-on-boot.
- MKT-06 real metrics, GCS/Firebase, Pusher, Figma library, rich text.

## 12. Files likely to change (for the later plan)

- `src/app/api/content/[id]/route.ts` — add PATCH
- `src/app/api/content/[id]/submit/route.ts` — new
- `src/services/content.service.ts` — status/auth guards; BLOCK rollback; detail assets + `revisionRequest`
- `src/services/approval.service.ts` — skip outbox on `REVISION_REQUESTED`
- `src/lib/n8n/generate-client.ts` + `src/app/api/studio/generate/route.ts`
- `src/hooks/useContent.ts` — update/submit mutations
- `src/app/(main)/studio/page.tsx`
- `src/app/(main)/queue/page.tsx`
- `.env.example`, `docs/n8n-bridge.md`, `n8n/workflows/studio-generate.json`
- Tests under `src/__tests__/api/` and `e2e/`

No Prisma schema change is required. `ContentRevision`, `Approval`, `ContentAsset` already exist.
