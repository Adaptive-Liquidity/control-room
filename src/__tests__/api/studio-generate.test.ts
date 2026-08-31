jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    campaign: { findFirst: jest.fn() },
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

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/studio/generate/route';
import { callN8nGenerate } from '@/lib/n8n/generate-client';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  project: { findUnique: jest.Mock };
};

describe('POST /api/studio/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
