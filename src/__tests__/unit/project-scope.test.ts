import {
  resolveProjectScope,
  type ProjectMembership,
} from '@/lib/scope/project-scope';

const memberships: ProjectMembership[] = [
  { projectId: 'p1', companyId: 'c1', role: 'ADMIN' },
  { projectId: 'p2', companyId: 'c1', role: 'EDITOR' },
];

describe('resolveProjectScope', () => {
  it('resolves requested project when membership exists', () => {
    expect(
      resolveProjectScope({
        userId: 'u1',
        requestedProjectId: 'p1',
        memberships,
      })
    ).toEqual({ ok: true, projectId: 'p1', companyId: 'c1', role: 'ADMIN' });
  });

  it('rejects when requested project is not in memberships', () => {
    expect(
      resolveProjectScope({
        userId: 'u1',
        requestedProjectId: 'p999',
        memberships,
      })
    ).toEqual({ ok: false, reason: 'no_membership' });
  });

  it('rejects unauthenticated (missing userId)', () => {
    expect(
      resolveProjectScope({
        userId: null,
        requestedProjectId: 'p1',
        memberships,
      })
    ).toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('rejects empty memberships', () => {
    expect(
      resolveProjectScope({
        userId: 'u1',
        requestedProjectId: 'p1',
        memberships: [],
      })
    ).toEqual({ ok: false, reason: 'no_membership' });
  });

  it('auto-selects sole membership when request omitted', () => {
    expect(
      resolveProjectScope({
        userId: 'u1',
        requestedProjectId: undefined,
        memberships: [memberships[0]],
      })
    ).toEqual({ ok: true, projectId: 'p1', companyId: 'c1', role: 'ADMIN' });
  });

  it('requires explicit project when multiple memberships and none requested', () => {
    expect(
      resolveProjectScope({
        userId: 'u1',
        requestedProjectId: undefined,
        memberships,
      })
    ).toEqual({ ok: false, reason: 'no_project' });
  });

  it('ignores client-supplied companyId', () => {
    const result = resolveProjectScope({
      userId: 'u1',
      requestedProjectId: 'p1',
      memberships,
      clientCompanyId: 'evil-company',
    });
    expect(result).toEqual({
      ok: true,
      projectId: 'p1',
      companyId: 'c1',
      role: 'ADMIN',
    });
  });
});
