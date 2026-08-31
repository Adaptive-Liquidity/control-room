import { UserRole } from '@prisma/client';
import { ForbiddenError } from '@/lib/rbac';
import { resolveInviteRoles } from '@/lib/project/invite-roles';

describe('resolveInviteRoles', () => {
  it('does not mint global ADMIN unless the inviter is a global ADMIN', () => {
    expect(
      resolveInviteRoles({
        requested: UserRole.ADMIN,
        inviterGlobalRole: 'MANAGER',
      })
    ).toEqual({ globalRole: UserRole.MANAGER, membershipRole: UserRole.ADMIN });

    expect(
      resolveInviteRoles({
        requested: UserRole.ADMIN,
        inviterGlobalRole: 'ADMIN',
      })
    ).toEqual({ globalRole: UserRole.ADMIN, membershipRole: UserRole.ADMIN });
  });

  it('does not change User.role when adding an existing human to a project', () => {
    expect(
      resolveInviteRoles({
        requested: UserRole.ADMIN,
        inviterGlobalRole: 'ADMIN',
        existingGlobalRole: UserRole.EDITOR,
      })
    ).toEqual({ globalRole: null, membershipRole: UserRole.ADMIN });
  });

  it('rejects attaching a human role to a SERVICE account', () => {
    expect(() =>
      resolveInviteRoles({
        requested: UserRole.REVIEWER,
        inviterGlobalRole: 'ADMIN',
        existingGlobalRole: UserRole.SERVICE,
      })
    ).toThrow(ForbiddenError);
  });

  it('rejects converting an existing human into SERVICE', () => {
    expect(() =>
      resolveInviteRoles({
        requested: UserRole.SERVICE,
        inviterGlobalRole: 'ADMIN',
        existingGlobalRole: UserRole.EDITOR,
      })
    ).toThrow(ForbiddenError);
  });

  it('allows inviting a new SERVICE account for n8n', () => {
    expect(
      resolveInviteRoles({
        requested: UserRole.SERVICE,
        inviterGlobalRole: 'ADMIN',
      })
    ).toEqual({ globalRole: UserRole.SERVICE, membershipRole: UserRole.SERVICE });
  });
});
