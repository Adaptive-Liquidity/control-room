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

  it('GET reports existing company without requiring membership', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.company.findFirst.mockResolvedValue({
      id: 'cmpy_1',
      name: 'Adaptive',
      slug: 'adaptive',
      setupCompletedAt: new Date(),
    });
    mockedPrisma.projectMember.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasCompany).toBe(true);
    expect(json.canManage).toBe(true);
    expect(json.ready).toBe(false);
    expect(json.missing).toEqual(expect.arrayContaining(['project', 'company_pack', 'project_pack']));
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
