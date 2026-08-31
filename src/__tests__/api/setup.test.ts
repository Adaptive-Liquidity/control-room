jest.mock('@/lib/prisma', () => ({
  prisma: {
    company: { findFirst: jest.fn(), findUnique: jest.fn() },
    projectMember: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/services/context-pack.service', () => ({
  CompanyPackRequiredError: class CompanyPackRequiredError extends Error {
    constructor() {
      super('Company must have a published context pack first');
      this.name = 'CompanyPackRequiredError';
    }
  },
  contextPackService: {
    publishCompanyPack: jest.fn().mockResolvedValue({}),
    publishProjectPack: jest.fn().mockResolvedValue({}),
  },
}));

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET, POST } from '@/app/api/setup/route';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  company: { findFirst: jest.Mock; findUnique: jest.Mock };
  projectMember: { findMany: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};

describe('/api/setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET does not disclose a company the caller does not belong to', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.projectMember.findMany.mockResolvedValue([]);

    const res = await GET(new NextRequest('http://localhost/api/setup'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasCompany).toBe(false);
    expect(json.company).toBeNull();
    expect(json.canManage).toBe(true);
    expect(json.ready).toBe(false);
    expect(mockedPrisma.company.findFirst).not.toHaveBeenCalled();
  });

  it('GET reports the caller membership company', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.projectMember.findMany.mockResolvedValue([
      {
        projectId: 'proj_aeon',
        project: {
          id: 'proj_aeon',
          activeContextVersionId: 'pv1',
          company: {
            id: 'cmpy_1',
            name: 'Adaptive',
            slug: 'adaptive',
            activeContextVersionId: 'cv1',
          },
        },
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/setup'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasCompany).toBe(true);
    expect(json.company).toEqual({ id: 'cmpy_1', name: 'Adaptive', slug: 'adaptive' });
    expect(json.ready).toBe(true);
  });

  it('GET reports the active project company when memberships span companies', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      ...session('ADMIN', 'admin-1'),
      user: {
        ...session('ADMIN', 'admin-1').user,
        lastActiveProjectId: 'proj_b',
      },
    });
    mockedPrisma.projectMember.findMany.mockResolvedValue([
      {
        projectId: 'proj_a',
        project: {
          id: 'proj_a',
          activeContextVersionId: 'pv-a',
          company: {
            id: 'cmpy_a',
            name: 'Alpha',
            slug: 'alpha',
            activeContextVersionId: 'cv-a',
          },
        },
      },
      {
        projectId: 'proj_b',
        project: {
          id: 'proj_b',
          activeContextVersionId: 'pv-b',
          company: {
            id: 'cmpy_b',
            name: 'Bravo',
            slug: 'bravo',
            activeContextVersionId: 'cv-b',
          },
        },
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/setup'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.company).toEqual({ id: 'cmpy_b', name: 'Bravo', slug: 'bravo' });
    expect(json.hasCompany).toBe(true);
  });

  it('POST extra project uses the active project company', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      ...session('ADMIN', 'admin-1'),
      user: {
        ...session('ADMIN', 'admin-1').user,
        lastActiveProjectId: 'proj_b',
      },
    });
    mockedPrisma.projectMember.findMany.mockResolvedValue([
      {
        projectId: 'proj_a',
        project: {
          id: 'proj_a',
          activeContextVersionId: 'pv-a',
          company: {
            id: 'cmpy_a',
            name: 'Alpha',
            slug: 'alpha',
            activeContextVersionId: 'cv-a',
          },
        },
      },
      {
        projectId: 'proj_b',
        project: {
          id: 'proj_b',
          activeContextVersionId: 'pv-b',
          company: {
            id: 'cmpy_b',
            name: 'Bravo',
            slug: 'bravo',
            activeContextVersionId: 'cv-b',
          },
        },
      },
    ]);
    mockedPrisma.company.findUnique.mockResolvedValue({
      id: 'cmpy_b',
      name: 'Bravo',
      slug: 'bravo',
    });
    const create = jest.fn().mockResolvedValue({ id: 'proj_new' });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        project: { create },
        projectMember: { create: jest.fn() },
        user: { update: jest.fn() },
      })
    );

    const res = await POST(
      new NextRequest('http://localhost/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          company: { name: 'Ignored', slug: 'ignored' },
          project: { name: 'New HQ', slug: 'new-hq' },
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'cmpy_b', slug: 'new-hq' }),
      })
    );
    expect(mockedPrisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'cmpy_b' },
    });
  });

  it('POST refuses extra project when companies span and no active project is set', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.projectMember.findMany.mockResolvedValue([
      {
        projectId: 'proj_a',
        project: {
          id: 'proj_a',
          activeContextVersionId: 'pv-a',
          company: {
            id: 'cmpy_a',
            name: 'Alpha',
            slug: 'alpha',
            activeContextVersionId: 'cv-a',
          },
        },
      },
      {
        projectId: 'proj_b',
        project: {
          id: 'proj_b',
          activeContextVersionId: 'pv-b',
          company: {
            id: 'cmpy_b',
            name: 'Bravo',
            slug: 'bravo',
            activeContextVersionId: 'cv-b',
          },
        },
      },
    ]);

    const res = await POST(
      new NextRequest('http://localhost/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          company: { name: 'Ignored', slug: 'ignored' },
          project: { name: 'New HQ', slug: 'new-hq' },
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(409);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('POST rejects non-admin', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    const res = await POST(
      new NextRequest('http://localhost/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          company: { name: 'X', slug: 'x' },
          project: { name: 'Y', slug: 'y' },
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(403);
  });
});
