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

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET, POST } from '@/app/api/setup/route';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  company: { findFirst: jest.Mock; findUnique: jest.Mock };
  projectMember: { findMany: jest.Mock; findFirst: jest.Mock };
};

describe('/api/setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET does not disclose a company the caller does not belong to', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.projectMember.findMany.mockResolvedValue([]);

    const res = await GET();
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

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasCompany).toBe(true);
    expect(json.company).toEqual({ id: 'cmpy_1', name: 'Adaptive', slug: 'adaptive' });
    expect(json.ready).toBe(true);
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
