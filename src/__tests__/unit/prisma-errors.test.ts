import { isUniqueConstraintError } from '@/lib/prisma-errors';

describe('isUniqueConstraintError', () => {
  it('detects Prisma P2002', () => {
    expect(isUniqueConstraintError({ code: 'P2002', meta: { target: ['slug'] } })).toBe(true);
  });

  it('rejects other errors', () => {
    expect(isUniqueConstraintError(new Error('boom'))).toBe(false);
    expect(isUniqueConstraintError({ code: 'P2003' })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
