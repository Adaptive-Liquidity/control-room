# Content Desk Create/Revise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `Content` id through Studio save/generate, Queue review, request-revision without n8n resume, and optional agent-assisted rewrite in Studio.

**Architecture:** Tighten `contentService.update` + new PATCH/submit routes so later saves do not `POST` a new row. `approvalService.decide` still writes `REVISION_REQUESTED` but does not enqueue outbox. Studio generate `mode: 'rewrite'` loads body + latest revision comment on the server. Queue links authors (and approvers) to `/studio?id=`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Jest, Playwright, existing n8n HMAC generate client. No new npm dependencies. No Prisma migration.

**Spec:** `docs/superpowers/specs/2026-09-01-content-desk-create-revise-design.md`

## Global Constraints

- HMAC on n8n ingress and generate (`N8N_INGRESS_SECRET` / `N8N_GENERATE_SECRET`).
- Resume URLs stay encrypted server-side. Never in browser, Pusher, logs, or content APIs.
- `PUBLISHED` only via SUCCESS publish-receipt matching current revision + `contentHash`.
- Approve / reject / request revision require `content.approve`. SERVICE cannot approve.
- Prisma `migrate deploy` only in staging/prod — this plan does not add a migration.
- Request revision does **not** resume n8n. Approve and reject still resume when `origin === 'N8N'` and a bridge job exists.
- Do not add live social publish, Send-to-agent, or scheduled publish.
- `git add` only files listed in that task. Never `git add -A`.
- Gates after each task: the tests named in the task plus `npm run typecheck` before the last commit of that task if you touched `.ts`/`.tsx`.

### File map

| File | Responsibility |
|---|---|
| `src/lib/content/studio-mutate.ts` | Editable statuses + who may mutate a Studio row |
| `src/services/content.service.ts` | Status guards, BLOCK rollback on update, `submit`, detail extras |
| `src/app/api/content/[id]/route.ts` | PATCH |
| `src/app/api/content/[id]/submit/route.ts` | Submit → `PENDING_REVIEW` |
| `src/services/approval.service.ts` | Skip outbox on `REVISION_REQUESTED` |
| `src/lib/n8n/generate-client.ts` | `contentId`, `mode`, rewrite fields |
| `src/app/api/studio/generate/route.ts` | Server-side rewrite context |
| `src/hooks/useContent.ts` | PATCH/submit mutations |
| `src/hooks/useQueue.ts` | Approve `edits` |
| `src/app/(main)/studio/page.tsx` | `?id=`, campaign, rewrite, PATCH |
| `src/app/(main)/queue/page.tsx` | Open in Studio, assets, reviewer edits |
| `.env.example`, `docs/n8n-bridge.md`, `n8n/workflows/studio-generate.json` | Generate webhook contract |
| `src/__tests__/unit/studio-mutate.test.ts` | Guard unit tests |
| `src/__tests__/api/content-desk.test.ts` | PATCH/submit/GET |
| `src/__tests__/unit/approval-revision-outbox.test.ts` | Outbox skip |
| `src/__tests__/api/studio-generate.test.ts` | Rewrite payload |
| `e2e/studio-desk.spec.ts` | Seeded editor/reviewer loop |

---

### Task 1: Studio mutate guards + contentService

**Files:**
- Create: `src/lib/content/studio-mutate.ts`
- Create: `src/__tests__/unit/studio-mutate.test.ts`
- Modify: `src/services/content.service.ts`
- Test: `src/__tests__/unit/studio-mutate.test.ts`

**Interfaces:**
- Consumes: `hasPermission` / `ForbiddenError` from `src/lib/rbac.ts`; `ConflictError` / `ValidationServiceError` from `content.service.ts`
- Produces: `STUDIO_EDITABLE_STATUSES`, `assertStudioMutator()`, `isStudioEditableStatus()`; `contentService.update` throws `ConflictError` (409) on illegal status and `ValidationServiceError` (422) on Guardian `BLOCK` with no committed revision; `contentService.submit`; `getDetail` adds `assets` and `revisionRequest`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/unit/studio-mutate.test.ts`:

```ts
import {
  STUDIO_EDITABLE_STATUSES,
  assertStudioMutator,
  isStudioEditableStatus,
} from '@/lib/content/studio-mutate';
import { ForbiddenError } from '@/lib/rbac';

