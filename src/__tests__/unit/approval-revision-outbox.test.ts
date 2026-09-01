import { shouldEnqueueN8nResume } from '@/services/approval.service';

describe('shouldEnqueueN8nResume', () => {
  it('is false for REVISION_REQUESTED', () => {
    expect(shouldEnqueueN8nResume('REVISION_REQUESTED')).toBe(false);
  });
  it('is true for APPROVED and REJECTED', () => {
    expect(shouldEnqueueN8nResume('APPROVED')).toBe(true);
    expect(shouldEnqueueN8nResume('REJECTED')).toBe(true);
  });
});
