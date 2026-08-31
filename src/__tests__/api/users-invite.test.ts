jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    projectMember: { upsert: jest.fn() },
    $transaction: jest.fn(),
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
      role: 'ADMIN',
      company: { id: 'cmpy_1', slug: 'adaptive', name: 'Adaptive' },
      projects: [],
    }),
  };
});

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/users/route';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

describe('POST /api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds an existing user to the project instead of 409', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'admin-1'));
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      email: 'editor@aeon.test',
      role: 'EDITOR',
    });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        projectMember: { upsert: jest.fn().mockResolvedValue({ role: 'EDITOR' }) },
        activityLog: { create: jest.fn().mockResolvedValue({}) },
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'user-existing',
            email: 'editor@aeon.test',
            name: 'editor',
            role: 'EDITOR',
            isActive: true,
          }),
        },
      })
    );

    const res = await POST(
      new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'editor@aeon.test',
          password: 'AeonEditor123!',
          role: 'EDITOR',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.existing).toBe(true);
    expect(json.user.email).toBe('editor@aeon.test');
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });
});
