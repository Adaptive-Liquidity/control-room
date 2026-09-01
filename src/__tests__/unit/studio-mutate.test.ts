import {
  STUDIO_EDITABLE_STATUSES,
  assertStudioMutator,
  isStudioEditableStatus,
} from '@/lib/content/studio-mutate';
import { ForbiddenError } from '@/lib/rbac';

describe('studio-mutate', () => {
  it('allows DRAFT REVISION_REQUESTED REJECTED only', () => {
    expect(STUDIO_EDITABLE_STATUSES).toEqual(['DRAFT', 'REVISION_REQUESTED', 'REJECTED']);
    expect(isStudioEditableStatus('DRAFT')).toBe(true);
    expect(isStudioEditableStatus('PENDING_REVIEW')).toBe(false);
    expect(isStudioEditableStatus('APPROVED')).toBe(false);
  });

  it('allows the author with content.edit', () => {
    expect(() =>
      assertStudioMutator({ userId: 'ed-1', role: 'EDITOR', authorId: 'ed-1' })
    ).not.toThrow();
  });

  it('allows a non-author with content.approve', () => {
    expect(() =>
      assertStudioMutator({ userId: 'rev-1', role: 'REVIEWER', authorId: 'ed-1' })
    ).not.toThrow();
  });

  it('forbids VIEWER and non-author EDITOR', () => {
    expect(() =>
      assertStudioMutator({ userId: 'v-1', role: 'VIEWER', authorId: 'ed-1' })
    ).toThrow(ForbiddenError);
    expect(() =>
      assertStudioMutator({ userId: 'ed-2', role: 'EDITOR', authorId: 'ed-1' })
    ).toThrow(ForbiddenError);
  });
});
