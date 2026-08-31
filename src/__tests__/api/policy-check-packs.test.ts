jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    campaign: { findUnique: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/integrations/n8n/policy-check/route';
import { makeJsonRequest } from '../helpers/n8n';

const mockedPrisma = prisma as unknown as {
  project: { findUnique: jest.Mock };
};

describe('n8n policy-check context packs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unscoped allow when projectId is omitted', async () => {
    const res = await POST(
      makeJsonRequest('http://localhost/api/integrations/n8n/policy-check', {
        schemaVersion: '1',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.allowed).toBe(true);
    expect(json.contextPack).toBeUndefined();
  });

  it('returns composed pack when projectId has published versions', async () => {
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      slug: 'aeon',
      companyId: 'cmpy_1',
      activeContextVersion: {
        id: 'pcv-1',
        version: 1,
        contentHash: 'sha256:project',
        pack: {
          schemaVersion: '1',
          promptCore: { identity: { name: 'AEON' }, prohibitions: { forbiddenClaims: [] } },
        },
      },
      company: {
        id: 'cmpy_1',
        slug: 'adaptive',
        activeContextVersion: {
          id: 'ccv-1',
          pack: {
            schemaVersion: '1',
            promptCore: {
              identity: { name: 'Adaptive' },
              voice: { tone: 'precise' },
              prohibitions: { forbiddenClaims: ['moon'] },
            },
          },
        },
      },
    });

    const res = await POST(
      makeJsonRequest('http://localhost/api/integrations/n8n/policy-check', {
        schemaVersion: '1',
        projectId: 'proj_aeon',
        include: ['contextPack'],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.allowed).toBe(true);
    expect(json.composedHash).toMatch(/^sha256:/);
    expect(json.contextPack.promptCore.identity.name).toBe('AEON');
    expect(json.project).toMatchObject({ id: 'proj_aeon', slug: 'aeon' });
  });

  it('fails closed when packs are missing', async () => {
    mockedPrisma.project.findUnique.mockResolvedValue({
      id: 'proj_aeon',
      slug: 'aeon',
      companyId: 'cmpy_1',
      activeContextVersion: null,
      company: { id: 'cmpy_1', slug: 'adaptive', activeContextVersion: null },
    });

    const res = await POST(
      makeJsonRequest('http://localhost/api/integrations/n8n/policy-check', {
        schemaVersion: '1',
        projectId: 'proj_aeon',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.allowed).toBe(false);
    expect(json.reason).toBe('no_context_pack');
  });
});
