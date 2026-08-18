import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class CampaignPolicyRejectedError extends Error {
  readonly reason: CampaignPolicyReason;

  constructor(reason: CampaignPolicyReason) {
    super(`Campaign policy rejected: ${reason}`);
    this.name = 'CampaignPolicyRejectedError';
    this.reason = reason;
  }
}

export type CampaignPolicyReason =
  | 'emergency_stopped'
  | 'auto_gen_disabled'
  | 'paused'
  | 'daily_content_limit';

export interface CampaignPolicyDecision {
  allowed: boolean;
  reason: CampaignPolicyReason | null;
  remainingContentToday: number | null;
  remainingPublishToday: number | null;
  requireHuman: boolean;
}

/** Decision returned when no campaign is attached: nothing to enforce, human still required. */
export const UNSCOPED_POLICY_DECISION: CampaignPolicyDecision = {
  allowed: true,
  reason: null,
  remainingContentToday: null,
  remainingPublishToday: null,
  requireHuman: true,
};

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function resolveRequireHuman(approvalPolicy: unknown): boolean {
  if (approvalPolicy && typeof approvalPolicy === 'object' && !Array.isArray(approvalPolicy)) {
    const value = (approvalPolicy as Record<string, unknown>).requireHuman;
    if (typeof value === 'boolean') return value;
  }
  return true;
}

/**
 * Evaluates campaign kill-switches and daily quotas for n8n-originated work.
 * Returns null when the campaign does not exist so callers pick their own status code.
 */
export async function evaluateCampaignPolicy(
  campaignId: string,
  tx?: Prisma.TransactionClient
): Promise<CampaignPolicyDecision | null> {
  const db = tx ?? prisma;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      approvalPolicy: true,
      dailyContentLimit: true,
      dailyPublishLimit: true,
      paused: true,
      autoGenDisabled: true,
      emergencyStopped: true,
    },
  });

  if (!campaign) return null;

  const dayStart = startOfUtcDay();
  const [contentToday, publishedToday] = await Promise.all([
    db.content.count({
      where: { campaignId, origin: 'N8N', createdAt: { gte: dayStart } },
    }),
    db.content.count({
      where: { campaignId, status: 'PUBLISHED', publishedAt: { gte: dayStart } },
    }),
  ]);

  const shared = {
    remainingContentToday:
      campaign.dailyContentLimit != null
        ? Math.max(0, campaign.dailyContentLimit - contentToday)
        : null,
    remainingPublishToday:
      campaign.dailyPublishLimit != null
        ? Math.max(0, campaign.dailyPublishLimit - publishedToday)
        : null,
    requireHuman: resolveRequireHuman(campaign.approvalPolicy),
  };

  if (campaign.emergencyStopped) {
    return { allowed: false, reason: 'emergency_stopped', ...shared };
  }
  if (campaign.autoGenDisabled) {
    return { allowed: false, reason: 'auto_gen_disabled', ...shared };
  }
  if (campaign.paused) {
    return { allowed: false, reason: 'paused', ...shared };
  }
  if (campaign.dailyContentLimit != null && contentToday >= campaign.dailyContentLimit) {
    return {
      allowed: false,
      reason: 'daily_content_limit',
      ...shared,
      remainingContentToday: 0,
    };
  }

  return { allowed: true, reason: null, ...shared };
}
