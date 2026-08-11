/**
 * Concurrency semantics (mocked): dual approve → one wins via stale revision;
 * duplicate draft → one content via externalDraftId idempotency.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    content: { findUnique: jest.fn() },
    contentRevision: { findUnique: jest.fn() },
    n8nBridgeJob: { findUnique: jest.fn() },
    publishReceipt: { findUnique: jest.fn() },
    agentRun: { findUnique: jest.fn() },
    metricSnapshot: { findUnique: jest.fn() },
    attributionEvent: { findUnique: jest.fn() },
    approval: { create: jest.fn() },
    activityLog: { create: jest.fn() },
    outboxEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/pusher/server', () => ({
  emitContentCreated: jest.fn(),
  emitContentApproved: jest.fn(),
  emitContentRejected: jest.fn(),
  emitContentUpdated: jest.fn(),
}));

jest.mock('@/lib/outbox/outbox.service', () => ({
  OUTBOX_TYPE_N8N_RESUME: 'N8N_RESUME_REQUESTED',
  outboxService: {
    enqueue: jest.fn(),
    processOne: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { approvalService } from '@/services/approval.service';
import { ConflictError } from '@/services/content.service';
import { POST as draftPost } from '@/app/api/integrations/n8n/drafts/route';
import { makeJsonRequest, session } from '../helpers/n8n';

const mockedPrisma = prisma as unknown as {
  content: { findUnique: jest.Mock };
  $transaction: jest.Mock;
  n8nBridgeJob: { findUnique: jest.Mock };
  publishReceipt: { findUnique: jest.Mock };
  agentRun: { findUnique: jest.Mock };
  metricSnapshot: { findUnique: jest.Mock };
  attributionEvent: { findUnique: jest.Mock };
};

describe('concurrency: dual approve', () => {
  it('second approve with same revision loses with ConflictError', async () => {
    let approved = false;

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        content: {
          findUnique: jest.fn().mockImplementation(async () => ({
            id: 'c1',
            title: 'T',
            origin: 'MANUAL',
            currentRevisionId: approved ? 'r-new' : 'r1',
            bridgeJobs: [],
          })),
          update: jest.fn().mockImplementation(async () => {
            approved = true;
            return {
              id: 'c1',
              title: 'T',
              status: 'APPROVED',
              author: {},
              approvals: [],
            };
          }),
        },
        contentRevision: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'r1',
            contentHash: 'h',
            title: 'T',
            body: 'B',
            channel: 'TWITTER',
            guardianPolicyVersion: 't',
            guardianScore: 90,
          }),
        },
        approval: { create: jest.fn().mockResolvedValue({}) },
        activityLog: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const s = session('REVIEWER') as never;
    const first = await approvalService.decide({
      session: s,
      contentId: 'c1',
      expectedRevisionId: 'r1',
      decision: 'APPROVED',
    });
    expect(first.status).toBe('APPROVED');

    await expect(
      approvalService.decide({
        session: session('MANAGER', 'reviewer-2') as never,
        contentId: 'c1',
        expectedRevisionId: 'r1',
        decision: 'APPROVED',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('concurrency: duplicate draft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.n8nBridgeJob.findUnique.mockResolvedValue(null);
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.agentRun.findUnique.mockResolvedValue(null);
    mockedPrisma.metricSnapshot.findUnique.mockResolvedValue(null);
    mockedPrisma.attributionEvent.findUnique.mockResolvedValue(null);
  });

  it('parallel-looking duplicate externalDraftId returns same content', async () => {
    const existing = {
      id: 'c-only',
      currentRevisionId: 'r-only',
      status: 'PENDING_REVIEW',
      guardianScore: 80,
      author: { id: 'u1', email: 's@t', name: 'svc', role: 'SERVICE' },
      revisions: [{ id: 'r-only' }],
    };
    mockedPrisma.content.findUnique.mockResolvedValue(existing);

    const body = {
      schemaVersion: '1',
      eventId: 'evt-a',
      externalDraftId: 'ext-shared',
      workflowId: 'wf',
      executionId: 'ex1',
      resumeUrl: 'https://n8n.example/wait/1',
      content: {
        title: 'Dup',
        body: 'Same draft twice',
        type: 'LINKEDIN_POST',
        channel: 'LINKEDIN',
      },
    };

    const [a, b] = await Promise.all([
      draftPost(makeJsonRequest('http://localhost/api/integrations/n8n/drafts', body)),
      draftPost(
        makeJsonRequest('http://localhost/api/integrations/n8n/drafts', {
          ...body,
          eventId: 'evt-b',
        })
      ),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ja = await a.json();
    const jb = await b.json();
    expect(ja.contentId).toBe('c-only');
    expect(jb.contentId).toBe('c-only');
    expect(ja.idempotent).toBe(true);
    expect(jb.idempotent).toBe(true);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
