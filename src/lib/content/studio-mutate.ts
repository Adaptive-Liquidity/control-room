import { ForbiddenError, hasPermission } from '@/lib/rbac';

export const STUDIO_EDITABLE_STATUSES = ['DRAFT', 'REVISION_REQUESTED', 'REJECTED'] as const;
export type StudioEditableStatus = (typeof STUDIO_EDITABLE_STATUSES)[number];

export function isStudioEditableStatus(status: string): status is StudioEditableStatus {
  return (STUDIO_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function canStudioMutate(opts: {
  userId: string;
  role: string;
  authorId: string;
}): boolean {
  const isAuthor = opts.userId === opts.authorId;
  if (isAuthor && hasPermission(opts.role, 'content.edit')) return true;
  if (hasPermission(opts.role, 'content.approve')) return true;
  return false;
}

export function assertStudioMutator(opts: {
  userId: string;
  role: string;
  authorId: string;
}): void {
  if (canStudioMutate(opts)) return;
  throw new ForbiddenError('Missing permission: content.edit');
}
