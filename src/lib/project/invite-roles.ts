import type { UserRole } from '@prisma/client';
import { ForbiddenError } from '@/lib/rbac';

/**
 * Project invites must not mint org-wide JWT powers or attach
 * human-approval membership to a SERVICE account.
 */
export function resolveInviteRoles(input: {
  requested: UserRole;
  inviterGlobalRole: string;
  existingGlobalRole?: UserRole | null;
}): { globalRole: UserRole | null; membershipRole: UserRole } {
  const { requested, inviterGlobalRole, existingGlobalRole } = input;

  if (existingGlobalRole === 'SERVICE' && requested !== 'SERVICE') {
    throw new ForbiddenError('SERVICE accounts cannot receive a human project role');
  }
  if (existingGlobalRole && existingGlobalRole !== 'SERVICE' && requested === 'SERVICE') {
    throw new ForbiddenError('Cannot convert an existing account into SERVICE');
  }

  if (existingGlobalRole) {
    return { globalRole: null, membershipRole: requested };
  }

  const globalRole =
    requested === 'ADMIN' && inviterGlobalRole !== 'ADMIN' ? 'MANAGER' : requested;
  return { globalRole, membershipRole: requested };
}
