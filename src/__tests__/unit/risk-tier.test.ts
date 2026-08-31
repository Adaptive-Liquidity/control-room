import { riskTierFromGuardian } from '@/lib/guardian/risk-tier';

describe('riskTierFromGuardian', () => {
  it('maps BLOCK or very low safety score to CRITICAL', () => {
    expect(riskTierFromGuardian('BLOCK', 10)).toBe('CRITICAL');
    expect(riskTierFromGuardian('ALLOW', 10)).toBe('CRITICAL');
  });

  it('maps REVIEW with lower safety score to HIGH and safer REVIEW to MEDIUM', () => {
    expect(riskTierFromGuardian('REVIEW', 50)).toBe('HIGH');
    expect(riskTierFromGuardian('REVIEW', 80)).toBe('MEDIUM');
  });

  it('maps clean ALLOW (score 100) to LOW', () => {
    expect(riskTierFromGuardian('ALLOW', 100)).toBe('LOW');
    expect(riskTierFromGuardian('ALLOW', 80)).toBe('LOW');
  });
});
