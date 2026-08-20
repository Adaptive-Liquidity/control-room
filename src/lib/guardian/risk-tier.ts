import type { ContentRiskTier, GuardianResult } from '@prisma/client';

/** Map Guardian verdict + score onto Content.riskTier. */
export function riskTierFromGuardian(
  result: GuardianResult | 'ALLOW' | 'REVIEW' | 'BLOCK',
  score: number
): ContentRiskTier {
  if (result === 'BLOCK' || score >= 80) return 'CRITICAL';
  if (result === 'REVIEW' && score >= 40) return 'HIGH';
  if (result === 'REVIEW') return 'MEDIUM';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}
