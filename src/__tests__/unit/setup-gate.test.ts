import { evaluateSetupGate } from '@/lib/setup/setup-gate';

describe('evaluateSetupGate', () => {
  it('blocks when there are no memberships', () => {
    expect(evaluateSetupGate({ memberships: [] })).toEqual({
      ready: false,
      missing: ['project', 'company_pack', 'project_pack'],
    });
  });

  it('is ready when a membership has both published packs', () => {
    expect(
      evaluateSetupGate({
        memberships: [
          {
            projectId: 'p1',
            companyId: 'c1',
            hasPublishedCompanyPack: true,
            hasPublishedProjectPack: true,
          },
        ],
      })
    ).toEqual({ ready: true, projectId: 'p1' });
  });

  it('names missing packs when project exists but packs are draft', () => {
    const result = evaluateSetupGate({
      memberships: [
        {
          projectId: 'p1',
          companyId: 'c1',
          hasPublishedCompanyPack: false,
          hasPublishedProjectPack: false,
        },
      ],
    });
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(
        expect.arrayContaining(['company_pack', 'project_pack'])
      );
    }
  });
});
