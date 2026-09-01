jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    campaign: { findFirst: jest.fn() },
    content: { findUnique: jest.fn() },
    contentRevision: {},
    approval: {},
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/project/context', () => {
  const actual = jest.requireActual('@/lib/project/context');
  return {
    ...actual,
    resolveProjectContext: jest.fn().mockResolvedValue({
      projectId: 'proj_aeon',
      slug: 'aeon',
      name: 'AEON',
      role: 'EDITOR',
      company: { id: 'cmpy_1', slug: 'adaptive', name: 'Adaptive' },
      projects: [],
    }),
  };
});

jest.mock('@/lib/n8n/generate-client', () => ({
  generateRequestSchema: jest.requireActual('@/lib/n8n/generate-client').generateRequestSchema,
  callN8nGenerate: jest.fn(),
}));

jest.mock('@/lib/n8n/campaign-policy', () => ({
  evaluateCampaignPolicy: jest.fn().mockResolvedValue({
    allowed: true,
    reason: null,
    remainingContentToday: null,
    remainingPublishToday: null,
    requireHuman: true,
  }),
}));

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { resolveProjectContext } from '@/lib/project/context';
import { POST } from '@/app/api/studio/generate/route';
import { callN8nGenerate } from '@/lib/n8n/generate-client';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  project: { findUnique: jest.Mock };
  campaign: { findFirst: jest.Mock };
  content: { findUnique: jest.Mock };
};

function projectCtx(role: string) {
  return {
    projectId: 'proj_aeon',
    slug: 'aeon',
    name: 'AEON',
    role,
    company: { id: 'cmpy_1', slug: 'adaptive', name: 'Adaptive' },
    projects: [],
  };
}

function mockPublishedPacks() {
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
}

describe('POST /api/studio/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('EDITOR'));
  });

  it('returns 409 when published packs are missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      activeContextVersion: null,
      company: { activeContextVersion: null },
    });

    const res = await POST(
      new NextRequest('http://localhost/api/studio/generate', {
        method: 'POST',
        body: JSON.stringify({ channel: 'TWITTER', type: 'TWITTER_THREAD' }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(409);
    expect(callN8nGenerate).not.toHaveBeenCalled();
  });

  it('passes campaign objective and thesis into the composed pack', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    mockedPrisma.campaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      objective: 'Grow waitlist',
      thesis: 'Liquidity is the product',
    });
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
    (callN8nGenerate as jest.Mock).mockResolvedValue({ ok: true, data: { queued: true } });

    const res = await POST(
      new NextRequest('http://localhost/api/studio/generate', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'TWITTER',
          type: 'TWITTER_THREAD',
          campaignId: 'camp-1',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(callN8nGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        contextPack: expect.objectContaining({
          promptCore: expect.objectContaining({
            campaignBrief: {
              objective: 'Grow waitlist',
              thesis: 'Liquidity is the product',
            },
          }),
        }),
      })
    );
  });

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

  it('allows REVIEWER rewrite when contentId is set (author is someone else)', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER', 'rev-1'));
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('REVIEWER'));
    mockedPrisma.content.findUnique.mockResolvedValue({
      id: 'c1',
      projectId: 'proj_aeon',
      authorId: 'ed-1',
      title: 'Old title',
      body: 'Old body',
      campaignId: null,
      approvals: [],
    });
    mockPublishedPacks();
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
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(callN8nGenerate).toHaveBeenCalled();
  });

  it('returns 403 when REVIEWER generates without contentId', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('REVIEWER', 'rev-1'));
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('REVIEWER'));

    const res = await POST(
      new NextRequest('http://localhost/api/studio/generate', {
        method: 'POST',
        body: JSON.stringify({ channel: 'TWITTER', type: 'TWITTER_THREAD' }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(403);
    expect(callN8nGenerate).not.toHaveBeenCalled();
  });
});
