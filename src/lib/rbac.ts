import type { Session } from 'next-auth';
import type { UserRole } from '@prisma/client';

export type Permission =
  | 'content.approve'
  | 'content.edit'
  | 'campaign.launch'
  | 'integration.manage'
  | 'settings.manage'
  | 'company.manage'
  | 'project.manage';

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    'content.approve',
    'content.edit',
    'campaign.launch',
    'integration.manage',
    'settings.manage',
    'company.manage',
    'project.manage',
  ],
  MANAGER: ['content.approve', 'content.edit', 'campaign.launch', 'project.manage'],
  REVIEWER: ['content.approve'],
  EDITOR: ['content.edit'],
  VIEWER: [],
  SERVICE: [],
};

export function permissionsForRole(role: UserRole | string | undefined | null): readonly Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as UserRole] ?? [];
}

export function hasPermission(
  role: UserRole | string | undefined | null,
  permission: Permission
): boolean {
  return permissionsForRole(role).includes(permission);
}

export function requirePermission(
  session: Session | null | undefined,
  permission: Permission
): asserts session is Session {
  if (!session?.user?.id) {
    throw new ForbiddenError('Unauthorized');
  }
  if (!hasPermission(session.user.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
