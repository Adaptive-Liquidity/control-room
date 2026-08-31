import type { ContentRiskTier, GuardianResult } from '@prisma/client';

/**
 * Map Guardian verdict + score onto Content.riskTier.
 * Guardian score is safety (100 = clean, 0 = heavily flagged). Lower score = higher risk.
 */
export function riskTierFromGuardian(
  result: GuardianResult | 'ALLOW' | 'REVIEW' | 'BLOCK',
  score: number
): ContentRiskTier {
  if (result === 'BLOCK' || score <= 20) return 'CRITICAL';
  if (result === 'REVIEW' && score <= 60) return 'HIGH';
  if (result === 'REVIEW') return 'MEDIUM';
  if (score <= 75) return 'MEDIUM';
  return 'LOW';
}
