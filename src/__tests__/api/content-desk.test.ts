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
import { ForbiddenError } from '@/lib/rbac';
import { ConflictError, ValidationServiceError } from '@/services/content.service';
import { session } from '../helpers/n8n';

describe('content desk routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PATCH returns 403 for VIEWER', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('VIEWER', 'v-1'));
    jest.spyOn(contentService, 'update').mockRejectedValueOnce(
      new ForbiddenError('Missing permission: content.edit')
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
      new ConflictError('Cannot edit content in status PENDING_REVIEW')
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
      new ValidationServiceError('Guardian BLOCK; revision not saved')
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
