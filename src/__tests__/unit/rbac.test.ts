import {
  ForbiddenError,
  hasPermission,
  permissionsForRole,
  requirePermission,
} from '@/lib/rbac';
import {
  ForbiddenProjectError,
  requireProjectPermission,
  type ProjectContext,
} from '@/lib/project/context';
import type { Session } from 'next-auth';

function sessionFor(role: string, id = 'user-1'): Session {
  return {
    expires: new Date(Date.now() + 3600_000).toISOString(),
    user: { id, email: `${role}@test.local`, role: role as Session['user']['role'] },
  };
}

describe('RBAC', () => {
  it('ADMIN has all permissions', () => {
    expect(permissionsForRole('ADMIN')).toEqual(
      expect.arrayContaining([
        'content.approve',
        'content.edit',
        'campaign.launch',
        'integration.manage',
        'settings.manage',
        'company.manage',
        'project.manage',
      ])
    );
  });

  it('MANAGER can manage projects but not company packs', () => {
    expect(hasPermission('MANAGER', 'project.manage')).toBe(true);
    expect(hasPermission('MANAGER', 'company.manage')).toBe(false);
  });

  it('REVIEWER can approve but not edit', () => {
    expect(hasPermission('REVIEWER', 'content.approve')).toBe(true);
    expect(hasPermission('REVIEWER', 'content.edit')).toBe(false);
  });

  it('EDITOR can edit but not approve', () => {
    expect(hasPermission('EDITOR', 'content.edit')).toBe(true);
    expect(hasPermission('EDITOR', 'content.approve')).toBe(false);
  });

  it('VIEWER and SERVICE have no permissions', () => {
    expect(permissionsForRole('VIEWER')).toEqual([]);
    expect(permissionsForRole('SERVICE')).toEqual([]);
    expect(hasPermission('VIEWER', 'content.approve')).toBe(false);
    expect(hasPermission('SERVICE', 'content.approve')).toBe(false);
  });

  it('requirePermission throws ForbiddenError for missing permission', () => {
    expect(() => requirePermission(sessionFor('VIEWER'), 'content.approve')).toThrow(
      ForbiddenError
    );
    expect(() => requirePermission(sessionFor('EDITOR'), 'content.approve')).toThrow(
      /Missing permission/
    );
  });

  it('requirePermission throws for unauthenticated session', () => {
    expect(() => requirePermission(null, 'content.edit')).toThrow(/Unauthorized/);
  });

  it('requirePermission allows REVIEWER to approve', () => {
    expect(() =>
      requirePermission(sessionFor('REVIEWER'), 'content.approve')
    ).not.toThrow();
  });

  it('requireProjectPermission uses membership role, not a global role', () => {
    const ctx = { role: 'VIEWER' } as ProjectContext;
    expect(() => requireProjectPermission(ctx, 'content.approve')).toThrow(
      ForbiddenProjectError
    );
    expect(() =>
      requireProjectPermission({ role: 'REVIEWER' } as ProjectContext, 'content.approve')
    ).not.toThrow();
  });
});
