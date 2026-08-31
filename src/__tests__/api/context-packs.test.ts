jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
  },
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
        projectId: 'proj_aeon',
        slug: 'aeon',
        name: 'AEON',
        role: session?.user?.role ?? 'ADMIN',
        company: { id: 'cmpy_1', slug: 'adaptive', name: 'Adaptive' },
        projects: [],
      };
    }),
  };
});

jest.mock('@/services/context-pack.service', () => ({
  contextPackService: {
    publishCompanyPack: jest.fn(),
    publishProjectPack: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { contextPackService } from '@/services/context-pack.service';
import { GET, PUT } from '@/app/api/context/route';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  project: { findUnique: jest.Mock };
};

describe('/api/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns active company and project packs', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      name: 'AEON',
      slug: 'aeon',
      companyId: 'cmpy_1',
      activeContextVersion: {
        version: 1,
        contentHash: 'sha256:p',
        publishedAt: new Date('2026-08-20T00:00:00.000Z'),
        pack: { schemaVersion: '1', promptCore: { identity: { name: 'AEON' } } },
      },
      company: {
        id: 'cmpy_1',
        name: 'Adaptive',
        slug: 'adaptive',
        legalName: null,
        activeContextVersion: {
          version: 2,
          contentHash: 'sha256:c',
          publishedAt: new Date('2026-08-20T00:00:00.000Z'),
          pack: { schemaVersion: '1', promptCore: { voice: { tone: 'precise' } } },
        },
      },
    });

    const res = await GET(new NextRequest('http://localhost/api/context'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.company.version).toBe(2);
    expect(json.project.version).toBe(1);
    expect(json.company.pack.promptCore.voice.tone).toBe('precise');
  });

  it('PUT company pack requires company.manage', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    const res = await PUT(
      new NextRequest('http://localhost/api/context', {
        method: 'PUT',
        body: JSON.stringify({ scope: 'company', voiceTone: 'calm' }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('PUT publishes a new company pack version', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      name: 'AEON',
      slug: 'aeon',
      companyId: 'cmpy_1',
      activeContextVersion: { pack: { schemaVersion: '1', promptCore: {} } },
      company: {
        id: 'cmpy_1',
        name: 'Adaptive',
        slug: 'adaptive',
        legalName: null,
        activeContextVersion: {
          pack: { schemaVersion: '1', promptCore: { identity: { name: 'Adaptive' } } },
        },
      },
    });
    (contextPackService.publishCompanyPack as jest.Mock).mockResolvedValue({
      version: 3,
      contentHash: 'sha256:new',
      publishedAt: new Date('2026-08-31T00:00:00.000Z'),
    });

    const res = await PUT(
      new NextRequest('http://localhost/api/context', {
        method: 'PUT',
        body: JSON.stringify({ scope: 'company', voiceTone: 'calm', dontSay: ['moon'] }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ scope: 'company', version: 3 });
    expect(contextPackService.publishCompanyPack).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'cmpy_1',
        createdById: 'admin-1',
      })
    );
  });
});
