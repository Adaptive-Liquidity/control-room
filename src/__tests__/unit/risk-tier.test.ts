import { riskTierFromGuardian } from '@/lib/guardian/risk-tier';

describe('riskTierFromGuardian', () => {
  it('maps BLOCK / high score to CRITICAL', () => {
    expect(riskTierFromGuardian('BLOCK', 10)).toBe('CRITICAL');
    expect(riskTierFromGuardian('ALLOW', 80)).toBe('CRITICAL');
  });

  it('maps REVIEW with mid score to HIGH and low REVIEW to MEDIUM', () => {
    expect(riskTierFromGuardian('REVIEW', 50)).toBe('HIGH');
    expect(riskTierFromGuardian('REVIEW', 10)).toBe('MEDIUM');
  });

  it('maps clean ALLOW to LOW', () => {
    expect(riskTierFromGuardian('ALLOW', 0)).toBe('LOW');
  });
});