describe('studio-mutate', () => {
  it('allows DRAFT REVISION_REQUESTED REJECTED only', () => {
    expect(STUDIO_EDITABLE_STATUSES).toEqual(['DRAFT', 'REVISION_REQUESTED', 'REJECTED']);
    expect(isStudioEditableStatus('DRAFT')).toBe(true);
    expect(isStudioEditableStatus('PENDING_REVIEW')).toBe(false);
    expect(isStudioEditableStatus('APPROVED')).toBe(false);
  });

  it('allows the author with content.edit', () => {
    expect(() =>
      assertStudioMutator({ userId: 'ed-1', role: 'EDITOR', authorId: 'ed-1' })
    ).not.toThrow();
  });

  it('allows a non-author with content.approve', () => {
    expect(() =>
      assertStudioMutator({ userId: 'rev-1', role: 'REVIEWER', authorId: 'ed-1' })
    ).not.toThrow();
  });

  it('forbids VIEWER and non-author EDITOR', () => {
    expect(() =>
      assertStudioMutator({ userId: 'v-1', role: 'VIEWER', authorId: 'ed-1' })
    ).toThrow(ForbiddenError);
    expect(() =>
      assertStudioMutator({ userId: 'ed-2', role: 'EDITOR', authorId: 'ed-1' })
    ).toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/unit/studio-mutate.test.ts`

Expected: FAIL — `Cannot find module '@/lib/content/studio-mutate'`

- [ ] **Step 3: Implement guards**

Create `src/lib/content/studio-mutate.ts`:

```ts
import { ForbiddenError, hasPermission } from '@/lib/rbac';

export const STUDIO_EDITABLE_STATUSES = ['DRAFT', 'REVISION_REQUESTED', 'REJECTED'] as const;
export type StudioEditableStatus = (typeof STUDIO_EDITABLE_STATUSES)[number];

export function isStudioEditableStatus(status: string): status is StudioEditableStatus {
  return (STUDIO_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function assertStudioMutator(opts: {
  userId: string;
  role: string;
  authorId: string;
}): void {
  const isAuthor = opts.userId === opts.authorId;
  if (isAuthor && hasPermission(opts.role, 'content.edit')) return;
  if (hasPermission(opts.role, 'content.approve')) return;
  throw new ForbiddenError('Missing permission: content.edit');
}
```

- [ ] **Step 4: Change `contentService.update` and `getDetail`**

In `src/services/content.service.ts`:

1. Import `assertStudioMutator`, `isStudioEditableStatus` from `@/lib/content/studio-mutate`.
2. Add optional 5th argument to `update`:

```ts
async update(
  id: string,
  data: {
    title?: string;
    body?: string;
    type?: ContentType;
    channel?: Channel;
    campaignId?: string | null;
    status?: Content['status'];
    scheduledAt?: Date | null;
  },
  userId: string,
  projectId: string,
  mutator?: { role: string }
)
```

When `mutator` is passed (PATCH path always passes it):

```ts
assertStudioMutator({ userId, role: mutator.role, authorId: content.authorId });
if (contentFieldsChanged && !isStudioEditableStatus(content.status)) {
  throw new ConflictError(
    `Cannot edit content in status ${content.status}; must be DRAFT, REVISION_REQUESTED, or REJECTED`
  );
}
```

When `contentFieldsChanged`, wrap `createRevision` + remaining `content.update` in `prisma.$transaction`. Pass `tx` into `createRevision`. After `createRevision`, if `guardianResult.result === 'BLOCK'`, throw `new ValidationServiceError('Guardian BLOCK; revision not saved')` so the transaction rolls back.

Do **not** pass `status` from PATCH (callers omit it). Keep `schedule()` using `update` without `mutator` so APPROVED schedule still works — `schedule()` does not send title/body.

3. Add `submit`:

```ts
async submit(id: string, userId: string, projectId: string, role: string) {
  const db = scopedPrisma(projectId, prisma);
  const content = await db.content.findUnique({ where: { id } });
  if (!content) throw new ValidationServiceError('Content not found');
  assertStudioMutator({ userId, role, authorId: content.authorId });
  if (!isStudioEditableStatus(content.status)) {
    throw new ConflictError(
      `Cannot submit content in status ${content.status}`
    );
  }
  if (!content.title.trim() || !content.body.trim()) {
    const err = new Error('Title and body are required') as Error & { statusCode: number };
    err.statusCode = 400;
    err.name = 'BadRequestError';
    throw err;
  }
  if (content.currentRevisionId) {
    const revision = await prisma.contentRevision.findUnique({
      where: { id: content.currentRevisionId },
      select: { guardianResult: true },
    });
    if (revision?.guardianResult === 'BLOCK') {
      throw new ValidationServiceError('Cannot submit content with Guardian BLOCK result');
    }
  }
  return db.content.update({
    where: { id },
    data: { status: 'PENDING_REVIEW' },
    include: {
      author: true,
      approvals: { include: { reviewer: true } },
      campaign: true,
    },
  });
}
```

4. In `getDetail`, include current revision assets and latest revision request. After loading `currentRevision`, query:

```ts
const assets = currentRevision
  ? await prisma.contentAsset.findMany({
      where: { contentRevisionId: currentRevision.id },
      orderBy: { position: 'asc' },
      include: {
        asset: { select: { id: true, originalFilename: true, mimeType: true } },
      },
    })
  : [];

const latestRevision = content.approvals.find((a) => a.status === 'NEEDS_REVISION') ?? null;
const revisionRequest = latestRevision
  ? {
      comment: latestRevision.comment,
      reviewerName: latestRevision.reviewer.name,
      createdAt: latestRevision.createdAt,
    }
  : null;
```

Return `{ ..., assets, revisionRequest }` alongside existing fields. Approvals are already ordered `createdAt desc`. Approval status for request-revision is `NEEDS_REVISION` (see `approval.service.ts`), not the content status `REVISION_REQUESTED`.

- [ ] **Step 5: Re-run unit test**

Run: `npm test -- src/__tests__/unit/studio-mutate.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/studio-mutate.ts src/__tests__/unit/studio-mutate.test.ts src/services/content.service.ts
git commit -m "feat: guard Studio edits to one content row"
```

---

### Task 2: PATCH and submit routes

**Files:**
- Modify: `src/app/api/content/[id]/route.ts`
- Create: `src/app/api/content/[id]/submit/route.ts`
- Create: `src/__tests__/api/content-desk.test.ts`

**Interfaces:**
- Consumes: `contentService.update`, `contentService.submit`, `contentService.getDetail`, `assertStudioMutator` (inside service)
- Produces: `PATCH /api/content/:id`, `POST /api/content/:id/submit`

- [ ] **Step 1: Write failing API tests**

Create `src/__tests__/api/content-desk.test.ts`:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    content: { findUnique: jest.fn(), update: jest.fn() },
    contentRevision: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    contentAsset: { findMany: jest.fn() },
    campaign: { findUnique: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/project/context', () => {
  const actual = jest.requireActual('@/lib/project/context');
  const { getServerSession } = jest.requireMock('next-auth') as { getServerSession: jest.Mock };
  return {
    ...actual,
    resolveProjectContext: jest.fn().mockImplementation(async () => {
      const session = await getServerSession();
      return {
        projectId: 'project-1',
        slug: 'p',
        name: 'P',
        role: session?.user?.role ?? 'EDITOR',
        company: { id: 'c', slug: 'c', name: 'C' },
        projects: [],
      };
    }),
  };
});
jest.mock('@/lib/pusher/server', () => ({
  emitContentUpdated: jest.fn(),
  emitContentCreated: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/content/[id]/route';
import { POST as submitPost } from '@/app/api/content/[id]/submit/route';
import { contentService } from '@/services/content.service';
import { session } from '../helpers/n8n';

describe('content desk routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PATCH returns 403 for VIEWER', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('VIEWER', 'v-1'));
    jest.spyOn(contentService, 'update').mockRejectedValueOnce(
      Object.assign(new Error('Missing permission: content.edit'), { statusCode: 403, name: 'ForbiddenError' })
    );
    const res = await PATCH(
      new NextRequest('http://localhost/api/content/c1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Hi', body: 'Body text here' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(403);
  });

  it('PATCH returns 409 when status is PENDING_REVIEW', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    jest.spyOn(contentService, 'update').mockRejectedValueOnce(
      Object.assign(new Error('Cannot edit content in status PENDING_REVIEW'), {
        statusCode: 409,
        name: 'ConflictError',
      })
    );
    const res = await PATCH(
      new NextRequest('http://localhost/api/content/c1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Hi', body: 'Body text here' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(409);
  });

  it('PATCH returns 422 on Guardian BLOCK', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    jest.spyOn(contentService, 'update').mockRejectedValueOnce(
      Object.assign(new Error('Guardian BLOCK; revision not saved'), {
        statusCode: 422,
        name: 'ValidationServiceError',
      })
    );
    const res = await PATCH(
      new NextRequest('http://localhost/api/content/c1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Hi', body: 'guaranteed 50% APY' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(422);
  });

  it('submit moves REVISION_REQUESTED to PENDING_REVIEW', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    jest.spyOn(contentService, 'submit').mockResolvedValueOnce({
      id: 'c1',
      status: 'PENDING_REVIEW',
    } as never);
    const res = await submitPost(
      new NextRequest('http://localhost/api/content/c1/submit', { method: 'POST' }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(200);
    expect(contentService.submit).toHaveBeenCalledWith('c1', 'ed-1', 'project-1', 'EDITOR');
    expect((await res.json()).status).toBe('PENDING_REVIEW');
  });
});
```

Import `ForbiddenError`, `ConflictError`, and `ValidationServiceError` in the test and throw those classes instead of `Object.assign` so `instanceof` in the route works:

```ts
import { ForbiddenError } from '@/lib/rbac';
import { ConflictError, ValidationServiceError } from '@/services/content.service';
// throw new ForbiddenError('Missing permission: content.edit')
// throw new ConflictError('Cannot edit content in status PENDING_REVIEW')
// throw new ValidationServiceError('Guardian BLOCK; revision not saved')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/api/content-desk.test.ts`

Expected: FAIL — `PATCH` is not exported from `[id]/route.ts`

- [ ] **Step 3: Implement PATCH on `src/app/api/content/[id]/route.ts`**

Keep existing GET. Add:

```ts
import { z } from 'zod';
import { ForbiddenError } from '@/lib/rbac';
import { ConflictError, ValidationServiceError } from '@/services/content.service';
import { channelSchema, contentTypeSchema } from '@/lib/n8n/contracts';
const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(50000).optional(),
    type: contentTypeSchema.optional(),
    channel: channelSchema.optional(),
    campaignId: z.string().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field is required',
  });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const body = patchSchema.parse(await req.json());
    const updated = await contentService.update(
      params.id,
      body,
      session.user.id,
      ctx.projectId,
      { role: ctx.role }
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ValidationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('PATCH /api/content/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Do **not** call `requireProjectPermission(ctx, 'content.edit')` here — REVIEWER must be able to PATCH as an approver. Auth is `assertStudioMutator` inside `update`.

- [ ] **Step 4: Implement submit route**

Create `src/app/api/content/[id]/submit/route.ts` mirroring PATCH error mapping, calling:

```ts
const content = await contentService.submit(params.id, session.user.id, ctx.projectId, ctx.role);
return NextResponse.json(content);
```

Map `error.name === 'BadRequestError'` to 400.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/api/content-desk.test.ts src/__tests__/unit/studio-mutate.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/content/[id]/route.ts src/app/api/content/[id]/submit/route.ts src/__tests__/api/content-desk.test.ts
git commit -m "feat: add content PATCH and submit routes"
```

---

### Task 3: Request revision does not enqueue n8n resume

**Files:**
- Modify: `src/services/approval.service.ts` (the `if (existing.origin === 'N8N' && bridgeJob)` block ~line 161)
- Create: `src/__tests__/unit/approval-revision-outbox.test.ts`

**Interfaces:**
- Consumes: `outboxService.enqueue`, `OUTBOX_TYPE_N8N_RESUME`
- Produces: enqueue only when `opts.decision === 'APPROVED' || opts.decision === 'REJECTED'`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/approval-revision-outbox.test.ts` that mocks `outboxService.enqueue` and drives `approvalService.decide` is heavy because of Prisma transactions. Instead spy at the module after a thin extract.

Add exported helper in `src/services/approval.service.ts` **above** the class:

```ts
export function shouldEnqueueN8nResume(decision: ApprovalDecision): boolean {
  return decision === 'APPROVED' || decision === 'REJECTED';
}
```

Test file:

```ts
import { shouldEnqueueN8nResume } from '@/services/approval.service';

describe('shouldEnqueueN8nResume', () => {
  it('is false for REVISION_REQUESTED', () => {
    expect(shouldEnqueueN8nResume('REVISION_REQUESTED')).toBe(false);
  });
  it('is true for APPROVED and REJECTED', () => {
    expect(shouldEnqueueN8nResume('APPROVED')).toBe(true);
    expect(shouldEnqueueN8nResume('REJECTED')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — fail until helper exists and is used**

Run: `npm test -- src/__tests__/unit/approval-revision-outbox.test.ts`

Expected: FAIL until helper is exported.

- [ ] **Step 3: Wire the helper**

Replace:

```
if (existing.origin === 'N8N' && bridgeJob) {
```

with:

```
if (existing.origin === 'N8N' && bridgeJob && shouldEnqueueN8nResume(opts.decision)) {
```

Keep building the resume payload only inside that block. Approve/reject behavior unchanged.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/unit/approval-revision-outbox.test.ts src/__tests__/api/ingress-approval.test.ts`

Expected: PASS (existing request-revision test still only checks `decide` was called)

- [ ] **Step 5: Commit**

```bash
git add src/services/approval.service.ts src/__tests__/unit/approval-revision-outbox.test.ts
git commit -m "fix: do not resume n8n on request revision"
```

---

### Task 4: Generate rewrite mode

**Files:**
- Modify: `src/lib/n8n/generate-client.ts`
- Modify: `src/app/api/studio/generate/route.ts`
- Modify: `src/__tests__/api/studio-generate.test.ts`
- Modify: `src/__tests__/unit/generate-client.test.ts` only if schema tests exist there

**Interfaces:**
- Consumes: `generateRequestSchema`, `callN8nGenerate`, `assertStudioMutator`
- Produces: rewrite payload fields `mode`, `contentId`, `currentTitle`, `currentBody`, `reviewComment`

- [ ] **Step 1: Extend the schema and add a failing route test**

In `src/lib/n8n/generate-client.ts` add to `generateRequestSchema`:

```ts
contentId: z.string().min(1).optional(),
mode: z.enum(['create', 'rewrite']).optional(),
currentTitle: z.string().max(200).optional(),
currentBody: z.string().max(50000).optional(),
reviewComment: z.string().max(5000).nullable().optional(),
```

In `src/__tests__/api/studio-generate.test.ts` add prisma mocks:

```ts
content: { findUnique: jest.fn() },
contentRevision: {},
approval: {},
```

Add test (after existing ones):

```ts
  it('rewrite injects server body and latest revision comment', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    mockedPrisma.content = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'c1',
        projectId: 'proj_aeon',
        authorId: 'ed-1',
        title: 'Old title',
        body: 'Old body',
        campaignId: null,
        approvals: [
          {
            status: 'NEEDS_REVISION',
            comment: 'Tighten the APY claim',
            createdAt: new Date('2026-09-01'),
            reviewer: { name: 'Rev' },
          },
        ],
      }),
    } as never;
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      activeContextVersion: {
        id: 'pv1',
        pack: { schemaVersion: '1', promptCore: { identity: { name: 'AEON' } } },
      },
      company: {
        activeContextVersion: {
          id: 'cv1',
          pack: { schemaVersion: '1', promptCore: { identity: { name: 'Adaptive' } } },
        },
      },
    });
    (callN8nGenerate as jest.Mock).mockResolvedValue({
      ok: true,
      data: { title: 'New', body: 'Rewritten' },
    });

    const res = await POST(
      new NextRequest('http://localhost/api/studio/generate', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'TWITTER',
          type: 'TWITTER_THREAD',
          contentId: 'c1',
          mode: 'rewrite',
          currentBody: 'CLIENT_MUST_NOT_WIN',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(callN8nGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'rewrite',
        contentId: 'c1',
        currentTitle: 'Old title',
        currentBody: 'Old body',
        reviewComment: 'Tighten the APY claim',
      })
    );
    expect(callN8nGenerate).not.toHaveBeenCalledWith(
      expect.objectContaining({ currentBody: 'CLIENT_MUST_NOT_WIN' })
    );
  });
```

Extend the jest prisma mock at the top of that file with `content: { findUnique: jest.fn() }`.

- [ ] **Step 2: Run — expect rewrite test FAIL (route ignores contentId)**

Run: `npm test -- src/__tests__/api/studio-generate.test.ts`

Expected: FAIL on `currentTitle: 'Old title'`

- [ ] **Step 3: Implement rewrite load in `src/app/api/studio/generate/route.ts`**

After `generateRequestSchema.parse`, if `validated.contentId`:

```ts
const row = await prisma.content.findUnique({
  where: { id: validated.contentId },
  include: {
    approvals: {
      where: { status: 'NEEDS_REVISION' },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { reviewer: { select: { name: true } } },
    },
  },
});
if (!row || row.projectId !== ctx.projectId) {
  return NextResponse.json({ error: 'Content not found' }, { status: 404 });
}
assertStudioMutator({
  userId: session.user.id,
  role: ctx.role,
  authorId: row.authorId,
});
validated.mode = 'rewrite';
validated.currentTitle = row.title;
validated.currentBody = row.body;
validated.reviewComment = row.approvals[0]?.comment ?? null;
if (!validated.campaignId && row.campaignId) {
  validated.campaignId = row.campaignId;
}
```

Then existing campaign + pack + `callN8nGenerate` path runs. Catch `ForbiddenError`. Generate still does not write content.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/api/studio-generate.test.ts src/__tests__/unit/generate-client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/n8n/generate-client.ts src/app/api/studio/generate/route.ts src/__tests__/api/studio-generate.test.ts
git commit -m "feat: Studio generate rewrite uses server draft and comment"
```

---

### Task 5: Hooks + Studio UI

**Files:**
- Modify: `src/hooks/useContent.ts`
- Modify: `src/app/(main)/studio/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/content/:id`, `POST /api/content/:id/submit`, `POST /api/studio/generate`, `GET /api/content/:id`, `GET /api/campaigns`
- Produces: `useUpdateContent`, `useSubmitContent`; Studio `?id=` load; Save uses PATCH after first id; Rewrite with agent; campaign select

- [ ] **Step 1: Add mutations to `src/hooks/useContent.ts`**

Append:

```ts
export function useUpdateContent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string;
      body?: string;
      type?: string;
      channel?: string;
      campaignId?: string | null;
    }) => {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useSubmitContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['content', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

Extend `ContentDetail` with:

```ts
assets: Array<{
  id: string;
  altText: string | null;
  asset: { id: string; originalFilename: string; mimeType: string };
}>;
revisionRequest: { comment: string | null; reviewerName: string | null; createdAt: string } | null;
```

Make both optional (`?`) so old callers typecheck, but Studio should treat missing as `[]` / `null`.

- [ ] **Step 2: Studio page behavior (no separate Jest; E2E in Task 8)**

In `src/app/(main)/studio/page.tsx`:

1. `useSearchParams()` — `const contentId = searchParams.get('id')`.
2. `useContent(contentId)` — when data loads, set title/body/type/channel/campaignId from `detail.content`. Do not overwrite if the user has already typed (track `hydratedId`).
3. After successful first `POST /api/content`, `router.replace(\`/studio?id=${content.id}\`)` via `replace` (not push).
4. Save draft: if `contentId` then `useUpdateContent(contentId)` PATCH `{ title, body, type, channel, campaignId }` (status stays DRAFT). Else existing `useCreateContent` with `status: 'DRAFT'`.
5. Submit: if `contentId` then PATCH fields then `useSubmitContent`. Else `useCreateContent` with `status: 'PENDING_REVIEW'` (existing).
6. Campaign: `useQuery` `GET /api/campaigns?limit=50` — Select with value `none` for unset; send `campaignId: null` when none.
7. If `detail.revisionRequest?.comment`, show a `border` banner: `Revision requested` + comment + reviewer name.
8. Button **Rewrite with agent** visible when `contentId` is set. POST `/api/studio/generate` with `{ channel, type, contentId, mode: 'rewrite', prompt: generatePrompt || undefined }`. On success set title/body. On error toast; do not clear fields. If response status 503, toast the error (webhook missing).
9. Keep Guardian check and asset attach as they are, using `savedDraft.contentId` **or** `contentId`.
10. Do not add a rich-text toolbar.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useContent.ts src/app/(main)/studio/page.tsx
git commit -m "feat: Studio loads, patches, and rewrites one content id"
```

---

### Task 6: Queue — Open in Studio, assets, reviewer edits

**Files:**
- Modify: `src/hooks/useQueue.ts`
- Modify: `src/app/(main)/queue/page.tsx`

**Interfaces:**
- Consumes: `useContent` detail `assets` + `revisionRequest`; approve API `edits`
- Produces: `useApproveContent` accepts optional `edits: { title?: string; body?: string }`

- [ ] **Step 1: Extend `useApproveContent`**

In `src/hooks/useQueue.ts`, stop using the shared `useDecisionMutation` for approve. Replace `useApproveContent` with:

```ts
export function useApproveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contentId,
      revisionId,
      comment,
      edits,
    }: {
      contentId: string;
      revisionId: string;
      comment?: string;
      edits?: { title?: string; body?: string };
    }) => {
      const res = await fetch(`/api/queue/${contentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revisionId,
          comment,
          edits:
            edits && (edits.title || edits.body)
              ? {
                  ...(edits.title ? { title: edits.title } : {}),
                  ...(edits.body ? { body: edits.body } : {}),
                }
              : undefined,
        }),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['content', vars.contentId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

Leave reject/revision on `useDecisionMutation`.

- [ ] **Step 2: Queue UI**

In `src/app/(main)/queue/page.tsx`:

1. `const { data: session } = useSession()` already exists. `const canEditStudio = Boolean(selectedSummary && (selectedSummary.author.id === session?.user?.id || APPROVE_ROLES.has(session?.user?.role ?? '')))`.
2. When `selectedSummary.status` is `DRAFT` or `REVISION_REQUESTED` and `canEditStudio`, show a `Button` asChild `Link` href={`/studio?id=${selectedSummary.id}`} labeled `Open in Studio`.
3. In the detail pane, if `detail.assets?.length`, list `asset.originalFilename` as a `ul`. Do not show URLs.
4. Add optional `Input` placeholder `Approve with title edit (optional)` and keep the existing comment `Textarea`. State `approveTitle` / `approveBody` (body can be a second textarea labeled `Approve with body edit (optional)`). Pass into `approve.mutateAsync` as `edits` only when non-empty.
5. Request revision: keep comment required (disable button when comment empty).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useQueue.ts src/app/(main)/queue/page.tsx
git commit -m "feat: Queue opens Studio and sends optional approve edits"
```

---

### Task 7: Generate env + n8n export + bridge docs

**Files:**
- Modify: `.env.example`
- Modify: `docs/n8n-bridge.md` (Studio generate section)
- Create: `n8n/workflows/studio-generate.json`
- Modify: `n8n/workflows/README.md`

**Interfaces:**
- Consumes: generate HMAC contract already in `generate-client.ts`
- Produces: documented `N8N_GENERATE_WEBHOOK_URL` / `N8N_GENERATE_SECRET`; importable workflow that Responds `{ title, body }`

- [ ] **Step 1: `.env.example`**

After the `CRON_SECRET` block add:

```
# Studio Generate with AI (optional until Studio rewrite is used)
# n8n Respond webhook URL; HMAC uses N8N_GENERATE_SECRET or falls back to N8N_INGRESS_SECRET
# N8N_GENERATE_WEBHOOK_URL="https://your-n8n.example/webhook/aeon-studio-generate"
# N8N_GENERATE_SECRET="replace-with-long-random-string"
```

- [ ] **Step 2: `n8n/workflows/studio-generate.json`**

Write an n8n export with `name`: `AEON Studio Generate`, `id`: `58oYBY2ODlpRYhcc`, `"active": false`. Nodes:

1. **Webhook** — POST path `aeon-studio-generate`, responseMode `responseNode`.
2. **Build prompt** Code node that reads `$json` and sets `system` + `user`:
   - system: stringify `contextPack` if present else `'Follow Adaptive Liquidity / AEON brand voice. No yield promises.'`
   - user: if `mode === 'rewrite'`, include `reviewComment`, `currentTitle`, `currentBody`; else include `prompt` / `titleHint` / `channel` / `type`.
3. **OpenAI** Chat node (`gpt-4o`) using that prompt; credential name `OpenAI account` (same as MKT-03 — re-attach on import).
4. **Parse JSON** Code node: parse model output to `{ title, body }` (strip fences); fallback title `Draft`, body raw text.
5. **Respond to Webhook** JSON `{ title, body }`.

Header note in a Sticky: HMAC is verified by Control Room on the way **out**; this webhook should still be restricted (n8n webhook auth or VPN). Do not duplicate MKT Wait.

If a full OpenAI node credential id is unknown, use the same credential id as `n8n/workflows/mkt-03-04-05.json` OpenAI node (`BmB59ljWXBKxuiDZ`) and document re-attach in README.

- [ ] **Step 3: Docs**

In `docs/n8n-bridge.md` Studio generate section, add `contentId` / `mode` / rewrite fields to the request JSON example. State: re-import over workflow `58oYBY2ODlpRYhcc`; do not create a second workflow. List env vars.

In `n8n/workflows/README.md` add a row for `studio-generate.json`.

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/n8n-bridge.md n8n/workflows/studio-generate.json n8n/workflows/README.md
git commit -m "docs: Studio generate webhook env and n8n export"
```

---

### Task 8: E2E desk loop

**Files:**
- Create: `e2e/studio-desk.spec.ts`

**Interfaces:**
- Consumes: seeded `editor@aeon.test` / `reviewer@aeon.test`; Studio and Queue UI from Tasks 5–6
- Produces: Playwright coverage gated on `E2E_WITH_AUTH=1`

- [ ] **Step 1: Write the spec**

Create `e2e/studio-desk.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL ?? 'editor@aeon.test';
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD ?? 'AeonEditor123!';
const REVIEWER_EMAIL = process.env.E2E_REVIEWER_EMAIL ?? 'reviewer@aeon.test';
const REVIEWER_PASSWORD = process.env.E2E_REVIEWER_PASSWORD ?? 'AeonReview123!';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), { timeout: 15_000 });
}

test.describe('studio desk loop', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Set E2E_WITH_AUTH=1 and seed users');

  test('editor save submit, reviewer request revision, editor resubmit', async ({ page }) => {
    const title = `Desk loop ${Date.now()}`;
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/studio');
    await page.getByPlaceholder('Title').fill(title);
    await page.getByPlaceholder(/Start writing/i).fill('Plain draft body for revision loop.');
    await page.getByRole('button', { name: 'Submit for Approval' }).click();
    await page.waitForURL(/queue/, { timeout: 15_000 });

    await page.context().clearCookies();
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await page.goto('/queue');
    await page.getByText(title).first().click();
    await page.getByPlaceholder('Required for reject / request revision').fill('Please add a disclaimer.');
    await page.getByRole('button', { name: 'Request revision' }).click();

    await page.context().clearCookies();
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/queue');
    await page.getByRole('tab', { name: 'All' }).click();
    await page.getByText(title).first().click();
    await page.getByRole('link', { name: 'Open in Studio' }).click();
    await expect(page).toHaveURL(/\/studio\?id=/);
    await expect(page.getByText('Please add a disclaimer.')).toBeVisible();
    await page.getByPlaceholder(/Start writing/i).fill('Plain draft body. Not financial advice.');
    await page.getByRole('button', { name: 'Submit for Approval' }).click();
    await page.waitForURL(/queue/, { timeout: 15_000 });
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('generate without webhook keeps the editor', async ({ page, request }) => {
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/studio');
    await page.getByPlaceholder('Title').fill('Stay here');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const authed = await request.post('/api/studio/generate', {
      headers: { Cookie: cookieHeader, 'content-type': 'application/json' },
      data: { channel: 'TWITTER', type: 'TWITTER_THREAD' },
    });
    if (!process.env.N8N_GENERATE_WEBHOOK_URL) {
      expect(authed.status()).toBe(503);
    }
    await expect(page.getByPlaceholder('Title')).toHaveValue('Stay here');
  });
});
```

Studio buttons are `Save Draft`, `Submit for Approval`, and `Generate with AI`. Queue comment placeholder is `Required for reject / request revision`. After request-revision the row is not in the pending tab — editor uses the `all` tab.

- [ ] **Step 2: Run E2E if `E2E_WITH_AUTH=1` is set in this environment; otherwise run unit/API suite**

Run: `npm test -- src/__tests__/api/content-desk.test.ts src/__tests__/api/studio-generate.test.ts src/__tests__/unit/studio-mutate.test.ts src/__tests__/unit/approval-revision-outbox.test.ts`

If `E2E_WITH_AUTH=1`: `E2E_WITH_AUTH=1 npx playwright test e2e/studio-desk.spec.ts --project=chromium`

Expected: API tests PASS. E2E PASS when seeded.

- [ ] **Step 3: Commit**

```bash
git add e2e/studio-desk.spec.ts
git commit -m "test: E2E Studio save, revision, resubmit"
```

---

## Self-review (spec coverage)

| Spec section | Task |
|---|---|
| 5.1 PATCH + guards + BLOCK 422 | 1–2 |
| 5.2 submit | 1–2 |
| 5.3 no outbox on revision | 3 |
| 5.4 generate rewrite server body | 4 |
| 5.5 GET assets + revisionRequest | 1 |
| 6 Studio `?id=`, campaign, rewrite, replaceState | 5 |
| 7 Queue Open in Studio, edits, assets | 6 |
| 8 n8n export + env | 7 |
| 9 errors | 2, 4, 5 |
| 10 Jest | 1–4 |
| 10 E2E | 8 |
| 11 out of scope not implemented | — |
