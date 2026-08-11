import { createHash } from 'crypto';
import { hashContent } from '@/services/content.service';
import {
  deriveResult,
  isNegatedMatch,
} from '@/lib/guardian/guardian.service';

describe('hashContent', () => {
  it('is stable sha256 of title\\nbody', () => {
    const expected = createHash('sha256').update('Hello\nWorld').digest('hex');
    expect(hashContent('Hello', 'World')).toBe(expected);
  });

  it('changes when title or body changes', () => {
    const a = hashContent('A', 'body');
    const b = hashContent('B', 'body');
    const c = hashContent('A', 'other');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('Guardian deriveResult / severity', () => {
  it('BLOCK only when CRITICAL severity AND BLOCK action', () => {
    expect(
      deriveResult([{ severity: 'CRITICAL', action: 'BLOCK' }])
    ).toBe('BLOCK');
  });

  it('non-critical BLOCK becomes REVIEW', () => {
    expect(deriveResult([{ severity: 'ERROR', action: 'BLOCK' }])).toBe('REVIEW');
    expect(deriveResult([{ severity: 'WARNING', action: 'BLOCK' }])).toBe('REVIEW');
  });

  it('REVIEW action yields REVIEW', () => {
    expect(deriveResult([{ severity: 'INFO', action: 'REVIEW' }])).toBe('REVIEW');
  });

  it('empty findings allow', () => {
    expect(deriveResult([])).toBe('ALLOW');
  });

  it('CRITICAL+BLOCK wins over other findings', () => {
    expect(
      deriveResult([
        { severity: 'INFO', action: 'ALLOW' },
        { severity: 'CRITICAL', action: 'BLOCK' },
      ])
    ).toBe('BLOCK');
  });
});

describe('isNegatedMatch', () => {
  it('detects "not financial advice" style negation', () => {
    const text = 'This is not financial advice about yields';
    const idx = text.toLowerCase().indexOf('financial advice');
    expect(isNegatedMatch(text, idx)).toBe(true);
  });

  it('does not negate bare matches', () => {
    const text = 'guaranteed financial advice tomorrow';
    const idx = text.indexOf('financial advice');
    expect(isNegatedMatch(text, idx)).toBe(false);
  });
});
