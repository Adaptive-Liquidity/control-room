/**
 * API integration tests — prisma / pusher / resume mocked.
 * Covers: draft idempotency, bad sig, approve/reject/revision, stale 409,
 * publish receipt → PUBLISHED only.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    content: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contentRevision: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    n8nBridgeJob: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    publishReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    agentRun: {
      findUnique: jest.fn(),
    },
    metricSnapshot: {
      findUnique: jest.fn(),
    },
    attributionEvent: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    campaign: {
      findUnique: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    approval: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/pusher/server', () => ({
  emitContentCreated: jest.fn().mockResolvedValue(undefined),
  emitContentUpdated: jest.fn().mockResolvedValue(undefined),
  emitContentApproved: jest.fn().mockResolvedValue(undefined),
  emitContentRejected: jest.fn().mockResolvedValue(undefined),
  emitContentPublished: jest.fn().mockResolvedValue(undefined),
  emitAgentRunUpdated: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/crypto', () => ({
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/project/context', () => {
  const actual = jest.requireActual('@/lib/project/context');
  const { getServerSession } = jest.requireMock('next-auth') as {
    getServerSession: jest.Mock;
  };
  return {
    ...actual,
    resolveProjectContext: jest.fn().mockImplementation(async () => {
      const session = await getServerSession();
      return {
        projectId: 'project-1',
        slug: 'project-1',
        name: 'Project 1',
        role: session?.user?.role ?? 'REVIEWER',
        company: { id: 'company-1', slug: 'company-1', name: 'Company 1' },
        projects: [],
      };
    }),
  };
});

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { POST as draftPost } from '@/app/api/integrations/n8n/drafts/route';
import { POST as receiptPost } from '@/app/api/integrations/n8n/publish-receipt/route';
import { POST as approvePost } from '@/app/api/queue/[id]/approve/route';
import { POST as rejectPost } from '@/app/api/queue/[id]/reject/route';
import { POST as revisionPost } from '@/app/api/queue/[id]/request-revision/route';
import { makeJsonRequest, session } from '../helpers/n8n';
import { NextRequest } from 'next/server';
import { ConflictError, ValidationServiceError } from '@/services/content.service';
import { approvalService } from '@/services/approval.service';
import { emitContentPublished } from '@/lib/pusher/server';

const mockedPrisma = prisma as unknown as {
  content: { findUnique: jest.Mock };
  contentRevision: { findUnique: jest.Mock };
  publishReceipt: { findUnique: jest.Mock; create: jest.Mock };
  n8nBridgeJob: { findUnique: jest.Mock };
  agentRun: { findUnique: jest.Mock };
  metricSnapshot: { findUnique: jest.Mock };
  attributionEvent: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const draftBody = {
  schemaVersion: '1',
  eventId: 'evt-draft-1',
  externalDraftId: 'ext-draft-1',
  workflowId: 'wf-1',
  executionId: 'exec-1',
  projectId: 'proj_aeon',
  resumeUrl: 'https://n8n.example/webhook/wait/abc',
  content: {
    title: 'Test draft',
    body: 'Body for test draft content.',
    type: 'TWITTER_THREAD',
    channel: 'TWITTER',
  },
};

describe('n8n draft ingress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.n8nBridgeJob.findUnique.mockResolvedValue(null);
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.agentRun.findUnique.mockResolvedValue(null);
    mockedPrisma.metricSnapshot.findUnique.mockResolvedValue(null);
    mockedPrisma.attributionEvent.findUnique.mockResolvedValue(null);
  });

  it('rejects bad signature with 401', async () => {
    const req = makeJsonRequest('http://localhost/api/integrations/n8n/drafts', draftBody, {
      badSig: true,
    });
    const res = await draftPost(req);
    expect(res.status).toBe(401);
  });

  it('returns idempotent existing draft by externalDraftId', async () => {
    mockedPrisma.content.findUnique.mockResolvedValue({
      id: 'c1',
      projectId: 'proj_aeon',
      currentRevisionId: 'r1',
      status: 'PENDING_REVIEW',
      guardianScore: 88,
      author: { id: 'u1', email: 's@t', name: 'svc', role: 'SERVICE' },
      revisions: [{ id: 'r1' }],
    });

    const req = makeJsonRequest('http://localhost/api/integrations/n8n/drafts', draftBody);
    const res = await draftPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      contentId: 'c1',
      revisionId: 'r1',
      idempotent: true,
    });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when externalDraftId already exists on another project', async () => {
    mockedPrisma.content.findUnique.mockResolvedValue({
      id: 'c-other',
      projectId: 'proj_other',
      currentRevisionId: 'r-other',
      status: 'PENDING_REVIEW',
      guardianScore: 88,
      author: { id: 'u1', email: 's@t', name: 'svc', role: 'SERVICE' },
      revisions: [{ id: 'r-other' }],
    });

    const req = makeJsonRequest('http://localhost/api/integrations/n8n/drafts', draftBody);
    const res = await draftPost(req);
    expect(res.status).toBe(409);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('queue approve / reject / revision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('VIEWER approve returns 403', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('VIEWER'));
    const req = new NextRequest('http://localhost/api/queue/c1/approve', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await approvePost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(403);
  });

  it('EDITOR approve returns 403', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR'));
    const req = new NextRequest('http://localhost/api/queue/c1/approve', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await approvePost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(403);
  });

  it('stale revision returns 409', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER'));
    jest.spyOn(approvalService, 'decide').mockRejectedValueOnce(
      new ConflictError('Stale revision: content was updated since the reviewer loaded it')
    );

    const req = new NextRequest('http://localhost/api/queue/c1/approve', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'stale-r' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await approvePost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(409);
  });

  it('reject without comment returns 400 (zod)', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER'));
    const req = new NextRequest('http://localhost/api/queue/c1/reject', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await rejectPost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(400);
  });

  it('reject with comment succeeds via approvalService', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER'));
    jest.spyOn(approvalService, 'decide').mockResolvedValueOnce({
      id: 'c1',
      status: 'REJECTED',
    } as never);

    const req = new NextRequest('http://localhost/api/queue/c1/reject', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1', comment: 'Off brand' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await rejectPost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(200);
    expect(approvalService.decide).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'REJECTED', comment: 'Off brand' })
    );
  });

  it('request-revision calls decide with REVISION_REQUESTED', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('MANAGER'));
    jest.spyOn(approvalService, 'decide').mockResolvedValueOnce({
      id: 'c1',
      status: 'REVISION_REQUESTED',
    } as never);

    const req = new NextRequest('http://localhost/api/queue/c1/request-revision', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1', comment: 'Please tighten claims' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await revisionPost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(200);
    expect(approvalService.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'REVISION_REQUESTED',
        expectedRevisionId: 'r1',
        comment: 'Please tighten claims',
      })
    );
  });

  it('maps ValidationServiceError to 422', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER'));
    jest
      .spyOn(approvalService, 'decide')
      .mockRejectedValueOnce(new ValidationServiceError('Comment required for rejection'));

    const req = new NextRequest('http://localhost/api/queue/c1/approve', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'r1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await approvePost(req, { params: { id: 'c1' } });
    expect(res.status).toBe(422);
  });
});

describe('publish receipt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const receiptBody = {
    schemaVersion: '1',
    eventId: 'evt-receipt-1',
    contentId: 'c1',
    revisionId: 'r1',
    contentHash: 'abc123',
    channel: 'TWITTER',
    status: 'SUCCESS' as const,
    executionId: 'exec-9',
    platformPostId: 'tw-1',
  };

  it('rejects bad signature', async () => {
    const req = makeJsonRequest(
      'http://localhost/api/integrations/n8n/publish-receipt',
      receiptBody,
      { badSig: true }
    );
    const res = await receiptPost(req);
    expect(res.status).toBe(401);
  });

  it('SUCCESS receipt sets content PUBLISHED and emits realtime', async () => {
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.contentRevision.findUnique.mockResolvedValue({
      id: 'r1',
      contentId: 'c1',
      contentHash: 'abc123',
      title: 'T',
      guardianResult: 'ALLOW',
      content: { status: 'APPROVED', projectId: 'proj_aeon', currentRevisionId: 'r1' },
    });

    const contentUpdate = jest.fn().mockResolvedValue({ id: 'c1', status: 'PUBLISHED' });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        publishReceipt: {
          create: jest.fn().mockResolvedValue({ id: 'pr1', status: 'SUCCESS' }),
        },
        content: { update: contentUpdate },
        activityLog: { create: jest.fn().mockResolvedValue({}) },
      })
    );

    const req = makeJsonRequest(
      'http://localhost/api/integrations/n8n/publish-receipt',
      receiptBody
    );
    const res = await receiptPost(req);
    expect(res.status).toBe(201);
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      })
    );
    expect(emitContentPublished).toHaveBeenCalledWith(
      expect.objectContaining({ contentId: 'c1', status: 'PUBLISHED' })
    );
  });

  it('rejects SUCCESS receipt when revision is not current', async () => {
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.contentRevision.findUnique.mockResolvedValue({
      id: 'r1',
      contentId: 'c1',
      contentHash: 'abc123',
      title: 'T',
      guardianResult: 'ALLOW',
      content: { status: 'APPROVED', projectId: 'proj_aeon', currentRevisionId: 'r-newer' },
    });

    const req = makeJsonRequest(
      'http://localhost/api/integrations/n8n/publish-receipt',
      { ...receiptBody, eventId: 'evt-stale-rev' }
    );
    const res = await receiptPost(req);
    expect(res.status).toBe(422);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects SUCCESS receipt when content is still PENDING_REVIEW', async () => {
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.contentRevision.findUnique.mockResolvedValue({
      id: 'r1',
      contentId: 'c1',
      contentHash: 'abc123',
      title: 'T',
      guardianResult: 'ALLOW',
      content: { status: 'PENDING_REVIEW', projectId: 'proj_aeon', currentRevisionId: 'r1' },
    });

    const req = makeJsonRequest(
      'http://localhost/api/integrations/n8n/publish-receipt',
      { ...receiptBody, eventId: 'evt-pending' }
    );
    const res = await receiptPost(req);
    expect(res.status).toBe(422);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('FAILED receipt does not update content to PUBLISHED', async () => {
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.contentRevision.findUnique.mockResolvedValue({
      id: 'r1',
      contentId: 'c1',
      contentHash: 'abc123',
      title: 'T',
      guardianResult: 'ALLOW',
      content: { status: 'APPROVED', projectId: 'proj_aeon', currentRevisionId: 'r1' },
    });

    const contentUpdate = jest.fn();
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        publishReceipt: {
          create: jest.fn().mockResolvedValue({ id: 'pr2', status: 'FAILED' }),
        },
        content: { update: contentUpdate },
        activityLog: { create: jest.fn() },
      })
    );

    const req = makeJsonRequest(
      'http://localhost/api/integrations/n8n/publish-receipt',
      { ...receiptBody, eventId: 'evt-fail', status: 'FAILED', errorCode: 'POST_FAIL' }
    );
    const res = await receiptPost(req);
    expect(res.status).toBe(201);
    expect(contentUpdate).not.toHaveBeenCalled();
  });
});
